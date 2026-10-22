// Background Focus Persistence, Live Notification & Lock-Screen MediaSession Engine

const DEVICE_ID_KEY = 'fokus_device_id_v1';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_fallback';
  }
}

export function getDeviceName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Cihaz';
  const ua = navigator.userAgent.toLowerCase();
  const isIPad = /ipad/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIPad) return 'iPad / Tablet';
  if (/iphone|ipod/.test(ua)) return 'iPhone';
  if (/android/.test(ua)) {
    if (!/mobile/.test(ua)) return 'Android Tablet';
    return 'Android Telefon';
  }
  if (/tablet|playbook|silk/.test(ua)) return 'Tablet';
  if (/mobile/.test(ua)) return 'Telefon';
  return 'Bilgisayar (PC)';
}

export interface LiveNotificationPayload {
  mode: string;
  modeLabel: string;
  subjectName: string;
  taskTitle?: string;
  timerType: 'countdown' | 'stopwatch';
  plannedMinutes: number;
  anchorTimestamp: number;
  accumulatedFocusSeconds: number;
  breakAnchorTimestamp: number;
  accumulatedBreakSeconds: number;
  isPaused: boolean;
  isCampActive: boolean;
  forceShow?: boolean;
}

export function formatTimerDisplay(totalSecs: number): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildProgressBar(percent: number): string {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const totalBlocks = 10;
  const filled = Math.round((clamped / 100) * totalBlocks);
  return `${'▓'.repeat(filled)}${'░'.repeat(Math.max(0, totalBlocks - filled))} %${clamped}`;
}

