import React, { useState } from 'react';
import {
  Bell,
  ShieldCheck,
  X,
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  PictureInPicture2,
} from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface NotificationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => Promise<void>;
  permissionState: NotificationPermission | 'unsupported';
  currentRemainingFormatted?: string;
  currentSubject?: string;
  timerType?: 'countdown' | 'stopwatch';
  isPaused?: boolean;
  isCampActive?: boolean;
  onTogglePause?: () => void;
  onToggleBreak?: () => void;
  onMinimizeToCapsule?: () => void;
  onOpenPipCapsule?: () => Promise<boolean>;
  onSendTestNotification?: () => void;
}

export const NotificationPreviewModal: React.FC<NotificationPreviewModalProps> = ({
  isOpen,
  onClose,
  onRequestPermission,
  permissionState,
  currentRemainingFormatted = '24:50',
  isPaused = false,
  isCampActive = false,
  onTogglePause,
  onToggleBreak,
  onMinimizeToCapsule,
  onOpenPipCapsule,
  onSendTestNotification,
}) => {
  const [testSent, setTestSent] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  if (!isOpen) return null;

  const handleActivateAll = async () => {
    soundEngine.playClick();
    if (permissionState !== 'granted') {
      await onRequestPermission();
    }
    if (onSendTestNotification) {
      onSendTestNotification();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
    if (onOpenPipCapsule) {
      const opened = await onOpenPipCapsule();
      if (opened) setPipActive(true);
    }
  };

  const handleLaunchPip = async () => {
    soundEngine.playClick();
    if (onOpenPipCapsule) {
      const opened = await onOpenPipCapsule();
      if (opened) {
        setPipActive(true);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
      <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-[#0a0b0f] p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Siyah Kapsül & Canlı Bildirim</h3>
              <p className="text-[11px] text-neutral-400">
                Genişletmesiz saf siyah kapsül ve beyaz premium saat senkronizasyonu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pure Black Non-Expanding Capsule Preview */}
        <div className="py-6 flex flex-col items-center gap-5">
          <div className="w-full flex items-center justify-center py-6 px-4 rounded-3xl bg-neutral-950 border border-neutral-800/80">
            {/* Genişletmesiz Saf Siyah Kapsül + Beyaz Premium Saat */}
            <div className="bg-black border border-white/15 rounded-full px-6 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.96)] flex items-center gap-4 select-none">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isCampActive
                      ? 'bg-amber-400'
                      : isPaused
                      ? 'bg-red-500'
                      : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]'
                  }`}
                />
                <span className="font-mono text-3xl font-black text-white tracking-tight tabular-nums leading-none">
                  {currentRemainingFormatted}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleBreak?.();
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                    isCampActive
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
                  aria-label="Mola"
                >
                  <Coffee className="w-4 h-4 stroke-[2.3]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onTogglePause?.();
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                    isPaused
                      ? 'bg-white text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={isPaused ? 'Başlat' : 'Duraklat'}
                  aria-label={isPaused ? 'Başlat' : 'Duraklat'}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  ) : (
                    <Pause className="w-4 h-4 fill-current" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="w-full space-y-2.5">
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-neutral-300">
                  Canlı Senkron Bildirim:{' '}
                  <strong className={permissionState === 'granted' ? 'text-emerald-400' : 'text-amber-400'}>
                    {permissionState === 'granted' ? 'Aktif & Senkronize' : 'İzin Bekleniyor'}
                  </strong>
                </span>
              </div>

              {permissionState !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleActivateAll}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-md"
                >
                  İzin Ver & Başlat
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleActivateAll}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{testSent ? 'Senkronize!' : 'Şimdi Senkronla'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleLaunchPip}
                className="py-3 px-3.5 rounded-2xl bg-black hover:bg-neutral-900 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                <PictureInPicture2 className="w-4 h-4 text-white" />
                <span>{pipActive ? 'Siyah Kapsül Açık' : 'Ekran Üstü Siyah Kapsül'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onClose();
                  onMinimizeToCapsule?.();
                }}
                className="py-3 px-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                <span>Kapsüle Küçült</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
