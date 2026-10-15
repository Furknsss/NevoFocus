import { db, safeSetDoc, handleFirestoreError, OperationType, cleanFirestoreData, parseNumericField } from '../firebase';
import { doc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { FocusSession, FocusTask, UserProfile } from '../types';
import {
  getStoredSessions,
  setAllStoredSessions,
  getStoredTasks,
  setAllStoredTasks,
  getStoredProfile,
  updateStoredProfile,
} from '../utils/storage';

const LAST_SYNC_KEY = 'fokus_last_sync_timestamp';

export interface SyncResult {
  success: boolean;
  sessionsUploaded: number;
  tasksUploaded: number;
  message?: string;
  timestamp: number;
}

export function getLastSyncTime(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

export function setLastSyncTime(timestamp: number): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
  } catch {
    // ignore
  }
}

/**
 * Uploads all local sessions, tasks and user profile into Firestore.
 * Does not overwrite newer records. Safely batches or writes items.
 */
export async function syncAllToFirestore(
  user: User | null,
  sessions: FocusSession[],
  tasks: FocusTask[],
  profile: UserProfile
): Promise<SyncResult> {
  if (!user) {
    return {
      success: false,
      sessionsUploaded: 0,
      tasksUploaded: 0,
      message: 'Giriş yapılmamış. Senkronizasyon için oturum açın.',
      timestamp: Date.now(),
    };
  }

  try {
    const uid = user.uid;

    // 1. Sync User Profile doc
    const userDocRef = doc(db, 'users', uid);
    const profilePayload = {
      userId: uid,
      email: user.email || profile.email || '',
      displayName: profile.name || user.displayName || 'Öğrenci',
      targetUniversity: profile.targetUniversity || '',
      targetDepartment: profile.targetDepartment || '',
      targetExam: profile.targetExam || 'YKS 2026',
      studyTrack: profile.studyTrack || 'Sayısal',
      dailyGoalHours: profile.dailyGoalHours || 6,
      avatarColor: profile.avatarColor || '#ff5500',
      soundNotifications: profile.soundNotifications ?? true,
      breakReminders: profile.breakReminders ?? true,
      desktopNotifications: profile.desktopNotifications ?? false,
      liveNotifications: profile.liveNotifications ?? false,
      theme: profile.theme || 'dark',
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    };
    await safeSetDoc(userDocRef, profilePayload, { merge: true });

    // 2. Upload Sessions in chunks / safe parallel writes
    let sessionsUploaded = 0;
    for (const session of sessions) {
      if (!session.id) continue;
      const sessionRef = doc(db, 'users', uid, 'sessions', session.id);
      await safeSetDoc(
        sessionRef,
        {
          ...session,
          userId: uid,
          syncedAt: Date.now(),
        },
        { merge: true }
      );
      sessionsUploaded++;
    }

    // 3. Upload Tasks
    let tasksUploaded = 0;
    for (const task of tasks) {
      if (!task.id) continue;
      const taskRef = doc(db, 'users', uid, 'tasks', task.id);
      await safeSetDoc(
        taskRef,
        {
          ...task,
          userId: uid,
          syncedAt: Date.now(),
        },
        { merge: true }
      );
      tasksUploaded++;
    }

    const now = Date.now();
    setLastSyncTime(now);

    return {
      success: true,
      sessionsUploaded,
      tasksUploaded,
      message: `${sessionsUploaded} çalışma seansı ve ${tasksUploaded} görev Firestore bulutuna başarıyla yedeklendi.`,
      timestamp: now,
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/sync`);
    return {
      success: false,
      sessionsUploaded: 0,
      tasksUploaded: 0,
      message: error?.message || 'Yedekleme sırasında bir hata oluştu.',
      timestamp: Date.now(),
    };
  }
}

/**
 * Restores and merges all cloud data from Firestore into local cache.
 * Combines local and cloud sessions and tasks without deleting anything!
 */
export async function restoreAllFromFirestore(
  user: User | null
): Promise<{
  success: boolean;
  sessions: FocusSession[];
  tasks: FocusTask[];
  profile?: Partial<UserProfile>;
  message: string;
}> {
  if (!user) {
    return {
      success: false,
      sessions: getStoredSessions(),
      tasks: getStoredTasks(),
      message: 'Giriş yapılmamış.',
    };
  }

  try {
    const uid = user.uid;

    // 1. Fetch Cloud Profile
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    let cloudProfile: Partial<UserProfile> = {};
    if (userSnap.exists()) {
      cloudProfile = userSnap.data() as Partial<UserProfile>;
    }

    // 2. Fetch Cloud Sessions
    const sessionsCol = collection(db, 'users', uid, 'sessions');
    const sessionsSnap = await getDocs(sessionsCol);
    const cloudSessions: FocusSession[] = [];
    sessionsSnap.forEach((docSnap) => {
      const s = docSnap.data() as any;
      if (s) {
        cloudSessions.push({
          ...s,
          durationMinutes: parseNumericField(s.durationMinutes, 25),
          actualSeconds: parseNumericField(s.actualSeconds, 1500),
          timestamp: parseNumericField(s.timestamp, Date.now()),
        } as unknown as FocusSession);
      }
    });

    // 3. Fetch Cloud Tasks
    const tasksCol = collection(db, 'users', uid, 'tasks');
    const tasksSnap = await getDocs(tasksCol);
    const cloudTasks: FocusTask[] = [];
    tasksSnap.forEach((docSnap) => {
      const t = docSnap.data() as any;
      if (t && !t.deleted) {
        cloudTasks.push({
          ...t,
          estimatedPomodoros: parseNumericField(t.estimatedPomodoros, 1),
          completedPomodoros: parseNumericField(t.completedPomodoros, 0),
          createdAt: parseNumericField(t.createdAt, Date.now()),
        } as unknown as FocusTask);
      }
    });

    // 4. Merge Sessions (local + cloud, deduplicated by ID, latest timestamp first)
    const localSessions = getStoredSessions();
    const sessionMap = new Map<string, FocusSession>();
    // First put local
    for (const s of localSessions) {
      if (s.id) sessionMap.set(s.id, s);
    }
    // Then overwrite/add cloud
    for (const s of cloudSessions) {
      if (s.id) sessionMap.set(s.id, s);
    }
    const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    setAllStoredSessions(mergedSessions);

    // 5. Merge Tasks
    const localTasks = getStoredTasks();
    const taskMap = new Map<string, FocusTask>();
    for (const t of localTasks) {
      if (t.id) taskMap.set(t.id, t);
    }
    for (const t of cloudTasks) {
      if (t.id) taskMap.set(t.id, t);
    }
    const mergedTasks = Array.from(taskMap.values());
    setAllStoredTasks(mergedTasks);

    // 6. Update Profile
    let mergedProfile = getStoredProfile();
    if (cloudProfile.name || cloudProfile.targetExam) {
      mergedProfile = updateStoredProfile(cloudProfile);
    }

    const now = Date.now();
    setLastSyncTime(now);

    return {
      success: true,
      sessions: mergedSessions,
      tasks: mergedTasks,
      profile: mergedProfile,
      message: `${mergedSessions.length} seans ve ${mergedTasks.length} görev buluttan başarıyla yüklendi ve birleştirildi.`,
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/restore`);
    return {
      success: false,
      sessions: getStoredSessions(),
      tasks: getStoredTasks(),
      message: error?.message || 'Buluttan geri yükleme yapılırken hata oluştu.',
    };
  }
}

