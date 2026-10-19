import React, { useState, useEffect } from 'react';
import { Play, Pause, CheckCircle2, X } from 'lucide-react';
import { soundEngine } from '../../utils/audio';

export type ClockStyle = 'ipad' | 'flip';

export interface BreakRecord {
  id: number;
  seconds: number;
  isActive: boolean;
}

interface ActiveClockCanvasProps {
  elapsedSeconds: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
  onAbandon: () => void;
  onTakeBreak?: () => void;
  isBreakActive?: boolean;
  breakSeconds?: number;
  timerType?: 'countdown' | 'stopwatch';
  remainingSeconds?: number;
  clockStyle?: ClockStyle;
  onToggleClockStyle?: (style: ClockStyle) => void;
}

export const ActiveClockCanvas: React.FC<ActiveClockCanvasProps> = ({
  elapsedSeconds,
  isPaused,
  onTogglePause,
  onFinish,
  onAbandon,
  onTakeBreak,
  isBreakActive: parentBreakActive = false,
  breakSeconds: parentBreakSeconds = 0,
  timerType = 'stopwatch',
  remainingSeconds = 0,
  clockStyle = 'ipad',
}) => {
  const [breaks, setBreaks] = useState<BreakRecord[]>([]);
  const [isBreakRunning, setIsBreakRunning] = useState<boolean>(false);

  // Time calculation: keeps running smoothly without stopping when switching clock styles
  const displaySeconds = timerType === 'countdown' ? Math.max(0, remainingSeconds) : elapsedSeconds;
  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  const seconds = displaySeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Break live counter ticker
  useEffect(() => {
    if (!isBreakRunning) return;

    const interval = setInterval(() => {
      setBreaks((prev) =>
        prev.map((b) => (b.isActive ? { ...b, seconds: b.seconds + 1 } : b))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isBreakRunning]);

  // Sync if parent break active changes
  useEffect(() => {
    if (parentBreakActive && !isBreakRunning) {
      setIsBreakRunning(true);
      setBreaks((prev) => {
        const hasActive = prev.some((b) => b.isActive);
        if (hasActive) return prev;
        return [...prev, { id: prev.length + 1, seconds: parentBreakSeconds || 0, isActive: true }];
      });
    } else if (!parentBreakActive && isBreakRunning) {
      setIsBreakRunning(false);
      setBreaks((prev) => prev.map((b) => (b.isActive ? { ...b, isActive: false } : b)));
    }
  }, [parentBreakActive]);

  // Handle Mola toggle
  const handleToggleMola = () => {
    soundEngine.playClick();

    if (!isBreakRunning) {
      if (!isPaused) {
        onTogglePause();
      }
      if (onTakeBreak && !parentBreakActive) {
        onTakeBreak();
      }

      setIsBreakRunning(true);
      setBreaks((prev) => {
        const closed = prev.map((b) => ({ ...b, isActive: false }));
        return [...closed, { id: closed.length + 1, seconds: 0, isActive: true }];
      });
    } else {
      setIsBreakRunning(false);
      setBreaks((prev) => prev.map((b) => (b.isActive ? { ...b, isActive: false } : b)));

      if (onTakeBreak && parentBreakActive) {
        onTakeBreak();
      }
      if (isPaused) {
        onTogglePause();
      }
    }
  };

  // Handle Play/Pause
  const handleTogglePlayPause = () => {
    soundEngine.playClick();
    if (isBreakRunning) {
      setIsBreakRunning(false);
      setBreaks((prev) => prev.map((b) => (b.isActive ? { ...b, isActive: false } : b)));
      if (onTakeBreak && parentBreakActive) {
        onTakeBreak();
      }
      if (isPaused) {
        onTogglePause();
      }
    } else {
      onTogglePause();
    }
  };

  const minutesPadded = pad(minutes);
  const secondsPadded = pad(seconds);
  const hoursPadded = pad(hours);

  return (
    <div className="relative w-full h-full min-h-screen bg-[#000000] text-white flex flex-col justify-between select-none overflow-hidden font-sans">

      {/* Center Stage: Saati çok ufak aşşağıya alıp (pt-20 sm:pt-28 md:pt-32 lg:pt-36) birazcık büyüt ve tam sağdan ve soldan ortala */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-20 sm:pt-28 md:pt-32 lg:pt-36 px-4 w-full max-w-7xl mx-auto">
        {clockStyle === 'ipad' ? (
          /* IPAD STOPWATCH STYLE (PURE SİPSİYAH, ZERO GLOW, BÜYÜTÜLMÜŞ PREMIUM APPLE TYPOGRAPHY, ROCK-SOLID CENTERING) */
          <div className="flex flex-col items-center justify-center w-full">
            {/*
              Her bir basamak sabit genişlikli slotlarda render edilir (w-[0.6em] inline-block text-center).
              Böylece saat saymaya başladığında '01', '02', '11' gibi rakamlar değişirken
              saat milimetrik bile sağa/sola oynamaz; tam sağdan ve soldan ekranın ortasında kalır!
            */}
            <div
              className="flex items-baseline justify-center tracking-tight select-none tabular-nums text-center"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {hours > 0 && (
                <>
                  <div className="inline-flex items-baseline text-8xl sm:text-[11rem] md:text-[13rem] lg:text-[15rem] xl:text-[16.5rem] leading-none text-white font-extralight">
                    <span className="inline-block w-[0.6em] text-center">{hoursPadded[0]}</span>
                    <span className="inline-block w-[0.6em] text-center">{hoursPadded[1]}</span>
                  </div>
                  <span className="inline-block w-[0.35em] text-center text-5xl sm:text-7xl md:text-9xl lg:text-[10rem] leading-none text-neutral-600 font-thin select-none">
                    :
                  </span>
                </>
              )}

              {/* Dakika: Büyütülmüş ve her basamak sabit genişlikte */}
              <div className="inline-flex items-baseline text-8xl sm:text-[11rem] md:text-[13rem] lg:text-[15rem] xl:text-[16.5rem] leading-none text-white font-extralight">
                <span className="inline-block w-[0.6em] text-center">{minutesPadded[0]}</span>
                <span className="inline-block w-[0.6em] text-center">{minutesPadded[1]}</span>
              </div>

              {/* İki nokta ayırıcı */}
              <span className="inline-block w-[0.35em] text-center text-5xl sm:text-7xl md:text-9xl lg:text-[10rem] leading-none text-neutral-600 font-thin select-none">
                :
              </span>

              {/* Saniye: Büyütülmüş ama saat/dakikadan sakin ve dengeli, her basamak sabit genişlikte */}
              <div className="inline-flex items-baseline text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10.5rem] leading-none text-neutral-300 font-light">
                <span className="inline-block w-[0.6em] text-center">{secondsPadded[0]}</span>
                <span className="inline-block w-[0.6em] text-center">{secondsPadded[1]}</span>
              </div>
            </div>

            {/* Apple Stopwatch Mola List (Saatin altında 1.mola : 00:01 saymaya başlar, her yeni molada altta eklenir) */}
            {breaks.length > 0 && (
              <div className="w-full max-w-md mt-6 sm:mt-8 max-h-48 sm:max-h-60 overflow-y-auto divide-y divide-neutral-900 border-t border-b border-neutral-900 px-3 scrollbar-thin">
                {breaks.map((brk) => (
                  <div
                    key={brk.id}
                    className="flex items-center justify-between py-2 sm:py-2.5 text-xs sm:text-sm font-mono"
                  >
                    <span className="text-neutral-400 font-mono">
                      {brk.id}. Mola :
                    </span>
                    <div className="flex items-center gap-4">
                      {brk.isActive && (
                        <span className="text-[10px] text-amber-500 font-mono animate-pulse">
                          sayıyor...
                        </span>
                      )}
                      <span
                        className={`font-mono ${
                          brk.isActive ? 'text-amber-400 font-bold' : 'text-neutral-300'
                        }`}
                      >
                        {pad(Math.floor(brk.seconds / 60))}:{pad(brk.seconds % 60)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* PREMIUM 3D MECHANICAL FLIP CLOCK WITH REAL SPLIT-FLAP PHYSICS */
          <div className="flex flex-col items-center justify-center w-full py-4">
            <div className="flex items-center justify-center gap-2 sm:gap-4 select-none">
              {hours > 0 && (
                <>
                  <FlipGroup value={hoursPadded} label="SAAT" />
                  <span className="text-4xl sm:text-6xl text-neutral-600 font-bold mb-6 select-none">:</span>
                </>
              )}
              <FlipGroup value={minutesPadded} label="DAKİKA" />
              <span className="text-4xl sm:text-6xl text-neutral-600 font-bold mb-6 select-none">:</span>
              <FlipGroup value={secondsPadded} label="SANİYE" isSeconds />
            </div>

            {breaks.length > 0 && (
              <div className="w-full max-w-md mt-6 max-h-40 overflow-y-auto divide-y divide-neutral-900 border-t border-b border-neutral-900 px-3 scrollbar-thin">
                {breaks.map((brk) => (
                  <div
                    key={brk.id}
                    className="flex items-center justify-between py-2 text-xs font-mono"
                  >
                    <span className="text-neutral-400 font-mono">{brk.id}. Mola :</span>
                    <span className={brk.isActive ? 'text-amber-400 font-bold' : 'text-neutral-300'}>
                      {pad(Math.floor(brk.seconds / 60))}:{pad(brk.seconds % 60)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Buttons:
          - Sol Yuvarlak: Turuncu Mola Tuşu (☕ Emojisi)
          - Orta İkili: Vazgeç & Seansı Bitir
          - Sağ Yuvarlak: Durdur / Devam Et */}
      <div className="relative z-10 w-full px-4 sm:px-8 pb-8 sm:pb-12 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 sm:gap-8">
          {/* Sol Dairesel Buton: TURUNCU MOLA BUTONU */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMola}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer shadow-lg shadow-black ${
                isBreakRunning
                  ? 'bg-[#3b1c00] border-[#ff9f0a] text-[#ff9f0a] hover:bg-[#4d2500] ring-2 ring-[#ff9f0a]/30'
                  : 'bg-[#2b1704] border-[#ff9f0a] text-[#ff9f0a] hover:bg-[#3d2005]'
              }`}
            >
              <div className="flex flex-col items-center justify-center leading-tight">
                <span className="text-xl sm:text-2xl leading-none mb-0.5">☕</span>
                <span className="text-[10px] sm:text-xs font-bold text-[#ff9f0a]">
                  {isBreakRunning ? 'Devam Et' : 'Mola'}
                </span>
              </div>
            </button>
          </div>

          {/* Orta İkili Butonlar: Vazgeç ve Bitir */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onAbandon();
              }}
              className="px-4 sm:px-5 py-2.5 rounded-full bg-neutral-900/90 border border-neutral-800 hover:border-rose-900/60 text-neutral-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Vazgeç</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onFinish();
              }}
              className="px-5 sm:px-7 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Seansı Bitir</span>
            </button>
          </div>

          {/* Sağ Dairesel Buton: Durdur / Devam Et */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer shadow-lg shadow-black ${
                isPaused || isBreakRunning
                  ? 'bg-[#122b17] border-[#30d158] text-[#30d158] hover:bg-[#193a20]'
                  : 'bg-[#301616] border-[#ff453a] text-[#ff453a] hover:bg-[#421f1f]'
              }`}
            >
              <div className="flex flex-col items-center justify-center leading-tight">
                {isPaused || isBreakRunning ? (
                  <>
                    <Play className="w-5 h-5 fill-current mb-0.5 ml-0.5" />
                    <span className="text-[10px] sm:text-xs">Başlat</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 fill-current mb-0.5" />
                    <span className="text-[10px] sm:text-xs">Durdur</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// REAL MECHANICAL 3D SPLIT-FLAP FLIP CLOCK
// ==========================================
interface FlipGroupProps {
  value: string;
  label: string;
  isSeconds?: boolean;
}

const FlipGroup: React.FC<FlipGroupProps> = ({ value, label, isSeconds }) => {
  const digits = value.split('');

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {digits.map((d, i) => (
          <FlipSingleCard key={i} digit={d} isSmall={isSeconds} />
        ))}
      </div>
      <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-neutral-500 font-bold uppercase">
        {label}
      </span>
    </div>
  );
};

interface FlipSingleCardProps {
  digit: string;
  isSmall?: boolean;
}

const FlipSingleCard: React.FC<FlipSingleCardProps> = ({ digit, isSmall }) => {
  const [current, setCurrent] = useState(digit);
  const [prev, setPrev] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (digit !== current) {
      setPrev(current);
      setCurrent(digit);
      setIsFlipping(true);

      const timer = setTimeout(() => {
        setIsFlipping(false);
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [digit, current]);

  const cardWidthClass = isSmall ? 'w-12 sm:w-18 md:w-22' : 'w-14 sm:w-22 md:w-28';
  const cardHeightClass = isSmall ? 'h-20 sm:h-30 md:h-38' : 'h-24 sm:h-36 md:h-44';
  const fontSizeClass = isSmall
    ? 'text-4xl sm:text-6xl md:text-7xl'
    : 'text-5xl sm:text-7xl md:text-8xl';

  return (
    <div
      className={`relative ${cardWidthClass} ${cardHeightClass} rounded-xl sm:rounded-2xl bg-[#121214] border border-neutral-800/80 shadow-2xl flex flex-col justify-between overflow-hidden select-none`}
      style={{ perspective: '1000px' }}
    >
      {/* 1. Static Upper Half: Displays NEW digit top half */}
      <div className="relative w-full h-1/2 bg-[#19191d] border-b border-black overflow-hidden flex items-end justify-center rounded-t-xl sm:rounded-t-2xl">
        <span
          className={`font-black tracking-tight text-neutral-100 ${fontSizeClass}`}
          style={{ transform: 'translateY(50%)' }}
        >
          {current}
        </span>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* 2. Static Lower Half: Displays OLD digit bottom half while flipping, then NEW */}
      <div className="relative w-full h-1/2 bg-[#141417] overflow-hidden flex items-start justify-center rounded-b-xl sm:rounded-b-2xl">
        <span
          className={`font-black tracking-tight text-neutral-200 ${fontSizeClass}`}
          style={{ transform: 'translateY(-50%)' }}
        >
          {isFlipping ? prev : current}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* 3. Center Mechanical Slit & Pivot Pins */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-black z-30 flex items-center justify-between px-0.5">
        <div className="w-1.5 h-2 bg-neutral-950 rounded-r-xs border-r border-neutral-700/60" />
        <div className="w-1.5 h-2 bg-neutral-950 rounded-l-xs border-l border-neutral-700/60" />
      </div>

      {/* 4. Flipping Top Flap: Shows OLD digit, folds down */}
      {isFlipping && (
        <div
          className="absolute inset-x-0 top-0 h-1/2 bg-[#19191d] border-b border-black overflow-hidden flex items-end justify-center rounded-t-xl sm:rounded-t-2xl z-20 animate-flip-top"
          style={{
            transformOrigin: '50% 100%',
            backfaceVisibility: 'hidden',
          }}
        >
          <span
            className={`font-black tracking-tight text-neutral-100 ${fontSizeClass}`}
            style={{ transform: 'translateY(50%)' }}
          >
            {prev}
          </span>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/40 pointer-events-none" />
        </div>
      )}

      {/* 5. Flipping Bottom Flap: Shows NEW digit, unfolds down onto lower half */}
      {isFlipping && (
        <div
          className="absolute inset-x-0 top-1/2 h-1/2 bg-[#141417] overflow-hidden flex items-start justify-center rounded-b-xl sm:rounded-b-2xl z-20 animate-flip-bottom"
          style={{
            transformOrigin: '50% 0%',
            backfaceVisibility: 'hidden',
          }}
        >
          <span
            className={`font-black tracking-tight text-neutral-200 ${fontSizeClass}`}
            style={{ transform: 'translateY(-50%)' }}
          >
            {current}
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};
