import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coffee, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import {
  EXAM_AUDIO_EVENT,
  getExamAsset,
  isExamAudioPlaying,
  pauseExamAudio,
  prepareExamAudio,
  readExamPreferences,
  resumeExamAudioIfLoaded,
  startExamAudio,
  stopExamAudio,
} from '../services/examExperience';

interface ExamClockCanvasProps {
  elapsedSeconds: number;
  remainingSeconds: number;
  timerType: 'stopwatch' | 'countdown';
  isPaused: boolean;
  isBreakActive: boolean;
  onTogglePause: () => void;
  onTakeBreak: () => void;
  onFinish: () => void;
  onAbandon: () => void;
  onOpenAudio: () => void;
}

const hhmmss = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60]
    .map(x => String(x).padStart(2, '0')).join(':');
};

/** Live wall clock, not a picture with frozen hands. Correct even after tab sleep. */
function WallClock({ now }: { now: Date }) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const s = seconds * 6;
  const m = (minutes + seconds / 60) * 6;
  const h = (hours + minutes / 60) * 30;
  const marks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  return (
    <svg viewBox="0 0 320 320" role="img" aria-label={`ÖSYM tipi analog duvar saati, saat ${now.toLocaleTimeString('tr-TR')}`} className="block w-full h-full drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
      <defs>
        <radialGradient id="examClockFace"><stop offset="0" stopColor="#ffffff"/><stop offset=".9" stopColor="#f5f5ec"/><stop offset="1" stopColor="#e0e4e4"/></radialGradient>
        <linearGradient id="examClockRim" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a3aaad"/><stop offset=".3" stopColor="#f0f3f4"/><stop offset=".7" stopColor="#6f797c"/><stop offset="1" stopColor="#d9dddd"/></linearGradient>
      </defs>
      <circle cx="160" cy="160" r="156" fill="url(#examClockRim)" stroke="#272f33" strokeWidth="2"/>
      <circle cx="160" cy="160" r="145" fill="#fbfbf6" stroke="#92999c" strokeWidth="3"/>
      <circle cx="160" cy="160" r="139" fill="url(#examClockFace)" stroke="#b9c1c1" strokeWidth="1.5"/>
      {marks.map(i => {
        const a = i * Math.PI / 30 - Math.PI / 2;
        const major = i % 5 === 0;
        const x1 = 160 + Math.cos(a) * (major ? 122 : 130);
        const y1 = 160 + Math.sin(a) * (major ? 122 : 130);
        const x2 = 160 + Math.cos(a) * 137;
        const y2 = 160 + Math.sin(a) * 137;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#31383b" strokeWidth={major ? 2.3 : 1.1}/>;
      })}
      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
        const a = n * Math.PI / 6 - Math.PI / 2;
        const x = 160 + Math.cos(a) * 107;
        const y = 160 + Math.sin(a) * 107;
        return <text key={n} x={x} y={y+9} textAnchor="middle" fontSize="30" fontFamily="Arial, sans-serif" fontWeight="600" fill="#2b3336">{n}</text>;
      })}
      <circle cx="159" cy="123" r="13" fill="#ffbd34"/>
      <text x="175" y="130" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="600" fill="#3c464b">ÖSYM</text>
      <g transform={`rotate(${h} 160 160)`}>
        <line x1="160" y1="180" x2="160" y2="87" stroke="#20292d" strokeWidth="8" strokeLinecap="round"/>
      </g>
      <g transform={`rotate(${m} 160 160)`}>
        <line x1="160" y1="183" x2="160" y2="53" stroke="#283438" strokeWidth="5.5" strokeLinecap="round"/>
      </g>
      <g transform={`rotate(${s} 160 160)`}>
        <line x1="160" y1="198" x2="160" y2="58" stroke="#d04435" strokeWidth="2.3" strokeLinecap="round"/>
        <circle cx="160" cy="202" r="4" stroke="#d04435" strokeWidth="1.8" fill="none"/>
      </g>
      <circle cx="160" cy="160" r="7.5" fill="#262f32" stroke="#b8bfc2" strokeWidth="2"/>
      <circle cx="160" cy="160" r="2.3" fill="#e5e5dc"/>
    </svg>
  );
}

