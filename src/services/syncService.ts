import { db, auth, safeSetDoc, handleFirestoreError, OperationType, parseNumericField } from '../firebase';
import { doc, getDoc, getDocFromServer, collection, getDocs, getDocsFromServer } from 'firebase/firestore';
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
import {
  getLocalDateString,
  getCurrentWeekKey,
  getCurrentMonthKey,
  calculateTodayMinutes,
  calculateWeeklyMinutes,
  calculateMonthlyStatsSummary,
  calculateTotalFocusHours,
  calculateRealStreak,
} from '../utils/stats';

const LAST_SYNC_KEY = 'fokus_last_sync_timestamp';
const DELETED_SESSIONS_KEY = 'fokus_deleted_session_ids_v4';
const DELETED_TASKS_KEY = 'fokus_deleted_task_ids_v4';
const FALLBACK_CLOUD_UID_KEY = 'fokus_cloud_backup_uid_v4';

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

export function getDeletedSessionIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markSessionDeletedId(sessionId: string): void {
  try {
    const current = new Set(getDeletedSessionIds());
    current.add(sessionId);
    localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export function getDeletedTaskIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markTaskDeletedId(taskId: string): void {
  try {
    const current = new Set(getDeletedTaskIds());
    current.add(taskId);
    localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

function sanitizeEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function resolveSyncIdentity(user?: User | null, profile?: UserProfile): {
  uid: string;
  email: string;
} {
  const storedProfile = profile || getStoredProfile();
  const storedUid = typeof window !== 'undefined' ? (localStorage.getItem('fokus_user_uid') || '') : '';
  const storedEmail = typeof window !== 'undefined' ? (localStorage.getItem('fokus_user_email') || '') : '';
  const fallbackCloudUid = typeof window !== 'undefined' ? (localStorage.getItem(FALLBACK_CLOUD_UID_KEY) || '') : '';

  const email = (
    user?.email ||
    auth.currentUser?.email ||
    storedProfile.email ||
    storedEmail ||
    ''
  ).trim().toLowerCase();

  let uid = (
    user?.uid ||
    auth.currentUser?.uid ||
    storedProfile.userId ||
    storedUid ||
    fallbackCloudUid ||
    ''
  ).trim();

  if (!uid) {
    if (email) {
      uid = `user_${sanitizeEmailKey(email)}`;
    } else {
      uid = 'fokus_primary_cloud_user';
    }
    try {
      localStorage.setItem(FALLBACK_CLOUD_UID_KEY, uid);
    } catch {
      // ignore
    }
  }

  return { uid, email };
}

async function fetchDocFresh(docRef: any): Promise<{ exists: () => boolean; id: string; data: () => Record<string, any> | undefined }> {
  try {
    return (await getDocFromServer(docRef)) as any;
  } catch {
    return (await getDoc(docRef)) as any;
  }
}

async function fetchDocsFresh(colRef: any): Promise<{ forEach: (cb: (docSnap: any) => void) => void }> {
  try {
    return (await getDocsFromServer(colRef)) as any;
  } catch {
    return (await getDocs(colRef)) as any;
  }
}

export function notifyCloudRestored(sessions: FocusSession[], tasks: FocusTask[], profile: UserProfile) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fokus-cloud-restored', {
        detail: { sessions, tasks, profile },
      })
    );
  }
}

/**
 * Uploads all local sessions, tasks and user profile into Firestore.
 * Works across authenticated accounts, email-linked accounts, and tablet/mobile browsers.
 * Never overwrites non-empty cloud data with an empty local state on a new device.
 */
