import { db, auth, safeSetDoc, handleFirestoreError, OperationType, parseNumericField } from '../firebase';
import { doc, getDoc, getDocFromServer, collection, getDocs, getDocsFromServer } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { mergeSyncedRecords, collectDeletedIds, recordNeedsUpload, canonicalStatsFromSessions } from './syncIntegrity';
import { accountCacheIsBound } from './accountCache';
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

/** Remove third-party access/refresh tokens and client secrets from every
 * user backup and direct profile upload. Only non-sensitive preferences sync. */
export function safeMusicPreferences(raw: UserProfile['musicConnections']): UserProfile['musicConnections'] {
  if (!raw) return undefined;
  const platform = (id: 'spotify' | 'youtube_music' | 'apple_music') => ({
    connected: false,
    accountName: '',
    customPlaylistUrl: String(raw[id]?.customPlaylistUrl || ''),
    customTrackTitle: String(raw[id]?.customTrackTitle || ''),
    customArtistName: String(raw[id]?.customArtistName || ''),
  });
  return {
    activePlatform: raw.activePlatform || 'spotify',
    spotify: platform('spotify'),
    youtube_music: platform('youtube_music'),
    apple_music: platform('apple_music'),
  };
}

/** Cloud identity is NEVER inferred from localStorage, email, or a
 * previously signed-in Firebase account. Only the current Auth principal can
 * authorize a Firestore path. Guest sessions remain offline until sign-in. */
export function resolveSyncIdentity(user?: User | null, _profile?: UserProfile): {
  uid: string;
  email: string;
} {
  const current = auth.currentUser;
  if (!current || (user?.uid && user.uid !== current.uid)) return { uid:'', email:'' };
  return { uid:current.uid, email:(current.email || '').trim().toLowerCase() };
}

async function fetchDocFresh(docRef: any) {
  return getDocFromServer(docRef);
}

