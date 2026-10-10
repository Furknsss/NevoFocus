import React, { useEffect, useState, useRef } from 'react';
import { FocusModeType } from '../../types';
import { soundEngine } from '../../utils/audio';
import { Plane, Trees, Mountain, Waves, Sparkles, Lock } from 'lucide-react';

interface CinematicTransitionCurtainProps {
  mode: FocusModeType;
  onTransitionEnd: () => void;
  onMidpoint?: () => void;
}

const MODE_META: Record<
  FocusModeType,
  {
    title: string;
    sub: string;
    icon: any;
    accent: string;
    borderGlow: string;
    badge: string;
  }
> = {
  flight: {
    title: 'Focus Flight İstasyonu',
    sub: '3D Google Earth Rotası & Uçuş Terminali Açılıyor',
    icon: Plane,
    accent: '#38bdf8',
    borderGlow: 'rgba(56, 189, 248, 0.5)',
    badge: '3D HAVA KORİDORU',
  },
  forest: {
    title: 'Kadim Orman Alanı',
    sub: 'Biyolojik Doğa Rezonansı & Sanal Orman İnşası',
    icon: Trees,
    accent: '#10b981',
    borderGlow: 'rgba(16, 185, 129, 0.5)',
    badge: 'BİYO-ODAK EKOSİSTEMİ',
  },
  climb: {
    title: 'Dağcılık & Zirve Kampı',
    sub: 'Alpin İrtifa Havası & Yüksek Rakım Kampı Kuruluyor',
    icon: Mountain,
    accent: '#f97316',
    borderGlow: 'rgba(249, 115, 22, 0.5)',
    badge: 'ZİRVE TIRMANIŞ ÜSSÜ',
  },
  dive: {
    title: 'Derin Okyanus Araştırma',
    sub: 'Basınç Odası Yalıtımı & Balık Şehri Keşfi',
    icon: Waves,
    accent: '#14b8a6',
    borderGlow: 'rgba(20, 184, 166, 0.5)',
    badge: 'HİDROFON BASINÇ ODASI',
  },
};

