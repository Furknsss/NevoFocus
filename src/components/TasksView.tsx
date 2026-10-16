import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  ListTodo,
  ArrowRight,
  BookOpen,
  Video,
  PenTool,
  Repeat,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  X
} from 'lucide-react';
import { FocusTask, FocusTaskType, StudyAreaType, SubjectItem, FocusSession } from '../types';
import { soundEngine } from '../utils/audio';
import { getAllowedAreasForTrack, getSubjectsForAreaAndTrack, normalizeStudyTrack } from '../utils/subjects';

interface TasksViewProps {
  tasks: FocusTask[];
  subjects: SubjectItem[];
  studentTrack?: string;
  sessions?: FocusSession[];
  dailyGoalHours?: number;
  onAddTask: (task: Omit<FocusTask, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string, manualDurationMinutes?: number) => void;
  onDeleteTask: (taskId: string) => void;
  onStartTaskWithMode: (task: FocusTask) => void;
}

const TASK_TYPES: { id: FocusTaskType; label: string; icon: any; color: string }[] = [
  { id: 'soru', label: 'Soru Çözümü', icon: PenTool, color: '#ff5500' },
  { id: 'video', label: 'Video İzleme', icon: Video, color: '#3b82f6' },
  { id: 'konu', label: 'Konu Çalışma', icon: BookOpen, color: '#10b981' },
  { id: 'rutin', label: 'Rutin / Tekrar', icon: Repeat, color: '#8b5cf6' },
  { id: 'deneme', label: 'Deneme Çözümü', icon: FileSpreadsheet, color: '#ec4899' },
];

