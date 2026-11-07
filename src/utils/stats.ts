import type { FocusSession, UserProfile } from '../types';

/**
 * Checks if a specific date is a designated rest day (mola günü) according to user preferences.
 * Only individually selected dates are active by default. Old recurring defaults are ignored.
 */
export function isDateRestDay(dateInput: string | Date, profile?: UserProfile): boolean {
  if (!profile) return false;

  let dateStr: string;
  let dayOfWeek: number;

  if (typeof dateInput === 'string') {
    dateStr = dateInput;
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      dayOfWeek = new Date(year, month, day).getDay();
    } else {
      dayOfWeek = new Date(dateInput).getDay();
    }
  } else {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
    dayOfWeek = dateInput.getDay();
  }

  // 1. If explicitly excluded for this specific date/week:
  if (Array.isArray(profile.excludedRestDates) && profile.excludedRestDates.includes(dateStr)) {
    return false;
  }

  // 2. Check custom specific dates chosen by user (e.g. for different weeks)
  if (Array.isArray(profile.customRestDates) && profile.customRestDates.includes(dateStr)) {
    return true;
  }

  // 3. Check weekly recurring rest days (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  if (profile.restDaySelectionMode === 'weekly' && Array.isArray(profile.weeklyRestDays) && profile.weeklyRestDays.includes(dayOfWeek)) {
    return true;
  }

  return false;
}

/** Toggle one calendar date; never turn its weekday into a recurring rule. */
export function toggleRestDate(dateStr: string, profile: UserProfile): Partial<UserProfile> {
  const dates = new Set(profile.customRestDates || []);
  const selected = dates.has(dateStr) && !(profile.excludedRestDates || []).includes(dateStr);
  if (selected) dates.delete(dateStr);
  else dates.add(dateStr);
  return {
    restDaySelectionMode: 'dates',
    weeklyRestDays: [],
    customRestDates: [...dates].sort(),
    excludedRestDates: (profile.excludedRestDates || []).filter(date => date !== dateStr),
  };
}

/**
 * Calculates genuine day-by-day streak based exclusively on completed study sessions.
 * If user studied today, streak is counted from today back.
 * If today or yesterday was an authorized rest day (mola günü), streak is protected!
 * If user hasn't studied today yet, but studied yesterday, the streak remains intact from yesterday back.
 * If user missed without an authorized rest day, streak is 0.
 */
/**
 * Returns YYYY-MM-DD formatted string in user's local timezone (not UTC).
 * Prevents timezone mismatches where sessions between 00:00-03:00 get attributed to the wrong day.
 */
