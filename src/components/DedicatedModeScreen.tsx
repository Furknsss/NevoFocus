import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Clock,
  Plus,
  Ticket,
  Trees,
  Mountain,
  Plane,
  Waves,
  Sparkles,
  Tent,
  CheckCircle2,
  CheckSquare,
  Timer,
  Hourglass,
  Calendar
} from 'lucide-react';
import { FocusModeType, SubjectItem, FocusTask, FlightAirport, UserProfile } from '../types';
import { ALL_AIRPORTS, TURKEY_AIRPORTS, WORLD_AIRPORTS } from '../utils/airports';
import { WorldMap2DFlight } from './visuals/WorldMap2DFlight';
import { ActiveClimbCanvas } from './visuals/ActiveClimbCanvas';
import { ActiveDiveCanvas } from './visuals/ActiveDiveCanvas';
import { ActiveForestCanvas } from './visuals/ActiveForestCanvas';
import { BoardingPassCard } from './flight/BoardingPassCard';
import { MyForestModal } from './forest/MyForestModal';
import { soundEngine } from '../utils/audio';

interface DedicatedModeScreenProps {
  mode: FocusModeType;
  onBackToHub: () => void;
  subjects: SubjectItem[];
  selectedSubject: SubjectItem;
  onSelectSubject: (s: SubjectItem) => void;
  durationMinutes: number;
  onChangeDuration: (m: number) => void;
  tasks: FocusTask[];
  selectedTask: FocusTask | null;
  onSelectTask: (t: FocusTask | null) => void;
  originAirport: FlightAirport;
  destAirport: FlightAirport;
  onChangeAirports: (orig: FlightAirport, dest: FlightAirport) => void;
  profile: UserProfile;
  timerType: 'countdown' | 'stopwatch';
  onChangeTimerType: (type: 'countdown' | 'stopwatch') => void;
  onAddNewTask?: (task: Omit<FocusTask, 'id' | 'createdAt'>) => void;
  onStartActiveSession: () => void;
}

