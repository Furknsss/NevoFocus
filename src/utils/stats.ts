import { FocusSession } from '../types';

/**
 * Calculates genuine day-by-day streak based exclusively on completed study sessions.
 * If user studied today, streak is counted from today back.
 * If user hasn't studied today yet, but studied yesterday, the streak remains intact from yesterday back.
 * If user missed yesterday as well, streak is 0.
 */
export function calculateRealStreak(sessions: FocusSession[]): number {
  if (!sessions || sessions.length === 0) return 0;

  // Filter completed sessions with at least 60 seconds of real focus
  const validSessions = sessions.filter((s) => s.completed && s.completedSeconds >= 60);
  if (validSessions.length === 0) return 0;

  const studiedDates = new Set(validSessions.map((s) => s.dateString));

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Determine starting date for streak walk
  let anchorDate: Date | null = null;
  if (studiedDates.has(todayStr)) {
    anchorDate = today;
  } else if (studiedDates.has(yesterdayStr)) {
    anchorDate = yesterday;
  } else {
    return 0; // Streak broken
  }

  let streak = 0;
  const runner = new Date(anchorDate);

  // Traverse backwards day-by-day
  for (let i = 0; i < 365; i++) {
    const dStr = runner.toISOString().split('T')[0];
    if (studiedDates.has(dStr)) {
      streak++;
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
 * Calculates today's studied minutes from real sessions.
 */
export function calculateTodayMinutes(sessions: FocusSession[]): number {
  if (!sessions || sessions.length === 0) return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySeconds = sessions
    .filter((s) => s.dateString === todayStr && s.completed)
    .reduce((acc, s) => acc + s.completedSeconds, 0);
  return Math.round(todaySeconds / 60);
}
