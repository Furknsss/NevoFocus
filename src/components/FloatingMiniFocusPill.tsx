import React, { useState, useEffect, useCallback } from 'react';
import {
  Coffee,
  Pause,
  Play,
  Maximize2,
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
    const interval = window.setInterval(sync, 250);
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
      {/* Saf Siyah Kapsül: En solda beyaz süre, sağında Turuncu Mola, Kırmızı Durdur / Yeşil Başlat ve Beyaz Büyüt */}
      <div className="bg-black border border-white/15 rounded-full px-6 py-3.5 shadow-[0_16px_50px_rgba(0,0,0,0.95)] flex items-center gap-5 sm:gap-6 select-none">
        {/* En Solda: Premium Beyaz Süre */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onMaximize();
          }}
          className="font-mono text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums leading-none cursor-pointer focus:outline-none"
          title="Focus Ekranını Aç"
        >
          {timeString}
        </button>

        {/* Sağda: Eşit Büyüklükte 3 İkon Buton (Mola Turuncu, Durdur Kırmızı / Başlat Yeşil, Büyüt Beyaz) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* 1. Mola Butonu (Turuncu - Focus ekranındaki gibi) */}
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
            className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg ${
              session.isCampActive
                ? 'bg-amber-400 text-black ring-2 ring-amber-200 shadow-amber-500/40'
                : 'bg-[#ff5500] hover:bg-[#ff6600] text-white shadow-[#ff5500]/35'
            }`}
            title={session.isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
            aria-label={session.isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
          >
            <Coffee className="w-5 h-5 stroke-[2.4]" />
          </button>

          {/* 2. Durdur (Kırmızı) / Başlat (Yeşil) Butonu */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onTogglePause();
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg ${
              session.isPaused
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/40'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40'
            }`}
            title={session.isPaused ? 'Başlat' : 'Durdur'}
            aria-label={session.isPaused ? 'Başlat' : 'Durdur'}
          >
            {session.isPaused ? (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            ) : (
              <Pause className="w-5 h-5 fill-current" />
            )}
          </button>

          {/* 3. Büyütme Butonu (Beyaz - Basınca Focus ekranına atar) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onMaximize();
            }}
            className="w-11 h-11 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg shadow-white/20"
            title="Büyüt (Focus Ekranına Dön)"
            aria-label="Büyüt"
          >
            <Maximize2 className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
