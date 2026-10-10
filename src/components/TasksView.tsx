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
  Sparkles
} from 'lucide-react';
import { FocusTask, FocusTaskType, StudyAreaType, SubjectItem } from '../types';
import { soundEngine } from '../utils/audio';
import { getAllowedAreasForTrack, getSubjectsForAreaAndTrack, normalizeStudyTrack } from '../utils/subjects';

interface TasksViewProps {
  tasks: FocusTask[];
  subjects: SubjectItem[];
  studentTrack?: string;
  onAddTask: (task: Omit<FocusTask, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
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

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  subjects,
  studentTrack = 'Sayısal',
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
    return getSubjectsForAreaAndTrack(selectedArea, normalizedTrack);
  }, [selectedArea, normalizedTrack]);

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

      {/* Completion Summary Pill */}
      <div className="mb-6 flex items-center justify-between p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            Seçili Günün İlerlemesi: <strong className="text-white">{completedCount}</strong> / {dayTasks.length} Tamamlandı
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-emerald-400">
          {dayTasks.length > 0 ? `%${Math.round((completedCount / dayTasks.length) * 100)}` : '%0'}
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
                      onClick={() => setSelectedTaskType(type.id)}
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
                      onClick={() => onToggleTask(task.id)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        task.isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'border-neutral-700 hover:border-neutral-500'
                      }`}
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

                        {/* Badges: Görev Türü & Alan */}
                        {task.taskTypeName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#ff5500]/15 text-[#ff5500] border border-[#ff5500]/30">
                            {task.taskTypeName}
                          </span>
                        )}
                        {task.areaName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
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
    </div>
  );
};
