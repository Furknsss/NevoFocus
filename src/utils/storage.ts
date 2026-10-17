import { FocusModeConfig, FocusSession, FocusTask, StudentPeer, StudyRoom, SubjectItem, UserProfile } from '../types';

export const FOCUS_MODES: FocusModeConfig[] = [
  {
    id: 'forest',
    title: 'Orman',
    subtitle: 'Ağacını büyüt',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    description: 'Bonsai ve mistik orman ağacını odaklandıkça filizlendir, yapraklarını açtır.',
    iconName: 'Trees',
  },
  {
    id: 'climb',
    title: 'Tırmanış',
    subtitle: 'Zirveye ulaş',
    accentColor: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    description: 'Karlı dağ zirvelerine tırman, kamp kur ve rakım rekorlarını kır.',
    iconName: 'Mountain',
  },
  {
    id: 'flight',
    title: 'Uçuş',
    subtitle: 'Destinasyona var',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    description: 'Dünya haritasında şehirler arası kesintili rota çizgisi, telemetri ve iniş simülasyonu.',
    iconName: 'Plane',
  },
  {
    id: 'dive',
    title: 'Dalış',
    subtitle: 'Derine in',
    accentColor: '#2dd4bf',
    glowColor: 'rgba(45, 212, 191, 0.4)',
    description: 'Balıkçı teknesinden kaçan balıkla derin denizdeki Balık Şehri\'ne dal.',
    iconName: 'Waves',
  },
];

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  { id: 'sub-tyt-mat', name: 'TYT Matematik', color: '#10b981' },
  { id: 'sub-tyt-geo', name: 'TYT Geometri', color: '#059669' },
  { id: 'sub-tyt-fiz', name: 'TYT Fizik', color: '#3b82f6' },
  { id: 'sub-tyt-kim', name: 'TYT Kimya', color: '#ec4899' },
  { id: 'sub-tyt-biyo', name: 'TYT Biyoloji', color: '#84cc16' },
  { id: 'sub-tyt-turk', name: 'TYT Türkçe', color: '#f59e0b' },
  { id: 'sub-ayt-mat', name: 'AYT Matematik', color: '#0d9488' },
  { id: 'sub-ayt-geo', name: 'AYT Geometri', color: '#14b8a6' },
  { id: 'sub-ayt-fiz', name: 'AYT Fizik', color: '#2563eb' },
  { id: 'sub-ayt-kim', name: 'AYT Kimya', color: '#db2777' },
  { id: 'sub-ayt-biyo', name: 'AYT Biyoloji', color: '#65a30d' },
];

export const DEFAULT_ROOMS: StudyRoom[] = [];

const STORAGE_KEYS = {
  SESSIONS: 'fokus_sessions_v4',
  SUBJECTS: 'fokus_subjects_v4',
  PROFILE: 'fokus_profile_v4',
  TASKS: 'fokus_tasks_v4',
  ROOMS: 'fokus_rooms_v4',
  PEERS: 'fokus_peers_v4',
};

// Purged: No fake seed sessions exist! Clean production state.
export function getStoredSessions(): FocusSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSession(session: FocusSession): FocusSession[] {
  const current = getStoredSessions();
  const updated = [session, ...current.filter((s) => s.id !== session.id)];
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save session to storage', err);
  }
  return updated;
}

export function setAllStoredSessions(sessions: FocusSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save all sessions', err);
  }
}

// Purged: Clean default tasks (empty)
export function getStoredTasks(): FocusTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTask(task: FocusTask): FocusTask[] {
  const current = getStoredTasks();
  const updated = [task, ...current];
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function setAllStoredTasks(tasks: FocusTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

export function toggleTaskDone(taskId: string): FocusTask[] {
  const current = getStoredTasks();
  const updated = current.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t));
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function deleteTask(taskId: string): FocusTask[] {
  const current = getStoredTasks();
  const updated = current.filter((t) => t.id !== taskId);
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function getStoredSubjects(): SubjectItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
      return DEFAULT_SUBJECTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SUBJECTS;
  }
}

export function addStoredSubject(subject: SubjectItem): SubjectItem[] {
  const current = getStoredSubjects();
  const updated = [...current, subject];
  try {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save subject', err);
  }
  return updated;
}

function safeNum(val: any, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    if (!isNaN(n)) return n;
  }
  if (val && typeof val === 'object') {
    if (typeof val.Vi === 'number' && !isNaN(val.Vi)) return val.Vi;
    if (typeof val.value === 'number' && !isNaN(val.value)) return val.value;
  }
  return fallback;
}

export function getStoredProfile(): UserProfile {
  const defaultProfile: UserProfile = {
    name: 'Öğrenci',
    initials: 'Ö',
    avatarColor: '#ff5500',
    avatarUrl: '',
    targetUniversity: '',
    targetDepartment: '',
    targetExam: 'YKS 2026 Sayısal',
    studyTrack: 'Sayısal',
    dailyGoalHours: 6,
    currentStreakDays: 0,
    totalFocusHours: 0,
    hasCompletedOnboarding: false,
    soundNotifications: true,
    breakReminders: true,
    desktopNotifications: false,
    liveNotifications: false,
    theme: 'dark',
    weeklyRestDays: [0], // Default: Pazar
    customRestDates: [],
    excludedRestDates: [],
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    const parsed = JSON.parse(raw);
    const merged: UserProfile = {
      ...defaultProfile,
      ...parsed,
      name: typeof parsed.name === 'string' ? parsed.name : defaultProfile.name,
      targetExam: typeof parsed.targetExam === 'string' ? parsed.targetExam : defaultProfile.targetExam,
      studyTrack: typeof parsed.studyTrack === 'string' ? parsed.studyTrack : defaultProfile.studyTrack,
      dailyGoalHours: safeNum(parsed.dailyGoalHours, 6),
      currentStreakDays: safeNum(parsed.currentStreakDays, 0),
      totalFocusHours: safeNum(parsed.totalFocusHours, 0),
      cheersReceived: safeNum(parsed.cheersReceived, 0),
      weeklyRestDays: Array.isArray(parsed.weeklyRestDays) ? parsed.weeklyRestDays : [0],
      customRestDates: Array.isArray(parsed.customRestDates) ? parsed.customRestDates : [],
      excludedRestDates: Array.isArray(parsed.excludedRestDates) ? parsed.excludedRestDates : [],
    };
    return merged;
  } catch {
    return defaultProfile;
  }
}

export function updateStoredProfile(profile: Partial<UserProfile>): UserProfile {
  const current = getStoredProfile();
  const sanitizedProfile: Partial<UserProfile> = { ...profile };
  if ('dailyGoalHours' in sanitizedProfile) {
    sanitizedProfile.dailyGoalHours = safeNum(sanitizedProfile.dailyGoalHours, 6);
  }
  if ('currentStreakDays' in sanitizedProfile) {
    sanitizedProfile.currentStreakDays = safeNum(sanitizedProfile.currentStreakDays, 0);
  }
  if ('totalFocusHours' in sanitizedProfile) {
    sanitizedProfile.totalFocusHours = safeNum(sanitizedProfile.totalFocusHours, 0);
  }
  if ('cheersReceived' in sanitizedProfile) {
    sanitizedProfile.cheersReceived = safeNum(sanitizedProfile.cheersReceived, 0);
  }
  const updated = { ...current, ...sanitizedProfile };
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update profile', err);
  }
  return updated;
}