export const CinematicTransitionCurtain: React.FC<CinematicTransitionCurtainProps> = ({
  mode,
  onTransitionEnd,
  onMidpoint,
}) => {
  // 'entering' (yukarıda gizli) -> 'closed' (aşağı indi kapalı) -> 'opening' (yukarı çekiliyor açılıyor)
  const [phase, setPhase] = useState<'entering' | 'closed' | 'opening'>('entering');
  const [statusText, setStatusText] = useState<'KEPENK İNİYOR...' | 'EVREN KİLİTLENDİ' | 'AÇILIYOR...'>('KEPENK İNİYOR...');

  const onEndRef = useRef(onTransitionEnd);
  onEndRef.current = onTransitionEnd;

  const onMidpointRef = useRef(onMidpoint);
  onMidpointRef.current = onMidpoint;

  const hasEndedRef = useRef(false);

  const safeFinish = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (onMidpointRef.current) onMidpointRef.current();
    onEndRef.current();
  };

  useEffect(() => {
    // 1. Ses efekti
    soundEngine.playSwoosh();

    // 2. Normal hızda akıcı kepenk inişi (450ms)
    const tClose = setTimeout(() => {
      setPhase('closed');
      setStatusText('KEPENK İNİYOR...');
    }, 20);

    // 3. Kepenk kapandı, evren bağlandı (500ms)
    const tMid = setTimeout(() => {
      setStatusText('EVREN KİLİTLENDİ');
      soundEngine.playClick();
      if (onMidpointRef.current) {
        onMidpointRef.current();
      }
    }, 520);

    // 4. Kepenk yukarı akıcı şekilde açılıyor (850ms)
    const tOpen = setTimeout(() => {
      setStatusText('AÇILIYOR...');
      setPhase('opening');
      soundEngine.playSwoosh();
    }, 850);

    // 5. Tamamlanma ve perdeyi kaldırma (1300ms)
    const tEnd = setTimeout(() => {
      safeFinish();
    }, 1300);

    // Güvenlik zaman aşımı
    const tFailsafe = setTimeout(() => {
      safeFinish();
    }, 1500);

    return () => {
      clearTimeout(tClose);
      clearTimeout(tMid);
      clearTimeout(tOpen);
      clearTimeout(tEnd);
      clearTimeout(tFailsafe);
    };
  }, []);

  const meta = MODE_META[mode] || MODE_META.forest;
  const Icon = meta.icon;

  // Inline transform style for 100% reliable animation across all browsers
  const translateY = phase === 'closed' ? '0%' : '-100%';

  return (
    <div
      onClick={safeFinish}
      className="fixed inset-0 z-[150] overflow-hidden select-none"
      style={{
        pointerEvents: phase === 'opening' ? 'none' : 'auto',
        cursor: 'pointer',
      }}
      title="Hemen geçmek için tıklayabilirsiniz"
    >
      {/* ELEKTRONİK ÇELİK KEPENK GÖVDESİ */}
      <div
        className="absolute inset-0 w-full h-full flex flex-col justify-between bg-[#0b0e14] shadow-2xl"
        style={{
          transform: `translateY(${translateY})`,
          transition: 'transform 480ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        {/* Yan Kılavuz Rayları (Side Guide Rails) */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-neutral-800 to-black border-r border-neutral-700/80 z-20 shadow-xl" />
        <div className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-neutral-800 to-black border-l border-neutral-700/80 z-20 shadow-xl" />

        {/* Kepenk Yatay Metal Çıtaları / Slats Dokusu */}
        <div
          className="absolute inset-0 pointer-events-none opacity-45 z-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.05) 0px,
              rgba(255, 255, 255, 0.05) 1.5px,
              transparent 1.5px,
              transparent 28px,
              rgba(0, 0, 0, 0.8) 28px,
              rgba(0, 0, 0, 0.8) 30px
            )`,
          }}
        />

        {/* Ambient Mode-Themed Spotlight */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${meta.accent} 0%, transparent 68%)`,
          }}
        />

        {/* Kepenk Üst Kutu / Sarıcı Kasa */}
        <div className="relative z-10 w-full px-6 py-4 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800/90 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: meta.accent }}
            />
            <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-neutral-200">
              FOKUS ELEKTRONİK KEPENK SİSTEMİ
            </span>
          </div>

          <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
            <span>DURUM:</span>
            <span className="font-extrabold text-white uppercase bg-neutral-900 px-2.5 py-0.5 rounded-md border border-neutral-800">
              {statusText}
            </span>
          </div>
        </div>

        {/* Kepenk Merkez Paneli: Evren Amblemi & Hologram Bilgisi */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Amblem Rozeti */}
          <div
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 mb-5 flex items-center justify-center shadow-2xl transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${meta.accent} 0%, #171717 100%)`,
              boxShadow: `0 0 45px ${meta.borderGlow}`,
            }}
          >
            <div className="w-full h-full rounded-[22px] bg-neutral-950 flex items-center justify-center">
              <Icon className="w-12 h-12" style={{ color: meta.accent }} />
            </div>
          </div>

          {/* Rozet Başlığı */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-700/80 mb-3 shadow-lg">
            <Sparkles className="w-3.5 h-3.5" style={{ color: meta.accent }} />
            <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-200 uppercase">
              {meta.badge}
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
            {meta.title}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-300 mt-2 max-w-md font-medium">
            {meta.sub}
          </p>

          <div className="mt-7 flex items-center gap-2 px-3.5 py-1 rounded-xl bg-black/60 border border-white/10 text-[10px] text-neutral-400 font-mono">
            <span>Geçmek için ekrana tıklayabilirsiniz</span>
          </div>
        </div>

        {/* Kepenk Alt Ağırlık / Tutma & Kilit Barı */}
        <div className="relative z-10 w-full px-6 py-4 bg-gradient-to-t from-black via-neutral-950 to-neutral-900 border-t-2 border-neutral-700 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-2 text-neutral-300 text-xs font-mono font-bold">
            <Lock className="w-4 h-4" style={{ color: meta.accent }} />
            <span>ALAN İZOLASYON KİLİDİ AKTİF</span>
          </div>

          {/* Ağır Metal Tutamaklar */}
          <div className="flex items-center gap-3">
            <div className="w-20 h-2.5 rounded-full bg-neutral-700 border border-neutral-600" />
            <div className="w-20 h-2.5 rounded-full bg-neutral-700 border border-neutral-600" />
          </div>

          <div className="text-[11px] font-mono text-neutral-400 font-bold">
            PRO-SERIES SHUTTER
          </div>
        </div>
      </div>
    </div>
  );
};
