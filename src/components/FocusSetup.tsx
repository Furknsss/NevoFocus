import React, { useState } from 'react';
import {
  Play,
  Plus,
  Check,
  Trees,
  Mountain,
  Plane,
  Waves,
  Sparkles,
  Flame,
  Clock,
  Ticket,
  Globe2,
  ArrowRight,
  Compass
} from 'lucide-react';
import { FocusModeType, SubjectItem, FocusTask, FlightAirport } from '../types';
import { FOCUS_MODES } from '../utils/storage';
import { POPULAR_AIRPORTS } from '../utils/airports';
import { ModeCardPreview } from './visuals/ModeCardPreview';
import { InteractiveFlightGlobe } from './visuals/InteractiveFlightGlobe';
import { soundEngine } from '../utils/audio';

interface FocusSetupProps {
  selectedMode: FocusModeType;
  onSelectMode: (mode: FocusModeType) => void;
  durationMinutes: number;
  onChangeDuration: (minutes: number) => void;
  subjects: SubjectItem[];
  selectedSubject: SubjectItem;
  onSelectSubject: (subject: SubjectItem) => void;
  onAddSubject: (name: string, color: string) => void;
  tasks: FocusTask[];
  selectedTask: FocusTask | null;
  onSelectTask: (task: FocusTask | null) => void;
  originAirport: FlightAirport;
  destAirport: FlightAirport;
  onChangeAirports: (origin: FlightAirport, dest: FlightAirport) => void;
  onStartSession: () => void;
  todayMinutes: number;
  dailyGoalHours: number;
  streakDays: number;
}