export const TasksView = React.memo<TasksViewProps>(({
  tasks,
  subjects,
  studentTrack = 'Sayısal',
  sessions = [],
  dailyGoalHours = 6,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onStartTaskWithMode,
}) => {
  // Day selection state: dayOffset 0 is today, -1 is yesterday, +1 is tomorrow
  const [dayOffset, setDayOffset] = useState<number>(0);

  // Compute selected date
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const selectedDateStr = useMemo(() => {
    return selectedDate.toISOString().split('T')[0];
  }, [selectedDate]);

  const selectedDateFormatted = useMemo(() => {
    const today = new Date();
    const isToday = dayOffset === 0;
    const isYesterday = dayOffset === -1;
    const isTomorrow = dayOffset === 1;

    let prefix = '';
    if (isToday) prefix = 'Bugün · ';
    else if (isYesterday) prefix = 'Dün · ';
    else if (isTomorrow) prefix = 'Yarın · ';

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    };
    return prefix + selectedDate.toLocaleDateString('tr-TR', options);
  }, [selectedDate, dayOffset]);

  // Dynamic Allowed Areas based on the Student's Study Track
  const normalizedTrack = useMemo(() => normalizeStudyTrack(studentTrack), [studentTrack]);

  const allowedAreas = useMemo(() => {
    return getAllowedAreasForTrack(normalizedTrack);
  }, [normalizedTrack]);

  // 1. Görev başlığı
  const [title, setTitle] = useState('');

  // 2. Görev türü seçiniz (soru, video, konu, rutin, deneme)
  const [selectedTaskType, setSelectedTaskType] = useState<FocusTaskType>('soru');

  // 3. Alan seçimi: default to first allowed area
  const [selectedArea, setSelectedArea] = useState<StudyAreaType>(allowedAreas[0]?.id || 'tyt');

  // 4. Ders seçimi: dynamically filtered by normalizedTrack & area (Geometries separated!)
  const availableSubjects = useMemo(() => {
    const list = getSubjectsForAreaAndTrack(selectedArea, normalizedTrack);
    if (selectedTaskType === 'rutin') {
      const routinePriority = [
        { name: 'Paragraf', color: '#f59e0b' },
        { name: 'Problem', color: '#10b981' },
      ];
      const other = list.filter((s) => s.name !== 'Paragraf' && s.name !== 'Problem');
      return [...routinePriority, ...other];
    }
    return list;
  }, [selectedArea, normalizedTrack, selectedTaskType]);

  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(
    availableSubjects[0]?.name || 'TYT Matematik'
  );
  const [selectedSubjectColor, setSelectedSubjectColor] = useState<string>(
    availableSubjects[0]?.color || '#10b981'
  );

  // 5. Süre seçme
  const [plannedMinutes, setPlannedMinutes] = useState<number>(45);
  const [customMinutes, setCustomMinutes] = useState<string>('45');

  const presetTimes = [15, 25, 45, 60, 90, 120];

  // If track changed or area changed, keep subject aligned
  const handleSelectArea = (area: StudyAreaType) => {
    setSelectedArea(area);
    const subjs = getSubjectsForAreaAndTrack(area, normalizedTrack);
    if (subjs.length > 0) {
      setSelectedSubjectName(subjs[0].name);
      setSelectedSubjectColor(subjs[0].color);
    }
  };

  const handleSelectSubject = (sub: { name: string; color: string }) => {
    setSelectedSubjectName(sub.name);
    setSelectedSubjectColor(sub.color);
  };

  // Re-align selectedArea when normalizedTrack changes or if invalid
  useEffect(() => {
    if (!allowedAreas.some((a) => a.id === selectedArea)) {
      if (allowedAreas.length > 0) {
        const nextArea = allowedAreas[0].id;
        setSelectedArea(nextArea);
        const subjs = getSubjectsForAreaAndTrack(nextArea, normalizedTrack);
        if (subjs.length > 0) {
          setSelectedSubjectName(subjs[0].name);
          setSelectedSubjectColor(subjs[0].color);
        }
      }
    }
  }, [allowedAreas, selectedArea, normalizedTrack]);

  // Re-align selectedSubject if not present in availableSubjects
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some((s) => s.name === selectedSubjectName)) {
      setSelectedSubjectName(availableSubjects[0].name);
      setSelectedSubjectColor(availableSubjects[0].color);
    }
  }, [availableSubjects, selectedSubjectName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundEngine.playClick();
    const taskTypeObj = TASK_TYPES.find((t) => t.id === selectedTaskType);
    const areaObj = allowedAreas.find((a) => a.id === selectedArea);

    onAddTask({
      title: title.trim(),
      taskType: selectedTaskType,
      taskTypeName: taskTypeObj?.label || 'Soru Çözümü',
      area: selectedArea,
      areaName: areaObj?.label || 'TYT',
      subjectName: selectedSubjectName,
      subjectColor: selectedSubjectColor,
      plannedMinutes,
      isCompleted: false,
      dateString: selectedDateStr,
    });

    setTitle('');
  };

  // Manual Task Completion Modal State
  const [completingTask, setCompletingTask] = useState<FocusTask | null>(null);
  const [manualHours, setManualHours] = useState<string>('0');
  const [manualMinutes, setManualMinutes] = useState<string>('45');

  const handleInitiateToggle = (task: FocusTask) => {
    soundEngine.playClick();
    if (task.isCompleted) {
      onToggleTask(task.id);
    } else {
      const h = Math.floor((task.plannedMinutes || 45) / 60);
      const m = (task.plannedMinutes || 45) % 60;
      setManualHours(String(h));
      setManualMinutes(String(m));
      setCompletingTask(task);
    }
  };

  const handleConfirmManualComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    const h = parseInt(manualHours, 10) || 0;
    const m = parseInt(manualMinutes, 10) || 0;
    const totalMins = Math.max(1, h * 60 + m);
    soundEngine.playCompletionBell();
    onToggleTask(completingTask.id, totalMins);
    setCompletingTask(null);
  };

  // Distinct Badges Colors for Task Types & Exam Areas
  const getTaskTypeBadgeStyle = (typeId?: string, typeName?: string) => {
    const norm = (typeId || typeName || '').toLowerCase();
    if (norm.includes('soru')) return 'bg-orange-500/20 text-orange-400 border-orange-500/35';
    if (norm.includes('video')) return 'bg-blue-500/20 text-blue-400 border-blue-500/35';
    if (norm.includes('konu')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/35';
    if (norm.includes('rutin') || norm.includes('tekrar')) return 'bg-purple-500/20 text-purple-400 border-purple-500/35';
    if (norm.includes('deneme')) return 'bg-pink-500/20 text-pink-400 border-pink-500/35';
    return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  };

  const getAreaBadgeStyle = (areaId?: string, areaName?: string) => {
    const norm = (areaId || areaName || '').toLowerCase();
    if (norm.includes('tyt')) return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
    if (norm.includes('ayt')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35';
    if (norm.includes('ydt') || norm.includes('dil')) return 'bg-amber-500/20 text-amber-300 border-amber-500/35';
    if (norm.includes('meb') || norm.includes('okul') || norm.includes('lgs')) return 'bg-teal-500/20 text-teal-300 border-teal-500/35';
    return 'bg-neutral-800 text-neutral-300 border-neutral-700';
  };

  // Filter tasks for the selected date. Also include tasks without dateString if viewing today.
  const dayTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.dateString) {
        // legacy tasks fallback to today
        return dayOffset === 0;
      }
      return t.dateString === selectedDateStr;
    });
  }, [tasks, selectedDateStr, dayOffset]);

  const completedCount = dayTasks.filter((t) => t.isCompleted).length;

  const totalPlannedMinutes = useMemo(() => {
    return dayTasks.reduce((sum, t) => sum + (t.plannedMinutes || 45), 0);
  }, [dayTasks]);

  const actualDateFocusMinutes = useMemo(() => {
    return sessions
      .filter((s) => s.dateString === selectedDateStr)
      .reduce((sum, s) => sum + Math.round(s.completedSeconds / 60), 0);
  }, [sessions, selectedDateStr]);

  const planAdherencePercent = totalPlannedMinutes > 0
    ? Math.min(100, Math.round((actualDateFocusMinutes / totalPlannedMinutes) * 100))
    : (actualDateFocusMinutes > 0 ? 100 : 0);

  const goalMinutes = (dailyGoalHours || 6) * 60;
  const goalProgressPercent = Math.min(100, Math.round((actualDateFocusMinutes / goalMinutes) * 100));

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Top Banner & Date Navigation (Sağ/Sol Oklar ile Gün Değiştirme) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-widest text-[#ff5500] uppercase">
              GÖREV YÖNETİMİ & GÜNLÜK PLANLAYICI
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-sky-400 border border-neutral-700">
              {studentTrack} Alanı
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Görevlerini Planla & Takip Et
          </h1>
        </div>

        {/* Date Selector with Left/Right Arrows */}
        <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 p-1.5 rounded-2xl shadow-lg">
          <button
            onClick={() => {
              setDayOffset((prev) => prev - 1);
              soundEngine.playClick();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Önceki Gün"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1">
            <Calendar className="w-4 h-4 text-[#ff5500]" />
            <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap font-mono">
              {selectedDateFormatted}
            </span>
          </div>

          <button
            onClick={() => {
              setDayOffset((prev) => prev + 1);
              soundEngine.playClick();
            }}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Sonraki Gün"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {dayOffset !== 0 && (
            <button
              onClick={() => {
                setDayOffset(0);
                soundEngine.playClick();
              }}
              className="ml-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-[#ff5500] transition-colors cursor-pointer"
            >
              Bugün
            </button>
          )}
        </div>
      </div>

      {/* Daily Goal, Task Plan & Plan Adherence Dashboard */}
      <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 shadow-xl space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Daily Goal */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800/80">
            <span className="text-[11px] font-medium text-neutral-400 block mb-1">Günlük Odak Hedefi</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white font-mono">{dailyGoalHours}</span>
              <span className="text-xs text-neutral-400">Saat / Gün</span>
            </div>
            <div className="mt-2 w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ff5500] transition-all duration-500"
                style={{ width: `${goalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* 2. Tasks Planned Time */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800/80">
            <span className="text-[11px] font-medium text-neutral-400 block mb-1">Görevlerden Planlanan</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-sky-400 font-mono">
                {totalPlannedMinutes >= 60
                  ? `${Math.floor(totalPlannedMinutes / 60)} sa ${totalPlannedMinutes % 60} dk`
                  : `${totalPlannedMinutes} dk`}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block mt-1.5">
              {dayTasks.length} görevden hesaplandı
            </span>
          </div>

          {/* 3. Actual Focus Completed */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800/80">
            <span className="text-[11px] font-medium text-neutral-400 block mb-1">Gerçekleşen Odak</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-400 font-mono">
                {actualDateFocusMinutes >= 60
                  ? `${Math.floor(actualDateFocusMinutes / 60)} sa ${actualDateFocusMinutes % 60} dk`
                  : `${actualDateFocusMinutes} dk`}
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block mt-1.5">
              Seçili gündeki kayıtlı seanslar
            </span>
          </div>

          {/* 4. Plan Adherence */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-neutral-400">Plana Uyum</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                planAdherencePercent >= 100
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                  : planAdherencePercent >= 75
                  ? 'bg-sky-950 text-sky-400 border border-sky-800/40'
                  : 'bg-amber-950 text-amber-400 border border-amber-800/40'
              }`}>
                {planAdherencePercent >= 100 ? '🎯 Hedefe Ulaşıldı' : planAdherencePercent >= 75 ? '⚡ Güçlü İlerleme' : '🚀 Devam Et'}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white font-mono">%{planAdherencePercent}</span>
            </div>
            <div className="mt-2 w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  planAdherencePercent >= 100
                    ? 'bg-emerald-400'
                    : planAdherencePercent >= 75
                    ? 'bg-sky-400'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, planAdherencePercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task completion pill */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
          <div className="flex items-center gap-2 text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Görev Tamamlanma: <strong className="text-white">{completedCount}</strong> / {dayTasks.length} Görev Bitti
            </span>
          </div>
          <div className="font-mono font-bold text-emerald-400">
            {dayTasks.length > 0 ? `%${Math.round((completedCount / dayTasks.length) * 100)}` : '%0'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Create Task (5 Cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6 backdrop-blur-sm shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#ff5500]" />
              <span>Yeni Görev Oluştur</span>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              {selectedDateStr}
            </span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. GÖREV BAŞLIĞI EN ÜSTTE */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Görev Başlığı
              </label>
              <input
                type="text"
                required
                placeholder="örn: Türev Teğet Denklemleri 30 Soru"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            {/* 2. GÖREV TÜRÜ SEÇİNİZ (Soru Çözümü, Video İzleme, Konu, Rutin, Deneme) */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Görev Türü Seçiniz
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {TASK_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedTaskType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskType(type.id);
                        if (type.id === 'rutin') {
                          setSelectedSubjectName('Paragraf');
                          setSelectedSubjectColor('#f59e0b');
                          if (!title || title.includes('Soru')) {
                            setTitle('Günlük 20 Paragraf');
                          }
                        }
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#ff5500] border-[#ff5500] text-white shadow-md'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{type.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Rutin Türüne Özel Hızlı Seçim Butonları (Paragraf & Problem) */}
              {selectedTaskType === 'rutin' && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 animate-in fade-in duration-200">
                  <span className="text-[11px] text-neutral-400 font-semibold mr-1">Hızlı Rutin:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Günlük 20 Paragraf');
                      setSelectedSubjectName('Paragraf');
                      setSelectedSubjectColor('#f59e0b');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      selectedSubjectName === 'Paragraf'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <span>📄</span>
                    <span>20 Paragraf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Günlük 15 Problem');
                      setSelectedSubjectName('Problem');
                      setSelectedSubjectColor('#10b981');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      selectedSubjectName === 'Problem'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <span>🧮</span>
                    <span>15 Problem</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Günlük 10 Geometri');
                      setSelectedSubjectName('TYT Geometri');
                      setSelectedSubjectColor('#059669');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      selectedSubjectName.includes('Geometri')
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <span>📐</span>
                    <span>10 Geometri</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. ALAN SEÇİMİ (ÖĞRENCİNİN ALANINA GÖRE FİLTRELİ) */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>Alan Seçimi</span>
                <span className="text-[10px] text-sky-400 font-semibold">{normalizedTrack} alanına özel</span>
              </label>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${allowedAreas.length}, minmax(0, 1fr))` }}
              >
                {allowedAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => handleSelectArea(area.id)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                      selectedArea === area.id
                        ? 'bg-sky-500 border-sky-500 text-white shadow-md'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. DERS SEÇİMİ (GEOLAR AYRI, İLGİSİZ DERSLER YOK!) */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>Ders Seçimi</span>
                <span className="text-[11px] text-emerald-400 font-semibold">Geometri ayrı ders</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {availableSubjects.map((sub) => {
                  const isSelected = selectedSubjectName === sub.name;
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => handleSelectSubject(sub)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white font-bold shadow-sm'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                      <span>{sub.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. SÜRE SEÇME */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Çalışma Süresi Seçin
              </label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {presetTimes.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setPlannedMinutes(mins);
                      setCustomMinutes(String(mins));
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      plannedMinutes === mins
                        ? 'bg-[#ff5500] border-[#ff5500] text-white shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {mins} dk
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={customMinutes}
                  onChange={(e) => {
                    setCustomMinutes(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) setPlannedMinutes(val);
                  }}
                  className="w-24 px-3 py-1.5 text-xs font-mono rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                />
                <span className="text-xs text-neutral-400">özel dakika belirleyin</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs shadow-lg shadow-[#ff5500]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Görevi Bu Güne Kaydet</span>
            </button>
          </form>
        </div>

        {/* Right List: Task Cards (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-sky-400" />
              <span>Seçili Günün Görevleri ({dayTasks.length})</span>
            </h2>
            <span className="text-xs text-neutral-400 font-mono">
              {selectedDateStr}
            </span>
          </div>

          {dayTasks.length === 0 ? (
            <div className="p-12 rounded-3xl border border-neutral-800 bg-neutral-900/40 text-center text-neutral-400">
              <CheckSquare className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-200">
                {selectedDateFormatted} için kayıtlı görev bulunmuyor
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Sol panelden görev başlığını, türünü ve süresini belirleyerek bu güne görev ekleyebilirsin.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {dayTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    task.isCompleted
                      ? 'border-neutral-800/60 bg-neutral-950/40 opacity-60'
                      : 'border-neutral-800 bg-neutral-900/80 hover:border-neutral-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleInitiateToggle(task)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        task.isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'border-neutral-700 hover:border-neutral-500'
                      }`}
                      title={task.isCompleted ? 'Tamamlanmadı olarak işaretle' : 'Tamamla ve süreyi kaydet'}
                    >
                      {task.isCompleted && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold text-white ${
                            task.isCompleted ? 'line-through text-neutral-400' : ''
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Badges: Görev Türü & Alan ile Farklılaştırılmış Renkler */}
                        {task.taskTypeName && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTaskTypeBadgeStyle(task.taskType, task.taskTypeName)}`}>
                            {task.taskTypeName}
                          </span>
                        )}
                        {task.areaName && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getAreaBadgeStyle(task.area, task.areaName)}`}>
                            {task.areaName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-neutral-200">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.subjectColor }} />
                          <span>{task.subjectName}</span>
                        </span>
                        <span>·</span>
                        <span className="font-mono text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{task.plannedMinutes} dk</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-neutral-800/80 shrink-0">
                    {!task.isCompleted && (
                      <button
                        onClick={() => onStartTaskWithMode(task)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Bu Görevle Başla</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Görevi Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Task Completion Modal (Saat & Dakika Doğrudan Girişi) */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative">
            <button
              onClick={() => setCompletingTask(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 pr-6">
                <h3 className="text-lg font-bold text-white tracking-tight">Görevi Tamamla</h3>
                <p className="text-xs text-neutral-400 truncate">{completingTask.title}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 mb-5 leading-relaxed">
              Bu görevi odak seansı olmadan tamamladın. Günlük çalışma sürene ve plana uyum grafiğine doğru yansıması için harcadığın süreyi gir:
            </p>

            <form onSubmit={handleConfirmManualComplete} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#ff5500]" />
                    <span>Saat</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-700/80 hover:border-neutral-600 text-white font-mono text-lg font-bold focus:outline-none focus:border-[#ff5500] text-center"
                    />
                    <span className="absolute right-3 top-3.5 text-xs text-neutral-500 font-bold pointer-events-none">
                      saat
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Dakika</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      placeholder="45"
                      className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-700/80 hover:border-neutral-600 text-white font-mono text-lg font-bold focus:outline-none focus:border-[#ff5500] text-center"
                    />
                    <span className="absolute right-3 top-3.5 text-xs text-neutral-500 font-bold pointer-events-none">
                      dakika
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="flex-1 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-black transition-colors cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Kaydet & Tamamla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
