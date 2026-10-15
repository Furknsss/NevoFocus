import React from 'react';
import { Trees, Mountain, Plane, Waves, ArrowRight, Sparkles, Flame, Clock } from 'lucide-react';
import { FocusModeType } from '../types';
import { FOCUS_MODES } from '../utils/storage';
import { ModeCardPreview } from './visuals/ModeCardPreview';
import { soundEngine } from '../utils/audio';

interface ModeHubSelectionProps {
  onSelectMode: (mode: FocusModeType) => void;
  todayMinutes: number;
  streakDays: number;
  dailyGoalHours: number;
  todayPlannedMinutes?: number;
}

export const ModeHubSelection: React.FC<ModeHubSelectionProps> = ({
  onSelectMode,
  todayMinutes,
  streakDays,
  dailyGoalHours,
  todayPlannedMinutes = 0,
}) => {
  const getModeIcon = (modeId: FocusModeType) => {
    switch (modeId) {
      case 'forest':
        return <Trees className="w-5 h-5 text-emerald-400" />;
      case 'climb':
        return <Mountain className="w-5 h-5 text-orange-400" />;
      case 'flight':
        return <Plane className="w-5 h-5 text-sky-400" />;
      case 'dive':
        return <Waves className="w-5 h-5 text-teal-400" />;
    }
  };

  const getModeBadge = (modeId: FocusModeType) => {
    switch (modeId) {
      case 'forest':
        return 'Tohumdan Ağaca · Sanal Orman';
      case 'climb':
        return 'Kamp Ateşi & Zafer Bayrağı';
      case 'flight':
        return 'Şehirler Arası Uçuş Radarı & İniş';
      case 'dive':
        return 'Tekneden Kaçış · Balık Şehri';
    }
  };

  const todayHours = Math.floor(todayMinutes / 60);
  const todayRemainingMins = todayMinutes % 60;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 animate-in fade-in duration-300 flex flex-col justify-center min-h-[calc(100vh-140px)]">
      {/* Editorial Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-bold text-[#ff5500]">
          <span>✨</span>
          <span>SİNEMATİK ODAKLANMA DÜNYALARI</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
          Hangi evrende odaklanmak istersin?
        </h1>
        <p className="mt-3 text-sm sm:text-base text-neutral-400">
          Modunu seç, sinematik geçişle kendi özel istasyonuna bağlan ve hedefine odaklan.
        </p>
      </div>

      {/* 4 Mode Big Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-12">
        {FOCUS_MODES.map((mode) => {
          return (
            <button
              key={mode.id}
              onClick={() => {
                soundEngine.playClick();
                onSelectMode(mode.id);
              }}
              className="group relative flex flex-col text-left rounded-3xl p-3 sm:p-4 bg-neutral-900/50 hover:bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/60 cursor-pointer"
            >
              {/* Animated Canvas Preview Frame */}
              <div className="relative w-full aspect-[16/11] rounded-2xl overflow-hidden mb-4 bg-neutral-950 border border-neutral-800/80 group-hover:border-neutral-700 transition-colors">
                <ModeCardPreview mode={mode.id} isActive={true} />

                {/* Mode Tag Badge */}
                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-neutral-200">
                  {getModeBadge(mode.id)}
                </div>
              </div>

              {/* Title & Description */}
              <div className="px-1.5 pb-2 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getModeIcon(mode.id)}
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {mode.title}
                    </h2>
                  </div>
                  <p className="text-xs font-semibold text-neutral-400 mb-2">
                    {mode.subtitle}
                  </p>
                  <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                    {mode.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">
                  <span>Modu Başlat</span>
                  <div className="w-7 h-7 rounded-full bg-neutral-800 group-hover:bg-[#ff5500] text-white flex items-center justify-center transition-all group-hover:translate-x-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Daily Progress Ribbon at bottom */}
      <div className="flex items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm text-neutral-400 py-3 px-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>
            Bugün: <strong className="text-white font-mono">{todayHours > 0 ? `${todayHours} sa ${todayRemainingMins} dk` : `${todayRemainingMins} dk`}</strong>
          </span>
        </div>
        <span className="text-neutral-700">·</span>
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#ff5500]" />
          <span>
            Seri: <strong className="text-[#ff5500] font-mono">{streakDays} Gün</strong>
          </span>
        </div>
        <span className="text-neutral-700">·</span>
        <span>Hedef: <strong className="text-white font-mono">{dailyGoalHours} Saat</strong></span>
        {todayPlannedMinutes > 0 && (
          <>
            <span className="text-neutral-700">·</span>
            <span>
              Görev Planı: <strong className="text-sky-300 font-mono">{todayPlannedMinutes >= 60 ? `${Math.floor(todayPlannedMinutes / 60)} sa ${todayPlannedMinutes % 60} dk` : `${todayPlannedMinutes} dk`}</strong>
            </span>
            <span className="text-neutral-700">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
              Plana Uyum: %{Math.min(100, Math.round((todayMinutes / todayPlannedMinutes) * 100))}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