// 1-second silent WAV (8kHz mono PCM) data URI to keep mobile browser & MediaSession alive in background
const SILENT_WAV_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class BackgroundFocusManager {
  private silentAudio: HTMLAudioElement | null = null;
  private isKeepAliveRunning = false;
  private onTogglePauseCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FOKUS_NOTIFICATION_ACTION') {
          if (event.data.action === 'toggle_pause' && this.onTogglePauseCallback) {
            this.onTogglePauseCallback();
          }
        }
      });
    }
  }

  public setPauseHandler(handler: (() => void) | null) {
    this.onTogglePauseCallback = handler;
  }

  public startKeepAlive() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.silentAudio) {
        this.silentAudio = new Audio(SILENT_WAV_URI);
        this.silentAudio.loop = true;
        this.silentAudio.volume = 0.01;
      }
      if (!this.isKeepAliveRunning) {
        this.silentAudio.play().then(() => {
          this.isKeepAliveRunning = true;
        }).catch(() => {
          // Will retry on next user gesture
        });
      }
    } catch {
      // ignore
    }
  }

  public stopKeepAlive() {
    try {
      if (this.silentAudio) {
        this.silentAudio.pause();
        this.silentAudio.currentTime = 0;
      }
      this.isKeepAliveRunning = false;
    } catch {
      // ignore
    }
  }

  public updateMediaSession(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const now = Date.now();
      const elapsedFocus = payload.isPaused || payload.isCampActive
        ? payload.accumulatedFocusSeconds
        : payload.accumulatedFocusSeconds + Math.max(0, Math.floor((now - payload.anchorTimestamp) / 1000));

      const elapsedBreak = !payload.isCampActive || payload.isPaused
        ? payload.accumulatedBreakSeconds
        : payload.accumulatedBreakSeconds + Math.max(0, Math.floor((now - payload.breakAnchorTimestamp) / 1000));

      const totalPlannedSecs = Math.max(60, payload.plannedMinutes * 60);
      const remainingSecs = Math.max(0, totalPlannedSecs - elapsedFocus);
      const progressPct = Math.min(100, Math.round((elapsedFocus / totalPlannedSecs) * 100));

      let title = '';
      if (payload.isCampActive) {
        title = `☕ Mola: ${formatTimerDisplay(elapsedBreak)} · ${payload.subjectName}`;
      } else if (payload.isPaused) {
        const displayTime = payload.timerType === 'stopwatch'
          ? formatTimerDisplay(elapsedFocus)
          : formatTimerDisplay(remainingSecs);
        title = `⏸️ Duraklatıldı (${displayTime}) · ${payload.subjectName}`;
      } else if (payload.timerType === 'stopwatch') {
        title = `⏱️ ${formatTimerDisplay(elapsedFocus)} · ${payload.subjectName}`;
      } else {
        title = `⏳ ${formatTimerDisplay(remainingSecs)} Kaldı · ${payload.subjectName} (%${progressPct})`;
      }

      const artist = `Fokus Premium · ${payload.modeLabel}${payload.taskTitle ? ` · ${payload.taskTitle}` : ''}`;
      const album = payload.timerType === 'stopwatch'
        ? 'Canlı Kronometre Arka Planda Çalışıyor'
        : `Hedef: ${payload.plannedMinutes} dk · ${buildProgressBar(progressPct)}`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = payload.isPaused ? 'paused' : 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        if (payload.isPaused && this.onTogglePauseCallback) {
          this.onTogglePauseCallback();
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!payload.isPaused && this.onTogglePauseCallback) {
          this.onTogglePauseCallback();
        }
      });
    } catch {
      // ignore
    }
  }

  public clearMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // ignore
    }
  }

  public async syncLiveNotification(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined') return;

    // Always update MediaSession for lock screen / control center
    this.updateMediaSession(payload);

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Forward state to Service Worker so it can maintain the sticky notification in background
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.active) {
          reg.active.postMessage({
            type: 'SYNC_FOCUS_TIMER',
            payload: {
              ...payload,
              isHidden: document.hidden || Boolean(payload.forceShow),
            },
          });
        }
      } catch {
        // ignore
      }
    }

    // If tab is currently in background (or forceShow requested), also trigger showNotification directly
    if (document.hidden || payload.forceShow) {
      await this.showStickyNotificationNow(payload);
    }
  }

  public async showStickyNotificationNow(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const now = Date.now();
    const elapsedFocus = payload.isPaused || payload.isCampActive
      ? payload.accumulatedFocusSeconds
      : payload.accumulatedFocusSeconds + Math.max(0, Math.floor((now - payload.anchorTimestamp) / 1000));

    const elapsedBreak = !payload.isCampActive || payload.isPaused
      ? payload.accumulatedBreakSeconds
      : payload.accumulatedBreakSeconds + Math.max(0, Math.floor((now - payload.breakAnchorTimestamp) / 1000));

    const totalPlannedSecs = Math.max(60, payload.plannedMinutes * 60);
    const remainingSecs = Math.max(0, totalPlannedSecs - elapsedFocus);
    const progressPct = Math.min(100, Math.round((elapsedFocus / totalPlannedSecs) * 100));

    let title = '';
    let body = '';

    if (payload.isCampActive) {
      title = `☕ Mola (${formatTimerDisplay(elapsedBreak)}) · ${payload.subjectName}`;
      body = `${payload.modeLabel} · Net Çalışma: ${formatTimerDisplay(elapsedFocus)} · Dönmek için dokunun`;
    } else if (payload.isPaused) {
      const displayTime = payload.timerType === 'stopwatch'
        ? formatTimerDisplay(elapsedFocus)
        : formatTimerDisplay(remainingSecs);
      title = `⏸️ Duraklatıldı (${displayTime}) · ${payload.subjectName}`;
      body = `${payload.modeLabel}${payload.taskTitle ? ` · ${payload.taskTitle}` : ''} · Devam etmek için dokunun`;
    } else if (payload.timerType === 'stopwatch') {
      title = `⏱️ ${formatTimerDisplay(elapsedFocus)} · ${payload.subjectName}`;
      body = `Canlı Kronometre Aktif · ${payload.modeLabel}${payload.taskTitle ? ` · ${payload.taskTitle}` : ''}`;
    } else {
      title = `⏳ ${formatTimerDisplay(remainingSecs)} Kaldı · ${payload.subjectName}`;
      body = `${buildProgressBar(progressPct)} · ${payload.modeLabel}${payload.taskTitle ? ` · ${payload.taskTitle}` : ''}`;
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'fokus-active-timer',
            renotify: false,
            silent: true,
            requireInteraction: true,
            data: { url: '/' },
            actions: [
              {
                action: 'open_app',
                title: '🔥 Odak Ekranını Aç',
              },
              {
                action: 'toggle_pause',
                title: payload.isPaused ? '▶️ Devam Et' : '⏸️ Duraklat',
              },
            ],
          } as NotificationOptions);
          return;
        }
      }

      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        tag: 'fokus-active-timer',
        silent: true,
      });
    } catch {
      // ignore
    }
  }

  public async stopAll() {
    this.stopKeepAlive();
    this.clearMediaSession();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.active) {
          reg.active.postMessage({ type: 'STOP_FOCUS_TIMER' });
        }
        const notifications = await reg.getNotifications({ tag: 'fokus-active-timer' });
        notifications.forEach((n) => n.close());
      } catch {
        // ignore
      }
    }
  }
}

export const backgroundFocus = new BackgroundFocusManager();
