import React, { useState } from 'react';
import {
  X,
  Trees,
  Calendar,
  Clock,
  Sparkles,
  Award,
  CheckCircle2,
  Leaf,
  Filter,
  Flame,
  Search,
  ExternalLink
} from 'lucide-react';
import { FocusSession } from '../../types';
import { getStoredSessions } from '../../utils/storage';

interface MyForestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession?: () => void;
}

// Stylized cute Forest Focus app vector tree icon
const ForestAppTreeBadge: React.FC<{ color?: string; size?: number; isSprout?: boolean }> = ({
  color = '#10b981',
  size = 56,
  isSprout = false,
}) => {
  if (isSprout) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="drop-shadow-md">
        <ellipse cx="32" cy="56" rx="20" ry="5" fill="#2d1a10" />
        <ellipse cx="32" cy="54" rx="16" ry="3.5" fill="#10b981" />
        <path d="M32 54 L32 38" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="25" cy="35" rx="7" ry="4" fill="#10b981" transform="rotate(-25 25 35)" />
        <ellipse cx="39" cy="35" rx="7" ry="4" fill="#34d399" transform="rotate(25 39 35)" />
        <circle cx="42" cy="32" r="1.5" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="drop-shadow-md">
      {/* Earth mound */}
      <ellipse cx="32" cy="57" rx="24" ry="5.5" fill="#2d1a10" />
      <ellipse cx="32" cy="55" rx="20" ry="4" fill="#059669" />
      {/* Wood trunk */}
      <path d="M30 55 L30 35 L34 35 L34 55 Z" fill="#78350f" />
      {/* Cloud foliage puffs (signature Forest app style) */}
      <circle cx="21" cy="35" r="11" fill={color} opacity="0.9" />
      <circle cx="43" cy="35" r="11" fill={color} opacity="0.9" />
      <circle cx="32" cy="24" r="14" fill={color} />
      <circle cx="30" cy="20" r="9" fill="#a7f3d0" opacity="0.35" />
      {/* Blossom flowers */}
      <circle cx="23" cy="28" r="2.2" fill="#f472b6" />
      <circle cx="23" cy="28" r="1" fill="#ffffff" />
      <circle cx="39" cy="25" r="2.2" fill="#fbbf24" />
      <circle cx="39" cy="25" r="1" fill="#ffffff" />
      <circle cx="32" cy="33" r="2" fill="#fbcfe8" />
    </svg>
  );
};

