import React from 'react';
import { X, Trophy, Sparkles, Award, Star, Flame, Target, BookOpen, Clock, Zap, Lock } from 'lucide-react';
import { UserProfile, FocusSession } from '../types';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  sessions: FocusSession[];
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  profile,
  sessions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-[#12141a] p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 text-left">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">Başarılar & Rozetler</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Geliştirme Aşamasında</span>
            </div>
            <h4 className="text-xl font-extrabold text-white">Çok Yakında Sizlerle!</h4>
            <p className="text-xs text-neutral-400 mt-2 max-w-xs mx-auto leading-relaxed">
              Özel seri rozetleri, maraton şampiyonlukları, zirve tırmanışı madalyaları ve seviye ödülleri sonraki güncellemelerde burada aktif olacaktır.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Tamamdır, Beklemedeyim 👍
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