export function getLocalDateString(dateInput: Date | number = new Date()): string {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
/**
 * Returns only valid completed sessions (where user pressed Tamamla and completedSeconds > 0).
 * Normalizes dateString if missing.
 */
export function getValidCompletedSessions(sessions: FocusSession[]): FocusSession[] {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .filter((s) => s && s.completed !== false && Number(s.completedSeconds) > 0)
    .map((s) => ({
      ...s,
      completedSeconds: Number(s.completedSeconds) || 0,
      breakSeconds: Number(s.breakSeconds) || 0,
      dateString: s.dateString || getLocalDateString(s.timestamp || Date.now()),
    }));
}

/**
 * Calculates genuine day-by-day streak based exclusively on completed study sessions.
 * If user studied today, streak is counted from today back.
 * If today or yesterday was an authorized rest day (mola günü), streak is protected!
 * If user hasn't studied today yet, but studied yesterday, the streak remains intact from yesterday back.
 * If user missed without an authorized rest day, streak is 0.
 */
export function calculateRealStreak(sessions: FocusSession[], profile?: UserProfile): number {
  const validSessions = getValidCompletedSessions(sessions);
  if (validSessions.length === 0) return 0;

  const studiedDates = new Set(validSessions.map((s) => s.dateString));

  const today = new Date();
  const todayStr = getLocalDateString(today);

  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  const dayBeforeYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
  const dayBeforeYesterdayStr = getLocalDateString(dayBeforeYesterday);

  // Determine starting date for streak walk
  let anchorDate: Date | null = null;
  if (studiedDates.has(todayStr)) {
    anchorDate = today;
  } else if (isDateRestDay(todayStr, profile) && studiedDates.has(yesterdayStr)) {
    // Today is an authorized rest day, and user studied yesterday: streak is active
    anchorDate = yesterday;
  } else if (studiedDates.has(yesterdayStr)) {
    anchorDate = yesterday;
  } else if (isDateRestDay(yesterdayStr, profile) && studiedDates.has(dayBeforeYesterdayStr)) {
    // Yesterday was an authorized rest day, and user studied before it: streak is active
    anchorDate = dayBeforeYesterday;
  } else {
    return 0; // Streak broken
  }

  let streak = 0;
  const runner = new Date(anchorDate);

  // Traverse backwards day-by-day up to a full year
  for (let i = 0; i < 365; i++) {
    const dStr = getLocalDateString(runner);
    if (studiedDates.has(dStr)) {
      streak++;
      runner.setDate(runner.getDate() - 1);
    } else if (profile && isDateRestDay(dStr, profile)) {
      // Authorized rest day: does not break streak! Continue backwards
      runner.setDate(runner.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates total focus hours from real completed sessions.
 */
export function calculateTotalFocusHours(sessions: FocusSession[]): number {
  const validSessions = getValidCompletedSessions(sessions);
  if (validSessions.length === 0) return 0;
  const totalSeconds = validSessions.reduce((acc, s) => acc + s.completedSeconds, 0);
  return Math.round((totalSeconds / 3600) * 10) / 10;
}

/**
 * Calculates today's studied minutes from real completed sessions using local calendar day.
 */
export function calculateTodayMinutes(sessions: FocusSession[]): number {
  const validSessions = getValidCompletedSessions(sessions);
  if (validSessions.length === 0) return 0;
  const todayStr = getLocalDateString(new Date());
  const todaySeconds = validSessions
    .filter((s) => s.dateString === todayStr)
    .reduce((acc, s) => acc + s.completedSeconds, 0);
  if (todaySeconds <= 0) return 0;
  return Math.max(1, Math.round(todaySeconds / 60));
}

/**
 * Returns the Monday YYYY-MM-DD of the current week (Monday-start).
 */
export function getCurrentWeekKey(now: Date = new Date()): string {
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  return getLocalDateString(monday);
}

/**
 * Returns YYYY-MM for the current month.
 */
export function getCurrentMonthKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculates current week's (Monday through Sunday) total studied minutes.
 */
export function calculateWeeklyMinutes(sessions: FocusSession[]): number {
  const validSessions = getValidCompletedSessions(sessions);
  if (validSessions.length === 0) return 0;
  const mondayStr = getCurrentWeekKey(new Date());
  const todayStr = getLocalDateString(new Date());
  const weekSeconds = validSessions
    .filter((s) => s.dateString >= mondayStr && s.dateString <= todayStr)
    .reduce((acc, s) => acc + s.completedSeconds, 0);
  if (weekSeconds <= 0) return 0;
  return Math.max(1, Math.round(weekSeconds / 60));
}

/**
 * Calculates current month's total studied minutes and rich summary metrics.
 */
export function calculateMonthlyStatsSummary(sessions: FocusSession[]): {
  monthlyMinutes: number;
  monthlySessionsCount: number;
  monthlyActiveDays: number;
  favoriteSubject: string;
} {
  const validSessions = getValidCompletedSessions(sessions);
  const monthPrefix = getCurrentMonthKey(new Date());
  const monthSessions = validSessions.filter((s) => s.dateString.startsWith(monthPrefix));

  if (monthSessions.length === 0) {
    return {
      monthlyMinutes: 0,
      monthlySessionsCount: 0,
      monthlyActiveDays: 0,
      favoriteSubject: 'Genel Odak',
    };
  }

  const totalSecs = monthSessions.reduce((acc, s) => acc + s.completedSeconds, 0);
  const monthlyMinutes = totalSecs > 0 ? Math.max(1, Math.round(totalSecs / 60)) : 0;
  const activeDaysSet = new Set(monthSessions.map((s) => s.dateString));

  const subjectMap = new Map<string, number>();
  for (const s of monthSessions) {
    const subj = s.subjectName || 'Genel Odak';
    subjectMap.set(subj, (subjectMap.get(subj) || 0) + s.completedSeconds);
  }
  let favoriteSubject = 'Genel Odak';
  let maxSubjSecs = -1;
  subjectMap.forEach((secs, subj) => {
    if (secs > maxSubjSecs) {
      maxSubjSecs = secs;
      favoriteSubject = subj;
    }
  });

  return {
    monthlyMinutes,
    monthlySessionsCount: monthSessions.length,
    monthlyActiveDays: activeDaysSet.size,
    favoriteSubject,
  };
}