async function fetchDocsFresh(colRef: any) {
  return getDocsFromServer(colRef);
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
const syncFlights = new Map<string, Promise<SyncResult>>();

/** Full reconciliation is serialized per Firebase account. It ALWAYS reads
 * server documents first; an offline/stale client must not overwrite another
 * device's newer records. Failed writes keep local data and retry later. */
export async function syncAllToFirestore(
  user: User | null,
  sessions?: FocusSession[],
  tasks?: FocusTask[],
  profile?: UserProfile,
  _options?: { allowEmptyOverwrite?: boolean },
): Promise<SyncResult> {
  const activeUser = auth.currentUser || user;
  const uid = activeUser?.uid || '';
  const failed = (message: string): SyncResult => ({
    success: false, sessionsUploaded: 0, tasksUploaded: 0, message, timestamp: Date.now(),
  });
  if (!uid || (user?.uid && user.uid !== uid))
    return failed('Bulut eşitlemesi için doğru Google/Firebase hesabıyla giriş yapmalısın.');
  if (!accountCacheIsBound(uid))
    return failed('Hesap önbelleği doğrulanamadı. Yanlış hesaba veri yazmamak için eşitleme durduruldu.');
  if (typeof localStorage !== 'undefined' && localStorage.getItem('fokus_deleting_account_uid') === uid)
    return failed('Hesap silme işlemi sürerken otomatik bulut kaydı kapalı.');
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return failed('İnternet bağlantısı yok. Kayıtların cihazında korundu, çevrimiçi olunca tekrar denenecek.');

  // Serializing ALL reconciliation calls prevents old uploads finishing after
  // newer writes (e.g. when user completes a session and immediately deletes one).
  const previous = syncFlights.get(uid);
  const run = async (): Promise<SyncResult> => {
    if (auth.currentUser?.uid !== uid)
      return failed('Hesap değiştiği için eski eşitleme güvenli biçimde iptal edildi.');
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fokus_deleting_account_uid') === uid)
      return failed('Hesap siliniyor; buluta kayıt yapılmadı.');
    try {
      const currentProfile = profile || getStoredProfile();
      const sessionsRef = collection(db, 'users', uid, 'sessions');
      const tasksRef = collection(db, 'users', uid, 'tasks');
      const userRef = doc(db, 'users', uid);

      const [sessionSnap, taskSnap, legacyBackupSnap] = await Promise.all([
        getDocsFromServer(sessionsRef),
        getDocsFromServer(tasksRef),
        getDocFromServer(doc(db, 'users', uid, 'backups', 'latest')),
      ]);
      if (auth.currentUser?.uid !== uid || !accountCacheIsBound(uid))
        return failed('Hesap değişti; başka bir hesabın kayıtlarına dokunulmadı.');

      const cloudSessions = sessionSnap.docs.map(d => ({...d.data(), id:d.id}) as FocusSession & {deleted?:boolean;updatedAt?:number});
      const cloudTasks = taskSnap.docs.map(d => ({...d.data(), id:d.id}) as FocusTask & {deleted?:boolean;updatedAt?:number});
      const legacy = legacyBackupSnap.exists() ? legacyBackupSnap.data() : {};
      const legacySessionDeletes = Array.isArray(legacy.deletedSessionIds) ? legacy.deletedSessionIds.filter((v:unknown)=>typeof v==='string') : [];
      const legacyTaskDeletes = Array.isArray(legacy.deletedTaskIds) ? legacy.deletedTaskIds.filter((v:unknown)=>typeof v==='string') : [];
      const deletedSessions = collectDeletedIds(cloudSessions, new Set([...getDeletedSessionIds(), ...legacySessionDeletes]));
      const deletedTasks = collectDeletedIds(cloudTasks, new Set([...getDeletedTaskIds(), ...legacyTaskDeletes]));

      const localSessions = [...getStoredSessions(), ...(sessions || [])].filter(item => item && item.id);
      const localTasks = [...getStoredTasks(), ...(tasks || [])].filter(item => item && item.id);
      const allSessions = mergeSyncedRecords(localSessions, cloudSessions, deletedSessions, 'session');
      const allTasks = mergeSyncedRecords(localTasks, cloudTasks, deletedTasks, 'task');

      // A user may intentionally have NO sessions. Empty input is safe because
      // we already fetched the complete authenticated cloud collection.
      const cloudSessionMap = new Map(cloudSessions.map(s => [s.id, s]));
      const cloudTaskMap = new Map(cloudTasks.map(t => [t.id, t]));
      const uploadSessions = allSessions.filter(s => recordNeedsUpload(s, cloudSessionMap.get(s.id)));
      const uploadTasks = allTasks.filter(t => recordNeedsUpload(t, cloudTaskMap.get(t.id)));
      const pendingDeletedSessions = [...deletedSessions].filter(id => !cloudSessionMap.get(id)?.deleted);
      const pendingDeletedTasks = [...deletedTasks].filter(id => !cloudTaskMap.get(id)?.deleted);

      const CHUNK = 20;
      const saveInChunks = async <T>(items: T[], write: (item:T)=>Promise<unknown>) => {
        for(let i=0;i<items.length;i+=CHUNK) await Promise.all(items.slice(i,i+CHUNK).map(write));
      };
      await saveInChunks(uploadSessions, session => safeSetDoc(
        doc(db,'users',uid,'sessions',session.id),
        {...session,userId:uid,deleted:false,syncedAt:Date.now()},{merge:true}
      ));
      await saveInChunks(uploadTasks, task => safeSetDoc(
        doc(db,'users',uid,'tasks',task.id),
        {...task,userId:uid,deleted:false,syncedAt:Date.now()},{merge:true}
      ));
      // Physical delete is unsafe: the offline tablet would reintroduce it.
      // Keep small durable tombstones; restores/readers filter deleted:true.
      await saveInChunks(pendingDeletedSessions, id => safeSetDoc(
        doc(db,'users',uid,'sessions',id),
        {id,userId:uid,deleted:true,updatedAt:Date.now()},{merge:true}
      ));
      await saveInChunks(pendingDeletedTasks, id => safeSetDoc(
        doc(db,'users',uid,'tasks',id),
        {id,userId:uid,deleted:true,updatedAt:Date.now()},{merge:true}
      ));

      const stats = canonicalStatsFromSessions(allSessions);
      const todayStr = getLocalDateString(new Date());
      const weekStr = getCurrentWeekKey(new Date());
      const monthStr = getCurrentMonthKey(new Date());
      const computedToday = calculateTodayMinutes(allSessions);
      const computedWeekly = calculateWeeklyMinutes(allSessions);
      const monthly = calculateMonthlyStatsSummary(allSessions);
      const streak = calculateRealStreak(allSessions, currentProfile);
      const now = Date.now();

      // Background sync may update statistics only; it must NEVER overwrite
      // another device's newly edited profile/preferences with stale copies.
      const statsPatch = {
        userId:uid, lastSyncAt:now, updatedStatsAt:now,
        todayDateString:todayStr, weekDateString:weekStr, monthDateString:monthStr,
        todayTotalMinutes:computedToday, weeklyTotalMinutes:computedWeekly,
        monthlyTotalMinutes:monthly.monthlyMinutes,
        monthlySessionsCount:monthly.monthlySessionsCount,
        monthlyActiveDays:monthly.monthlyActiveDays,
        favoriteSubject:monthly.favoriteSubject,
        totalFocusMinutes:stats.totalMinutes, totalFocusHours:stats.totalHours,
        currentStreakDays:streak, streakDays:streak,
      };
      await safeSetDoc(userRef,statsPatch,{merge:true});
      // Complete records already live in sessions/tasks collections. Avoid
      // 400-item truncation and Firestore's 1 MiB document ceiling.
      // Write NEW metadata only; preserve the old 'latest' backup untouched.
      await safeSetDoc(doc(db,'users',uid,'backups','latest_v2'),{
        uid,version:2,kind:'indexed-subcollections',sessionCount:allSessions.length,
        taskCount:allTasks.length,sessionSeconds:stats.seconds,
        deletedSessionsCount:deletedSessions.size,deletedTasksCount:deletedTasks.size,
        completedAt:now,
      },{merge:true});

      // Local UI follows successful SERVER reconciliation. Never broadcast
      // an incomplete/failed sync as a finished backup.
      const oldSessions = getStoredSessions();
      const oldTasks = getStoredTasks();
      const dataChanged = JSON.stringify(oldSessions)!==JSON.stringify(allSessions)
        || JSON.stringify(oldTasks)!==JSON.stringify(allTasks);
      if(dataChanged){
        setAllStoredSessions(allSessions);
        setAllStoredTasks(allTasks);
      }
      const updatedLocal = updateStoredProfile({
        userId:uid, totalFocusHours:stats.totalHours,
        currentStreakDays:streak, todayTotalMinutes:computedToday,
      });
      // Profile preferences remain whatever was modified locally. The
      // latest cloud preference values are restored separately on login.
      if(dataChanged) notifyCloudRestored(allSessions,allTasks,updatedLocal);
      setLastSyncTime(now);
      return {success:true,sessionsUploaded:uploadSessions.length,
        tasksUploaded:uploadTasks.length,
        message:`${allSessions.length} seans ve ${allTasks.length} görev Firebase sunucusunda doğrulandı (yeni yükleme: ${uploadSessions.length} / ${uploadTasks.length}).`,
        timestamp:now};
    } catch(error:any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/sync`);
      return failed(error?.message || 'Bulut senkronizasyonu tamamlanamadı. Yerel veriler korundu.');
    }
  };
  const operation = previous ? previous.catch(()=>undefined).then(run) : run();
  syncFlights.set(uid, operation);
  try { return await operation; }
  finally { if(syncFlights.get(uid)===operation)syncFlights.delete(uid); }
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
  const activeUser = auth.currentUser || user;
  if (!activeUser?.uid || (user?.uid && user.uid !== activeUser.uid) ||
    !accountCacheIsBound(activeUser.uid)) {
    return { success: false, sessions: getStoredSessions(), tasks: getStoredTasks(),
      profile: getStoredProfile(), message: 'Buluttan geri yüklemek için giriş yapmalısınız.' };
  }
  const currentProfile = getStoredProfile();
  const { uid } = resolveSyncIdentity(activeUser, currentProfile);

  try {
    const cloudSessions: FocusSession[] = [];
    const cloudTasks: FocusTask[] = [];
    const primarySessions: FocusSession[] = [];
    const primaryTasks: FocusTask[] = [];
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
          if (norm) primarySessions.push(norm);
        });

        tasksSnap.forEach((docSnap: any) => {
          const t = docSnap.data() as any;
          if (t && t.deleted && (t.id || docSnap.id)) {
            deletedTaskIds.add(t.id || docSnap.id);
            return;
          }
          const norm = normalizeCloudTask(t, docSnap.id);
          if (norm) primaryTasks.push(norm);
        });
      } catch (error) {
        // Incomplete remote history must never be presented as a successful restore.
        throw error;
      }
    };

    // Restore only this authenticated user's profile, history and private backup.
    await pullUserSubcollections(uid);
    try {
      const privateSnap = await fetchDocFresh(doc(db, 'users', uid, 'backups', 'latest'));
      if (privateSnap.exists()) absorbBackupEnvelope(privateSnap.data() as Record<string, any>);
    } catch {
      // An offline cache may still be available; keep local records.
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

    // Merge authoritative per-record documents after legacy snapshots:
    // on equal timestamps a complete primary document wins.
    const allCloudSessions = [...cloudSessions, ...primarySessions];
    const allCloudTasks = [...cloudTasks, ...primaryTasks];
    // Cloud restore can be requested on an offline device. All mandatory
    // collection reads succeeded server-side before touching local caches.
    const mergedSessions = mergeSyncedRecords(getStoredSessions(), allCloudSessions, deletedSessionIds, 'session');
    const mergedTasks = mergeSyncedRecords(getStoredTasks(), allCloudTasks, deletedTaskIds, 'task');

    setAllStoredSessions(mergedSessions);
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
      if (['clock', 'exam', 'forest', 'climb', 'flight', 'dive'].includes(cloudProfile.preferredFocusMode)) {
        patch.preferredFocusMode = cloudProfile.preferredFocusMode;
      }
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
        patch.musicConnections = safeMusicPreferences(cloudProfile.musicConnections);
      }
    }

    const tempProfile = { ...mergedProfile, ...patch };
    patch.totalFocusHours = calculateTotalFocusHours(mergedSessions);
    patch.currentStreakDays = calculateRealStreak(mergedSessions, tempProfile);
    patch.todayTotalMinutes = calculateTodayMinutes(mergedSessions);
    patch.hasCompletedOnboarding = true;

    patch.userId = uid;
    patch.email = activeUser.email || patch.email || mergedProfile.email;
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
    profile: { ...profile, musicConnections: safeMusicPreferences(profile.musicConnections) },
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
    const activeUser = auth.currentUser || user;
    if (!activeUser?.uid || (user?.uid && activeUser.uid !== user.uid) ||
        !accountCacheIsBound(activeUser.uid)) {
      throw new Error('Yedeği aktarmak için doğru Firebase hesabıyla giriş yapmalısın.');
    }
    if (jsonString.length > 24 * 1024 * 1024)
      throw new Error('Yedek JSON dosyası 24 MB sınırını aşıyor. İçeriği önce kontrol et.');
    const parsed = JSON.parse(jsonString);
    if (!parsed || (!parsed.sessions && !parsed.tasks && !parsed.profile)) {
      throw new Error('Geçersiz yedek dosyası formatı.');
    }

    const safeArray = (input: unknown, label: string): any[] => {
      if (input === undefined) return [];
      if (!Array.isArray(input) || input.length > 15000)
        throw new Error(`${label} verisi geçersiz veya aşırı büyük.`);
      for (const row of input) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' ||
          !row.id.trim() || row.id.length > 500 || row.id.includes('/'))
          throw new Error(`${label} içinde hatalı kayıt kimliği var; hiçbir değişiklik yapılmadı.`);
      }
      return input;
    };
    safeArray(parsed.sessions, 'Seans');
    safeArray(parsed.tasks, 'Görev');

    // Keep original record IDs, dates and durations, but associate the new
    // Firebase account and never re-import credentials from a legacy JSON.
    const importedSessions: FocusSession[] = Array.isArray(parsed.sessions)
      ? parsed.sessions.map((item: FocusSession) => ({ ...item, userId: activeUser.uid }))
      : [];
    const importedTasks: FocusTask[] = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((item: FocusTask) => ({ ...item, userId: activeUser.uid }))
      : [];
    const rawProfile = parsed.profile && typeof parsed.profile === 'object' && !Array.isArray(parsed.profile)
      ? parsed.profile as Record<string, any> : {};
    const importedProfile: Partial<UserProfile> = {
      userId: activeUser.uid,
      email: activeUser.email || '',
      musicConnections: safeMusicPreferences(rawProfile.musicConnections),
    };
    // Strict whitelist; unexpected fields, old UID, passwords, tokens and
    // backend-only metadata can never be imported to the new profile.
    for (const key of ['name','initials','avatarColor','avatarUrl',
      'targetUniversity','targetDepartment','targetExam','studyTrack','theme'] as const) {
      if (typeof rawProfile[key] === 'string') (importedProfile as any)[key] = rawProfile[key];
    }
    if (Number.isFinite(Number(rawProfile.dailyGoalHours)))
      importedProfile.dailyGoalHours = Math.max(1, Math.min(24, Number(rawProfile.dailyGoalHours)));
    for (const key of ['soundNotifications','breakReminders','desktopNotifications',
      'liveNotifications','hasCompletedOnboarding'] as const) {
      if (typeof rawProfile[key] === 'boolean') (importedProfile as any)[key] = rawProfile[key];
    }
    if (['auto','mobile','tablet','desktop'].includes(rawProfile.deviceModePreference))
      importedProfile.deviceModePreference = rawProfile.deviceModePreference;
    if (['clock','exam','forest','climb','flight','dive'].includes(rawProfile.preferredFocusMode))
      importedProfile.preferredFocusMode = rawProfile.preferredFocusMode;
    if (rawProfile.restDaySelectionMode === 'dates' || rawProfile.restDaySelectionMode === 'weekly')
      importedProfile.restDaySelectionMode = rawProfile.restDaySelectionMode;
    for (const key of ['weeklyRestDays','customRestDates','excludedRestDates'] as const) {
      if (Array.isArray(rawProfile[key]) && rawProfile[key].length <= 366)
        (importedProfile as any)[key] = rawProfile[key];
    }

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
    const result = await syncAllToFirestore(activeUser, mergedSessions, mergedTasks, mergedProfile);
    if (!result.success) throw new Error(result.message || 'Bulut eşitlemesi başarısız oldu.');

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
