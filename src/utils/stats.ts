import { FocusSession, UserProfile } from '../types';

/**
 * Checks if a specific date is a designated rest day (mola günü) according to user preferences.
 * Supports both weekly recurring rest days (0 = Sunday, 1 = Monday...) and custom week-specific dates.
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
  if (Array.isArray(profile.weeklyRestDays) && profile.weeklyRestDays.includes(dayOfWeek)) {
    return true;
  }

  return false;
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
 * Calculates genuine day-by-day streak based exclusively on completed study sessions.
 * If user studied today, streak is counted from today back.
 * If today or yesterday was an authorized rest day (mola günü), streak is protected!
 * If user hasn't studied today yet, but studied yesterday, the streak remains intact from yesterday back.
 * If user missed without an authorized rest day, streak is 0.
 */
export function calculateRealStreak(sessions: FocusSession[], profile?: UserProfile): number {
  if (!sessions || sessions.length === 0) return 0;

  // Filter completed sessions with at least 60 seconds of real focus
  const validSessions = sessions.filter((s) => s.completed && s.completedSeconds >= 60);
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
 * Calculates total focus hours from real sessions.
 */
export function calculateTotalFocusHours(sessions: FocusSession[]): number {
  if (!sessions || sessions.length === 0) return 0;
  const totalSeconds = sessions
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + s.completedSeconds, 0);
  return Math.round((totalSeconds / 3600) * 10) / 10;
}

/**
 * Calculates today's studied minutes from real sessions using local calendar day.
 */
export function calculateTodayMinutes(sessions: FocusSession[]): number {
  if (!sessions || sessions.length === 0) return 0;
  const todayStr = getLocalDateString(new Date());
  const todaySeconds = sessions
    .filter((s) => s.dateString === todayStr && s.completed)
    .reduce((acc, s) => acc + s.completedSeconds, 0);
  return Math.round(todaySeconds / 60);
}
