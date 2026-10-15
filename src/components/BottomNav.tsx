import React from 'react';
import {
  Flame,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  User,
  Compass
} from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface BottomNavProps {
  currentTab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students';
  onSelectTab: (tab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students') => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  activeModeTitle?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenSettings,
  onOpenProfile,
  activeModeTitle,
}) => {
  const handleTabClick = (tab: 'focus' | 'tasks' | 'stats' | 'students') => {
    soundEngine.playClick();
    onSelectTab(tab);
  };

  return (
    <nav
      aria-label="Mobil Gezinme Menüsü"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#090b10]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.8)]"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center gap-1">
        
        {/* 1. ODAK */}
        <button
          type="button"
          onClick={() => handleTabClick('focus')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'focus'
              ? 'text-[#ff5500]'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <Flame className={`w-5 h-5 ${currentTab === 'focus' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {currentTab === 'focus' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#ff5500] shadow-[0_0_8px_#ff5500]" />
            )}
          </div>
          <span className="text-[10px] font-bold mt-1 tracking-tight truncate max-w-[56px]">
            {activeModeTitle || 'Odak'}
          </span>
        </button>

        {/* 2. GÖREVLER */}
        <button
          type="button"
          onClick={() => handleTabClick('tasks')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'tasks'
              ? 'text-emerald-400'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <CheckSquare className={`w-5 h-5 ${currentTab === 'tasks' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {currentTab === 'tasks' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            )}
          </div>
          <span className="text-[10px] font-bold mt-1 tracking-tight">Görevler</span>
        </button>

        {/* 3. İSTATİSTİK */}
        <button
          type="button"
          onClick={() => handleTabClick('stats')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'stats'
              ? 'text-sky-400'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <BarChart3 className={`w-5 h-5 ${currentTab === 'stats' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {currentTab === 'stats' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            )}
          </div>
          <span className="text-[10px] font-bold mt-1 tracking-tight">İstatistik</span>
        </button>

        {/* 4. ÖĞRENCİLER */}
        {/* 4. ÖĞRENCİLER & ODALAR */}
        <button
          type="button"
          onClick={() => handleTabClick('students')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer relative ${
            currentTab === 'students' || currentTab === 'rooms'
              ? 'text-purple-400'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <div className="relative">
            <Users className={`w-5 h-5 ${currentTab === 'students' || currentTab === 'rooms' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {(currentTab === 'students' || currentTab === 'rooms') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
            )}
          </div>
          <span className="text-[10px] font-bold mt-1 tracking-tight">Öğrenciler</span>
        </button>

        {/* 5. AYARLAR */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenSettings();
          }}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5 stroke-2" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">Ayarlar</span>
        </button>

      </div>
    </nav>
  );
};
