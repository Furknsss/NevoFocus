/**
 * Personal exam simulation assets live ONLY on the current device.
 * Do not upload copyrighted audio/images to public GitHub, Firebase, or cloud backups.
 */
export type ExamAssetKind = 'examAudio' | 'classroomImage';
export interface ExamPreferences {
  volume: number;
  pauseOnBreak: boolean;
  showCountdown: boolean;
}
const DB_NAME = 'nevofocus_exam_media_v1';
const PREF_KEY = 'nevofocus_exam_preferences_v1';
const STORE_NAME = 'assets';
export const EXAM_AUDIO_EVENT = 'nevofocus:exam-audio-changed';
export const DEFAULT_EXAM_PREFERENCES: ExamPreferences = {
  volume: 0.65,
  pauseOnBreak: true,
  showCountdown: false,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Bu cihazda yerel medya depolama desteklenmiyor.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Yerel medya deposu açılamadı.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: Error) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let settled = false;
    const success = (value: T) => {
      if (!settled) { settled = true; resolve(value); }
    };
    const failure = (error: Error) => {
      if (!settled) { settled = true; reject(error); }
    };
    transaction.onerror = () => failure(transaction.error || new Error('Yerel kayıt başarısız.'));
    transaction.onabort = () => failure(transaction.error || new Error('Kaydetme işlemi iptal edildi.'));
    transaction.oncomplete = () => db.close();
    work(store, success, failure);
  });
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EXAM_AUDIO_EVENT));
}

export async function getExamAsset(kind: ExamAssetKind): Promise<Blob | null> {
  return withStore('readonly', (store, resolve, reject) => {
    const request = store.get(kind);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error || new Error('Dosya okunamadı.'));
  });
}

export async function storeExamAsset(kind: ExamAssetKind, file: File): Promise<void> {
  if (kind === 'examAudio' && !(/^audio\//.test(file.type) || /\.(mp3|ogg|opus|m4a|wav|webm)$/i.test(file.name))) {
    throw new Error('MP3, OGG, OPUS, M4A, WAV veya WEBM ses dosyası seç.');
  }
  if (kind === 'classroomImage' && !(/^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name))) {
    throw new Error('PNG, JPG veya WEBP görseli seç.');
  }
  // Large files can exceed browser quota. Prefer the optional compact 165-min OGG.
  if (file.size > 300 * 1024 * 1024) throw new Error('Dosya çok büyük. 300 MB altındaki sürümü kullan.');
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(file, kind);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Cihazın saklama alanı dolu olabilir.'));
  });
  if (kind === 'examAudio') {
    stopExamAudio();
    void prepareExamAudio().catch(() => {});
  }
  notify();
}

export async function removeExamAsset(kind: ExamAssetKind): Promise<void> {
  if (kind === 'examAudio') stopExamAudio();
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(kind);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Dosya silinemedi.'));
  });
  notify();
}

export function readExamPreferences(): ExamPreferences {
  try {
    const data = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    const v = Number(data.volume);
    return {
      volume: Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_EXAM_PREFERENCES.volume,
      pauseOnBreak: data.pauseOnBreak !== false,
      showCountdown: data.showCountdown === true,
    };
  } catch {
    return { ...DEFAULT_EXAM_PREFERENCES };
  }
}

export function updateExamPreferences(update: Partial<ExamPreferences>): ExamPreferences {
  const next = { ...readExamPreferences(), ...update };
  next.volume = Math.max(0, Math.min(1, Number(next.volume) || 0));
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch {}
  if (audioElement) audioElement.volume = next.volume;
  notify();
  return next;
}

let audioElement: HTMLAudioElement | null = null;
let ownedUrl: string | null = null;
let pendingStart: Promise<boolean> | null = null;

export function isExamAudioPlaying(): boolean {
  return Boolean(audioElement && !audioElement.paused);
}

/**
 * Prepare the Blob while the mode/settings UI is mounted, before the user
 * taps Sesi Aç. Calling play() only after an IndexedDB await can lose
 * Android WebView's transient user gesture and trigger NotAllowedError.
 */
export async function prepareExamAudio(): Promise<boolean> {
  if (audioElement) return true;
  const media = await getExamAsset('examAudio');
  if (!media) return false;
  ownedUrl = URL.createObjectURL(media);
  audioElement = new Audio(ownedUrl);
  audioElement.loop = true;
  audioElement.preload = 'metadata';
  audioElement.volume = readExamPreferences().volume;
  audioElement.addEventListener('pause', notify);
  audioElement.addEventListener('play', notify);
  audioElement.addEventListener('ended', notify);
  return true;
}

export async function startExamAudio(): Promise<boolean> {
  if (pendingStart) return pendingStart;
  // In the usual case the player was preloaded on mount; play() is called
  // synchronously inside the user's click handler.
  if (audioElement) {
    audioElement.volume = readExamPreferences().volume;
    await audioElement.play();
    notify();
    return true;
  }
  pendingStart = (async () => {
    if (!(await prepareExamAudio()) || !audioElement)
      throw new Error('Önce sınav sesi dosyasını bu cihaza yükle.');
    try {
      await audioElement.play();
    } catch {
      throw new Error('Cihaz otomatik ses açmayı engelledi. Sesi Aç düğmesine tekrar dokun.');
    }
    notify();
    return true;
  })();
  try { return await pendingStart; }
  finally { pendingStart = null; }
}

export function pauseExamAudio(): void {
  audioElement?.pause();
  notify();
}

export function resumeExamAudioIfLoaded(): void {
  if (!audioElement) return;
  void audioElement.play().catch(() => {});
}

export function stopExamAudio(): void {
  if (audioElement) {
    audioElement.pause();
    audioElement.removeAttribute('src');
    audioElement.load();
    audioElement = null;
  }
  if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  ownedUrl = null;
  notify();
}
