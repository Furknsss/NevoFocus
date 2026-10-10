import React from 'react';
import { X, Volume2, CloudRain, Trees, Wind, Plane, Waves, Flame, BellRing } from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface AudioPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: string | null;
  onSelectTrack: (track: 'rain' | 'forest' | 'white_noise' | 'airplane' | 'ocean' | 'campfire' | 'off') => void;
  volume: number;
  onVolumeChange: (val: number) => void;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  onSelectTrack,
  volume,
  onVolumeChange,
}) => {
  if (!isOpen) return null;

  const tracks = [
    { id: 'off', label: 'Sessiz (Kapalı)', desc: 'Sadece seans çanı aktif', icon: Volume2 },
    { id: 'rain', label: 'Dingin Yağmur', desc: 'Sakinleştirici kesintisiz yağmur sesi', icon: CloudRain },
    { id: 'forest', label: 'Orman & Kuşlar', desc: 'Hafif esinti ve kuş cıvıltıları', icon: Trees },
    { id: 'white_noise', label: 'Beyaz Gürültü', desc: 'Dış sesleri izole eden derin akustik', icon: Wind },
    { id: 'airplane', label: 'Uçak Kabini', desc: 'Seyir irtifasında hipnotik kabin uğultusu', icon: Plane },
    { id: 'ocean', label: 'Okyanus Dalgaları', desc: 'Ritmik dingin su ve dalga yankısı', icon: Waves },
    { id: 'campfire', label: 'Kamp Ateşi', desc: 'Sıcak çıtırtılı gece ateşi', icon: Flame },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ff5500]/15 flex items-center justify-center text-[#ff5500]">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Zen Ortam Sesleri</h3>
              <p className="text-xs text-neutral-400">Arka plan sesleri ile dikkat dağınıklığını önle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Volume slider */}
        <div className="py-4 border-b border-neutral-800">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Ses Düzeyi</span>
            <span className="font-mono text-neutral-200">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg bg-neutral-800 accent-[#ff5500] cursor-pointer"
          />
        </div>

        {/* Track selector grid */}
        <div className="mt-4 grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {tracks.map((t) => {
            const Icon = t.icon;
            const isSelected = (currentTrack || 'off') === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onSelectTrack(t.id as any);
                  soundEngine.playClick();
                }}
                className={`flex items-center gap-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#ff5500] bg-[#ff5500]/10 text-white shadow-sm'
                    : 'border-neutral-800/80 bg-neutral-900/40 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/40'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-[#ff5500] text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t.label}</div>
                  <div className="text-xs text-neutral-400 truncate">{t.desc}</div>
                </div>
                {isSelected && (
                  <span className="text-xs font-bold text-[#ff5500] bg-[#ff5500]/20 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Test chime button */}
        <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => soundEngine.playCompletionBell()}
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-400" />
            <span>Tamamlanma Çanını Dinle</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