export const MyForestModal: React.FC<MyForestModalProps> = ({
  isOpen,
  onClose,
  onStartSession,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTreeSession, setSelectedTreeSession] = useState<FocusSession | null>(null);

  if (!isOpen) return null;

  // Retrieve completed forest sessions (or all completed focus sessions)
  const allSessions = getStoredSessions();
  const forestSessions = allSessions.filter(
    (s) => s.completed && (s.mode === 'forest' || s.forestInfo || s.completedSeconds >= 600)
  );

  // Filter based on period
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const filteredSessions = forestSessions.filter((s) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNote = s.note?.toLowerCase().includes(q);
      const matchTask = s.taskTitle?.toLowerCase().includes(q);
      const matchSubject = s.subjectName?.toLowerCase().includes(q);
      if (!matchNote && !matchTask && !matchSubject) return false;
    }

    if (filterPeriod === 'today') {
      return s.dateString === todayStr;
    }
    if (filterPeriod === 'week') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return s.timestamp >= oneWeekAgo;
    }
    return true;
  });

  // Forest stats
  const totalTrees = forestSessions.length;
  const totalMinutes = forestSessions.reduce(
    (acc, s) => acc + Math.round((s.completedSeconds || s.plannedMinutes * 60) / 60),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);
  const oxygenKg = (totalTrees * 0.42).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black rounded-3xl border border-emerald-500/20 shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-wide">Kişisel Kadim Ormanım</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 rounded-full">
                  {totalTrees} Ağaç Dikildi
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Her tamamlanan odaklanma seansında tarih ve göreviyle yeşeren ağaçların
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Forest Vital Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 bg-black/40 border-b border-white/5">
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-emerald-900/30">
            <span className="text-[11px] text-neutral-400 font-medium block">Toplam Dikilen Ağaç</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-emerald-400 font-mono">{totalTrees}</span>
              <span className="text-xs text-emerald-600 font-bold">fidan</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-emerald-900/30">
            <span className="text-[11px] text-neutral-400 font-medium block">Orman Odaklanma Süresi</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{totalHours}</span>
              <span className="text-xs text-neutral-400 font-bold">saat</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-emerald-900/30">
            <span className="text-[11px] text-neutral-400 font-medium block">Üretilen Oksijen (O₂)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-sky-400 font-mono">{oxygenKg}</span>
              <span className="text-xs text-sky-600 font-bold">kg</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-emerald-900/30">
            <span className="text-[11px] text-neutral-400 font-medium block">Orman Sağlığı & Canlılık</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-emerald-300 font-mono">%100</span>
              <span className="text-xs text-emerald-500 font-bold">kusursuz</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-neutral-950/40">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-white/10">
            <button
              onClick={() => setFilterPeriod('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'all'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Tüm Ağaçlar
            </button>
            <button
              onClick={() => setFilterPeriod('week')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'week'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Bu Hafta
            </button>
            <button
              onClick={() => setFilterPeriod('today')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'today'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Bugün
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Görev veya ders ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-emerald-900/40 bg-emerald-950/10">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl border border-emerald-500/30 shadow-xl bg-black/60 flex items-center justify-center p-2">
                <ForestAppTreeBadge isSprout={true} size={64} />
              </div>
              <h4 className="text-base font-bold text-white mb-1">Henüz Bu Filtrede Ağaç Bulunmuyor</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto mb-4">
                Kadim Orman modunda bir odaklanma seansı tamamladığında, her seansın için görevi ve tarihiyle birlikte ulu bir ağaç yeşerecek!
              </p>
              {onStartSession && (
                <button
                  onClick={() => {
                    onClose();
                    onStartSession();
                  }}
                  className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg transition-all cursor-pointer"
                >
                  İlk Ağacını Dikmeye Başla 🌱
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Ormanındaki Ağaçlar ({filteredSessions.length})
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  Görevi ve Tarihiyle Büyüyen Ağaç Korun
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredSessions.map((session, idx) => {
                  const durationMins = Math.round(
                    (session.completedSeconds || session.plannedMinutes * 60) / 60
                  );
                  const isSprout = durationMins < 20;

                  return (
                    <div
                      key={session.id || idx}
                      onClick={() => setSelectedTreeSession(session)}
                      className="group p-4 rounded-2xl bg-neutral-900/80 hover:bg-neutral-900 border border-emerald-500/20 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg hover:shadow-emerald-950/30 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {/* Stylized Forest Focus App Tree badge */}
                        <div className="w-14 h-14 rounded-2xl shrink-0 border border-emerald-500/30 bg-black/50 group-hover:scale-105 transition-transform flex items-center justify-center p-1">
                          <ForestAppTreeBadge
                            isSprout={isSprout}
                            color={session.subjectColor || '#10b981'}
                            size={48}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${session.subjectColor || '#10b981'}25`,
                                color: session.subjectColor || '#10b981',
                              }}
                            >
                              {session.subjectName || 'Odak Seansı'}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              {session.dateString}
                            </span>
                          </div>

                          <h5 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                            {session.taskTitle || session.note || 'Özel Odak Hedefi'}
                          </h5>
                          <span className="text-[11px] text-neutral-400 font-medium">
                            {session.forestInfo?.treeSpecies || (isSprout ? 'Taze Filiz Çınarı' : 'Mistik Zümrüt Bonsai')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{durationMins} dk odak</span>
                        </span>
                        <span className="flex items-center gap-1 text-neutral-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Tamamlandı</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Tree Detail Modal */}
        {selectedTreeSession && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl p-6 flex flex-col justify-center items-center animate-in fade-in">
            <div className="max-w-md w-full bg-neutral-900 border border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-28 h-28 mx-auto rounded-3xl border-2 border-emerald-500/60 bg-black/60 shadow-2xl flex items-center justify-center p-3">
                <ForestAppTreeBadge
                  isSprout={Math.round((selectedTreeSession.completedSeconds || 0) / 60) < 20}
                  color={selectedTreeSession.subjectColor || '#10b981'}
                  size={92}
                />
              </div>

              <div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  🌿 Ağaç Detay Kartı
                </span>
                <h4 className="text-lg font-black text-white">
                  {selectedTreeSession.taskTitle || selectedTreeSession.note || 'Odak Seansı'}
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Ders: {selectedTreeSession.subjectName} · {selectedTreeSession.dateString} ({selectedTreeSession.startTimeString || 'Gündüz'})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left bg-black/50 p-3 rounded-2xl border border-white/5 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10px]">Ağaç Türü:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedTreeSession.forestInfo?.treeSpecies || 'Mistik Zümrüt Bonsai'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">Kazanılan Süre:</span>
                  <span className="font-bold text-white font-mono">
                    {Math.round((selectedTreeSession.completedSeconds || 0) / 60)} Dakika
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTreeSession(null)}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
