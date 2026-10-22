import React, { useState, useEffect, useCallback } from 'react';
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
  Sparkles,
  Clock,
  X,
  Smartphone,
  Laptop,
  Radio,
} from 'lucide-react';
import { FocusModeType, SubjectItem } from '../types';
import { soundEngine } from '../utils/audio';
import { formatTimerDisplay } from '../utils/backgroundFocus';

export interface ActiveFocusData {
  mode: FocusModeType;
  subject: SubjectItem;
  plannedMinutes: number;
  startedAt: number;
  elapsedSeconds: number;
  anchorTimestamp?: number | null;
  accumulatedFocusSeconds?: number;
  breakAnchorTimestamp?: number | null;
  accumulatedBreakSeconds?: number;
  isPaused: boolean;
  isCampActive?: boolean;
  breakSeconds?: number;
  timerType: 'countdown' | 'stopwatch';
  selectedTreeSpecies?: string;
  originAirport?: any;
  destAirport?: any;
  selectedTaskId?: string;
  selectedTaskTitle?: string;
  deviceId?: string;
  deviceName?: string;
  isRemoteDevice?: boolean;
}

interface FloatingMiniFocusPillProps {
  session: ActiveFocusData;
  onMaximize: () => void;
  onTogglePause: () => void;
  onToggleAudio: () => void;
  isAudioPlaying?: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
  isMobile?: boolean;
}

export const FloatingMiniFocusPill: React.FC<FloatingMiniFocusPillProps> = ({
  session,
  onMaximize,
  onTogglePause,
  onToggleAudio,
  isAudioPlaying = false,
  onComplete,
  onDismiss,
  isMobile = false,
}) => {
  const computeLiveFocusSeconds = useCallback(() => {
    if (session.isPaused || session.isCampActive) {
      return session.accumulatedFocusSeconds ?? session.elapsedSeconds ?? 0;
    }
    if (session.anchorTimestamp && session.anchorTimestamp > 0) {
      const delta = Math.max(0, Math.floor((Date.now() - session.anchorTimestamp) / 1000));
      return (session.accumulatedFocusSeconds ?? 0) + delta;
    }
    return session.elapsedSeconds ?? 0;
  }, [
    session.isPaused,
    session.isCampActive,
    session.anchorTimestamp,
    session.accumulatedFocusSeconds,
    session.elapsedSeconds,
  ]);

  const [seconds, setSeconds] = useState<number>(() => computeLiveFocusSeconds());

  useEffect(() => {
    setSeconds(computeLiveFocusSeconds());
    const interval = window.setInterval(() => {
      setSeconds(computeLiveFocusSeconds());
    }, 500);

    return () => window.clearInterval(interval);
  }, [computeLiveFocusSeconds]);

  const totalPlannedSecs = session.plannedMinutes * 60;
  const isCountdown = session.timerType === 'countdown';
  const displayRemaining = Math.max(0, totalPlannedSecs - seconds);
  const displaySecs = isCountdown ? displayRemaining : seconds;
  const timeString = formatTimerDisplay(displaySecs);

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
      case 'clock':
        return <Clock className="w-5 h-5 text-white" />;
      default:
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getModeTitle = () => {
    switch (session.mode) {
      case 'forest':
        return 'Kadim Orman';
      case 'climb':
        return 'Dağcı Kampı';
      case 'flight':
        return 'Focus Flight';
      case 'dive':
        return 'Derin Dalış';
      case 'clock':
        return 'Dijital Saat';
      default:
        return 'Odak Modu';
    }
  };

  return (
    <aside
      aria-label="Aktif Odaklanma Bildirimi"
      className={`fixed z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
        isMobile
          ? 'bottom-[4.8rem] left-3 right-3'
          : 'bottom-6 right-6 max-w-md w-[410px]'
      }`}
    >
      <div className="bg-[#0b101d]/95 backdrop-blur-2xl border border-[#ff5500]/40 rounded-2xl p-3 sm:p-3.5 shadow-[0_14px_45px_rgba(0,0,0,0.9)] ring-1 ring-white/10 flex flex-col gap-2.5">
        {/* Top Live Synchronization Status Bar */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-extrabold text-emerald-400 tracking-wide truncate">
              {session.isRemoteDevice
                ? 'Aktif Focus Başka Bir Cihazda Devam Etmekte'
                : 'Aktif Focus Arka Planda Devam Ediyor'}
            </span>
          </div>

          {session.deviceName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-neutral-300 shrink-0">
              {session.deviceName.toLowerCase().includes('pc') || session.deviceName.toLowerCase().includes('bilgisayar') ? (
                <Laptop className="w-3 h-3 text-sky-400" />
              ) : (
                <Smartphone className="w-3 h-3 text-[#ff5500]" />
              )}
              <span>{session.deviceName}</span>
            </span>
          )}
        </div>

        {/* Main Content Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Mode Icon & Subject / Live Stopwatch */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onMaximize();
            }}
            className="flex items-center gap-3 text-left min-w-0 cursor-pointer group focus:outline-none flex-1"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-950 to-indigo-950 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-md shadow-cyan-950/40 group-hover:scale-105 transition-transform">
              {getModeIcon()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h5 className="text-[11px] font-black tracking-wider text-cyan-400 uppercase truncate">
                  {session.subject?.name || 'SERBEST ÇALIŞMA'}
                </h5>
                <span className="text-[10px] text-neutral-500">·</span>
                <span className="text-[10px] font-semibold text-neutral-300 truncate">
                  {getModeTitle()}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
                  {timeString}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium truncate">
                  {session.isCampActive
                    ? '☕ Molada'
                    : session.isPaused
                    ? '⏸️ Duraklatıldı'
                    : isCountdown
                    ? `${session.plannedMinutes} Dk Sayaç`
                    : 'Canlı Kronometre'}
                </span>
              </div>
            </div>
          </button>

          {/* Right Actions: Pause, Complete, and Prominent "Göster" Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1. Pause / Resume */}
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

            {/* 2. Zen Audio */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onToggleAudio();
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                isAudioPlaying
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/20'
                  : 'border-neutral-700/60 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300'
              }`}
              title="Zen Ortam Sesi"
              aria-label="Zen Ortam Sesi"
            >
              {isAudioPlaying ? <Volume2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            {/* 3. Finish / Check */}
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

            {/* 4. Prominent "Göster" Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onMaximize();
              }}
              className="px-3.5 h-9 rounded-xl bg-gradient-to-r from-[#ff5500] to-[#ff6a00] hover:from-[#ff6600] hover:to-[#ff7711] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#ff5500]/30 transition-all active:scale-95"
              title="Aynı Odak Ekranını Bu Cihazda Aç ve Devam Et"
            >
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Göster</span>
            </button>

            {/* 5. Dismiss / Discard button */}
            {onDismiss && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onDismiss();
                }}
                className="w-8 h-9 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-all active:scale-95"
                title="Sonlandır / Kapat"
                aria-label="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
