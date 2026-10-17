import React, { useState, useEffect } from 'react';
import {
  Trees,
  Mountain,
  Plane,
  Waves,
  Pause,
  Play,
  Bell,
  Maximize2,
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { FocusModeType, SubjectItem } from '../types';
import { soundEngine } from '../utils/audio';

export interface ActiveFocusData {
  mode: FocusModeType;
  subject: SubjectItem;
  plannedMinutes: number;
  startedAt: number;
  elapsedSeconds: number;
  isPaused: boolean;
  isCampActive?: boolean;
  breakSeconds?: number;
  timerType: 'countdown' | 'stopwatch';
  selectedTreeSpecies?: string;
  originAirport?: any;
  destAirport?: any;
  selectedTaskId?: string;
  selectedTaskTitle?: string;
}

interface FloatingMiniFocusPillProps {
  session: ActiveFocusData;
  onMaximize: () => void;
  onTogglePause: () => void;
  onToggleAudio: () => void;
  isAudioPlaying?: boolean;
  onComplete: () => void;
  isMobile?: boolean;
}

export const FloatingMiniFocusPill: React.FC<FloatingMiniFocusPillProps> = ({
  session,
  onMaximize,
  onTogglePause,
  onToggleAudio,
  isAudioPlaying = false,
  onComplete,
  isMobile = false,
}) => {
  // Real-time ticking counter inside the floating pill
  const [seconds, setSeconds] = useState<number>(session.elapsedSeconds);

  useEffect(() => {
    setSeconds(session.elapsedSeconds);
  }, [session.elapsedSeconds]);

  useEffect(() => {
    if (session.isPaused) return;

    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session.isPaused]);

  const totalPlannedSecs = session.plannedMinutes * 60;
  const isCountdown = session.timerType === 'countdown';
  const displayRemaining = Math.max(0, totalPlannedSecs - seconds);

  const displaySecs = isCountdown ? displayRemaining : seconds;
  const mins = Math.floor(displaySecs / 60);
  const secs = displaySecs % 60;
  const timeString = `${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;

  const getModeIcon = () => {
    switch (session.mode) {
      case 'forest':
        return <Trees className="w-5 h-5 text-emerald-400" />;
      case 'climb':
        return <Mountain className="w-5 h-5 text-orange-400" />;
      case 'flight':
        return <Plane className="w-5 h-5 text-sky-400" />;
      case 'dive':
        return <Waves className="w-5 h-5 text-teal-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <aside
      aria-label="Aktif Odaklanma Çubuğu"
      className={`fixed z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
        isMobile
          ? 'bottom-[4.5rem] left-3 right-3'
          : 'bottom-6 right-6 max-w-md w-auto'
      }`}
    >
      <div className="bg-[#0b101d]/95 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl p-2.5 sm:p-3 shadow-[0_10px_40px_rgba(0,0,0,0.85)] ring-1 ring-white/10 flex items-center justify-between gap-3">
        {/* Left: Mode Icon & Subject / Live Stopwatch */}
        <button
          type="button"
          onClick={onMaximize}
          className="flex items-center gap-3 text-left min-w-0 cursor-pointer group focus:outline-none"
        >
          {/* Mode Icon in glowing rounded container */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-cyan-950 to-indigo-950 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-md shadow-cyan-950/40 group-hover:scale-105 transition-transform">
            {getModeIcon()}
          </div>

          {/* Texts */}
          <div className="min-w-0">
            <h5 className="text-[10px] sm:text-[11px] font-black tracking-wider text-cyan-400 uppercase truncate">
              {session.subject?.name || 'SERBEST ÇALIŞMA'}
            </h5>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg sm:text-xl font-black text-white tracking-tight">
                {timeString}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium truncate hidden sm:inline">
                {session.isCampActive
                  ? 'Mola Verildi'
                  : isCountdown
                  ? `${session.plannedMinutes} Dk Hedef`
                  : 'Limitsiz Kronometre'}
              </span>
            </div>
          </div>
        </button>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-white/15 mx-0.5 shrink-0" />

        {/* Right Actions: Pause, Audio, Complete, Maximize (Matches Uploaded Screenshot) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 1. Pause / Resume (Yellow outline) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onTogglePause();
            }}
            className="w-9 h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title={session.isPaused ? 'Devam Et' : 'Duraklat'}
            aria-label={session.isPaused ? 'Devam Et' : 'Duraklat'}
          >
            {session.isPaused ? (
              <Play className="w-4 h-4 fill-amber-300 text-amber-300" />
            ) : (
              <Pause className="w-4 h-4 fill-amber-300 text-amber-300" />
            )}
          </button>

          {/* 2. Zen Audio / Bell (Amber outline) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleAudio();
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
              isAudioPlaying
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'border-amber-700/30 bg-amber-900/10 hover:bg-amber-900/20 text-amber-400'
            }`}
            title="Zen Ortam Sesi"
            aria-label="Zen Ortam Sesi"
          >
            {isAudioPlaying ? <Volume2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {/* 3. Finish / Check (Cyan outline) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onComplete();
            }}
            className="w-9 h-9 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="Oturumu Tamamla"
            aria-label="Oturumu Tamamla"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>

          {/* 4. Fullscreen / Maximize (Purple/Blue filled button) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onMaximize();
            }}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            title="Tam Ekrana Büyüt"
            aria-label="Tam Ekrana Büyüt"
          >
            <Maximize2 className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