export const ExamClockCanvas: React.FC<ExamClockCanvasProps> = ({
  elapsedSeconds, remainingSeconds, timerType, isPaused, isBreakActive,
  onTogglePause, onTakeBreak, onFinish, onAbandon, onOpenAudio,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [classroomUrl, setClassroomUrl] = useState<string | null>(null);
  const [audioActive, setAudioActive] = useState(() => isExamAudioPlaying());
  const [audioRequested, setAudioRequested] = useState(() => isExamAudioPlaying());
  const [audioError, setAudioError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(() => readExamPreferences());
  const [mediaRevision, setMediaRevision] = useState(0);
  const shouldPauseAudio = prefs.pauseOnBreak && (isBreakActive || isPaused);

  useEffect(() => { void prepareExamAudio().catch(() => {}); }, []);

  useEffect(() => {
    const onTick = () => setNow(new Date());
    const id = window.setInterval(onTick, 1000);
    document.addEventListener('visibilitychange', onTick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onTick); };
  }, []);

  useEffect(() => {
    const onChange = () => {
      setPrefs(readExamPreferences());
      setAudioActive(isExamAudioPlaying());
      setMediaRevision(v => v + 1);
    };
    window.addEventListener(EXAM_AUDIO_EVENT, onChange);
    return () => window.removeEventListener(EXAM_AUDIO_EVENT, onChange);
  }, []);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    void getExamAsset('classroomImage').then(blob => {
      if (!active || !blob) return;
      localUrl = URL.createObjectURL(blob);
      setClassroomUrl(localUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
      setClassroomUrl(null);
    };
  }, [mediaRevision]);

  useEffect(() => {
    if (!audioRequested) return;
    if (shouldPauseAudio) pauseExamAudio();
    else resumeExamAudioIfLoaded();
  }, [shouldPauseAudio, audioRequested]);

  // We intentionally do NOT stop playback on unmount: minimizing the focus
  // screen must not interrupt an ongoing session. End/abandon stops it.
  const toggleAudio = useCallback(async () => {
    if (audioRequested) {
      setAudioRequested(false);
      pauseExamAudio();
      return;
    }
    setAudioError(null);
    try {
      const started = await startExamAudio();
      if (started) {
        setAudioRequested(true);
        if (shouldPauseAudio) pauseExamAudio();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ses oynatılamıyor.';
      setAudioError(message);
    }
  }, [audioRequested, shouldPauseAudio]);

  const displayRemaining = timerType === 'countdown'
    ? Math.max(0, Math.ceil(remainingSeconds))
    : Math.max(0, Math.floor(elapsedSeconds));

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#b6b2a5] select-none">
      {classroomUrl ? (
        <div className="absolute inset-0">
          <img src={classroomUrl} alt="" draggable={false} className="w-full h-full object-cover object-center" style={{ filter: 'blur(2px) brightness(.72)' }}/>
        </div>
      ) : (
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[linear-gradient(165deg,#e0ceaa,#bebbaa_56%,#7f898a)]"/>
          <div className="absolute left-[7%] right-[7%] top-[24%] h-[42%] bg-[#1d5f54] rounded-[3px] border-[10px] border-[#9d988a] shadow-[0_10px_30px_rgba(15,20,22,.22)]"/>
          <div className="absolute left-[33%] right-[28%] top-[24%] h-[42%] bg-[#dedbcf] border-[8px] border-[#a5aca5]"/>
          <div className="absolute left-[12%] right-[12%] bottom-[-7%] h-[19%] bg-[#76624c]/70 rounded-[80%_80%_0_0] blur-md"/>
        </div>
      )}
      <div className="absolute inset-0 bg-black/[.22]"/>
      <div className="absolute top-0 inset-x-0 h-[25%] bg-gradient-to-b from-black/30 to-transparent"/>
      <div className="absolute bottom-0 inset-x-0 h-[40%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"/>
      {/* The clock is always prominent and sharp regardless of image blur or zoom. */}
      <div className="absolute inset-x-0 top-[13%] sm:top-[13%] flex flex-col items-center gap-3 pointer-events-none">
        <div className="w-[clamp(190px,31vmin,365px)] aspect-square rounded-full">
          <WallClock now={now}/>
        </div>
        <div className="text-center text-white font-semibold text-xs sm:text-sm tracking-[.13em] px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/20">
          {isBreakActive ? 'MOLA' : isPaused ? 'SINAV DURDURULDU' : 'SINAV ORTAMI'}
        </div>
        {prefs.showCountdown && <span className="font-mono tabular-nums text-white text-base sm:text-lg bg-black/50 px-3 py-1 rounded-lg">{timerType === 'countdown' ? 'Kalan ' : 'Geçen '}{hhmmss(displayRemaining)}</span>}
      </div>
      <div className="absolute left-3 sm:left-7 bottom-[max(6rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-2">
        <button onClick={() => void toggleAudio()} type="button"
          className="flex items-center gap-2 rounded-full border border-white/25 bg-black/75 px-3 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur"
          aria-label={audioRequested ? 'Sınav sesini kapat' : 'Sınav sesini aç'}>
          {audioRequested ? <Volume2 className="w-4 h-4"/> : <VolumeX className="w-4 h-4"/>}
          Sınav Sesi {audioRequested ? (audioActive ? 'Açık' : 'Bekliyor') : 'Kapalı'}
        </button>
        <button type="button" onClick={onOpenAudio} className="text-white/80 underline text-xs py-2">Ses ayarı</button>
      </div>
      {audioError && <div role="alert" className="absolute bottom-[9rem] left-3 right-3 z-30 text-xs bg-red-950/90 text-red-100 p-3 rounded-xl">{audioError} <button className="underline ml-2" onClick={onOpenAudio}>Dosya seç</button></div>}
      <div className="absolute inset-x-0 bottom-0 z-20 px-3 sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <button type="button" onClick={onTakeBreak} className="rounded-full bg-amber-950/90 text-amber-100 border border-amber-400/50 px-4 py-3 text-xs sm:text-sm font-semibold inline-flex items-center gap-2"><Coffee size={16}/>{isBreakActive ? 'Molayı Bitir' : 'Mola'}</button>
        <button type="button" onClick={onTogglePause} className="rounded-full bg-black/80 border border-white/25 px-4 py-3 text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2">{isPaused ? <Play size={16}/> : <Pause size={16}/>} {isPaused ? 'Devam' : 'Durdur'}</button>
        <button type="button" onClick={() => { stopExamAudio(); onFinish(); }} className="rounded-full bg-emerald-800/95 text-white border border-emerald-400/50 px-4 py-3 text-xs sm:text-sm font-semibold inline-flex items-center gap-2"><CheckCircle2 size={16}/>Seansı Bitir</button>
        <button type="button" onClick={onAbandon} className="rounded-full bg-black/70 text-neutral-200 border border-white/20 px-3 py-3 text-xs sm:text-sm inline-flex items-center gap-2"><RotateCcw size={15}/>Vazgeç</button>
      </div>
    </div>
  );
};