export const FocusSetup: React.FC<FocusSetupProps> = ({
  selectedMode,
  onSelectMode,
  durationMinutes,
  onChangeDuration,
  subjects,
  selectedSubject,
  onSelectSubject,
  onAddSubject,
  tasks,
  selectedTask,
  onSelectTask,
  originAirport,
  destAirport,
  onChangeAirports,
  onStartSession,
  todayMinutes,
  dailyGoalHours,
  streakDays,
}) => {
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#8b5cf6');

  const presetDurations = [15, 25, 45, 60, 90, 120];
  const currentModeConfig = FOCUS_MODES.find((m) => m.id === selectedMode) || FOCUS_MODES[0];

  const getModeIcon = (modeId: FocusModeType) => {
    switch (modeId) {
      case 'forest':
        return <Trees className="w-4 h-4 text-emerald-400" />;
      case 'climb':
        return <Mountain className="w-4 h-4 text-orange-400" />;
      case 'flight':
        return <Plane className="w-4 h-4 text-sky-400" />;
      case 'dive':
        return <Waves className="w-4 h-4 text-teal-400" />;
      case 'clock':
        return <Clock className="w-4 h-4 text-white" />;
    }
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    onAddSubject(newSubjectName.trim(), newSubjectColor);
    setNewSubjectName('');
    setShowAddSubjectModal(false);
  };

  const todayHours = Math.floor(todayMinutes / 60);
  const todayRemainingMins = todayMinutes % 60;
  const goalProgress = Math.min(100, Math.round((todayMinutes / (dailyGoalHours * 60)) * 100));

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-0.5 w-6 bg-[#ff5500]"></div>
          <span className="text-xs font-bold tracking-widest text-[#ff5500] uppercase">
            YENİ SEANS
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          Modunu seç, süreyi ayarla, başla.
        </h1>
      </div>

      {/* 5 Focus Mode Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {FOCUS_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => {
                onSelectMode(mode.id);
                soundEngine.playClick();
              }}
              className={`group relative flex flex-col text-left rounded-2xl p-2.5 sm:p-3 transition-all duration-200 cursor-pointer border ${
                isSelected
                  ? 'border-emerald-400/90 shadow-lg shadow-emerald-950/40 bg-neutral-900/90 ring-1 ring-emerald-400/50'
                  : 'border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/70'
              }`}
            >
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-3 bg-neutral-950">
                <ModeCardPreview mode={mode.id} isActive={isSelected} />

                <div
                  className={`absolute top-2 right-2 flex items-center justify-center rounded-full transition-all ${
                    isSelected
                      ? 'w-6 h-6 bg-emerald-500 text-black shadow-md'
                      : 'w-5 h-5 bg-black/40 border border-white/20 text-transparent opacity-0 group-hover:opacity-60'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              <div className="px-1.5 pb-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {getModeIcon(mode.id)}
                  <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {mode.title}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 font-medium">{mode.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* SPECIAL FOCUS FLIGHT 3D GLOBE & TICKET SECTION */}
      {selectedMode === 'flight' && (
        <div className="mb-8 rounded-3xl border border-sky-500/40 bg-gradient-to-br from-sky-950/30 to-neutral-950/80 p-5 sm:p-7 backdrop-blur-md shadow-2xl animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* 3D Interactive Rotating Globe */}
            <div className="w-full lg:w-1/2 aspect-square max-w-[340px] sm:max-w-[400px] rounded-2xl overflow-hidden bg-black/60 border border-sky-900/60 p-2">
              <InteractiveFlightGlobe
                origin={originAirport}
                destination={destAirport}
                progress={0.25}
              />
            </div>

            {/* Flight Ticket (Boarding Pass) Card */}
            <div className="w-full lg:w-1/2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-sky-800/40 mb-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-sky-400" />
                    <span className="text-sm font-bold text-white uppercase tracking-wider">
                      Uçuş Bileti (Boarding Pass)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-800/40">
                    FK-707 · Business Class
                  </span>
                </div>

                {/* Airport Route Selectors */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Kalkış Havalimanı
                    </label>
                    <select
                      value={originAirport.code}
                      onChange={(e) => {
                        const found = POPULAR_AIRPORTS.find((a) => a.code === e.target.value);
                        if (found) onChangeAirports(found, destAirport);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-sky-400"
                    >
                      {POPULAR_AIRPORTS.map((a) => (
                        <option key={a.code} value={a.code} disabled={a.code === destAirport.code}>
                          {a.city} ({a.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Varış Havalimanı
                    </label>
                    <select
                      value={destAirport.code}
                      onChange={(e) => {
                        const found = POPULAR_AIRPORTS.find((a) => a.code === e.target.value);
                        if (found) onChangeAirports(originAirport, found);
                      }}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-sky-400"
                    >
                      {POPULAR_AIRPORTS.map((a) => (
                        <option key={a.code} value={a.code} disabled={a.code === originAirport.code}>
                          {a.city} ({a.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Task selection for Flight */}
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Uçuş Görevi (Task Seç)
                  </label>
                  {tasks.length > 0 ? (
                    <select
                      value={selectedTask?.id || ''}
                      onChange={(e) => {
                        const t = tasks.find((item) => item.id === e.target.value) || null;
                        onSelectTask(t);
                        if (t) onChangeDuration(t.plannedMinutes);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="">Doğrudan ders odaklanması</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.plannedMinutes} dk - {t.subjectName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-neutral-400 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                      💡 Henüz bir görev eklenmemiş. Yukarıdaki "Görevler" sekmesinden veya aşağıdaki ders panelinden uçuş konunuzu seçebilirsiniz.
                    </p>
                  )}
                </div>
              </div>

              {/* Boarding Pass Summary footer */}
              <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-800/40 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-neutral-400 block">ROTA</span>
                  <strong className="text-white">
                    {originAirport.code} ✈ {destAirport.code}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">SÜRE</span>
                  <strong className="text-sky-400">{durationMinutes} DAKİKA</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">KOLTUK</span>
                  <strong className="text-white">12A</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standard Setup Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        {/* Left Panel: Duration Settings */}
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-5 sm:p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm sm:text-base font-semibold text-neutral-300">
                Süre — <strong className="text-white font-bold">{durationMinutes} dakika</strong>
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                {Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)}s ` : ''}
                {durationMinutes % 60}dk
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6">
              {presetDurations.map((mins) => {
                const isSelected = durationMinutes === mins;
                return (
                  <button
                    key={mins}
                    onClick={() => {
                      onChangeDuration(mins);
                      soundEngine.playClick();
                    }}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-center cursor-pointer border ${
                      isSelected
                        ? 'bg-[#ff5500] border-[#ff5500] text-white shadow-lg shadow-[#ff5500]/25 scale-[1.02]'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    {mins} dk
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="relative flex items-center mb-1">
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={durationMinutes}
                onChange={(e) => onChangeDuration(parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-[#ff5500]"
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-500 mt-1">
              <span>5 dk</span>
              <span>45 dk</span>
              <span>90 dk</span>
              <span>180 dk</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Subject & Topic Selection */}
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 p-5 sm:p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm sm:text-base font-semibold text-neutral-300">
                Ders / konu
              </span>
              <button
                onClick={() => setShowAddSubjectModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-[#ff5500] hover:text-[#ff7722] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Ders</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {subjects.map((sub) => {
                const isSelected = selectedSubject.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      onSelectSubject(sub);
                      soundEngine.playClick();
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#10b981] border-[#10b981] text-black font-bold shadow-md shadow-[#10b981]/20 scale-[1.02]'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    {!isSelected && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                    )}
                    <span>{sub.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
            <span>
              Seçilen: <strong className="text-white">{selectedSubject.name}</strong>
            </span>
            <span className="text-neutral-500">Zaman çizelgenize kaydedilir</span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={() => {
            soundEngine.playClick();
            onStartSession();
          }}
          className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[#ff5500] to-[#ff6600] text-white text-base sm:text-lg font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#ff5500]/30 hover:shadow-[#ff5500]/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
        >
          <Play className="w-5 h-5 fill-white group-hover:translate-x-0.5 transition-transform" />
          <span>
            {selectedMode === 'flight'
              ? `🎫 ${originAirport.code} → ${destAirport.code} Uçuşunu Başlat (${durationMinutes} dk)`
              : `${durationMinutes} dakikalık ${currentModeConfig.title} seansını başlat`}
          </span>
        </button>

        <div className="flex items-center gap-4 text-xs sm:text-sm text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>
              Bugün: <strong className="text-white font-mono">{todayHours > 0 ? `${todayHours} sa ${todayRemainingMins} dk` : `${todayRemainingMins} dk`}</strong>
            </span>
          </div>
          <span className="text-neutral-700">·</span>
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#ff5500]" />
            <span>
              Seri: <strong className="text-[#ff5500] font-mono">{streakDays} Gün</strong>
            </span>
          </div>
          <span className="text-neutral-700">·</span>
          <span className="text-neutral-400 hidden lg:inline">Hedef: %{goalProgress}</span>
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Yeni Ders veya Konu Ekle</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Çalıştığın özel sınav, proje veya üniversite dersini ekle
            </p>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Ders Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder="örn: Geometri, Organik Kimya, TYT Deneme"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Renk Seç
                </label>
                <div className="flex items-center gap-2">
                  {['#10b981', '#3b82f6', '#ec4899', '#f97316', '#8b5cf6', '#06b6d4', '#eab308', '#ef4444'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewSubjectColor(col)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        newSubjectColor === col ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#ff5500] hover:bg-[#ff6600] transition-colors cursor-pointer"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
