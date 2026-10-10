import React from 'react';
import { Bell, Flame, Check, ShieldCheck, ExternalLink, X, Smartphone, Globe } from 'lucide-react';

interface NotificationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => Promise<void>;
  permissionState: NotificationPermission | 'unsupported';
  currentRemainingFormatted?: string;
  currentSubject?: string;
}

export const NotificationPreviewModal: React.FC<NotificationPreviewModalProps> = ({
  isOpen,
  onClose,
  onRequestPermission,
  permissionState,
  currentRemainingFormatted = '24:50',
  currentSubject = 'TYT Matematik',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#0c0d12] p-6 sm:p-7 shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#ff5500]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ff5500]/20 text-[#ff5500]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Arka Planda Odaklanma Bildirimi</h3>
              <p className="text-[11px] text-neutral-400">Siteden çıksan bile canlı bildirimle odak takibi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="py-5 space-y-4">
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            Fokus'tan başka bir sekmeye geçsen veya tarayıcıyı küçültsen dahi, çalışma seansın arka planda kesintisiz devam eder.
            Aşağıdaki gibi telefonunun veya bilgisayarının kilit ekranında tam siyah şık bildirim kartı görünür:
          </p>

          {/* EXACT SAMSUNG ONE UI / PURE BLACK NOTIFICATION CARD PREVIEW */}
          <div className="rounded-2xl p-4 bg-black border border-neutral-800 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
            {/* Top row of Android / OS notification */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#ff5500] flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                  F
                </div>
                <span className="font-semibold text-neutral-200">Fokus Premium</span>
                <span className="text-neutral-600">·</span>
                <span className="text-[10px] text-neutral-400">Canlı Odak Sayacı</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">şimdi</span>
            </div>

            {/* Notification content body: Pure Black Sleek Design */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Odak Seansı Devam Ediyor</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </h4>
                <p className="text-xs text-neutral-300 mt-0.5">
                  <strong className="text-white font-semibold">{currentSubject}</strong> çalışılıyor · Arka planda aktif
                </p>
              </div>

              {/* Big High-Tech Timer Badge */}
              <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-right shrink-0">
                <span className="text-base font-black font-mono text-[#ff5500] tracking-wider block">
                  {currentRemainingFormatted}
                </span>
                <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider">
                  ÇALIŞIYOR
                </span>
              </div>
            </div>

            {/* Notification Action Buttons */}
            <div className="mt-3.5 pt-3 border-t border-neutral-800/80 flex items-center justify-end gap-3 text-xs font-bold">
              <span className="text-neutral-400 hover:text-white cursor-pointer transition-colors">
                Mola Ver
              </span>
              <span className="text-[#ff5500] hover:text-[#ff7722] cursor-pointer transition-colors flex items-center gap-1">
                <span>Uygulamaya Dön</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Status info & permissions trigger */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-neutral-300">
                Tarayıcı Bildirim İzni:{' '}
                <strong className={permissionState === 'granted' ? 'text-emerald-400' : 'text-amber-400'}>
                  {permissionState === 'granted'
                    ? 'Aktif ve İzin Verildi'
                    : permissionState === 'denied'
                    ? 'Engellendi (Ayarlardan açınız)'
                    : 'Henüz İzin Verilmedi'}
                </strong>
              </span>
            </div>

            {permissionState !== 'granted' && (
              <button
                onClick={onRequestPermission}
                className="px-3.5 py-1.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-md shadow-[#ff5500]/20"
              >
                İzin Ver
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