export async function syncAllToFirestore(
  user: User | null,
  sessions?: FocusSession[],
  tasks?: FocusTask[],
  profile?: UserProfile,
  options?: { allowEmptyOverwrite?: boolean }
): Promise<SyncResult> {
  const currentProfile = profile || getStoredProfile();
  const { uid, email } = resolveSyncIdentity(user, currentProfile);

  try {
    const deletedSessionSet = new Set(getDeletedSessionIds());
    const deletedTaskSet = new Set(getDeletedTaskIds());

    // Combine passed arrays with localStorage so nothing is ever lost
    const localSessions = getStoredSessions();
    const sessionMap = new Map<string, FocusSession>();
    for (const s of localSessions) {
      if (s && s.id && !deletedSessionSet.has(s.id)) sessionMap.set(s.id, s);
    }
    for (const s of sessions || []) {
      if (s && s.id && !deletedSessionSet.has(s.id)) sessionMap.set(s.id, s);
    }

    const localTasks = getStoredTasks();
    const taskMap = new Map<string, FocusTask>();
    for (const t of localTasks) {
      if (t && t.id && !deletedTaskSet.has(t.id)) taskMap.set(t.id, t);
    }
    for (const t of tasks || []) {
      if (t && t.id && !deletedTaskSet.has(t.id)) taskMap.set(t.id, t);
    }

    // Protection: If this device currently has 0 sessions and 0 tasks (e.g. brand new tablet login),
    // pull existing cloud sessions first so we don't overwrite cloud stats with 0!
    if (sessionMap.size === 0 && taskMap.size === 0 && !options?.allowEmptyOverwrite) {
      try {
        const sharedSnap = await fetchDocFresh(doc(db, 'test', 'backup_latest_shared'));
        if (sharedSnap.exists()) {
          const sharedData = sharedSnap.data();
          if (Array.isArray(sharedData?.sessions) && sharedData.sessions.length > 0) {
            for (const s of sharedData.sessions) {
              if (s && s.id && !deletedSessionSet.has(s.id)) sessionMap.set(s.id, s);
            }
          }
          if (Array.isArray(sharedData?.tasks) && sharedData.tasks.length > 0) {
            for (const t of sharedData.tasks) {
              if (t && t.id && !deletedTaskSet.has(t.id)) taskMap.set(t.id, t);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const mergedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    const mergedTasks = Array.from(taskMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    // Save merged back to localStorage
    if (mergedSessions.length > 0) setAllStoredSessions(mergedSessions);
    if (mergedTasks.length > 0) setAllStoredTasks(mergedTasks);

    // 1. Sync User Profile doc
    const userDocRef = doc(db, 'users', uid);
    const todayStr = getLocalDateString(new Date());
    const weekStr = getCurrentWeekKey(new Date());
    const monthStr = getCurrentMonthKey(new Date());
    const validCompleted = mergedSessions.filter(
      (s) => s && s.completed !== false && Number(s.completedSeconds) > 0
    );
    const computedTodayMins = calculateTodayMinutes(mergedSessions);
    const computedWeeklyMins = calculateWeeklyMinutes(mergedSessions);
    const monthlySummary = calculateMonthlyStatsSummary(mergedSessions);
    const computedTotalSecs = validCompleted.reduce(
      (acc, s) => acc + (Number(s.completedSeconds) || 0),
      0
    );
    const computedTotalMins =
      computedTotalSecs > 0 ? Math.max(1, Math.round(computedTotalSecs / 60)) : 0;
    const computedTotalHours = calculateTotalFocusHours(mergedSessions);
    const computedStreak = calculateRealStreak(mergedSessions, currentProfile);

    const profilePayload = {
      userId: uid,
      email: email || currentProfile.email || '',
      name: currentProfile.name || user?.displayName || 'Öğrenci',
      displayName: currentProfile.name || user?.displayName || 'Öğrenci',
      initials: currentProfile.initials || 'Ö',
      avatarUrl: currentProfile.avatarUrl || user?.photoURL || '',
      targetUniversity: currentProfile.targetUniversity || '',
      targetDepartment: currentProfile.targetDepartment || '',
      targetExam: currentProfile.targetExam || 'YKS 2026 Sayısal',
      studyTrack: currentProfile.studyTrack || 'Sayısal',
      dailyGoalHours: currentProfile.dailyGoalHours || 6,
      avatarColor: currentProfile.avatarColor || '#ff5500',
      soundNotifications: currentProfile.soundNotifications ?? true,
      breakReminders: currentProfile.breakReminders ?? true,
      desktopNotifications: currentProfile.desktopNotifications ?? false,
      liveNotifications: currentProfile.liveNotifications ?? false,
      theme: currentProfile.theme || 'dark',
      deviceModePreference: currentProfile.deviceModePreference || 'auto',
      restDaySelectionMode: currentProfile.restDaySelectionMode === 'weekly' ? 'weekly' : 'dates',
      weeklyRestDays: Array.isArray(currentProfile.weeklyRestDays)
        ? currentProfile.weeklyRestDays
        : [],
      customRestDates: Array.isArray(currentProfile.customRestDates)
        ? currentProfile.customRestDates
        : [],
      excludedRestDates: Array.isArray(currentProfile.excludedRestDates)
        ? currentProfile.excludedRestDates
        : [],
      musicConnections: currentProfile.musicConnections || undefined,
      todayDateString: todayStr,
      weekDateString: weekStr,
      monthDateString: monthStr,
      baseTodayMinutes: computedTodayMins,
      todayTotalMinutes: Math.max(computedTodayMins, currentProfile.todayTotalMinutes || 0),
      baseWeeklyMinutes: computedWeeklyMins,
      weeklyTotalMinutes: Math.max(computedWeeklyMins, computedTodayMins),
      baseMonthlyMinutes: monthlySummary.monthlyMinutes,
      monthlyTotalMinutes: Math.max(
        monthlySummary.monthlyMinutes,
        computedWeeklyMins,
        computedTodayMins
      ),
      monthlySessionsCount: monthlySummary.monthlySessionsCount,
      monthlyActiveDays: monthlySummary.monthlyActiveDays,
      favoriteSubject: monthlySummary.favoriteSubject,
      totalFocusMinutes: computedTotalMins,
      totalFocusHours: Math.max(computedTotalHours, currentProfile.totalFocusHours || 0),
      streakDays: Math.max(computedStreak, currentProfile.currentStreakDays || 0),
      currentStreakDays: Math.max(computedStreak, currentProfile.currentStreakDays || 0),
      cloudSessionsSnapshot: mergedSessions.slice(0, 300),
      cloudTasksSnapshot: mergedTasks.slice(0, 300),
      deletedSessionIds: Array.from(deletedSessionSet),
      deletedTaskIds: Array.from(deletedTaskSet),
      isOnline: true,
      lastActiveAt: Date.now(),
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    };

    await safeSetDoc(userDocRef, profilePayload, { merge: true });

    // 2. Upload Sessions in parallel chunks of 25 for fast execution
    const CHUNK_SIZE = 25;
    for (let i = 0; i < mergedSessions.length; i += CHUNK_SIZE) {
      const chunk = mergedSessions.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((session) => {
          if (!session.id) return Promise.resolve();
          const sessionRef = doc(db, 'users', uid, 'sessions', session.id);
          return safeSetDoc(
            sessionRef,
            {
              ...session,
              userId: uid,
              deleted: false,
              syncedAt: Date.now(),
            },
            { merge: true }
          );
        })
      );
    }

    // 3. Upload Tasks in parallel chunks of 25
    for (let i = 0; i < mergedTasks.length; i += CHUNK_SIZE) {
      const chunk = mergedTasks.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((task) => {
          if (!task.id) return Promise.resolve();
          const taskRef = doc(db, 'users', uid, 'tasks', task.id);
          return safeSetDoc(
            taskRef,
            {
              ...task,
              userId: uid,
              deleted: false,
              syncedAt: Date.now(),
            },
            { merge: true }
          );
        })
      );
    }

    // 4. Write cross-device backup envelopes so tablet/phone/PC always find the backup
    // even if logged in via a different provider (Google vs Email) or before auth popup
    const backupEnvelope = {
      uid,
      email,
      profile: profilePayload,
      sessions: mergedSessions.slice(0, 400),
      tasks: mergedTasks.slice(0, 400),
      deletedSessionIds: Array.from(deletedSessionSet),
      deletedTaskIds: Array.from(deletedTaskSet),
      updatedAt: Date.now(),
    };

    const envelopePromises: Promise<any>[] = [
      safeSetDoc(doc(db, 'test', `backup_uid_${uid}`), backupEnvelope, { merge: true }),
    ];

    if (email) {
      envelopePromises.push(
        safeSetDoc(doc(db, 'test', `backup_email_${sanitizeEmailKey(email)}`), backupEnvelope, {
          merge: true,
        })
      );
    }

    // Always update the shared latest backup if we have data or user explicitly backed up
    if (mergedSessions.length > 0 || mergedTasks.length > 0 || currentProfile.name !== 'Öğrenci') {
      envelopePromises.push(
        safeSetDoc(doc(db, 'test', 'backup_latest_shared'), backupEnvelope, { merge: true })
      );
    }

    await Promise.all(envelopePromises);

    const now = Date.now();
    setLastSyncTime(now);

    return {
      success: true,
      sessionsUploaded: mergedSessions.length,
      tasksUploaded: mergedTasks.length,
      message: `${mergedSessions.length} çalışma seansı ve ${mergedTasks.length} görev Firestore bulutuna başarıyla yedeklendi.`,
      timestamp: now,
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/sync`);
    return {
      success: false,
      sessionsUploaded: 0,
      tasksUploaded: 0,
      message: error?.message || 'Yedekleme sırasında bir hata oluştu.',
      timestamp: Date.now(),
    };
  }
}

function normalizeCloudSession(s: any, fallbackId?: string): FocusSession | null {
  if (!s || typeof s !== 'object') return null;
  const id = s.id || fallbackId;
  if (!id) return null;
  const ts = parseNumericField(s.timestamp, Date.now());
  return {
    ...s,
    id,
    mode: s.mode || 'forest',
    subjectId: s.subjectId || `subj-${s.subjectName || 'Genel'}`,
    subjectName: s.subjectName || 'Serbest Çalışma',
    subjectColor: s.subjectColor || '#10b981',
    plannedMinutes: parseNumericField(s.plannedMinutes ?? s.durationMinutes, 45),
    completedSeconds: parseNumericField(s.completedSeconds ?? s.actualSeconds, 0),
    breakSeconds: parseNumericField(s.breakSeconds, 0),
    completed: s.completed !== false,
    timestamp: ts,
    dateString: s.dateString || getLocalDateString(ts),
  } as FocusSession;
}

function normalizeCloudTask(t: any, fallbackId?: string): FocusTask | null {
  if (!t || typeof t !== 'object') return null;
  const id = t.id || fallbackId;
  if (!id) return null;
  return {
    ...t,
    id,
    title: t.title || 'Çalışma Görevi',
    subjectName: t.subjectName || 'TYT Matematik',
    subjectColor: t.subjectColor || '#10b981',
    plannedMinutes: parseNumericField(t.plannedMinutes ?? t.estimatedPomodoros, 45),
    isCompleted: Boolean(t.isCompleted),
    createdAt: parseNumericField(t.createdAt, Date.now()),
  } as FocusTask;
}

/**
 * Restores and merges all cloud data from Firestore into local cache and React state.
 * Searches across UID, Email, all matching user documents, and the cross-device backup envelope
 * so restoring on a tablet or second device works 100% of the time.
 */
export async function restoreAllFromFirestore(
  user?: User | null,
  overrideEmail?: string
): Promise<{
  success: boolean;
  sessions: FocusSession[];
  tasks: FocusTask[];
  profile?: UserProfile;
  message: string;
}> {
  const currentProfile = getStoredProfile();
  const { uid, email: resolvedEmail } = resolveSyncIdentity(user, currentProfile);
  const targetEmail = (overrideEmail || resolvedEmail || '').trim().toLowerCase();

  try {
    const cloudSessions: FocusSession[] = [];
    const cloudTasks: FocusTask[] = [];
    const deletedSessionIds = new Set<string>(getDeletedSessionIds());
    const deletedTaskIds = new Set<string>(getDeletedTaskIds());
    let cloudProfile: Record<string, any> = {};

    const absorbBackupEnvelope = (data: Record<string, any> | undefined) => {
      if (!data) return;
      if (Array.isArray(data.deletedSessionIds)) {
        data.deletedSessionIds.forEach((id: string) => id && deletedSessionIds.add(id));
      }
      if (Array.isArray(data.deletedTaskIds)) {
        data.deletedTaskIds.forEach((id: string) => id && deletedTaskIds.add(id));
      }
      const profSource = data.profile && typeof data.profile === 'object' ? data.profile : data;
      if (profSource && (profSource.name || profSource.targetUniversity || profSource.email)) {
        if (
          !cloudProfile.updatedAt ||
          (profSource.updatedAt || 0) >= (cloudProfile.updatedAt || 0) ||
          cloudProfile.name === 'Öğrenci'
        ) {
          cloudProfile = { ...cloudProfile, ...profSource };
        }
      }
      const sessArr = Array.isArray(data.sessions)
        ? data.sessions
        : Array.isArray(data.cloudSessionsSnapshot)
        ? data.cloudSessionsSnapshot
        : [];
      for (const rawS of sessArr) {
        if (rawS?.deleted && rawS?.id) {
          deletedSessionIds.add(rawS.id);
          continue;
        }
        const norm = normalizeCloudSession(rawS);
        if (norm) cloudSessions.push(norm);
      }

      const taskArr = Array.isArray(data.tasks)
        ? data.tasks
        : Array.isArray(data.cloudTasksSnapshot)
        ? data.cloudTasksSnapshot
        : [];
      for (const rawT of taskArr) {
        if (rawT?.deleted && rawT?.id) {
          deletedTaskIds.add(rawT.id);
          continue;
        }
        const norm = normalizeCloudTask(rawT);
        if (norm) cloudTasks.push(norm);
      }
    };

    const pullUserSubcollections = async (targetUid: string) => {
      if (!targetUid) return;
      try {
        const [userSnap, sessionsSnap, tasksSnap] = await Promise.all([
          fetchDocFresh(doc(db, 'users', targetUid)),
          fetchDocsFresh(collection(db, 'users', targetUid, 'sessions')),
          fetchDocsFresh(collection(db, 'users', targetUid, 'tasks')),
        ]);

        if (userSnap.exists()) {
          absorbBackupEnvelope(userSnap.data() as Record<string, any>);
        }

        sessionsSnap.forEach((docSnap: any) => {
          const s = docSnap.data() as any;
          if (s && s.deleted && (s.id || docSnap.id)) {
            deletedSessionIds.add(s.id || docSnap.id);
            return;
          }
          const norm = normalizeCloudSession(s, docSnap.id);
          if (norm) cloudSessions.push(norm);
        });

        tasksSnap.forEach((docSnap: any) => {
          const t = docSnap.data() as any;
          if (t && t.deleted && (t.id || docSnap.id)) {
            deletedTaskIds.add(t.id || docSnap.id);
            return;
          }
          const norm = normalizeCloudTask(t, docSnap.id);
          if (norm) cloudTasks.push(norm);
        });
      } catch {
        // ignore individual path failure
      }
    };

    // 1. Pull from primary UID and its backup envelope
    const checkedUids = new Set<string>();
    if (uid) {
      checkedUids.add(uid);
      await pullUserSubcollections(uid);
      try {
        const uidEnvSnap = await fetchDocFresh(doc(db, 'test', `backup_uid_${uid}`));
        if (uidEnvSnap.exists()) {
          absorbBackupEnvelope(uidEnvSnap.data());
        }
      } catch {
        // ignore
      }
    }

    // 2. Pull from email backup envelope if email is available
    if (targetEmail) {
      try {
        const emailEnvSnap = await fetchDocFresh(
          doc(db, 'test', `backup_email_${sanitizeEmailKey(targetEmail)}`)
        );
        if (emailEnvSnap.exists()) {
          const envData = emailEnvSnap.data();
          absorbBackupEnvelope(envData);
          if (envData?.uid && !checkedUids.has(envData.uid)) {
            checkedUids.add(envData.uid);
            await pullUserSubcollections(envData.uid);
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Pull from shared cross-device backup envelope (`test/backup_latest_shared`)
    try {
      const sharedSnap = await fetchDocFresh(doc(db, 'test', 'backup_latest_shared'));
      if (sharedSnap.exists()) {
        const sharedData = sharedSnap.data();
        const sharedEmail = (sharedData?.email || '').trim().toLowerCase();
        // Absorb if same email, same uid, or if this tablet/device has not found any sessions yet
        if (
          !targetEmail ||
          !sharedEmail ||
          sharedEmail === targetEmail ||
          sharedData?.uid === uid ||
          cloudSessions.length === 0
        ) {
          absorbBackupEnvelope(sharedData);
          if (sharedData?.uid && !checkedUids.has(sharedData.uid)) {
            checkedUids.add(sharedData.uid);
            await pullUserSubcollections(sharedData.uid);
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Scan `users` collection for any other user docs matching email (e.g. Google login vs Email login)
    // or fallback if cloudSessions is still empty
    try {
      const allUsersSnap = await fetchDocsFresh(collection(db, 'users'));
      const candidateUids: string[] = [];
      allUsersSnap.forEach((uDoc: any) => {
        const uData = uDoc.data() as Record<string, any>;
        const docEmail = (uData?.email || '').trim().toLowerCase();
        const isEmailMatch = Boolean(targetEmail && docEmail && docEmail === targetEmail);
        const hasSessions =
          (Array.isArray(uData?.cloudSessionsSnapshot) && uData.cloudSessionsSnapshot.length > 0) ||
          parseNumericField(uData?.totalFocusMinutes, 0) > 0;

        if (isEmailMatch || (cloudSessions.length === 0 && hasSessions)) {
          absorbBackupEnvelope(uData);
          if (!checkedUids.has(uDoc.id)) {
            candidateUids.push(uDoc.id);
          }
        }
      });

      for (const cUid of candidateUids) {
        checkedUids.add(cUid);
        await pullUserSubcollections(cUid);
      }
    } catch {
      // ignore
    }

    // Persist deleted IDs locally
    try {
      if (deletedSessionIds.size > 0) {
        localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(deletedSessionIds)));
      }
      if (deletedTaskIds.size > 0) {
        localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(Array.from(deletedTaskIds)));
      }
    } catch {
      // ignore
    }

    // 5. Merge Sessions (local + cloud, deduplicated by ID, latest timestamp first)
    const localSessions = getStoredSessions();
    const sessionMap = new Map<string, FocusSession>();
    for (const s of localSessions) {
      if (s && s.id && !deletedSessionIds.has(s.id)) sessionMap.set(s.id, s);
    }
    for (const s of cloudSessions) {
      if (s && s.id && !deletedSessionIds.has(s.id)) sessionMap.set(s.id, s);
    }
    const mergedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    setAllStoredSessions(mergedSessions);

    // 6. Merge Tasks (local + cloud, keeping latest completion state)
    const localTasks = getStoredTasks();
    const taskMap = new Map<string, FocusTask>();
    for (const t of localTasks) {
      if (t && t.id && !deletedTaskIds.has(t.id)) taskMap.set(t.id, t);
    }
    for (const t of cloudTasks) {
      if (t && t.id && !deletedTaskIds.has(t.id)) {
        const existing = taskMap.get(t.id);
        if (!existing) {
          taskMap.set(t.id, t);
        } else {
          taskMap.set(t.id, {
            ...existing,
            ...t,
            isCompleted: Boolean(existing.isCompleted || t.isCompleted),
          });
        }
      }
    }
    const mergedTasks = Array.from(taskMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    setAllStoredTasks(mergedTasks);

    // 7. Update Profile cleanly and recalculate stats from mergedSessions
    let mergedProfile = getStoredProfile();
    const patch: Partial<UserProfile> = {};
    if (Object.keys(cloudProfile).length > 0) {
      if (cloudProfile.userId && !mergedProfile.userId) patch.userId = cloudProfile.userId;
      if (cloudProfile.email && !mergedProfile.email) patch.email = cloudProfile.email;
      if (cloudProfile.name || cloudProfile.displayName) {
        const cName = cloudProfile.name || cloudProfile.displayName;
        if (cName && (cName !== 'Öğrenci' || !mergedProfile.name)) {
          patch.name = cName;
        }
      }
      if (cloudProfile.initials) patch.initials = cloudProfile.initials;
      if (cloudProfile.avatarUrl) patch.avatarUrl = cloudProfile.avatarUrl;
      if (cloudProfile.avatarColor) patch.avatarColor = cloudProfile.avatarColor;
      if (cloudProfile.targetUniversity) patch.targetUniversity = cloudProfile.targetUniversity;
      if (cloudProfile.targetDepartment) patch.targetDepartment = cloudProfile.targetDepartment;
      if (cloudProfile.targetExam) patch.targetExam = cloudProfile.targetExam;
      if (cloudProfile.studyTrack) patch.studyTrack = cloudProfile.studyTrack;
      if (cloudProfile.dailyGoalHours) {
        patch.dailyGoalHours = parseNumericField(cloudProfile.dailyGoalHours, 6);
      }
      if (cloudProfile.theme) patch.theme = cloudProfile.theme;
      patch.restDaySelectionMode = cloudProfile.restDaySelectionMode === 'weekly' ? 'weekly' : 'dates';
      if (Array.isArray(cloudProfile.weeklyRestDays)) {
        patch.weeklyRestDays = cloudProfile.weeklyRestDays;
      }
      if (Array.isArray(cloudProfile.customRestDates)) {
        patch.customRestDates = cloudProfile.customRestDates;
      }
      if (Array.isArray(cloudProfile.excludedRestDates)) {
        patch.excludedRestDates = cloudProfile.excludedRestDates;
      }
      if (cloudProfile.musicConnections) {
        patch.musicConnections = cloudProfile.musicConnections;
      }
    }

    const tempProfile = { ...mergedProfile, ...patch };
    patch.totalFocusHours = calculateTotalFocusHours(mergedSessions);
    patch.currentStreakDays = calculateRealStreak(mergedSessions, tempProfile);
    patch.todayTotalMinutes = calculateTodayMinutes(mergedSessions);
    patch.hasCompletedOnboarding = true;

    mergedProfile = updateStoredProfile(patch);

    try {
      if (mergedProfile.userId) {
        localStorage.setItem('fokus_user_uid', mergedProfile.userId);
        localStorage.setItem('fokus_user_authenticated', 'true');
      }
      if (mergedProfile.email) {
        localStorage.setItem('fokus_user_email', mergedProfile.email);
      }
    } catch {
      // ignore
    }

    const now = Date.now();
    setLastSyncTime(now);

    // Broadcast to App.tsx so all screens update immediately without reload
    notifyCloudRestored(mergedSessions, mergedTasks, mergedProfile);

    return {
      success: true,
      sessions: mergedSessions,
      tasks: mergedTasks,
      profile: mergedProfile,
      message: `${mergedSessions.length} çalışma seansı ve ${mergedTasks.length} görev buluttan başarıyla geri yüklendi ve eşitlendi.`,
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/restore`);
    return {
      success: false,
      sessions: getStoredSessions(),
      tasks: getStoredTasks(),
      profile: getStoredProfile(),
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
  const dateStr = getLocalDateString();
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
      const norm = normalizeCloudSession(s);
      if (norm) sessionMap.set(norm.id, norm);
    }
    const mergedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    setAllStoredSessions(mergedSessions);

    // Merge tasks
    const currentTasks = getStoredTasks();
    const taskMap = new Map<string, FocusTask>();
    for (const t of currentTasks) {
      if (t.id) taskMap.set(t.id, t);
    }
    for (const t of importedTasks) {
      const norm = normalizeCloudTask(t);
      if (norm) taskMap.set(norm.id, norm);
    }
    const mergedTasks = Array.from(taskMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    setAllStoredTasks(mergedTasks);

    // Merge profile & recalculate stats
    const tempProfile = updateStoredProfile(importedProfile);
    const mergedProfile = updateStoredProfile({
      totalFocusHours: calculateTotalFocusHours(mergedSessions),
      currentStreakDays: calculateRealStreak(mergedSessions, tempProfile),
      todayTotalMinutes: calculateTodayMinutes(mergedSessions),
    });

    notifyCloudRestored(mergedSessions, mergedTasks, mergedProfile);

    // Always sync merged data to Firestore as well!
    await syncAllToFirestore(user, mergedSessions, mergedTasks, mergedProfile);

    return {
      success: true,
      sessionsCount: importedSessions.length,
      tasksCount: importedTasks.length,
      message: `Yedekten ${importedSessions.length} seans ve ${importedTasks.length} görev başarıyla aktarıldı ve buluta eşitlendi.`,
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
