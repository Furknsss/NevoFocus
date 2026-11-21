import React, { useEffect, useState } from 'react';
import { FileAudio2, Image as ImageIcon, Pause, Play, Volume2 } from 'lucide-react';
import {
  EXAM_AUDIO_EVENT, getExamAsset, isExamAudioPlaying, pauseExamAudio, prepareExamAudio,
  readExamPreferences, startExamAudio, storeExamAsset,
  updateExamPreferences, type ExamPreferences,
} from '../services/examExperience';

export function ExamMediaSettings() {
  const [prefs, setPrefs] = useState<ExamPreferences>(() => readExamPreferences());
  const [hasAudio, setHasAudio] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [playing, setPlaying] = useState(() => isExamAudioPlaying());
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const [audio, image] = await Promise.all([getExamAsset('examAudio'), getExamAsset('classroomImage')]);
      if (audio) void prepareExamAudio().catch(() => {});
      if (mounted) {
        setHasAudio(Boolean(audio));
        setHasImage(Boolean(image));
        setPlaying(isExamAudioPlaying());
        setPrefs(readExamPreferences());
      }
    }
    void refresh().catch(() => {});
    const onChange = () => { void refresh().catch(() => {}); };
    window.addEventListener(EXAM_AUDIO_EVENT, onChange);
    return () => { mounted = false; window.removeEventListener(EXAM_AUDIO_EVENT, onChange); };
  }, []);

  const changePrefs = (update: Partial<ExamPreferences>) => setPrefs(updateExamPreferences(update));
  const onFile = async (kind: 'examAudio' | 'classroomImage', file?: File) => {
    if (!file) return;
    setBusy(kind);
    setStatus(null);
    try {
      await storeExamAsset(kind, file);
      setStatus(kind === 'examAudio'
        ? 'Sınav sesi bu cihazda kaydedildi. İnternet gerekmez.'
        : 'Sınıf fotoğrafı kaydedildi. Odak ekranında kullanılacak.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Dosya kaydedilemedi.');
    } finally {
      setBusy(null);
    }
  };
  const previewAudio = async () => {
    setStatus(null);
    try {
      if (isExamAudioPlaying()) pauseExamAudio();
      else await startExamAudio();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ses açılamadı.');
    }
  };

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#191510] to-[#0a0a0a] p-4 space-y-4 text-white">
      <div>
        <p className="text-xs font-bold tracking-[.13em] text-amber-300 uppercase">ÖSYM Saat · Sınav Deneyimi</p>
        <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
          Analog saat her saniye gerçek saati gösterir. Sınıf fotoğrafı ve sınav sesini
          bir kez bu cihaza yükle; dosyalar Firebase'e veya GitHub'a gönderilmez.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-3 cursor-pointer">
          <span className="inline-flex gap-2 items-center text-xs font-semibold"><ImageIcon size={16} className="text-amber-300"/> Sınıf fotoğrafı</span>
          <span className="text-[11px] text-neutral-400">{hasImage ? 'Cihaza kaydedildi ✓ · Değiştirmek için seç' : 'JPG / PNG / WEBP seç'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} className="text-[11px] w-full file:rounded-lg file:border-0 file:bg-amber-900/50 file:text-amber-100 file:px-2 file:py-2" onChange={e => {
            void onFile('classroomImage', e.target.files?.[0]); e.target.value = '';
          }}/>
        </label>
        <label className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-3 cursor-pointer">
          <span className="inline-flex gap-2 items-center text-xs font-semibold"><FileAudio2 size={16} className="text-amber-300"/> Gerçek sınav sesi</span>
          <span className="text-[11px] text-neutral-400">{hasAudio ? 'Ses kaydedildi ✓ · Değiştirmek için seç' : 'MP3 / OGG / OPUS · 165 dk desteklenir'}</span>
          <input type="file" accept="audio/*,.ogg,.opus,.mp3,.webm" disabled={Boolean(busy)} className="text-[11px] w-full file:rounded-lg file:border-0 file:bg-amber-900/50 file:text-amber-100 file:px-2 file:py-2" onChange={e => {
            void onFile('examAudio', e.target.files?.[0]); e.target.value = '';
          }}/>
        </label>
      </div>
      <div className="space-y-2">
        <label htmlFor="exam-ambient-volume" className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-2"><Volume2 size={15}/> Ortam sesi seviyesi</span>
          <span className="tabular-nums">{Math.round(prefs.volume*100)}%</span>
        </label>
        <input id="exam-ambient-volume" type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={e=>changePrefs({volume:Number(e.target.value)})} className="w-full accent-amber-400" />
        <button type="button" onClick={()=>void previewAudio()} disabled={!hasAudio || Boolean(busy)} className="rounded-lg border border-white/15 px-3 py-2 bg-white/5 text-xs font-semibold disabled:opacity-40 inline-flex gap-2 items-center">
          {playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Sesi Duraklat' : 'Sesi Dene'}
        </button>
      </div>
      <label className="flex items-center gap-3 text-xs text-neutral-200 cursor-pointer">
        <input type="checkbox" checked={prefs.pauseOnBreak} onChange={e=>changePrefs({pauseOnBreak:e.target.checked})} className="accent-amber-500"/>
        Mola veya durdurma sırasında ortam sesini beklet
      </label>
      <label className="flex items-center gap-3 text-xs text-neutral-200 cursor-pointer">
        <input type="checkbox" checked={prefs.showCountdown} onChange={e=>changePrefs({showCountdown:e.target.checked})} className="accent-amber-500"/>
        Analog saatin altında küçük dijital sayaç da göster
      </label>
      {busy && <p role="status" className="text-amber-300 text-xs">Dosya cihazına kaydediliyor…</p>}
      {status && <p role="status" className="rounded-lg bg-white/5 p-2 text-xs text-amber-100">{status}</p>}
      <p className="text-[11px] leading-relaxed text-neutral-500">
        Büyük ses dosyası için sıkıştırılmış OGG sürümünü seçmek depolama açısından daha verimlidir.
        Tarayıcı verilerini temizlersen yerel kayıtlar silinebilir.
      </p>
    </section>
  );
}
