import React, { useState } from 'react';
import {
  Bell,
  ShieldCheck,
  X,
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  Maximize2,
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
            <div className="p-2 rounded-xl bg-[#ff5500]/20 text-[#ff5500]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Canlı Fokus Kapsülü & Bildirim</h3>
              <p className="text-[11px] text-neutral-400">
                Uygulama dışında ve arka planda kesintisiz canlı sayaç
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

        {/* Pure Black Capsule Live Interactive Preview */}
        <div className="py-6 flex flex-col items-center gap-5">
          <div className="w-full flex items-center justify-center py-4 px-2 rounded-3xl bg-neutral-900/70 border border-neutral-800/80">
            {/* SAF SİYAH KAPSÜL: En solda beyaz süre, sağında Turuncu Mola, Kırmızı Durdur / Yeşil Başlat, Beyaz Büyüt */}
            <div className="bg-black border border-white/15 rounded-full px-6 py-3.5 shadow-[0_14px_45px_rgba(0,0,0,0.95)] flex items-center gap-5 sm:gap-6 select-none">
              {/* En Solda: Premium Beyaz Süre */}
              <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums leading-none">
                {currentRemainingFormatted}
              </span>

              {/* Sağda: Eşit Büyüklükte 3 İkon Buton */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* 1. Mola Butonu (Turuncu) */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleBreak?.();
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg ${
                    isCampActive
                      ? 'bg-amber-400 text-black ring-2 ring-amber-200 shadow-amber-500/40'
                      : 'bg-[#ff5500] hover:bg-[#ff6600] text-white shadow-[#ff5500]/35'
                  }`}
                  title={isCampActive ? 'Molayı Bitir' : 'Mola Ver'}
                  aria-label="Mola"
                >
                  <Coffee className="w-5 h-5 stroke-[2.4]" />
                </button>

                {/* 2. Durdur (Kırmızı) / Başlat (Yeşil) Butonu */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onTogglePause?.();
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg ${
                    isPaused
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/40'
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40'
                  }`}
                  title={isPaused ? 'Başlat' : 'Durdur'}
                  aria-label={isPaused ? 'Başlat' : 'Durdur'}
                >
                  {isPaused ? (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  ) : (
                    <Pause className="w-5 h-5 fill-current" />
                  )}
                </button>

                {/* 3. Büyütme Butonu (Beyaz) */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onClose();
                  }}
                  className="w-11 h-11 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg shadow-white/20"
                  title="Büyüt (Focus Ekranına Dön)"
                  aria-label="Büyüt"
                >
                  <Maximize2 className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="w-full space-y-2.5">
            {/* Permission & Background Notification Row */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-neutral-300">
                  Arka Plan Bildirimi:{' '}
                  <strong className={permissionState === 'granted' ? 'text-emerald-400' : 'text-amber-400'}>
                    {permissionState === 'granted' ? 'Aktif' : 'İzin Bekleniyor'}
                  </strong>
                </span>
              </div>

              {permissionState !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleActivateAll}
                  className="px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-md shadow-[#ff5500]/20"
                >
                  İzin Ver & Aktifleştir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleActivateAll}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{testSent ? 'Aktif!' : 'Bildirimi Yenile'}</span>
                </button>
              )}
            </div>

            {/* Launch Floating PiP Window or Minimize In-App */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleLaunchPip}
                className="py-3 px-3.5 rounded-2xl bg-black hover:bg-neutral-900 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                <PictureInPicture2 className="w-4 h-4 text-[#ff5500]" />
                <span>{pipActive ? 'PiP Kapsül Açık' : 'Yüzen Kapsül (PiP)'}</span>
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
                <Maximize2 className="w-4 h-4" />
                <span>Kapsüle Küçült</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
