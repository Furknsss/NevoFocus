import React from 'react';
import { Check, ChevronRight, Clock3, Coffee, Layers3, Mountain, Plane, Trees, Waves } from 'lucide-react';
import { FocusModeType } from '../types';
import { FOCUS_MODES } from '../utils/storage';
import { soundEngine } from '../utils/audio';

interface FocusModeSettingsProps {
  selectedMode: FocusModeType;
  onSelectMode: (mode: FocusModeType) => void;
  onOpenRestDays: () => void;
  selectionDisabled?: boolean;
}

const MODE_PRESENTATION = {
  clock: { icon: Clock3, color: 'text-white', ring: 'border-[#ff5500]/70 bg-[#ff5500]/10', tag: 'Önerilen' },
  forest: { icon: Trees, color: 'text-emerald-400', ring: 'border-emerald-500/60 bg-emerald-500/10', tag: 'Doğa' },
  climb: { icon: Mountain, color: 'text-orange-400', ring: 'border-orange-500/60 bg-orange-500/10', tag: 'Hedef' },
  flight: { icon: Plane, color: 'text-sky-400', ring: 'border-sky-500/60 bg-sky-500/10', tag: 'Keşif' },
  dive: { icon: Waves, color: 'text-cyan-400', ring: 'border-cyan-500/60 bg-cyan-500/10', tag: 'Derinlik' },
} as const;

const modes = [...FOCUS_MODES].sort((a, b) => Number(b.id === 'clock') - Number(a.id === 'clock'));

export const FocusModeSettings: React.FC<FocusModeSettingsProps> = ({
  selectedMode,
  onSelectMode,
  onOpenRestDays,
  selectionDisabled = false,
}) => {
  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#242026] via-[#17171d] to-[#111116] border border-white/10 p-4 sm:p-5">
        <div className="absolute -right-8 -top-12 w-36 h-36 rounded-full bg-[#ff5500]/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ff5500]/15 border border-[#ff5500]/25 text-[#ff682d] flex items-center justify-center shrink-0">
            <Layers3 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff875c]">Odaklanma deneyimi</p>
            <h4 className="text-base font-bold text-white mt-1">Sana uygun modu belirle</h4>
            <p className="text-xs text-neutral-400 leading-relaxed mt-1">
              Odaklan ekranı doğrudan seçtiğin modla açılır. Mod kartları çalışma ekranında görünmez.
              Sade bir deneyim için Dijital Saat önerilir.
            </p>
          </div>
        </div>
      </div>

      {selectionDisabled && (
        <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
          Devam eden odak seansın varken mod değiştirilemez. Önce seansı tamamla veya sonlandır.
        </div>
      )}

      <div role="radiogroup" aria-label="Odaklanma modu" className="space-y-2.5">
        {modes.map((mode) => {
          const details = MODE_PRESENTATION[mode.id];
          const Icon = details.icon;
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={mode.title + (isSelected ? ', seçili' : '')}
              disabled={selectionDisabled}
              onClick={() => {
                if (isSelected) return;
                soundEngine.playClick();
                onSelectMode(mode.id);
              }}
              className={`w-full min-h-[80px] flex items-center gap-3.5 rounded-2xl border p-3.5 sm:p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] disabled:opacity-60 disabled:cursor-not-allowed ${isSelected ? details.ring : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-600 hover:bg-neutral-800/80'}`}
            >
              <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border border-white/10 bg-neutral-800/80 ${details.color}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{mode.title}</span>
                  {mode.id === 'clock' && (
                    <span className="rounded-full border border-[#ff5500]/30 bg-[#ff5500]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ff956c]">
                      Varsayılan
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-neutral-400 leading-relaxed mt-0.5">{mode.subtitle}</span>
              </span>
              <span className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#ff5500] bg-[#ff5500] text-white' : 'border-neutral-700 text-neutral-500'}`}>
                {isSelected ? <Check className="w-4 h-4" aria-hidden="true" /> : <span className="w-2 h-2 rounded-full bg-neutral-700" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="pt-1 border-t border-white/10">
        <button
          type="button"
          onClick={onOpenRestDays}
          className="w-full flex items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]"
        >
          <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center">
            <Coffee className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-white">Mola günü ayarları</span>
            <span className="block text-[11px] text-neutral-400 mt-0.5">Dinlenme günlerini ve haftalık planını yönet</span>
          </span>
          <ChevronRight className="w-4 h-4 text-neutral-500" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