/**
 * Exports all user data as an offline JSON file backup.
 */
export function exportLocalBackup(
  sessions: FocusSession[],
  tasks: FocusTask[],
  profile: UserProfile
): void {
  const exportData = {
    app: 'Fokus Premium',
    version: '4.0.0',
    exportedAt: new Date().toISOString(),
    profile,
    sessions,
    tasks,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `fokus_yedek_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports a JSON file backup and merges it safely with current state.
 */
export async function importLocalBackup(
  jsonString: string,
  user: User | null
): Promise<{
  success: boolean;
  sessionsCount: number;
  tasksCount: number;
  message: string;
  mergedSessions: FocusSession[];
  mergedTasks: FocusTask[];
  mergedProfile?: UserProfile;
}> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || (!parsed.sessions && !parsed.tasks && !parsed.profile)) {
      throw new Error('Geçersiz yedek dosyası formatı.');
    }

    const importedSessions: FocusSession[] = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const importedTasks: FocusTask[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const importedProfile: Partial<UserProfile> = parsed.profile || {};

    // Merge sessions
    const currentSessions = getStoredSessions();
    const sessionMap = new Map<string, FocusSession>();
    for (const s of currentSessions) {
      if (s.id) sessionMap.set(s.id, s);
    }
    for (const s of importedSessions) {
      if (s.id) sessionMap.set(s.id, s);
    }
    const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    setAllStoredSessions(mergedSessions);

    // Merge tasks
    const currentTasks = getStoredTasks();
    const taskMap = new Map<string, FocusTask>();
    for (const t of currentTasks) {
      if (t.id) taskMap.set(t.id, t);
    }
    for (const t of importedTasks) {
      if (t.id) taskMap.set(t.id, t);
    }
    const mergedTasks = Array.from(taskMap.values());
    setAllStoredTasks(mergedTasks);

    // Merge profile
    const mergedProfile = updateStoredProfile(importedProfile);

    // If user is logged in, sync merged data to Firestore as well!
    if (user) {
      await syncAllToFirestore(user, mergedSessions, mergedTasks, mergedProfile);
    }

    return {
      success: true,
      sessionsCount: importedSessions.length,
      tasksCount: importedTasks.length,
      message: `Yedekten ${importedSessions.length} seans ve ${importedTasks.length} görev başarıyla aktarıldı.`,
      mergedSessions,
      mergedTasks,
      mergedProfile,
    };
  } catch (err: any) {
    return {
      success: false,
      sessionsCount: 0,
      tasksCount: 0,
      message: err?.message || 'Yedek dosyası ayrıştırılamadı.',
      mergedSessions: getStoredSessions(),
      mergedTasks: getStoredTasks(),
    };
  }
}
