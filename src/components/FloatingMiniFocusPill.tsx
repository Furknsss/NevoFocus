import React, { useState, useEffect, useCallback } from 'react';
import {
  Coffee,
  Pause,
  Play,
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
  onToggleBreak?: () => void;
  onToggleAudio?: () => void;
  isAudioPlaying?: boolean;
  onComplete?: () => void;
  onDismiss?: () => void;
  isMobile?: boolean;
}

export const FloatingMiniFocusPill: React.FC<FloatingMiniFocusPillProps> = ({
  session,
  onMaximize,
  onTogglePause,
  onToggleBreak,
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

  const computeLiveBreakSeconds = useCallback(() => {
    if (!session.isCampActive || session.isPaused) {
      return session.accumulatedBreakSeconds ?? session.breakSeconds ?? 0;
    }
    if (session.breakAnchorTimestamp && session.breakAnchorTimestamp > 0) {
      const delta = Math.max(0, Math.floor((Date.now() - session.breakAnchorTimestamp) / 1000));
      return (session.accumulatedBreakSeconds ?? 0) + delta;
    }
    return session.breakSeconds ?? 0;
  }, [
    session.isCampActive,
    session.isPaused,
    session.breakAnchorTimestamp,
    session.accumulatedBreakSeconds,
    session.breakSeconds,
  ]);

  const [focusSeconds, setFocusSeconds] = useState<number>(() => computeLiveFocusSeconds());
  const [breakSeconds, setBreakSeconds] = useState<number>(() => computeLiveBreakSeconds());

  useEffect(() => {
    const sync = () => {
      setFocusSeconds(computeLiveFocusSeconds());
      setBreakSeconds(computeLiveBreakSeconds());
    };
    sync();
    const interval = window.setInterval(sync, 200);
    return () => window.clearInterval(interval);
  }, [computeLiveFocusSeconds, computeLiveBreakSeconds]);

  const totalPlannedSecs = session.plannedMinutes * 60;
  const isCountdown = session.timerType === 'countdown';
  const displayRemaining = Math.max(0, totalPlannedSecs - focusSeconds);
  const displaySecs = session.isCampActive
    ? breakSeconds
    : isCountdown
    ? displayRemaining
    : focusSeconds;
  const timeString = formatTimerDisplay(displaySecs);

  return (
    <aside
      aria-label="Aktif Odaklanma Kapsülü"
      className={`fixed z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 ${
        isMobile
          ? 'bottom-[4.8rem] left-1/2 -translate-x-1/2'
          : 'bottom-6 right-6'
      }`}
    >
      {/* Genişletmesiz Saf Siyah Kapsül + Beyaz Premium Saat */}
      <div className="bg-black border border-white/15 rounded-full px-5 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.96)] flex items-center gap-4 select-none">
        {/* Beyaz Premium Saat (Tıklanınca doğrudan Focus ekranını açar) */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onMaximize();
          }}
          className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
          title="Focus Ekranına Dön"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              session.isCampActive
                ? 'bg-amber-400'
                : session.isPaused
                ? 'bg-red-500'
                : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]'
            }`}
          />
          <span className="font-mono text-2xl sm:text-[28px] font-black text-white tracking-tight tabular-nums leading-none group-hover:opacity-90 transition-opacity">
            {timeString}
          </span>
        </button>

        {/* Kompakt Mola & Durdur/Başlat Kontrolleri (Genişletme butonu yok) */}
        <div className="flex items-center gap-2 shrink-0 pl-1 border-l border-white/10">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              if (onToggleBreak) {
                onToggleBreak();
              } else {
                onMaximize();
              }
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
              session.isCampActive
                ? 'bg-amber-400 text-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={session.isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
            aria-label={session.isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
          >
            <Coffee className="w-4 h-4 stroke-[2.3]" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onTogglePause();
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
              session.isPaused
                ? 'bg-white text-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={session.isPaused ? 'Başlat' : 'Duraklat'}
            aria-label={session.isPaused ? 'Başlat' : 'Duraklat'}
          >
            {session.isPaused ? (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            ) : (
              <Pause className="w-4 h-4 fill-current" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