export const DedicatedModeScreen: React.FC<DedicatedModeScreenProps> = ({
  mode,
  onBackToHub,
  subjects,
  selectedSubject,
  onSelectSubject,
  durationMinutes,
  onChangeDuration,
  tasks,
  selectedTask,
  onSelectTask,
  originAirport,
  destAirport,
  onChangeAirports,
  profile,
  timerType,
  onChangeTimerType,
  onAddNewTask,
  onStartActiveSession,
}) => {
  const [selectedPeak, setSelectedPeak] = useState('Kaçkar Zirvesi (3,937m)');
  const [selectedTreeSpecies, setSelectedTreeSpecies] = useState('Mistik Zümrüt Bonsai');
  const [isMyForestOpen, setIsMyForestOpen] = useState(false);

  const peaks = [
    { name: 'Kaçkar Zirvesi (3,937m)', diff: 'Orta', region: 'Rize / Karadeniz' },
    { name: 'Ağrı Dağı Zirvesi (5,137m)', diff: 'Zorlu', region: 'Doğu Anadolu' },
    { name: 'Erciyes Dağı (3,917m)', diff: 'Orta', region: 'Kayseri / İç Anadolu' },
    { name: 'Everest Zirvesi (8,848m)', diff: 'Ekstrem', region: 'Himalayalar' },
  ];

  const treeSpeciesList = [
    { name: 'Mistik Zümrüt Bonsai', color: '#10b981', desc: 'Biolüminesans zümrüt yapraklar' },
    { name: 'Pembe Çiçekli Sakura', color: '#f472b6', desc: 'Japon kiraz çiçeği baharı' },
    { name: 'Kadim Anadolu Çınarı', color: '#14b8a6', desc: 'Derin kökler ve ulu gövde' },
    { name: 'Altın Kızılçam Sekoyası', color: '#f59e0b', desc: 'Görkemli asırlık göğe uzanış' },
  ];

  const handleStart = () => {
    soundEngine.playClick();
    if (!selectedSubject && subjects.length > 0) {
      onSelectSubject(subjects[0]);
    }
    onStartActiveSession();
  };

  // Reusable unified control bar (Görev Seçimi + Sayaç Tipi + Başlat)
  const renderUnifiedTaskTimerBar = (actionText: string, accentGradient: string) => {
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-neutral-900/90 to-neutral-950 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* 1. GÖREV SEÇİMİ (Sadece Görev Seçimi) */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[#ff5500]" />
                <span>Odaklanılacak Görev / Hedef</span>
              </label>
              {tasks.length === 0 && (
                <span className="text-[11px] text-neutral-500">
                  Görevler sekmesinden yeni görev ekleyebilirsin
                </span>
              )}
            </div>

            {/* Task Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedTask?.id || ''}
                onChange={(e) => {
                  const t = tasks.find((item) => item.id === e.target.value) || null;
                  onSelectTask(t);
                  if (t) {
                    onChangeDuration(t.plannedMinutes);
                    const sub = subjects.find((s) => s.name === t.subjectName);
                    if (sub) onSelectSubject(sub);
                  }
                }}
                className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-700/80 hover:border-neutral-600 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#ff5500] transition-colors cursor-pointer"
              >
                <option value="">Bağımsız / Görevsiz Serbest Çalışma</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.plannedMinutes} dk ({t.subjectName})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Task Details Pill */}
            {selectedTask ? (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedTask.subjectColor }}
                />
                <span className="text-xs font-semibold text-neutral-300">{selectedTask.subjectName}</span>
                <span className="text-neutral-500 text-xs">·</span>
                <span className="text-xs font-mono font-bold text-white">
                  {timerType === 'countdown' ? `${selectedTask.plannedMinutes} dk Süreli` : 'Kronometre ile Serbest Süre'}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400 pt-0.5">
                Görevler sekmesinden oluşturduğun hedefleri seçebilir veya bağımsız serbest seans başlatabilirsin.
              </p>
            )}
          </div>

          {/* 2. SAYAÇ TİPİ (Geri Sayım vs Kronometre) */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-sky-400" />
              <span>Sayaç Tipi</span>
            </label>

            <div className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-900 border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeTimerType('countdown');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  timerType === 'countdown'
                    ? 'bg-[#ff5500] text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Hourglass className="w-3.5 h-3.5" />
                <span>Geri Sayım</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeTimerType('stopwatch');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  timerType === 'stopwatch'
                    ? 'bg-sky-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Kronometre</span>
              </button>
            </div>
            <span className="text-[10px] text-neutral-400 block text-right">
              {timerType === 'countdown' ? 'Süreden geriye doğru sayar' : '00:00\'dan yukarı sayar'}
            </span>
          </div>
        </div>

        {/* 3. BAŞLAT (Start Session Action Button) */}
        <div className="pt-2 text-center">
          <button
            onClick={handleStart}
            className={`w-full sm:w-auto px-12 py-4 rounded-full ${accentGradient} hover:brightness-110 text-white font-black text-base sm:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-3`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{actionText}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Top Navigation & Back Button */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80 mb-6">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Mod Seçimine Dön</span>
        </button>

        <div className="flex items-center gap-2">
          {mode === 'flight' && (
            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-3 py-1 rounded-full">
              ✈️ Focus Flight İstasyonu
            </span>
          )}
          {mode === 'climb' && (
            <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/60 border border-orange-800/40 px-3 py-1 rounded-full">
              🏔️ Dağcılık Üssü
            </span>
          )}
          {mode === 'forest' && (
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full">
              🌿 Kadim Orman Alanı
            </span>
          )}
          {mode === 'dive' && (
            <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-800/40 px-3 py-1 rounded-full">
              🌊 Okyanus Araştırma
            </span>
          )}
        </div>
      </div>

      {/* 1. FOCUS FLIGHT: 2D WORLD MAP & AIRLINE BOARDING PASS */}
      {mode === 'flight' && (
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto mb-2">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Focus Flight Terminali</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Yüksek kaliteli 2D dünya haritası üzerinde ülkeler, kesikli uçuş rotası ve kalkış-varış havalimanları.
            </p>
          </div>

          {/* 2D World Map & Airport Selectors */}
          <div className="rounded-3xl border border-sky-900/60 bg-gradient-to-b from-[#0a1829] to-[#040912] p-5 sm:p-7 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* 2D International Flight Radar Map */}
              <div className="lg:col-span-7 w-full aspect-video rounded-2xl overflow-hidden bg-black/80 border border-sky-900/50 shadow-2xl">
                <WorldMap2DFlight origin={originAirport} destination={destAirport} progress={0.15} />
              </div>

              {/* Airport Selection Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Uçuş Güzergahı</span>
                    <span className="text-[11px] text-neutral-400">{ALL_AIRPORTS.length} Havalimanı Mevcut</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Departure Airport */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Kalkış Havalimanı</label>
                      <select
                        value={originAirport.code}
                        onChange={(e) => {
                          const f = ALL_AIRPORTS.find((a) => a.code === e.target.value);
                          if (f) onChangeAirports(f, destAirport);
                        }}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-sky-400"
                      >
                        <optgroup label="🇹🇷 Türkiye Havalimanları">
                          {TURKEY_AIRPORTS.map((a) => (
                            <option key={a.code} value={a.code} disabled={a.code === destAirport.code}>
                              {a.city} - {a.name} ({a.code})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🌍 Dünya Havalimanları">
                          {WORLD_AIRPORTS.map((a) => (
                            <option key={a.code} value={a.code} disabled={a.code === destAirport.code}>
                              {a.city} - {a.name} ({a.code})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Destination Airport */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Varış Havalimanı</label>
                      <select
                        value={destAirport.code}
                        onChange={(e) => {
                          const f = ALL_AIRPORTS.find((a) => a.code === e.target.value);
                          if (f) onChangeAirports(originAirport, f);
                        }}
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-sky-400"
                      >
                        <optgroup label="🇹🇷 Türkiye Havalimanları">
                          {TURKEY_AIRPORTS.map((a) => (
                            <option key={a.code} value={a.code} disabled={a.code === originAirport.code}>
                              {a.city} - {a.name} ({a.code})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🌍 Dünya Havalimanları">
                          {WORLD_AIRPORTS.map((a) => (
                            <option key={a.code} value={a.code} disabled={a.code === originAirport.code}>
                              {a.city} - {a.name} ({a.code})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Airline Boarding Pass Preview */}
                <BoardingPassCard
                  passengerName={profile.name}
                  origin={originAirport}
                  destination={destAirport}
                  durationMinutes={durationMinutes}
                  flightCode="FK 0575"
                  seat="55L"
                  gate="22"
                  selectedTask={selectedTask}
                />
              </div>
            </div>
          </div>

          {/* Unified Controls: Task Selection + Countdown/Stopwatch + Launch */}
          {renderUnifiedTaskTimerBar(
            `${originAirport.code} ✈ ${destAirport.code} Uçuşunu Başlat`,
            'bg-gradient-to-r from-sky-500 to-blue-600 shadow-sky-500/30'
          )}
        </div>
      )}

      {/* 2. CLIMB: MOUNTAIN PEAK ASCENT */}
      {mode === 'climb' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Climb Focus Dağcılık Üssü</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Zirve rotanı seç, dilediğinde gece kamp ateşi molası ver ve tepeye zafer bayrağını dik.
            </p>
          </div>

          {/* Live Flowing Climb Preview Canvas */}
          <div className="w-full h-56 sm:h-64 rounded-3xl overflow-hidden border border-orange-900/40 relative shadow-2xl bg-black">
            <ActiveClimbCanvas progress={0.35} isPaused={false} isCampActive={false} elapsedSeconds={120} breakSeconds={0} />
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-orange-500/30 text-[11px] font-mono text-orange-400 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              <span>Canlı Rota Akışı</span>
            </div>
          </div>

          {/* Peak selection grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {peaks.map((p) => {
              const isSel = selectedPeak === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => setSelectedPeak(p.name)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSel
                      ? 'border-orange-500 bg-orange-950/30 text-white shadow-lg shadow-orange-950/40 ring-1 ring-orange-500/50'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold">{p.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                      {p.diff}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">{p.region}</span>
                </button>
              );
            })}
          </div>

          {/* Unified Controls: Task Selection + Countdown/Stopwatch + Launch */}
          {renderUnifiedTaskTimerBar(
            `${selectedPeak.split(' ')[0]} Tırmanışını Başlat`,
            'bg-gradient-to-r from-orange-600 to-amber-600 shadow-orange-600/30'
          )}
        </div>
      )}

      {/* 3. DIVE: FISHERMAN ESCAPE & FISH CITY */}
      {mode === 'dive' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Deep Dive Okyanus İstasyonu</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Balıkçı teknesinden atlayıp kaçan altın balığın derinlerdeki ışıltılı Balık Şehri'ne yolculuğu.
            </p>
          </div>

          {/* Live Flowing Dive Preview Canvas */}
          <div className="w-full h-56 sm:h-64 rounded-3xl overflow-hidden border border-teal-900/40 relative shadow-2xl bg-black">
            <ActiveDiveCanvas progress={0.0} isPaused={false} elapsedSeconds={0} />
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-teal-500/30 text-[11px] font-mono text-teal-400 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>Canlı Dalış & Atlama Önizlemesi</span>
            </div>
          </div>

          {/* Mission Story Info */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-teal-950/40 to-neutral-900 border border-teal-800/40 flex items-center gap-4">
            <span className="text-3xl">🐟</span>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Başlat butonuna bastığında balık <strong>tekneden suya atlayarak</strong> dalışa başlayacak ve süren bittiğinde 1,000m dipteki <strong>Balık Şehri Sarayı'na</strong> varacaktır.
            </p>
          </div>

          {/* Unified Controls: Task Selection + Countdown/Stopwatch + Launch */}
          {renderUnifiedTaskTimerBar(
            'Dalışı Başlat & Balık Şehrine Kaç',
            'bg-gradient-to-r from-teal-500 to-cyan-500 text-black shadow-teal-500/30'
          )}
        </div>
      )}

      {/* 4. FOREST: SEED TO ANCIENT TREE */}
      {mode === 'forest' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-emerald-950/60">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Forest Kadim Orman Alanı</h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Toprağa altın bir tohum ek, odaklandıkça dallanıp çiçek açsın ve kalıcı Sanal Ormanına eklensin.
              </p>
            </div>

            {/* Ormanım Button at Top */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setIsMyForestOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Trees className="w-4 h-4" />
              <span>🌳 Ormanım (Korum)</span>
            </button>
          </div>

          {/* Live Flowing Forest Tree Canvas (Forest Focus Style) */}
          <div className="w-full h-64 sm:h-72 rounded-3xl overflow-hidden border border-emerald-900/40 relative shadow-2xl bg-black">
            <ActiveForestCanvas progress={0.65} isPaused={false} elapsedSeconds={120} />
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/30 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Forest Odak Büyüme Önizlemesi</span>
            </div>
          </div>

          {/* Tree species cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {treeSpeciesList.map((tr) => {
              const isSel = selectedTreeSpecies === tr.name;
              return (
                <button
                  key={tr.name}
                  onClick={() => setSelectedTreeSpecies(tr.name)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSel
                      ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tr.color }} />
                    <span className="text-base font-bold">{tr.name}</span>
                  </div>
                  <span className="text-xs text-neutral-500">{tr.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Unified Controls: Task Selection + Countdown/Stopwatch + Launch */}
          {renderUnifiedTaskTimerBar(
            `Tohumu Ek & ${selectedTreeSpecies.split(' ')[0]} Büyüt`,
            'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/30'
          )}
        </div>
      )}

      {/* Kişisel Ormanım Modal */}
      <MyForestModal
        isOpen={isMyForestOpen}
        onClose={() => setIsMyForestOpen(false)}
        onStartSession={handleStart}
      />
    </div>
  );
};
