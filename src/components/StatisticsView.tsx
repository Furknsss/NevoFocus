import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight,
  Target,
  BarChart2,
  PieChart,
  Trees,
  Mountain,
  Plane,
  Waves,
  Sparkles,
  BookOpen,
  CalendarDays,
  Tent,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Coffee,
  Activity,
  X,
  Trash2,
} from 'lucide-react';
import { FocusSession, UserProfile, FocusTask } from '../types';
import { soundEngine } from '../utils/audio';
import { isDateRestDay, getLocalDateString, getValidCompletedSessions } from '../utils/stats';

interface StatisticsViewProps {
  sessions: FocusSession[];
  profile: UserProfile;
  tasks?: FocusTask[];
  onOpenSettings?: () => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onDeleteSession?: (sessionId: string) => void;
  onUpdateSession?: (session: FocusSession) => void;
}

export const StatisticsView = React.memo<StatisticsViewProps>(({
  sessions: rawSessions,
  profile,
  tasks = [],
  onOpenSettings,
  onUpdateProfile,
  onDeleteSession,
  onUpdateSession,
}) => {
  const sessions = useMemo(() => getValidCompletedSessions(rawSessions), [rawSessions]);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'forest_gallery'>('daily');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const [hoveredSession, setHoveredSession] = useState<FocusSession | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [isRestDayModalOpen, setIsRestDayModalOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Weekly rest day calculation
  const currentRestDayNumber = useMemo(() => {
    if (Array.isArray(profile.weeklyRestDays) && profile.weeklyRestDays.length > 0) {
      return profile.weeklyRestDays[0];
    }
    return null;
  }, [profile.weeklyRestDays]);

  const currentRestDayLabel = useMemo(() => {
    if (currentRestDayNumber === null) return 'Mola Günü Yok';
    const dayNames: Record<number, string> = {
      1: 'Pazartesi',
      2: 'Salı',
      3: 'Çarşamba',
      4: 'Perşembe',
      5: 'Cuma',
      6: 'Cumartesi',
      0: 'Pazar',
    };
    return dayNames[currentRestDayNumber] || 'Belirlendi';
  }, [currentRestDayNumber]);

  // --- 1. GÜNLÜK TAKİP (DAILY VIEW) ---
  const targetDate = useMemo(() => {
    if (selectedCalendarDate) {
      const parts = selectedCalendarDate.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    const d = new Date();
    d.setDate(d.getDate() + selectedDayOffset);
    return d;
  }, [selectedDayOffset, selectedCalendarDate]);

  const targetDateStr = useMemo(() => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [targetDate]);

  const dateFormattedTr = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    };
    return targetDate.toLocaleDateString('tr-TR', options);
  }, [targetDate]);

  const dateSessions = useMemo(() => {
    return sessions.filter((s) => s.dateString === targetDateStr);
  }, [sessions, targetDateStr]);

  const totalSecondsToday = useMemo(() => {
    return dateSessions.reduce((acc, s) => acc + s.completedSeconds, 0);
  }, [dateSessions]);

  const totalBreakSecondsToday = useMemo(() => {
    return dateSessions.reduce((acc, s) => acc + (s.breakSeconds || 0), 0);
  }, [dateSessions]);

  const breakCountToday = useMemo(() => {
    return dateSessions.filter((s) => (s.breakSeconds && s.breakSeconds > 0) || (s.climbInfo?.campsSet && s.climbInfo.campsSet > 0)).length;
  }, [dateSessions]);

  const totalMinutesToday = totalSecondsToday > 0 ? Math.max(1, Math.round(totalSecondsToday / 60)) : 0;
  const hoursToday = Math.floor(totalMinutesToday / 60);
  const minsToday = totalMinutesToday % 60;

  const goalMinutes = (profile.dailyGoalHours || 6) * 60;
  const goalPercentage = Math.min(100, Math.round((totalMinutesToday / goalMinutes) * 100));

  const subjectBreakdown = useMemo(() => {
    const map: Record<string, { name: string; color: string; seconds: number }> = {};
    dateSessions.forEach((s) => {
      const key = s.subjectId || s.subjectName;
      if (!map[key]) {
        map[key] = {
          name: s.subjectName,
          color: s.subjectColor,
          seconds: 0,
        };
      }
      map[key].seconds += s.completedSeconds;
    });

    const list = Object.values(map);
    list.sort((a, b) => b.seconds - a.seconds);
    return list;
  }, [dateSessions]);

  // 24-Hour Timeline Bar calculation
  const timelineHours = Array.from({ length: 24 }, (_, i) => i);

  const getSessionPosition = (s: FocusSession) => {
    if (!s.startTimeString || !s.endTimeString) return null;
    const [sh, sm] = s.startTimeString.split(':').map(Number);
    const [eh, em] = s.endTimeString.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    let endMinutes = eh * 60 + em;
    if (endMinutes < startMinutes) endMinutes = startMinutes + Math.round(s.completedSeconds / 60);
    const duration = Math.max(8, endMinutes - startMinutes);

    const leftPercent = (startMinutes / 1440) * 100;
    const widthPercent = (duration / 1440) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(1, widthPercent)}%`,
    };
  };

  // --- 2. HAFTALIK TAKİP (WEEKLY VIEW - PAZARTESİDEN PAZARA DİNAMİK HAFTA GEÇİŞİ) ---
  const selectedWeekMonday = useMemo(() => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const selectedWeekFormatted = useMemo(() => {
    const start = new Date(selectedWeekMonday);
    const end = new Date(selectedWeekMonday);
    end.setDate(end.getDate() + 6);

    const monthName = start.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const startStr = start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    const isThisWeek = weekOffset === 0;

    return `${capitalizedMonth} · ${startStr} - ${endStr} ${isThisWeek ? '(Bu Hafta)' : ''}`;
  }, [selectedWeekMonday, weekOffset]);

  const weekDaysData = useMemo(() => {
    const days: { dateStr: string; label: string; dateNum: number; totalMinutes: number; totalHours: string; isToday: boolean }[] = [];
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const todayStr = getLocalDateString(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(selectedWeekMonday);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const str = `${year}-${month}-${day}`;

      const daySecs = sessions
        .filter((s) => s.dateString === str)
        .reduce((sum, s) => sum + s.completedSeconds, 0);

      const mins = daySecs > 0 ? Math.max(1, Math.round(daySecs / 60)) : 0;
      days.push({
        dateStr: str,
        label: dayNames[i],
        dateNum: d.getDate(),
        totalMinutes: mins,
        totalHours: (mins / 60).toFixed(1),
        isToday: str === todayStr,
      });
    }
    return days;
  }, [sessions, selectedWeekMonday]);

  const weeklyAnalysis = useMemo(() => {
    const weekDateStrings = new Set(weekDaysData.map((d) => d.dateStr));
    const weeklySessions = sessions.filter((s) => weekDateStrings.has(s.dateString));

    const subjectMap: Record<string, { name: string; color: string; seconds: number }> = {};
    const hourlySeconds = Array(24).fill(0);

    weeklySessions.forEach((s) => {
      const key = s.subjectName;
      if (!subjectMap[key]) {
        subjectMap[key] = { name: s.subjectName, color: s.subjectColor, seconds: 0 };
      }
      subjectMap[key].seconds += s.completedSeconds;

      if (s.startTimeString) {
        const hour = parseInt(s.startTimeString.split(':')[0], 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          hourlySeconds[hour] += s.completedSeconds;
        }
      }
    });

    const subjectList = Object.values(subjectMap).sort((a, b) => b.seconds - a.seconds);
    const mostStudiedSubject = subjectList.length > 0 ? subjectList[0] : null;
    const leastStudiedSubject = subjectList.length > 1 ? subjectList[subjectList.length - 1] : null;

    let peakHour = 0;
    let peakSeconds = 0;
    hourlySeconds.forEach((sec, hr) => {
      if (sec > peakSeconds) {
        peakSeconds = sec;
        peakHour = hr;
      }
    });

    const totalWeeklySecs = weeklySessions.reduce((acc, s) => acc + s.completedSeconds, 0);
    const totalWeeklyMins = Math.round(totalWeeklySecs / 60);

    return {
      weeklySessions,
      subjectList,
      mostStudiedSubject,
      leastStudiedSubject,
      peakHour: `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00`,
      peakSeconds,
      hourlySeconds,
      totalWeeklyMins,
      totalWeeklyHours: (totalWeeklyMins / 60).toFixed(1),
    };
  }, [sessions, weekDaysData]);

  // --- 3. AYLIK TAKİP (MONTHLY VIEW - EKİM AYI, KASIM AYI DİNAMİK AY GEÇİŞİ VE PAZARTESİ-PAZAR GERÇEK TAKVİMİ) ---
  const selectedMonthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [monthOffset]);

  const selectedMonthTitle = useMemo(() => {
    const title = selectedMonthDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    return title.charAt(0).toUpperCase() + title.slice(1);
  }, [selectedMonthDate]);

  const monthlyCalendarData = useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday-based first day index (0: Pazartesi, 1: Salı, ... 6: Pazar)
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

    const days: ({
      dayNum: number;
      dateStr: string;
      mins: number;
      hours: string;
      formattedDuration: string;
      sessionCount: number;
      isToday: boolean;
      isRestDay: boolean;
    } | null)[] = [];

    // Empty leading padding slots for Monday start
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    const todayStr = getLocalDateString(new Date());
    const subjectMap: Record<string, number> = {};
    let totalMonthlySecs = 0;
    let totalBreakSecs = 0;
    let totalSessionCount = 0;
    let activeDaysCount = 0;
    let restDaysCount = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const matched = sessions.filter((s) => s.dateString === str);
      const daySecs = matched.reduce((sum, s) => sum + s.completedSeconds, 0);
      const dayBreakSecs = matched.reduce((sum, s) => sum + (s.breakSeconds || 0), 0);
      const mins = daySecs > 0 ? Math.max(1, Math.round(daySecs / 60)) : 0;
      const isRest = isDateRestDay(str, profile);

      if (daySecs > 0) activeDaysCount++;
      if (isRest) restDaysCount++;
      totalMonthlySecs += daySecs;
      totalBreakSecs += dayBreakSecs;
      totalSessionCount += matched.length;

      matched.forEach((s) => {
        subjectMap[s.subjectName] = (subjectMap[s.subjectName] || 0) + s.completedSeconds;
      });

      const formatCellDuration = (m: number) => {
        if (!m || m === 0) return '0 dk';
        const h = Math.floor(m / 60);
        const rem = m % 60;
        if (h > 0 && rem > 0) return `${h} sa ${rem} dk`;
        if (h > 0) return `${h} sa`;
        return `${rem} dk`;
      };

      days.push({
        dayNum: day,
        dateStr: str,
        mins,
        hours: (mins / 60).toFixed(1),
        formattedDuration: formatCellDuration(mins),
        sessionCount: matched.length,
        isToday: str === todayStr,
        isRestDay: isRest,
      });
    }

    const sortedSubjects = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]);
    const totalMonthlyMins = Math.round(totalMonthlySecs / 60);
    const totalBreakMins = Math.round(totalBreakSecs / 60);

    const formatHourMin = (m: number) => {
      const h = Math.floor(m / 60);
      const rem = m % 60;
      if (h > 0 && rem > 0) return `${h} sa ${rem} dk`;
      if (h > 0) return `${h} sa`;
      return `${rem} dk`;
    };

    return {
      days,
      totalDaysInMonth,
      totalHours: (totalMonthlySecs / 3600).toFixed(1),
      totalHoursFormatted: formatHourMin(totalMonthlyMins),
      totalBreakHours: (totalBreakSecs / 3600).toFixed(1),
      totalBreakHoursFormatted: formatHourMin(totalBreakMins),
      totalSessionCount,
      activeDaysCount,
      restDaysCount,
      consistencyRate: Math.round((activeDaysCount / totalDaysInMonth) * 100),
      topSubjects: sortedSubjects.slice(0, 5),
    };
  }, [sessions, selectedMonthDate, profile]);

  // Forest Trees Collection
  const forestTrees = useMemo(() => {
    return sessions.filter((s) => s.mode === 'forest' && s.completed);
  }, [sessions]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ff5500]">
              GELİŞMİŞ ODAK TAKİP SİSTEMİ
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Odak İstatistikleri & Zaman Çizelgesi
          </h1>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('daily');
              setSelectedCalendarDate(null);
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Günlük
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('weekly');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'weekly'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Haftalık
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('monthly');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Aylık Takvim
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveTab('forest_gallery');
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'forest_gallery'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Trees className="w-3.5 h-3.5" />
            <span>Sanal Orman</span>
          </button>
        </div>
      </div>

      {/* 1. DAILY VIEW */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Day Navigation Bar with Left/Right Arrows */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-lg">
            <button
              onClick={() => {
                soundEngine.playClick();
                if (selectedCalendarDate) {
                  const parts = selectedCalendarDate.split('-');
                  const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  cur.setDate(cur.getDate() - 1);
                  const y = cur.getFullYear();
                  const m = String(cur.getMonth() + 1).padStart(2, '0');
                  const d = String(cur.getDate()).padStart(2, '0');
                  setSelectedCalendarDate(`${y}-${m}-${d}`);
                } else {
                  setSelectedDayOffset((prev) => prev - 1);
                }
              }}
              className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              title="Önceki Gün"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-center">
              <Calendar className="w-5 h-5 text-[#ff5500] shrink-0" />
              <div>
                <span className="text-base sm:text-lg font-extrabold text-white block">
                  {dateFormattedTr}
                </span>
                {(selectedDayOffset !== 0 || selectedCalendarDate) && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedCalendarDate(null);
                      setSelectedDayOffset(0);
                    }}
                    className="text-[10px] font-bold text-[#ff5500] hover:underline cursor-pointer"
                  >
                    (Bugüne Dön)
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                if (selectedCalendarDate) {
                  const parts = selectedCalendarDate.split('-');
                  const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  cur.setDate(cur.getDate() + 1);
                  const y = cur.getFullYear();
                  const m = String(cur.getMonth() + 1).padStart(2, '0');
                  const d = String(cur.getDate()).padStart(2, '0');
                  setSelectedCalendarDate(`${y}-${m}-${d}`);
                } else {
                  setSelectedDayOffset((prev) => prev + 1);
                }
              }}
              className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              title="Sonraki Gün"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Rest Day Highlight Banner */}
          {isDateRestDay(targetDateStr, profile) && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/35 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="text-2xl sm:text-3xl">☕</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                    <span>Haftalık Mola Günü</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-mono">
                      {targetDateStr}
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    Bu gün programınızda dinlenme günü olarak işaretlidir. Mola günleri istikrar serinizi (streak) korur.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar - Net Odak, Mola Sayısı, Molada Geçen Süre */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-xs text-neutral-400">O Gün Toplam Odak</span>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                {hoursToday}s {minsToday}dk
              </p>
              <span className="text-[11px] text-emerald-400 font-medium">Net çalışma süresi</span>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-xs text-neutral-400">Mola Sayısı & Süresi</span>
              <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5">
                {Math.floor(totalBreakSecondsToday / 60)} dk
              </p>
              <span className="text-[11px] text-neutral-400">
                {breakCountToday} defa mola verildi
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-xs text-neutral-400">Günlük Hedef ({profile.dailyGoalHours}s)</span>
              <p className="text-xl sm:text-2xl font-black text-[#ff5500] font-mono mt-0.5">
                %{goalPercentage}
              </p>
              <div className="w-full h-1.5 rounded-full bg-neutral-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ff5500] to-emerald-400 rounded-full"
                  style={{ width: `${goalPercentage}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-xs text-neutral-400">Seans Sayısı</span>
              <p className="text-xl sm:text-2xl font-black text-sky-400 font-mono mt-0.5">
                {dateSessions.length} Seans
              </p>
              <span className="text-[11px] text-neutral-400">
                Ort. {dateSessions.length > 0 ? Math.round(totalMinutesToday / dateSessions.length) : 0} dk / seans
              </span>
            </div>
          </div>

          {/* 24-HOUR TIMELINE BAR */}
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#ff5500]" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  24-Saatlik Günlük Zaman Akışı
                </h3>
              </div>
              <span className="text-xs text-neutral-400 hidden sm:inline">
                Saat saat çalışma aralıkları ders renkleriyle boyanmıştır
              </span>
            </div>

            <div className="relative w-full bg-[#141720] rounded-xl p-3 border border-neutral-800/80">
              <div className="flex justify-between text-[10px] font-mono text-neutral-400 pb-2 border-b border-neutral-800/60 px-0.5">
                <span>00:00</span>
                <span>03:00</span>
                <span>06:00</span>
                <span>09:00</span>
                <span>12:00</span>
                <span>15:00</span>
                <span>18:00</span>
                <span>21:00</span>
                <span>24:00</span>
              </div>

              {/* Multi-colored Session Bar */}
              <div className="relative w-full h-11 bg-neutral-950/80 rounded-lg overflow-hidden my-2 border border-neutral-800/50">
                <div className="absolute inset-0 flex justify-between pointer-events-none">
                  {timelineHours.map((h) => (
                    <div
                      key={h}
                      className="h-full w-[1px] bg-neutral-800/40 border-r border-neutral-800/20"
                    />
                  ))}
                </div>

                {dateSessions.map((session) => {
                  const pos = getSessionPosition(session);
                  if (!pos) return null;

                  return (
                    <div
                      key={session.id}
                      onMouseEnter={() => setHoveredSession(session)}
                      onMouseLeave={() => setHoveredSession(null)}
                      className="absolute top-1 bottom-1 rounded-md transition-all cursor-pointer hover:brightness-125 hover:z-20 border border-white/20 shadow-sm"
                      style={{
                        left: pos.left,
                        width: pos.width,
                        backgroundColor: session.subjectColor || '#ff5500',
                      }}
                    />
                  );
                })}
              </div>

              {hoveredSession ? (
                <div className="text-xs text-neutral-300 flex items-center justify-between pt-2 border-t border-neutral-800/60">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: hoveredSession.subjectColor }}
                    />
                    <strong className="text-white">{hoveredSession.subjectName}</strong>
                    <span>({hoveredSession.startTimeString} - {hoveredSession.endTimeString})</span>
                  </div>
                  <span className="font-mono font-bold text-white">
                    {Math.round(hoveredSession.completedSeconds / 60)} dakika
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                  <span>Detay görmek için çizelgedeki blokların üzerine gelin</span>
                  <span>{dateSessions.length} seans işlendi</span>
                </div>
              )}
            </div>
          </div>

          {/* Subject Breakdown & Session List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <span>O Gün Çalışılan Dersler Dağılımı</span>
              </h3>

              {subjectBreakdown.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">Bu tarihte tamamlanan ders bulunmuyor.</p>
              ) : (
                <div className="space-y-3">
                  {subjectBreakdown.map((item) => {
                    const mins = Math.round(item.seconds / 60);
                    const pct = totalMinutesToday > 0 ? Math.round((mins / totalMinutesToday) * 100) : 0;
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-neutral-200">{item.name}</span>
                          </div>
                          <span className="font-mono text-white">{mins} dk (%{pct})</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>O Günün Seans Geçmişi ({dateSessions.length})</span>
              </h3>

              {dateSessions.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">Bu tarihte kayıtlı seans yok.</p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {dateSessions.map((s) => {
                    const isLongSession = s.completedSeconds >= 7200; // 2+ hours
                    const isDeletingThis = deletingSessionId === s.id;
                    const sessionMinutes = Math.round(s.completedSeconds / 60);

                    return (
                      <div
                        key={s.id}
                        className={`p-3 rounded-xl bg-neutral-950/70 border transition-all ${
                          isLongSession ? 'border-amber-500/30' : 'border-neutral-800'
                        } flex items-center justify-between gap-2`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.subjectColor }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-white leading-tight truncate">
                                {s.subjectName}
                              </p>
                              {isLongSession && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium shrink-0">
                                  Uzun Seans
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-400 block mt-0.5">
                              {s.startTimeString || '--:--'} - {s.endTimeString || '--:--'}
                              {s.note && s.note !== s.subjectName && ` · ${s.note}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-[#ff5500]">
                            {sessionMinutes >= 60
                              ? `${Math.floor(sessionMinutes / 60)} sa ${sessionMinutes % 60} dk`
                              : `${sessionMinutes} dk`}
                          </span>

                          {onDeleteSession && (
                            <>
                              {isDeletingThis ? (
                                <div className="flex items-center gap-1 animate-in fade-in duration-150">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundEngine.playClick();
                                      onDeleteSession(s.id);
                                      setDeletingSessionId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-[10px] font-bold text-white transition-colors cursor-pointer"
                                  >
                                    Sil
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingSessionId(null)}
                                    className="px-1.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-semibold text-neutral-300 transition-colors cursor-pointer"
                                  >
                                    İptal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeletingSessionId(s.id)}
                                  title="Bu seansı kayıtlardan sil"
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. WEEKLY VIEW (PAZARTESİDEN PAZARA DİNAMİK HAFTA GEÇİŞİ) */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          {/* Week Navigation Bar with Left/Right Arrows + Mola Günü Butonu */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setWeekOffset((prev) => prev - 1);
                }}
                className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
                title="Önceki Hafta"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 sm:gap-3 text-center sm:text-left">
                <CalendarDays className="w-5 h-5 text-[#ff5500] shrink-0" />
                <div>
                  <span className="text-sm sm:text-lg font-extrabold text-white block">
                    {selectedWeekFormatted}
                  </span>
                  {weekOffset !== 0 && (
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setWeekOffset(0);
                      }}
                      className="text-[10px] font-bold text-[#ff5500] hover:underline cursor-pointer"
                    >
                      (Bu Haftaya Dön)
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setWeekOffset((prev) => prev + 1);
                }}
                className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
                title="Sonraki Hafta"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Sağ Üst: Mola Günü Seçim Butonu (Kullanıcı Talebi) */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setIsRestDayModalOpen(true);
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer active:scale-95 ml-auto sm:ml-0"
              title="Haftalık mola gününü belirle veya kaldır"
            >
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Mola Günü:</span>
              <span className="underline decoration-amber-400/50 underline-offset-2">
                {currentRestDayLabel}
              </span>
            </button>
          </div>

          {/* Pazartesiden Pazara 7 Günlük Çubuk Grafik */}
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-400" />
                <span>Haftalık Odaklanma Saatleri (Pazartesi - Pazar)</span>
              </h3>
              <span className="text-xs font-mono font-bold text-[#ff5500]">
                Toplam: {Math.floor(weeklyAnalysis.totalWeeklyMins / 60)} sa {weeklyAnalysis.totalWeeklyMins % 60} dk
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-48 pt-6 pb-2 border-b border-neutral-800">
              {weekDaysData.map((d) => {
                const maxHours = Math.max(8, ...weekDaysData.map((x) => parseFloat(x.totalHours)));
                const hPercent = Math.min(100, Math.round((parseFloat(d.totalHours) / maxHours) * 100));

                return (
                  <div key={d.dateStr} className="flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 group-hover:text-white transition-colors">
                      {d.totalMinutes > 0
                        ? d.totalMinutes >= 60
                          ? `${Math.floor(d.totalMinutes / 60)}sa ${d.totalMinutes % 60}dk`
                          : `${d.totalMinutes}dk`
                        : '0dk'}
                    </span>

                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedCalendarDate(d.dateStr);
                        setActiveTab('daily');
                      }}
                      className={`w-full max-w-[48px] rounded-xl transition-all cursor-pointer relative ${
                        d.isToday
                          ? 'bg-gradient-to-t from-[#ff5500] to-[#ff7722] shadow-lg shadow-[#ff5500]/30 ring-1 ring-white/30'
                          : parseFloat(d.totalHours) > 0
                          ? 'bg-neutral-800 hover:bg-neutral-700 hover:scale-105'
                          : 'bg-neutral-900/60 border border-neutral-800/80'
                      }`}
                      style={{ height: `${Math.max(8, hPercent)}%` }}
                      title={`${d.label} (${d.dateStr}): ${d.totalHours} saat`}
                    />

                    <div className="text-center">
                      <span className="text-xs font-bold text-white block">{d.label.slice(0, 3)}</span>
                      <span className="text-[10px] font-mono text-neutral-500 block">{d.dateNum}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SAATLİK ISI HARİTASI (HOURLY HEATMAP) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#ff5500]" />
                <h3 className="text-base font-bold text-white">
                  Haftalık Saatlik Isı Haritası (24 Saat)
                </h3>
              </div>
              <span className="text-xs font-mono text-sky-400">
                En yoğun saat: <strong>{weeklyAnalysis.peakHour}</strong>
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2 my-2">
              {weeklyAnalysis.hourlySeconds.map((secs, hour) => {
                const mins = Math.round(secs / 60);
                let heatClass = 'bg-neutral-800/80 text-neutral-400 border-neutral-700/40';
                if (mins >= 60) heatClass = 'bg-[#ff5500] text-white font-bold shadow-md shadow-[#ff5500]/30 border-[#ff7722]';
                else if (mins >= 35) heatClass = 'bg-[#ff5500]/75 text-white font-semibold border-[#ff5500]/50';
                else if (mins >= 15) heatClass = 'bg-[#ff5500]/40 text-neutral-200 border-[#ff5500]/30';
                else if (mins > 0) heatClass = 'bg-[#ff5500]/20 text-neutral-300 border-[#ff5500]/15';

                return (
                  <div
                    key={hour}
                    className={`rounded-xl p-2 text-center border transition-all hover:scale-105 cursor-pointer ${heatClass}`}
                    title={`${hour}:00 - ${hour + 1}:00 arası: ${mins} dakika`}
                  >
                    <span className="text-[10px] font-mono block opacity-75">{hour}:00</span>
                    <span className="text-xs font-mono font-bold block mt-1">{mins}m</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EN ÇOK VE EN AZ ÇALIŞILAN DERSLER İSTATİSTİĞİ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-emerald-500/30 shadow-md">
              <div className="flex items-center gap-2 mb-3 text-emerald-400">
                <ArrowUpRight className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Bu Hafta En Çok Çalışılan Ders</h4>
              </div>

              {weeklyAnalysis.mostStudiedSubject ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: weeklyAnalysis.mostStudiedSubject.color }}
                    />
                    <span className="text-base font-extrabold text-white">
                      {weeklyAnalysis.mostStudiedSubject.name}
                    </span>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {Math.round(weeklyAnalysis.mostStudiedSubject.seconds / 60)} dakika
                  </span>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Bu hafta henüz seans kaydı yok.</p>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-amber-500/30 shadow-md">
              <div className="flex items-center gap-2 mb-3 text-amber-400">
                <ArrowDownRight className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Bu Hafta En Az Çalışılan Ders</h4>
              </div>

              {weeklyAnalysis.leastStudiedSubject ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: weeklyAnalysis.leastStudiedSubject.color }}
                    />
                    <span className="text-base font-extrabold text-white">
                      {weeklyAnalysis.leastStudiedSubject.name}
                    </span>
                  </div>
                  <span className="text-base font-black font-mono text-amber-400">
                    {Math.round(weeklyAnalysis.leastStudiedSubject.seconds / 60)} dakika
                  </span>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">
                  {weeklyAnalysis.mostStudiedSubject ? 'Tek bir ders çalışıldı.' : 'Bu hafta henüz seans kaydı yok.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. AYLIK TAKVİM (MONTHLY CALENDAR VIEW - EKİM AYI, KASIM AYI DİNAMİK VE PAZARTESİ-PAZAR GERÇEK TAKVİMİ) */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Month Navigation Bar with Left/Right Arrows */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-lg">
            <button
              onClick={() => {
                soundEngine.playClick();
                setMonthOffset((prev) => prev - 1);
              }}
              className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              title="Önceki Ay"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-center">
              <Calendar className="w-5 h-5 text-[#ff5500] shrink-0" />
              <div>
                <span className="text-base sm:text-lg font-extrabold text-white block">
                  {selectedMonthTitle}
                </span>
                {monthOffset !== 0 && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setMonthOffset(0);
                    }}
                    className="text-[10px] font-bold text-[#ff5500] hover:underline cursor-pointer"
                  >
                    (Bu Aya Dön)
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                setMonthOffset((prev) => prev + 1);
              }}
              className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
              title="Sonraki Ay"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Gerçek Pazartesi-Pazar Aylık Takvim Izgarası */}
          <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#ff5500]" />
                  <span>{selectedMonthTitle} Odaklanma Takvimi</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pazartesi'den Pazar'a gerçek takvim. Günlere tıklayarak detayları inceleyebilir, mola günlerinizi takip edebilirsiniz.
                </p>
              </div>

              {/* Heatmap Legend & Mola Günü Info */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span>0s</span>
                  <span className="w-3 h-3 rounded-sm bg-neutral-800/80" />
                  <span className="w-3 h-3 rounded-sm bg-[#ff5500]/25" />
                  <span className="w-3 h-3 rounded-sm bg-[#ff5500]/50" />
                  <span className="w-3 h-3 rounded-sm bg-[#ff5500]/80" />
                  <span className="w-3 h-3 rounded-sm bg-[#ff5500]" />
                  <span>6s+</span>
                </div>
                <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-800 text-amber-400 font-semibold text-[11px]">
                  <span>☕</span>
                  <span>mola günü</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsRestDayModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-all cursor-pointer hover:border-amber-500/60 hover:text-amber-300"
                  title="Haftalık mola gününü belirle veya kaldır"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mola Gününü Değiştir</span>
                </button>
              </div>
            </div>

            {/* Weekday Column Headers (Pzt to Paz) */}
            <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-2 text-center text-xs font-bold text-neutral-400 uppercase tracking-wider">
              <span>Pzt</span>
              <span>Sal</span>
              <span>Çar</span>
              <span>Per</span>
              <span>Cum</span>
              <span className="text-[#ff5500]">Cmt</span>
              <span className="text-[#ff5500]">Paz</span>
            </div>

            {/* Calendar Cells Matrix */}
            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {monthlyCalendarData.days.map((item, index) => {
                if (!item) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="aspect-square rounded-xl bg-neutral-950/30 border border-neutral-800/20"
                    />
                  );
                }

                const numericHours = parseFloat(item.hours);
                let colorClass = 'bg-neutral-800/60 text-neutral-400 border-neutral-700/40 hover:bg-neutral-800';

                if (item.isRestDay && numericHours === 0) {
                  colorClass = 'bg-amber-950/25 text-amber-200/90 border-amber-500/40 hover:bg-amber-900/30 hover:border-amber-400 shadow-sm';
                } else if (item.isRestDay && numericHours > 0) {
                  colorClass = 'bg-[#ff5500]/70 text-white font-bold border-amber-400/90 shadow-md shadow-amber-500/20';
                } else if (numericHours >= 6.0) {
                  colorClass = 'bg-[#ff5500] text-white font-black shadow-lg shadow-[#ff5500]/30 border-[#ff7722]';
                } else if (numericHours >= 4.0) {
                  colorClass = 'bg-[#ff5500]/80 text-white font-bold border-[#ff5500]/60';
                } else if (numericHours >= 2.0) {
                  colorClass = 'bg-[#ff5500]/50 text-neutral-100 font-semibold border-[#ff5500]/40';
                } else if (numericHours > 0) {
                  colorClass = 'bg-[#ff5500]/25 text-neutral-300 font-medium border-[#ff5500]/25';
                }

                return (
                  <button
                    key={item.dateStr}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedCalendarDate(item.dateStr);
                      setActiveTab('daily');
                    }}
                    className={`aspect-square rounded-xl p-1.5 sm:p-2.5 flex flex-col justify-between text-left transition-all hover:scale-105 hover:ring-2 hover:ring-white cursor-pointer border relative ${colorClass} ${
                      item.isToday ? 'ring-2 ring-sky-400' : ''
                    }`}
                    title={`${item.dateStr}: ${item.isRestDay ? '☕ Mola Günü - ' : ''}${item.formattedDuration} (${item.sessionCount} seans)`}
                  >
                    {/* Top Row: Day Number on the Left, Coffee & "mola günü" on the Right */}
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="text-[10px] sm:text-xs font-mono font-bold opacity-90">{item.dayNum}</span>
                      
                      <div className="flex items-center gap-1 ml-auto">
                        {item.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                        )}
                        {item.isRestDay && (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[7.5px] sm:text-[9.5px] font-bold text-amber-300 bg-amber-500/25 border border-amber-500/50 px-1 sm:px-1.5 py-0.5 rounded leading-none shadow-xs">
                            <span className="text-[9px] sm:text-[11px] leading-none">☕</span>
                            <span className="whitespace-nowrap font-medium">mola günü</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Duration or Rest Indicator */}
                    <div>
                      {item.isRestDay && numericHours === 0 ? (
                        <>
                          <span className="text-[9.5px] sm:text-xs font-semibold text-amber-300/90 leading-tight block truncate">
                            Dinlenme
                          </span>
                          <span className="text-[8px] sm:text-[9px] text-amber-400/60 hidden sm:block">
                            Haftalık Mola
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] sm:text-xs font-mono font-black leading-tight block truncate">
                            {item.formattedDuration}
                          </span>
                          <span className="text-[8px] sm:text-[9px] opacity-75 hidden sm:block">
                            {item.sessionCount > 0 ? `${item.sessionCount} seans` : 'odaklanma'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Monthly Summary Footer */}
            <div className="mt-8 pt-5 border-t border-neutral-800 grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-neutral-400 block mb-1">Aylık Toplam Odak:</span>
                <strong className="text-white text-base font-mono">{monthlyCalendarData.totalHoursFormatted}</strong>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-neutral-400 block mb-1">Toplam Mola Süresi:</span>
                <strong className="text-amber-400 text-base font-mono">{monthlyCalendarData.totalBreakHoursFormatted}</strong>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-neutral-400 block mb-1">Mola Günleri:</span>
                <strong className="text-amber-300 text-base font-mono flex items-center gap-1">
                  <span>☕</span>
                  <span>{monthlyCalendarData.restDaysCount} Gün</span>
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-neutral-400 block mb-1">Aktif Gün Sayısı:</span>
                <strong className="text-emerald-400 text-base font-mono">
                  {monthlyCalendarData.activeDaysCount} / {monthlyCalendarData.totalDaysInMonth} Gün
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-neutral-400 block mb-1">Aylık İstikrar Oranı:</span>
                <strong className="text-[#ff5500] text-base font-mono">%{monthlyCalendarData.consistencyRate}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. FOREST GALLERY */}
      {activeTab === 'forest_gallery' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-neutral-900/80 border border-emerald-900/40">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Trees className="w-5 h-5 text-emerald-400" />
              <span>Sanal Orman Mirası ({forestTrees.length} Ağaç)</span>
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Kadim Orman modunda başarıyla tamamladığın her seans burada kalıcı bir ağaç olarak yaşar.
            </p>

            {forestTrees.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 rounded-2xl border border-neutral-800">
                <Trees className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-neutral-300">Henüz dikilmiş ağaç bulunmuyor.</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Kadim Orman modunda bir seansı tamamlayarak ilk ağacını büyütebilirsin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {forestTrees.map((tree, idx) => (
                  <div
                    key={tree.id || idx}
                    className="p-4 rounded-2xl bg-neutral-950 border border-emerald-800/40 flex flex-col items-center text-center shadow-lg"
                  >
                    <span className="text-4xl mb-2">🌿</span>
                    <h4 className="text-xs font-bold text-white">Kadim Meşe</h4>
                    <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      {Math.round(tree.completedSeconds / 60)} dk Odak
                    </span>
                    <span className="text-[9px] text-neutral-500 mt-1">{tree.dateString}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HAFTALIK MOLA GÜNÜ SEÇİM MODALI (KULLANICI TALEBİ) */}
      {isRestDayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Haftalık Mola Günü</h3>
                  <p className="text-xs text-neutral-400">Haftanın 1 gününü dinlenme günü olarak belirle</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRestDayModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Mola gününde çalışma yapmasan bile istikrar serin (streak) korunur ve aylık takvimde kahve emojisi ile dinlenme günü olarak işaretlenir.
            </p>

            {/* 7 Günlük Liste + Mola Günü Yok */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[
                { id: 1, name: 'Pazartesi' },
                { id: 2, name: 'Salı' },
                { id: 3, name: 'Çarşamba' },
                { id: 4, name: 'Perşembe' },
                { id: 5, name: 'Cuma' },
                { id: 6, name: 'Cumartesi' },
                { id: 0, name: 'Pazar' },
              ].map((day) => {
                const isSelected = currentRestDayNumber === day.id;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      if (onUpdateProfile) {
                        onUpdateProfile({ weeklyRestDays: [day.id] });
                      }
                      setIsRestDayModalOpen(false);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/25 border-amber-500 text-amber-200 font-bold shadow-md shadow-amber-950/40 ring-1 ring-amber-400'
                        : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <span className="text-sm">{day.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>
                );
              })}

              {/* Mola Günü Yok Seçeneği (Kullanıcı Talebi) */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  if (onUpdateProfile) {
                    onUpdateProfile({ weeklyRestDays: [] });
                  }
                  setIsRestDayModalOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between col-span-2 ${
                  currentRestDayNumber === null
                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-bold ring-1 ring-rose-400'
                    : 'bg-neutral-950/70 border-neutral-800 hover:border-rose-900/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🚫</span>
                  <div>
                    <span className="text-sm font-bold block">Mola Günü Yok</span>
                    <span className="text-[10px] text-neutral-400 block">Haftalık mola günü belirleme, her gün çalışma hedefi</span>
                  </div>
                </div>
                {currentRestDayNumber === null && <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
