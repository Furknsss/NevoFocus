import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import {
  FocusModeType,
  FocusSession,
  FocusTask,
  SubjectItem,
  UserProfile,
  StudentPeer,
  FlightAirport,
  CheerNotification,
  SERBEST_CALISMA_SUBJECT,
} from './types';
import {
  getStoredSessions,
  saveSession,
  getStoredProfile,
  updateStoredProfile,
  getStoredTasks,
  saveTask,
  toggleTaskDone,
  deleteTask,
  setAllStoredSessions,
  setAllStoredTasks,
} from './utils/storage';
import {
  calculateRealStreak,
  calculateTotalFocusHours,
  calculateTodayMinutes,
  calculateWeeklyMinutes,
  calculateMonthlyStatsSummary,
  getLocalDateString,
  getCurrentWeekKey,
  getCurrentMonthKey,
} from './utils/stats';
import { getDefaultSubjectsForTrack } from './utils/subjects';
import { ALL_AIRPORTS, TURKEY_AIRPORTS, WORLD_AIRPORTS } from './utils/airports';
import { soundEngine } from './utils/audio';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  safeSetDoc,
  parseNumericField,
} from './firebase';
import {
  syncAllToFirestore,
  restoreAllFromFirestore,
  markSessionDeletedId,
  markTaskDeletedId,
  getDeletedSessionIds,
  getDeletedTaskIds,
  resolveSyncIdentity,
} from './services/syncService';
import { spotifyService } from './services/spotifyService';
import { onAuthStateChanged, type User, signOut } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';

import { Header } from './components/Header';
import { DedicatedModeScreen } from './components/DedicatedModeScreen';
import { ActiveFocusSession } from './components/ActiveFocusSession';
import { TasksView } from './components/TasksView';
import { StatisticsView } from './components/StatisticsView';
import { StudentsView } from './components/StudentsView';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { MarketModal } from './components/MarketModal';
import { AchievementsModal } from './components/AchievementsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { useDeviceMode } from './hooks/useDeviceMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { BottomNav } from './components/BottomNav';
import { FloatingMiniFocusPill, ActiveFocusData } from './components/FloatingMiniFocusPill';
import {
  getDeviceId,
  getDeviceName,
  backgroundFocus,
  markSessionTerminated,
  isSessionTerminated,
} from './utils/backgroundFocus';
import { Flame, X, Download } from 'lucide-react';
import { isNativeFocusAvailable, nativeFocus } from './services/nativeFocus';
import { isAndroidNativeAuth, signOutNativeGoogle } from './services/nativeGoogleAuth';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'focus' | 'tasks' | 'stats' | 'rooms' | 'students'>('focus');

  // Dedicated Mode Architecture
  const [currentActiveMode, setCurrentActiveMode] = useState<FocusModeType>(() => getStoredProfile().preferredFocusMode || 'clock');

  // Firebase auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  // Cloud active focus sync across devices (e.g. tablet <-> phone)
  const [cloudActiveSession, setCloudActiveSession] = useState<ActiveFocusData | null>(null);
  const [localMinimizedSession, setLocalMinimizedSession] = useState<ActiveFocusData | null>(null);

  // Tablet & Phone authentication persistence: never flash or dump user to landing screen
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    // Native WebView must wait for Firebase Auth initialization, not trust stale
    // localStorage user IDs left by a previous account or an interrupted login.
    if (isAndroidNativeAuth) return true;
    if (typeof window !== 'undefined') {
      const hadAuth = localStorage.getItem('fokus_user_authenticated') === 'true';
      const stored = getStoredProfile();
      return hadAuth || Boolean(stored.userId);
    }
    return false;
  });
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fokus_guest_mode') === 'true';
    }
    return false;
  });

  // Persistence data
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [peers, setPeers] = useState<StudentPeer[]>([]);

  // Adaptive Device Mode (Auto-detection + manual override in settings)
  const {
    deviceMode,
    detectedDevice,
    activeDevice,
    setDeviceMode,
    isMobile,
    isTablet,
    isDesktop,
  } = useDeviceMode(profile.deviceModePreference || 'auto');

  // Live Toast for Incoming Alev / Cheer Notifications & Cloud Auto-Backup
  const [incomingCheer, setIncomingCheer] = useState<CheerNotification | null>(null);
  const [cloudBackupToast, setCloudBackupToast] = useState<string | null>(null);

  // Branch-specific subjects automatically aligned to profile's study track
  const subjects = getDefaultSubjectsForTrack(profile.studyTrack || 'Sayısal');

  // Setup form state
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem>(subjects[0]);
  const [selectedTask, setSelectedTask] = useState<FocusTask | null>(null);

  // Flight Airports
  const [originAirport, setOriginAirport] = useState<FlightAirport>(TURKEY_AIRPORTS[0]);
  const [destAirport, setDestAirport] = useState<FlightAirport>(WORLD_AIRPORTS[2]); // Tokyo HND

  // Timer mode state (countdown vs stopwatch)
  const [timerType, setTimerType] = useState<'countdown' | 'stopwatch'>('stopwatch');

  // Forest selected tree species
  const [selectedTreeSpecies, setSelectedTreeSpecies] = useState<string>('Meşe Ağacı');

  // Active focus session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // Modals state
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'modes' | 'breaks' | 'notifications' | 'connections' | 'theme' | 'security' | 'backup'>('modes');
  const [isMarketModalOpen, setIsMarketModalOpen] = useState<boolean>(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // PWA (Progressive Web App) Install Hook
  const { isInstallable, installApp, showWelcomeBanner, dismissBanner } = usePWAInstall();

  const [currentAmbientTrack, setCurrentAmbientTrack] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0.5);

  // Load initial local storage data
  useEffect(() => {
    // Check Spotify OAuth redirect code (?code=...) on app load
    spotifyService.checkRedirectCode();

    const loadedSessions = getStoredSessions();
    const loadedTasks = getStoredTasks();
    const loadedProfile = getStoredProfile();

    setSessions(loadedSessions);
    setTasks(loadedTasks);
    setProfile(loadedProfile);

    const initialSubjects = getDefaultSubjectsForTrack(loadedProfile.studyTrack || 'Sayısal');
    if (initialSubjects.length > 0) {
      setSelectedSubject(initialSubjects[0]);
    }

    // Aynı cihazda devam eden bir odak seansı varsa (kullanıcı uygulamadan çıkıp geri girdiyse)
    // direkt aynı focus ekranını aç ve duvar saati (wall-clock) üzerinden süreyi kaldığı saniyeden sürdür!
    try {
      const runningRaw = localStorage.getItem('fokus_active_session_running');
      if (runningRaw) {
        const saved = JSON.parse(runningRaw);
        const startT = saved?.startTime || saved?.anchorTimestamp || 0;
        const isExpired = Date.now() - startT > 24 * 3600 * 1000;
        if (
          isExpired ||
          saved?.isFinished ||
          saved?.isActive === false ||
          isSessionTerminated(startT)
        ) {
          localStorage.removeItem('fokus_active_session_running');
        } else if (saved && saved.mode) {
          setCurrentActiveMode(saved.mode);
          setSelectedSubject(saved.subject || SERBEST_CALISMA_SUBJECT);
          setDurationMinutes(saved.plannedMinutes || 45);
          setTimerType(saved.timerType || 'countdown');
          if (saved.selectedTaskId) {
            setSelectedTask(loadedTasks.find((t) => t.id === saved.selectedTaskId) || null);
          }
          if (saved.originAirport) setOriginAirport(saved.originAirport);
          if (saved.destAirport) setDestAirport(saved.destAirport);
          if (saved.selectedTreeSpecies) setSelectedTreeSpecies(saved.selectedTreeSpecies);
          setIsSessionActive(true);
        }
      }
    } catch {
      localStorage.removeItem('fokus_active_session_running');
    }

    // Listen for global cloud restore events so any modal/button updates React state immediately
    const handleCloudRestoredEvent = (e: Event) => {
      const custom = e as CustomEvent<{
        sessions?: FocusSession[];
        tasks?: FocusTask[];
        profile?: UserProfile;
      }>;
      if (custom.detail) {
        if (Array.isArray(custom.detail.sessions)) setSessions(custom.detail.sessions);
        if (Array.isArray(custom.detail.tasks)) setTasks(custom.detail.tasks);
        if (custom.detail.profile) setProfile(custom.detail.profile);
      } else {
        setSessions(getStoredSessions());
        setTasks(getStoredTasks());
        setProfile(getStoredProfile());
      }
    };

    window.addEventListener('fokus-cloud-restored', handleCloudRestoredEvent);
    return () => {
      window.removeEventListener('fokus-cloud-restored', handleCloudRestoredEvent);
    };
  }, []);

  // A tap on the Android foreground notification always returns to the
  // running Focus screen, even if the user previously minimized the session
  // and navigated to Tasks or Statistics. Do not start a new timer.
  useEffect(() => {
    const openFocusFromNotification = (fromServiceWorker = false) => {
      const url = new URL(window.location.href);
      const hasDeepLink = url.searchParams.get('nevofocus_focus') === '1';
      if (!hasDeepLink && !fromServiceWorker) return;
      // Consume only this one-shot intent; keep the TWA bridge marker intact.
      if (hasDeepLink) {
        url.searchParams.delete('nevofocus_focus');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
      setCurrentTab('focus');
      try {
        const raw = localStorage.getItem('fokus_active_session_running');
        if (!raw) return;
        const saved = JSON.parse(raw);
        const startedAt = saved?.startTime || saved?.anchorTimestamp || 0;
        if (!startedAt || saved?.isFinished || saved?.isActive === false ||
            Date.now() - startedAt > 24 * 3600 * 1000 || isSessionTerminated(startedAt) ||
            !['clock', 'forest', 'climb', 'flight', 'dive'].includes(saved?.mode)) return;

        setCurrentActiveMode(saved.mode);
        setSelectedSubject(saved.subject || SERBEST_CALISMA_SUBJECT);
        setDurationMinutes(saved.plannedMinutes || 45);
        setTimerType(saved.timerType === 'stopwatch' ? 'stopwatch' : 'countdown');
        const storedTasks = getStoredTasks();
        setSelectedTask(saved.selectedTaskId
          ? storedTasks.find((task) => task.id === saved.selectedTaskId) || null
          : null);
        if (saved.originAirport) setOriginAirport(saved.originAirport);
        if (saved.destAirport) setDestAirport(saved.destAirport);
        if (saved.selectedTreeSpecies) setSelectedTreeSpecies(saved.selectedTreeSpecies);
        // Mounting ActiveFocusSession reconciles the notification button state
        // from Android's authoritative service before resuming display.
        setLocalMinimizedSession(null);
        setIsSessionActive(true);
      } catch (error) {
        console.warn('[NevoFocus] Notification Focus restore:', error);
      }
    };

    const handleServiceWorkerOpen = () => openFocusFromNotification(true);
    openFocusFromNotification();
    // pageshow/popstate callbacks pass Event, not a boolean request.
    const handleUrlOpen = () => openFocusFromNotification();
    window.addEventListener('pageshow', handleUrlOpen);
    window.addEventListener('popstate', handleUrlOpen);
    window.addEventListener('nevofocus:notification-open', handleServiceWorkerOpen);
    // Capacitor delivers cold-start notification intents only once the React
    // listener exists; Android retries until this explicit readiness flag.
    const focusWindow = window as Window & { __nevofocusFocusListenerReady?: boolean };
    focusWindow.__nevofocusFocusListenerReady = true;
    return () => {
      focusWindow.__nevofocusFocusListenerReady = false;
      window.removeEventListener('pageshow', handleUrlOpen);
      window.removeEventListener('popstate', handleUrlOpen);
      window.removeEventListener('nevofocus:notification-open', handleServiceWorkerOpen);
    };
  }, []);

  // Real-time cross-device sync listener on shared backup envelope (Tablet <-> Phone <-> PC)
  useEffect(() => {
    const sharedBackupDoc = doc(db, 'test', 'backup_latest_shared');
    const unsubShared = onSnapshot(
      sharedBackupDoc,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;

        const { uid: myUid, email: myEmail } = resolveSyncIdentity(currentUser, profile);
        const sharedEmail = (data.email || '').trim().toLowerCase();
        const isSameAccount =
          !myEmail ||
          !sharedEmail ||
          sharedEmail === myEmail ||
          data.uid === myUid;

        if (!isSameAccount) return;

        const delSessions = new Set<string>([
          ...getDeletedSessionIds(),
          ...(Array.isArray(data.deletedSessionIds) ? data.deletedSessionIds : []),
        ]);
        const delTasks = new Set<string>([
          ...getDeletedTaskIds(),
          ...(Array.isArray(data.deletedTaskIds) ? data.deletedTaskIds : []),
        ]);

        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          const local = getStoredSessions();
          const map = new Map<string, FocusSession>();
          for (const s of local) {
            if (s && s.id && !delSessions.has(s.id)) map.set(s.id, s);
          }
          let addedOrChanged = false;
          for (const s of data.sessions) {
            if (s && s.id && !delSessions.has(s.id)) {
              if (!map.has(s.id)) addedOrChanged = true;
              map.set(s.id, s);
            }
          }
          if (addedOrChanged || map.size !== local.length) {
            const merged = Array.from(map.values()).sort(
              (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
            );
            setAllStoredSessions(merged);
            setSessions(merged);
          }
        }

        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          const local = getStoredTasks();
          const map = new Map<string, FocusTask>();
          for (const t of local) {
            if (t && t.id && !delTasks.has(t.id)) map.set(t.id, t);
          }
          let addedOrChanged = false;
          for (const t of data.tasks) {
            if (t && t.id && !delTasks.has(t.id)) {
              const prev = map.get(t.id);
              if (!prev || prev.isCompleted !== t.isCompleted) addedOrChanged = true;
              map.set(t.id, {
                ...prev,
                ...t,
                isCompleted: Boolean(prev?.isCompleted || t.isCompleted),
              });
            }
          }
          if (addedOrChanged || map.size !== local.length) {
            const merged = Array.from(map.values()).sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            );
            setAllStoredTasks(merged);
            setTasks(merged);
          }
        }
      },
      () => {
        // ignore
      }
    );

    return () => unsubShared();
  }, [currentUser?.uid, profile.email, profile.userId]);

  // Update selected subject when profile's track changes (NEVER overwrite active session or Serbest Çalışma)
  useEffect(() => {
    if (isSessionActive) return;
    if (selectedSubject?.name === 'Serbest Çalışma') return;
    const trackSubjects = getDefaultSubjectsForTrack(profile.studyTrack || 'Sayısal');
    if (trackSubjects.length > 0) {
      const isStillValid = trackSubjects.some((s) => s.name === selectedSubject?.name);
      if (!isStillValid) {
        setSelectedSubject(trackSubjects[0]);
      }
    }
  }, [profile.studyTrack, isSessionActive, selectedSubject?.name]);

  // Fast loading safety timeout: unlock within max 1500ms so auth has time to hydrate without showing wrong state
  useEffect(() => {
    if (isAndroidNativeAuth) return;
    const timer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Firebase Auth listener and Firestore sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Immediately sync local profile with Google auth data so name and PP appear instantly without waiting or page refresh
        const userPhoto = user.photoURL || '';
        const userDisplayName = user.displayName || user.email?.split('@')[0] || 'Öğrenci';
        const immediateProfile = updateStoredProfile({
          userId: user.uid,
          email: user.email || '',
          name: userDisplayName,
          avatarUrl: userPhoto,
          hasCompletedOnboarding: true,
        });
        setProfile(immediateProfile);

        // INSTANT UNLOCK: Immediately display the app panel without waiting for cloud fetch!
        setIsAuthChecking(false);

        // Fetch user document from Firestore in the background to sync profile
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            const userPhoto = user.photoURL || '';
            const resolvedAvatar = (typeof data.avatarUrl === 'string' && data.avatarUrl) ? data.avatarUrl : userPhoto;
            const resolvedName = (typeof data.name === 'string' && data.name) ? data.name : ((typeof data.displayName === 'string' && data.displayName) ? data.displayName : (user.displayName || 'Öğrenci'));

            const mergedProfile = updateStoredProfile({
              userId: user.uid,
              email: user.email || '',
              name: resolvedName,
              avatarUrl: resolvedAvatar,
              avatarColor: typeof data.avatarColor === 'string' ? data.avatarColor : '#ff5500',
              targetUniversity: typeof data.targetUniversity === 'string' ? data.targetUniversity : '',
              targetDepartment: typeof data.targetDepartment === 'string' ? data.targetDepartment : '',
              targetExam: typeof data.targetExam === 'string' ? data.targetExam : 'YKS 2026 Sayısal',
              preferredFocusMode: ['clock', 'forest', 'climb', 'flight', 'dive'].includes(data.preferredFocusMode) ? data.preferredFocusMode : (immediateProfile.preferredFocusMode || 'clock'),
              studyTrack: typeof data.studyTrack === 'string' ? data.studyTrack : 'Sayısal',
              dailyGoalHours: parseNumericField(data.dailyGoalHours, 6),
              currentStreakDays: parseNumericField(data.streakDays ?? data.currentStreakDays, 0),
              totalFocusHours: parseNumericField(data.totalFocusHours, 0),
              cheersReceived: parseNumericField(data.cheersReceived, 0),
              restDaySelectionMode: data.restDaySelectionMode === 'weekly' ? 'weekly' : 'dates',
              excludedRestDates: Array.isArray(data.excludedRestDates) ? data.excludedRestDates : (immediateProfile.excludedRestDates || []),
              weeklyRestDays: Array.isArray(data.weeklyRestDays) ? data.weeklyRestDays : (immediateProfile.weeklyRestDays || []),
              customRestDates: Array.isArray(data.customRestDates) ? data.customRestDates : (immediateProfile.customRestDates || []),
              musicConnections: data.musicConnections || immediateProfile.musicConnections,
              hasCompletedOnboarding: true,
            });
            setProfile(mergedProfile);
            if (mergedProfile.musicConnections) {
              spotifyService.syncFromProfile(mergedProfile.musicConnections);
            }

            // Check if an active focus is running locally or on another device before marking idle
            let hasActiveFocusAnywhere = Boolean(localStorage.getItem('fokus_active_session_running'));
            if (!hasActiveFocusAnywhere) {
              try {
                const activeSnap = await getDoc(doc(db, 'users', user.uid, 'active_focus', 'current'));
                if (activeSnap.exists() && !activeSnap.data()?.isFinished) {
                  hasActiveFocusAnywhere = true;
                }
              } catch {}
            }

            if (!hasActiveFocusAnywhere) {
              safeSetDoc(
                userDocRef,
                {
                  status: 'idle',
                  currentSubject: '',
                  currentSeconds: 0,
                  lastActiveAt: Date.now(),
                },
                { merge: true }
              ).catch(() => {});
            }
          } else {
            // Document doesn't exist yet for this logged in user, create default safely with Google data
            const userPhoto = user.photoURL || '';
            const userDisplayName = user.displayName || user.email?.split('@')[0] || 'Öğrenci';
            const defaultUserData = {
              userId: user.uid,
              email: user.email || '',
              displayName: userDisplayName,
              name: userDisplayName,
              avatarUrl: userPhoto,
              targetExam: 'YKS 2026 Sayısal',
              studyTrack: 'Sayısal',
              dailyGoalHours: 6,
              streakDays: 1,
              totalFocusMinutes: 0,
              hasCompletedOnboarding: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await safeSetDoc(userDocRef, defaultUserData, { merge: true });
            const mergedProfile = updateStoredProfile(defaultUserData);
            setProfile(mergedProfile);
          }

          // 2. Bidirectional sync: Pull cloud sessions & tasks first, merge with local data
          const restoreResult = await restoreAllFromFirestore(user);
          if (restoreResult.success) {
            setSessions(restoreResult.sessions);
            setTasks(restoreResult.tasks);
            if (restoreResult.profile) {
              setProfile(restoreResult.profile);
            }
          }

          // 3. Upload merged sessions and tasks to Firestore
          await syncAllToFirestore(
            user,
            restoreResult.sessions,
            restoreResult.tasks,
            restoreResult.profile || getStoredProfile()
          );
        } catch (err) {
          console.warn('User profile sync notice:', err);
        }

        // Attach Firestore listener for user's private sessions
        const sessionsCol = collection(db, 'users', user.uid, 'sessions');
        const unsubSessions = onSnapshot(
          sessionsCol,
          (snapshot) => {
            const cloudSessions: FocusSession[] = [];
            const deletedSessionIds = new Set<string>();
            snapshot.forEach((d) => {
              const data = d.data() as FocusSession & { deleted?: boolean };
              if (data && data.deleted && (data.id || d.id)) {
                deletedSessionIds.add(data.id || d.id);
                return;
              }
              if (data && data.id) {
                cloudSessions.push(data);
              }
            });
            if (cloudSessions.length > 0 || deletedSessionIds.size > 0) {
              // Cihazlar arası eksiksiz birleştirme: Bir cihazda olan seans diğerinde asla kaybolmaz!
              const local = getStoredSessions();
              const map = new Map<string, FocusSession>();
              for (const s of local) {
                if (s.id && !deletedSessionIds.has(s.id)) map.set(s.id, s);
              }
              for (const s of cloudSessions) {
                if (s.id && !deletedSessionIds.has(s.id)) map.set(s.id, s);
              }
              const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
              setSessions(merged);
              setAllStoredSessions(merged);
            }
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/sessions`);
          }
        );

        // Attach Firestore listener for user's private tasks
        const tasksCol = collection(db, 'users', user.uid, 'tasks');
        const unsubTasks = onSnapshot(
          tasksCol,
          (snapshot) => {
            const cloudTasks: FocusTask[] = [];
            const deletedTaskIds = new Set<string>();
            snapshot.forEach((d) => {
              const data = d.data() as FocusTask & { deleted?: boolean };
              if (data && data.deleted && (data.id || d.id)) {
                deletedTaskIds.add(data.id || d.id);
                return;
              }
              if (data && data.id && !data.deleted) {
                cloudTasks.push(data);
              }
            });
            const local = getStoredTasks();
            const map = new Map<string, FocusTask>();
            for (const t of local) {
              if (t.id && !deletedTaskIds.has(t.id)) map.set(t.id, t);
            }
            for (const t of cloudTasks) {
              if (t.id && !deletedTaskIds.has(t.id)) map.set(t.id, t);
            }
            const mergedTasks = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setTasks(mergedTasks);
            setAllStoredTasks(mergedTasks);
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/tasks`);
          }
        );

        // Attach Firestore listener for incoming cheer/flame notifications
        const cheersCol = collection(db, 'users', user.uid, 'cheers');
        const unsubCheers = onSnapshot(
          cheersCol,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const raw = change.doc.data();
                const createdAtNum = parseNumericField(raw.createdAt, 0);
                // Only alert if within last 60 seconds
                if (Date.now() - createdAtNum < 60000) {
                  soundEngine.playCompletionBell();
                  const sanitizedCheer: CheerNotification = {
                    id: change.doc.id,
                    fromUserId: typeof raw.fromUserId === 'string' ? raw.fromUserId : 'guest',
                    fromUserName: typeof raw.fromUserName === 'string' ? raw.fromUserName : 'Öğrenci',
                    fromUserAvatarUrl: typeof raw.fromUserAvatarUrl === 'string' ? raw.fromUserAvatarUrl : '',
                    toUserId: user.uid,
                    createdAt: createdAtNum,
                    read: false,
                  };
                  setIncomingCheer(sanitizedCheer);
                  setTimeout(() => {
                    setIncomingCheer((curr) => (curr?.id === change.doc.id ? null : curr));
                  }, 6000);
                }
              }
            });
          },
          () => {
            // ignore
          }
        );

        // Attach Firestore listener for cross-device active focus session sync (tablet <-> phone <-> PC)
        const activeFocusDoc = doc(db, 'users', user.uid, 'active_focus', 'current');
        const unsubActiveFocus = onSnapshot(
          activeFocusDoc,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data && data.mode && data.subject && !data.isFinished && data.isActive !== false) {
                const startedAt = parseNumericField(data.startedAt, Date.now());
                const isStale = Date.now() - startedAt > 24 * 60 * 60 * 1000;
                if (isStale || isSessionTerminated(startedAt)) {
                  setCloudActiveSession(null);
                  try {
                    deleteDoc(activeFocusDoc).catch(() => {});
                  } catch {}
                  return;
                }
                const isPaused = Boolean(data.isPaused);
                const isCampActive = Boolean(data.isCampActive);
                const elapsedSeconds = parseNumericField(data.elapsedSeconds, 0);
                const accumulatedFocusSeconds =
                  typeof data.accumulatedFocusSeconds === 'number'
                    ? data.accumulatedFocusSeconds
                    : elapsedSeconds;
                const anchorTimestamp =
                  data.anchorTimestamp === null
                    ? null
                    : typeof data.anchorTimestamp === 'number'
                    ? data.anchorTimestamp
                    : !isPaused && !isCampActive
                    ? parseNumericField(data.updatedAt, startedAt)
                    : null;

                const remoteDeviceId = typeof data.deviceId === 'string' ? data.deviceId : undefined;
                const myDeviceId = getDeviceId();
                const isRemoteDevice = Boolean(remoteDeviceId && remoteDeviceId !== myDeviceId);

                setCloudActiveSession({
                  mode: data.mode,
                  subject: data.subject,
                  plannedMinutes: parseNumericField(data.plannedMinutes, 45),
                  startedAt,
                  elapsedSeconds,
                  anchorTimestamp,
                  accumulatedFocusSeconds,
                  breakAnchorTimestamp:
                    typeof data.breakAnchorTimestamp === 'number' ? data.breakAnchorTimestamp : null,
                  accumulatedBreakSeconds: parseNumericField(data.accumulatedBreakSeconds, 0),
                  isPaused,
                  isCampActive,
                  breakSeconds: parseNumericField(data.breakSeconds, 0),
                  timerType: data.timerType === 'stopwatch' ? 'stopwatch' : 'countdown',
                  selectedTreeSpecies: data.selectedTreeSpecies,
                  originAirport: data.originAirport,
                  destAirport: data.destAirport,
                  selectedTaskId: data.selectedTaskId,
                  selectedTaskTitle: data.selectedTaskTitle,
                  deviceId: remoteDeviceId,
                  deviceName: typeof data.deviceName === 'string' ? data.deviceName : undefined,
                  isRemoteDevice,
                });
              } else {
                setCloudActiveSession(null);
              }
            } else {
              setCloudActiveSession(null);
            }
          },
          () => {
            // ignore
          }
        );

        try {
          localStorage.setItem('fokus_user_authenticated', 'true');
          localStorage.setItem('fokus_user_uid', user.uid);
          localStorage.removeItem('fokus_guest_mode');
          setIsGuestMode(false);
        } catch {}

        return () => {
          unsubSessions();
          unsubTasks();
          unsubCheers();
          unsubActiveFocus();
        };
      } else {
        // Visitor is not logged in via Firebase Auth popup (e.g. tablet browser or guest mode):
        // Pull cloud sessions & tasks automatically in background if user had an account or empty local storage!
        setIsOnboardingOpen(false);
        setSessions(getStoredSessions());
        setTasks(getStoredTasks());
        setProfile(getStoredProfile());
        setCloudActiveSession(null);

        restoreAllFromFirestore(null)
          .then((res) => {
            if (res.success && (res.sessions.length > 0 || res.tasks.length > 0)) {
              setSessions(res.sessions);
              setTasks(res.tasks);
              if (res.profile) setProfile(res.profile);
            }
          })
          .catch(() => {});
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute 100% Real Stats & Real Streak (Rest days preserve streak)
  const realStreak = useMemo(() => calculateRealStreak(sessions, profile), [sessions, profile]);
  const realTotalHours = useMemo(() => calculateTotalFocusHours(sessions), [sessions]);
  const todayMinutes = useMemo(() => calculateTodayMinutes(sessions), [sessions]);

  // Sync computed stats into dynamic profile representation (memoized to avoid re-render cascades)
  const dynamicProfile: UserProfile = useMemo(() => ({
    ...profile,
    currentStreakDays: realStreak,
    totalFocusHours: realTotalHours,
    todayTotalMinutes: todayMinutes,
  }), [profile, realStreak, realTotalHours, todayMinutes]);

  // Tab switches never return the focus page to the old mode-selection hub.
  const handleSelectTab = useCallback((tab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students') => {
    setTimeout(() => soundEngine.playClick(), 0);
    setCurrentTab(tab);
  }, []);

  // Read live running session telemetry from localStorage / minimized state
  const getLiveRunningTelemetry = useCallback(() => {
    try {
      const raw = localStorage.getItem('fokus_active_session_running');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && !parsed.isFinished && parsed.isActive !== false) {
          const isPaused = Boolean(parsed.isPaused);
          const isCampActive = Boolean(parsed.isCampActive);
          const accFocus = typeof parsed.accumulatedFocusSeconds === 'number'
            ? parsed.accumulatedFocusSeconds
            : (parsed.elapsedCountUp || parsed.elapsedSeconds || 0);
          const anchor = typeof parsed.anchorTimestamp === 'number' ? parsed.anchorTimestamp : null;
          const liveSecs = (!isPaused && !isCampActive && anchor)
            ? accFocus + Math.max(0, Math.floor((Date.now() - anchor) / 1000))
            : accFocus;
          const subjName = parsed.selectedTaskTitle
            ? `${parsed.subject?.name || 'Odak'} · ${parsed.selectedTaskTitle}`
            : (parsed.subject?.name || 'Serbest Çalışma');
          return {
            isRunning: true,
            status: (isPaused || isCampActive ? 'break' : 'studying') as 'studying' | 'break',
            currentSeconds: liveSecs,
            currentSubject: subjName,
            currentMode: (parsed.mode || currentActiveMode || 'forest') as FocusModeType,
          };
        }
      }
    } catch {}
    return {
      isRunning: false,
      status: 'idle' as const,
      currentSeconds: 0,
      currentSubject: '',
      currentMode: (currentActiveMode || 'forest') as FocusModeType,
    };
  }, [currentActiveMode]);

  // Sync user status & study hours to Firestore for real community & room visibility
  const updateCloudStatus = useCallback(async (status: 'studying' | 'idle' | 'break', subjectName?: string, isOnlineOverride = true) => {
    const effectiveUid = currentUser?.uid || auth.currentUser?.uid || (typeof window !== 'undefined' ? (localStorage.getItem('fokus_user_uid') || profile.userId) : profile.userId);
    if (!effectiveUid) return;
    try {
      const liveInfo = getLiveRunningTelemetry();
      const resolvedStatus = status === 'idle' && !liveInfo.isRunning ? 'idle' : (liveInfo.isRunning ? liveInfo.status : status);
      const resolvedSecs = resolvedStatus === 'idle' ? 0 : liveInfo.currentSeconds;
      const liveExtraMins = resolvedStatus === 'idle' ? 0 : Math.floor(resolvedSecs / 60);
      const todayStr = getLocalDateString(new Date());
      let savedRoomId = '';
      try {
        savedRoomId = localStorage.getItem('fokus_active_joined_room_id_v3') || '';
      } catch {}

      const userDocRef = doc(db, 'users', effectiveUid);
      await safeSetDoc(
        userDocRef,
        {
          name: profile.name || 'Öğrenci',
          displayName: profile.name || 'Öğrenci',
          initials: profile.initials || 'Ö',
          avatarUrl: profile.avatarUrl || '',
          avatarColor: profile.avatarColor || '#ff5500',
          targetUniversity: profile.targetUniversity || '',
          targetDepartment: profile.targetDepartment || '',
          targetExam: profile.targetExam || 'YKS 2026',
          studyTrack: profile.studyTrack || 'Sayısal',
          status: resolvedStatus,
          currentSubject: resolvedStatus === 'idle' ? '' : (subjectName || liveInfo.currentSubject || 'Serbest Çalışma'),
          currentMode: liveInfo.currentMode || currentActiveMode || 'forest',
          currentSeconds: resolvedSecs,
          todayDateString: todayStr,
          baseTodayMinutes: todayMinutes,
          todayTotalMinutes: todayMinutes + liveExtraMins,
          totalFocusMinutes: Math.round(realTotalHours * 60) + liveExtraMins,
          totalFocusHours: realTotalHours,
          streakDays: realStreak,
          activeRoomId: savedRoomId,
          isOnline: isOnlineOverride,
          lastActiveAt: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // ignore
    }
  }, [currentUser?.uid, profile, getLiveRunningTelemetry, currentActiveMode, todayMinutes, realTotalHours, realStreak]);

  // Continuous 20-second presence & study-hours heartbeat + offline detection on tab close
  useEffect(() => {
    const effectiveUid = currentUser?.uid || auth.currentUser?.uid || (typeof window !== 'undefined' ? (localStorage.getItem('fokus_user_uid') || profile.userId) : profile.userId);
    if (!effectiveUid) return;

    const sendHeartbeat = () => {
      const live = getLiveRunningTelemetry();
      if (isSessionActive || localMinimizedSession || live.isRunning) {
        updateCloudStatus(live.status, live.currentSubject, true);
      } else {
        updateCloudStatus('idle', '', !document.hidden);
      }
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 20000);

    const handleVisibility = () => {
      if (!document.hidden) {
        sendHeartbeat();
      }
    };

    const handleBeforeUnload = () => {
      const live = getLiveRunningTelemetry();
      if (!isSessionActive && !localMinimizedSession && !live.isRunning) {
        const userDocRef = doc(db, 'users', effectiveUid);
        safeSetDoc(
          userDocRef,
          {
            status: 'idle',
            currentSeconds: 0,
            currentSubject: '',
            isOnline: false,
            lastActiveAt: Date.now(),
          },
          { merge: true }
        ).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.uid, profile.userId, isSessionActive, localMinimizedSession, getLiveRunningTelemetry, updateCloudStatus]);

  // Cloud preferences should update the setup screen without interrupting any live timer.
  useEffect(() => {
    const runningOnThisDevice = typeof window !== 'undefined' &&
      Boolean(localStorage.getItem('fokus_active_session_running'));
    if (isSessionActive || localMinimizedSession || cloudActiveSession || runningOnThisDevice) return;
    setCurrentActiveMode(profile.preferredFocusMode || 'clock');
  }, [profile.preferredFocusMode, isSessionActive, localMinimizedSession, cloudActiveSession]);

  const handleStartSession = () => {
    let subToUse = selectedSubject;
    if (!selectedTask) {
      subToUse = SERBEST_CALISMA_SUBJECT;
      setSelectedSubject(SERBEST_CALISMA_SUBJECT);
    } else if (!subToUse) {
      subToUse = subjects.find((s) => s.name === selectedTask.subjectName) || SERBEST_CALISMA_SUBJECT;
      setSelectedSubject(subToUse);
    }
    const now = Date.now();
    try {
      localStorage.setItem(
        'fokus_active_session_running',
        JSON.stringify({
          startTime: now,
          anchorTimestamp: now,
          accumulatedFocusSeconds: 0,
          breakAnchorTimestamp: null,
          accumulatedBreakSeconds: 0,
          mode: currentActiveMode || 'clock',
          subject: subToUse || SERBEST_CALISMA_SUBJECT,
          plannedMinutes: durationMinutes,
          timerType,
          elapsedSeconds: 0,
          elapsedCountUp: 0,
          breakSeconds: 0,
          isPaused: false,
          isCampActive: false,
          selectedTaskId: selectedTask?.id,
          selectedTaskTitle: selectedTask?.title,
          selectedTreeSpecies,
          originAirport,
          destAirport,
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
          updatedAt: now,
        })
      );
    } catch {}
    setLocalMinimizedSession(null);
    setCloudActiveSession(null);
    setIsSessionActive(true);
    updateCloudStatus('studying', subToUse?.name || 'Serbest Çalışma');
  };

  const handleSessionComplete = async (newSession: FocusSession) => {
    markSessionTerminated();
    backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();

    const finalSession: FocusSession = {
      ...newSession,
      subjectName: newSession.taskId ? newSession.subjectName : 'Serbest Çalışma',
    };
    const updated = saveSession(finalSession);
    setSessions(updated);
    setIsSessionActive(false);
    setLocalMinimizedSession(null);
    setCloudActiveSession(null);

    try {
      localStorage.removeItem('fokus_active_session_running');
    } catch {
      // ignore
    }

    // Complete linked task first so task completion is included in the automatic cloud backup
    let latestTasks = tasks;
    if (newSession.taskId) {
      soundEngine.playClick();
      latestTasks = toggleTaskDone(newSession.taskId);
      setTasks(latestTasks);
    }

    const updatedProfile = updateStoredProfile({
      totalFocusHours: calculateTotalFocusHours(updated),
      currentStreakDays: calculateRealStreak(updated, profile),
      todayTotalMinutes: calculateTodayMinutes(updated),
    });
    setProfile(updatedProfile);

    // HER FOCUS SEANSI TAMAMLANDIKTAN SONRA OTOMATİK BULUTA YEDEKLEME:
    const effectiveUser = currentUser || auth.currentUser;
    const { uid: effectiveUid } = resolveSyncIdentity(effectiveUser, updatedProfile);

    if (effectiveUid) {
      try {
        // Wipe running session in Firestore so no phantom floating pill renders
        const activeRef = doc(db, 'users', effectiveUid, 'active_focus', 'current');
        safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        deleteDoc(activeRef).catch(() => {});
      } catch {}

      try {
        const sessionDocRef = doc(db, 'users', effectiveUid, 'sessions', finalSession.id);
        await safeSetDoc(sessionDocRef, {
          ...finalSession,
          note: finalSession.note || '',
          taskId: finalSession.taskId || null,
          userId: effectiveUid,
          deleted: false,
          syncedAt: Date.now(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${effectiveUid}/sessions/${finalSession.id}`);
      }
    }

    // Tüm seansları, görevleri ve profili otomatik buluta yedekle (cihazlar arası tam senkronizasyon)
    syncAllToFirestore(effectiveUser, updated, latestTasks, updatedProfile)
      .then((res) => {
        if (res.success) {
          setCloudBackupToast('Odak tamamlandı ve buluta otomatik yedeklendi ☁️');
          setTimeout(() => {
            setCloudBackupToast(null);
          }, 4000);
        }
      })
      .catch(() => {});

    setCurrentTab('stats');
  };

  const handleAbandonSession = async (partialSession?: FocusSession) => {
    markSessionTerminated();
    backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();
    setIsSessionActive(false);
    setLocalMinimizedSession(null);
    setCloudActiveSession(null);
    try {
      localStorage.removeItem('fokus_active_session_running');
    } catch {
      // ignore
    }

    const effectiveUser = currentUser || auth.currentUser;
    const effectiveUid = effectiveUser?.uid || (typeof window !== 'undefined' ? (localStorage.getItem('fokus_user_uid') || profile.userId) : profile.userId);
    if (effectiveUid) {
      try {
        const activeRef = doc(db, 'users', effectiveUid, 'active_focus', 'current');
        safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        await deleteDoc(activeRef).catch(() => {});
      } catch {}
    }

    if (partialSession && partialSession.completedSeconds >= 5) {
      const updated = saveSession(partialSession);
      setSessions(updated);

      if (currentUser) {
        try {
          const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', partialSession.id);
          await safeSetDoc(sessionDocRef, {
            ...partialSession,
            note: partialSession.note || '',
            taskId: partialSession.taskId || null,
            userId: currentUser.uid,
          });

          // Update user's aggregate stats in Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          await safeSetDoc(
            userDocRef,
            {
              status: 'idle',
              currentSubject: '',
              todayTotalMinutes: todayMinutes + Math.round(partialSession.completedSeconds / 60),
              totalFocusMinutes: Math.round(realTotalHours * 60 + partialSession.completedSeconds / 60),
              lastActiveAt: Date.now(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Abandon save session notice:', err);
        }
      }

      const updatedProfile = updateStoredProfile({
        totalFocusHours: calculateTotalFocusHours([partialSession, ...sessions]),
      });
      setProfile(updatedProfile);
    }

    updateCloudStatus('idle');
  };

  const handleDeleteSession = async (sessionId: string) => {
    markSessionDeletedId(sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    setAllStoredSessions(updated);

    const updatedProfile = updateStoredProfile({
      totalFocusHours: calculateTotalFocusHours(updated),
      currentStreakDays: calculateRealStreak(updated, profile),
      todayTotalMinutes: calculateTodayMinutes(updated),
    });
    setProfile(updatedProfile);

    const effectiveUser = currentUser || auth.currentUser;
    const { uid: effectiveUid } = resolveSyncIdentity(effectiveUser, updatedProfile);
    if (effectiveUid) {
      try {
        const sessRef = doc(db, 'users', effectiveUid, 'sessions', sessionId);
        await safeSetDoc(sessRef, { id: sessionId, deleted: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        await deleteDoc(sessRef).catch(() => {});
      } catch (err) {
        console.warn('Error deleting session from Firestore:', err);
      }
    }

    syncAllToFirestore(effectiveUser, updated, tasks, updatedProfile, {
      allowEmptyOverwrite: true,
    }).catch(() => {});
  };

  const handleAddTask = async (taskData: Omit<FocusTask, 'id' | 'createdAt'>) => {
    const newTask: FocusTask = {
      ...taskData,
      id: `task-${Date.now()}`,
      createdAt: Date.now(),
      userId: currentUser?.uid,
    };
    const updated = saveTask(newTask);
    setTasks(updated);

    if (currentUser) {
      try {
        const taskDocRef = doc(db, 'users', currentUser.uid, 'tasks', newTask.id);
        await safeSetDoc(taskDocRef, { ...newTask, deleted: false });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/tasks/${newTask.id}`);
      }
    }
  };

  const handleToggleTask = async (taskId: string, manualDurationMinutes?: number) => {
    soundEngine.playClick();
    const updated = toggleTaskDone(taskId);
    setTasks(updated);

    const changed = updated.find((t) => t.id === taskId);
    if (currentUser && changed) {
      try {
        const taskDocRef = doc(db, 'users', currentUser.uid, 'tasks', taskId);
        await safeSetDoc(
          taskDocRef,
          {
            isCompleted: changed.isCompleted,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}/tasks/${taskId}`);
      }
    }

    // IF completed manually with explicit duration:
    if (changed && changed.isCompleted && manualDurationMinutes && manualDurationMinutes > 0) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = changed.dateString || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const manualSession: FocusSession = {
        id: `manual-task-${Date.now()}`,
        userId: currentUser?.uid,
        mode: 'forest',
        subjectId: `subj-${changed.subjectName}`,
        subjectName: changed.subjectName,
        subjectColor: changed.subjectColor || '#10b981',
        plannedMinutes: manualDurationMinutes,
        completedSeconds: manualDurationMinutes * 60,
        breakSeconds: 0,
        completed: true,
        timestamp: Date.now(),
        dateString: dateStr,
        startTimeString: timeStr,
        endTimeString: timeStr,
        note: `${changed.title} (${manualDurationMinutes} dk tamamlandı)`,
        taskId: changed.id,
        taskTitle: changed.title,
        forestInfo: {
          treeSpecies: 'Meşe Ağacı',
          treeLevel: Math.min(5, Math.floor(manualDurationMinutes / 20) + 1),
        },
      };

      const updatedSessions = saveSession(manualSession);
      setSessions(updatedSessions);

      if (currentUser) {
        try {
          const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', manualSession.id);
          await safeSetDoc(sessionDocRef, manualSession);

          // Update user cloud stats
          const userDocRef = doc(db, 'users', currentUser.uid);
          const nextToday = todayMinutes + manualDurationMinutes;
          const nextTotalMins = Math.round(realTotalHours * 60 + manualDurationMinutes);
          await safeSetDoc(
            userDocRef,
            {
              todayDateString: getLocalDateString(new Date()),
              baseTodayMinutes: nextToday,
              todayTotalMinutes: nextToday,
              totalFocusMinutes: nextTotalMins,
              totalFocusHours: Math.round((nextTotalMins / 60) * 10) / 10,
              streakDays: calculateRealStreak([manualSession, ...sessions], profile),
              lastActiveAt: Date.now(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/sessions/${manualSession.id}`);
        }
      }

      const updatedProfile = updateStoredProfile({
        totalFocusHours: calculateTotalFocusHours([manualSession, ...sessions]),
        currentStreakDays: calculateRealStreak([manualSession, ...sessions], profile),
      });
      setProfile(updatedProfile);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    soundEngine.playClick();
    markTaskDeletedId(taskId);
    const updated = deleteTask(taskId);
    setTasks(updated);

    const effectiveUser = currentUser || auth.currentUser;
    const { uid: effectiveUid } = resolveSyncIdentity(effectiveUser, profile);
    if (effectiveUid) {
      try {
        const taskDocRef = doc(db, 'users', effectiveUid, 'tasks', taskId);
        await safeSetDoc(taskDocRef, { id: taskId, deleted: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        await deleteDoc(taskDocRef).catch(() => {});
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${effectiveUid}/tasks/${taskId}`);
      }
    }

    syncAllToFirestore(effectiveUser, sessions, updated, profile, {
      allowEmptyOverwrite: true,
    }).catch(() => {});
  };

  const handleStartTaskWithMode = (task: FocusTask) => {
    soundEngine.playClick();
    setSelectedTask(task);
    setDurationMinutes(task.plannedMinutes);

    const matchedSubject = subjects.find((s) => s.name === task.subjectName) || {
      id: `sub-${task.subjectName}`,
      name: task.subjectName,
      color: task.subjectColor || '#10b981',
    };
    setSelectedSubject(matchedSubject);

    setCurrentTab('focus');
  };

  const handleCheerPeer = async (peerId: string) => {
    soundEngine.playCompletionBell();
  };

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    const updated = updateStoredProfile(updatedData);
    setProfile(updated);

    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await safeSetDoc(
          userDocRef,
          {
            ...updatedData,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleCompleteOnboarding = async (onboardingData: Partial<UserProfile>) => {
    const completeProfileData: Partial<UserProfile> = {
      ...onboardingData,
      hasCompletedOnboarding: true,
    };
    const updated = updateStoredProfile(completeProfileData);
    setProfile(updated);
    setIsOnboardingOpen(false);

    if (currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await safeSetDoc(
          userDocRef,
          {
            ...completeProfileData,
            email: currentUser.email || '',
            userId: currentUser.uid,
            createdAt: Date.now(),
            status: 'idle',
            todayTotalMinutes: 0,
            streakDays: 1,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
      }
    }
  };

  const handleSignOut = async () => {
    soundEngine.playClick();
    try {
      localStorage.removeItem('fokus_user_authenticated');
      localStorage.removeItem('fokus_user_uid');
      localStorage.removeItem('fokus_user_email');
      localStorage.removeItem('fokus_guest_mode');
      setIsGuestMode(false);
      await updateCloudStatus('idle');
      await signOut(auth);
      await signOutNativeGoogle();
      setCurrentUser(null);
      const fresh = getStoredProfile();
      fresh.userId = '';
      fresh.email = '';
      setProfile(fresh);
    } catch {
      // ignore
    }
  };

  const handleAccountDeleted = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('fokus_user_authenticated');
      localStorage.removeItem('fokus_user_uid');
      localStorage.removeItem('fokus_user_email');
      localStorage.removeItem('fokus_guest_mode');
    } catch {}
    setIsGuestMode(false);
    const fresh = getStoredProfile();
    fresh.userId = '';
    fresh.email = '';
    setProfile(fresh);
    setSessions([]);
    setTasks([]);
  };

  // Theme styling
  const themeBackground =
    dynamicProfile.theme === 'ocean'
      ? 'bg-[#05131f]'
      : dynamicProfile.theme === 'emerald'
      ? 'bg-[#06170e]'
      : dynamicProfile.theme === 'midnight'
      ? 'bg-[#0d081f]'
      : 'bg-[#0b0c10]';

  // 1. Tablet & Telefondan her giriş-çıkışta oturum durumunu doğrula (Kalıcı Giriş):
  // Kullanıcı zaten kayıtlıysa veya misafir modundaysa ASLA bekleme ekranında takılı kalmaz, 0ms anında açılır!
  const isExistingUser = isAndroidNativeAuth
    ? Boolean(currentUser || isGuestMode)
    : Boolean(
        currentUser || isGuestMode || profile.userId ||
        (typeof window !== 'undefined' && (
          localStorage.getItem('fokus_user_authenticated') === 'true' ||
          localStorage.getItem('fokus_user_uid')
        ))
      );

  if (isAndroidNativeAuth && isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center font-sans">
        <span className="text-sm text-neutral-400 tracking-wide">NevoFocus · Hesap doğrulanıyor…</span>
      </div>
    );
  }

  // 2. YENİ TARAYICIDA / İLK KEZ SİTEYE GİRİLDİĞİNDE:
  // Onboarding ASLA açılmaz; sağ üstte Giriş Yap ve Kaydol butonları olan Tanıtım Sayfası (LandingPage) gösterilir!
  if (!isExistingUser) {
    return (
      <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans">
        <LandingPage
          onOpenLogin={() => {
            soundEngine.playClick();
            setAuthInitialMode('login');
            setIsAuthModalOpen(true);
          }}
          onOpenRegister={() => {
            soundEngine.playClick();
            setAuthInitialMode('register');
            setIsAuthModalOpen(true);
          }}
          onContinueAsGuest={() => {
            try {
              localStorage.setItem('fokus_guest_mode', 'true');
            } catch {}
            setIsGuestMode(true);
          }}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          initialMode={authInitialMode}
          onRegistrationSuccess={() => {
            const current = getStoredProfile();
            if (!current.hasCompletedOnboarding) {
              setIsOnboardingOpen(true);
            }
          }}
          onProfileUpdate={(p) => setProfile(p)}
          onSyncComplete={() => {
            setSessions(getStoredSessions());
            setTasks(getStoredTasks());
            setProfile(getStoredProfile());
          }}
        />

        {isOnboardingOpen && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            initialProfile={dynamicProfile}
            userEmail={undefined}
            onComplete={handleCompleteOnboarding}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeBackground} text-[#f1f5f9] flex flex-col font-sans selection:bg-[#ff5500]/30 selection:text-white transition-colors duration-300`}>
      {/* Top Header */}
      {!isSessionActive && (
        <Header
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          profile={dynamicProfile}
          currentUser={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenSettings={() => {
            setSettingsInitialTab('modes');
            setIsSettingsModalOpen(true);
          }}
          onOpenBackup={() => {
            setSettingsInitialTab('backup');
            setIsSettingsModalOpen(true);
          }}
          onOpenMarket={() => setIsMarketModalOpen(true)}
          onOpenAchievements={() => setIsAchievementsModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
          isAudioPlaying={Boolean(currentAmbientTrack)}
          onToggleAudioModal={() => setIsAudioModalOpen(true)}
          isMobile={isMobile}
          activeDevice={activeDevice}
          isInstallable={isInstallable}
          onInstallPWA={installApp}
        />
      )}

      {/* Automatic Cloud Backup Confirmation Banner */}
      {cloudBackupToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="px-4 py-2.5 rounded-full bg-neutral-950/95 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl shadow-emerald-950/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{cloudBackupToast}</span>
          </div>
        </div>
      )}

      {/* Incoming Alev / Cheer Floating Notification Banner */}
      {incomingCheer && (
        <div className="fixed top-20 right-5 z-[80] animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/95 border-2 border-[#ff5500] shadow-2xl shadow-[#ff5500]/40 max-w-sm">
            <div className="w-10 h-10 rounded-full bg-[#ff5500]/20 flex items-center justify-center text-[#ff5500] shrink-0 animate-bounce">
              <Flame className="w-6 h-6 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>Moral Alevi Geldi! 🔥</span>
              </h4>
              <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                <strong className="text-white">{incomingCheer.fromUserName}</strong> sana alev gönderdi!
              </p>
            </div>
            <button
              onClick={() => setIncomingCheer(null)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport Content - Adaptive bottom padding for mobile bottom nav */}
      <main className={`flex-1 flex flex-col ${isMobile && !isSessionActive ? 'pb-24' : ''}`}>
        {isSessionActive && selectedSubject && currentActiveMode ? (
          <ActiveFocusSession
            mode={currentActiveMode}
            subject={selectedSubject}
            plannedMinutes={durationMinutes}
            originAirport={originAirport}
            destAirport={destAirport}
            selectedTaskId={selectedTask?.id}
            selectedTaskTitle={selectedTask?.title}
            timerType={timerType}
            tasksList={tasks}
            onToggleTaskDone={handleToggleTask}
            onSessionComplete={handleSessionComplete}
            onAbandonSession={handleAbandonSession}
            onToggleAudioModal={() => setIsAudioModalOpen(true)}
            isAudioPlaying={Boolean(currentAmbientTrack)}
            onMinimize={() => {
              let elapsed = 0;
              let anchorTs: number | null = Date.now();
              let accFocus = 0;
              let breakAnchorTs: number | null = null;
              let accBreak = 0;
              let isPausedVal = false;
              let isCampVal = false;
              let startTs = Date.now();
              try {
                const raw = localStorage.getItem('fokus_active_session_running');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.elapsedCountUp) elapsed = parsed.elapsedCountUp;
                  else if (parsed?.elapsedSeconds) elapsed = parsed.elapsedSeconds;
                  if (typeof parsed?.accumulatedFocusSeconds === 'number') accFocus = parsed.accumulatedFocusSeconds;
                  else accFocus = elapsed;
                  anchorTs = parsed?.anchorTimestamp !== undefined ? parsed.anchorTimestamp : Date.now();
                  breakAnchorTs = parsed?.breakAnchorTimestamp ?? null;
                  accBreak = parsed?.accumulatedBreakSeconds ?? parsed?.breakSeconds ?? 0;
                  isPausedVal = Boolean(parsed?.isPaused);
                  isCampVal = Boolean(parsed?.isCampActive);
                  startTs = parsed?.startTime || Date.now() - elapsed * 1000;
                }
              } catch {}

              const data: ActiveFocusData = {
                mode: currentActiveMode,
                subject: selectedTask ? selectedSubject : SERBEST_CALISMA_SUBJECT,
                plannedMinutes: durationMinutes,
                startedAt: startTs,
                elapsedSeconds: elapsed,
                anchorTimestamp: anchorTs,
                accumulatedFocusSeconds: accFocus,
                breakAnchorTimestamp: breakAnchorTs,
                accumulatedBreakSeconds: accBreak,
                isPaused: isPausedVal,
                isCampActive: isCampVal,
                timerType: timerType,
                selectedTaskId: selectedTask?.id,
                selectedTaskTitle: selectedTask?.title,
                selectedTreeSpecies,
                originAirport,
                destAirport,
                deviceId: getDeviceId(),
                deviceName: getDeviceName(),
                isRemoteDevice: false,
              };

              setLocalMinimizedSession(data);
              setIsSessionActive(false);
            }}
            desktopNotificationsEnabled={Boolean(dynamicProfile.desktopNotifications)}
            liveNotificationsEnabled={Boolean(dynamicProfile.liveNotifications)}
            selectedTreeSpecies={selectedTreeSpecies}
            onOpenSettingsConnections={() => {
              setSettingsInitialTab('connections');
              setIsSettingsModalOpen(true);
            }}
          />
        ) : (
          <>
            {currentTab === 'focus' && (
              <DedicatedModeScreen
                mode={currentActiveMode}
                subjects={subjects}
                selectedSubject={selectedSubject || subjects[0]}
                onSelectSubject={setSelectedSubject}
                durationMinutes={durationMinutes}
                onChangeDuration={setDurationMinutes}
                tasks={tasks}
                selectedTask={selectedTask}
                onSelectTask={setSelectedTask}
                originAirport={originAirport}
                destAirport={destAirport}
                onChangeAirports={(orig, dest) => {
                  setOriginAirport(orig);
                  setDestAirport(dest);
                }}
                profile={dynamicProfile}
                timerType={timerType}
                onChangeTimerType={setTimerType}
                onAddNewTask={handleAddTask}
                onStartActiveSession={handleStartSession}
                selectedTreeSpecies={selectedTreeSpecies}
                onSelectTreeSpecies={setSelectedTreeSpecies}
              />
            )}

            {currentTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                subjects={subjects}
                studentTrack={dynamicProfile.studyTrack || 'Sayısal'}
                sessions={sessions}
                dailyGoalHours={dynamicProfile.dailyGoalHours || 6}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onStartTaskWithMode={handleStartTaskWithMode}
              />
            )}

            {currentTab === 'stats' && (
              <StatisticsView
                sessions={sessions}
                profile={dynamicProfile}
                tasks={tasks}
                onOpenSettings={() => {
                  setSettingsInitialTab('breaks');
                  setIsSettingsModalOpen(true);
                }}
                onUpdateProfile={handleUpdateProfile}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {(currentTab === 'rooms' || currentTab === 'students') && (
              <StudentsView
                peers={peers}
                profile={dynamicProfile}
                currentUser={currentUser}
                onCheerPeer={handleCheerPeer}
                isCurrentUserStudying={Boolean(isSessionActive || localMinimizedSession || cloudActiveSession)}
                activeViewTab={currentTab === 'rooms' ? 'rooms' : 'students'}
                onSwitchTab={handleSelectTab}
              />
            )}
          </>
        )}
      </main>

      {/* Global Modals */}
      <AudioPlayerModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        currentTrack={currentAmbientTrack}
        onSelectTrack={(track: 'rain' | 'forest' | 'white_noise' | 'airplane' | 'ocean' | 'campfire' | 'off') => {
          setCurrentAmbientTrack(track);
          soundEngine.playAmbient(track);
        }}
        volume={audioVolume}
        onVolumeChange={(vol: number) => {
          setAudioVolume(vol);
          soundEngine.setVolume(vol);
        }}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={dynamicProfile}
        currentUser={currentUser}
        onSaveProfile={handleUpdateProfile}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        profile={dynamicProfile}
        currentUser={currentUser}
        sessions={sessions}
        tasks={tasks}
        deviceMode={deviceMode}
        detectedDevice={detectedDevice}
        onSelectDeviceMode={(mode) => {
          setDeviceMode(mode);
          handleUpdateProfile({ deviceModePreference: mode });
        }}
        onUpdateProfile={handleUpdateProfile}
        selectedFocusMode={dynamicProfile.preferredFocusMode || 'clock'}
        focusModeChangeDisabled={Boolean(isSessionActive || localMinimizedSession || cloudActiveSession)}
        onSelectFocusMode={(mode) => {
          if (isSessionActive || localMinimizedSession || cloudActiveSession) return;
          setCurrentActiveMode(mode);
          if (mode === 'clock') setTimerType('stopwatch');
          void handleUpdateProfile({ preferredFocusMode: mode });
          setIsSettingsModalOpen(false);
          setCurrentTab('focus');
        }}
        onAccountDeleted={handleAccountDeleted}
        onSyncComplete={(newSessions, newTasks, newProfile) => {
          setSessions(newSessions);
          setTasks(newTasks);
          if (newProfile) setProfile(newProfile);
        }}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setIsAuthModalOpen(true);
        }}
      />

      <MarketModal
        isOpen={isMarketModalOpen}
        onClose={() => setIsMarketModalOpen(false)}
      />

      <AchievementsModal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        profile={dynamicProfile}
        sessions={sessions}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialProfile={dynamicProfile}
        userEmail={currentUser?.email || undefined}
        onComplete={handleCompleteOnboarding}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        initialMode={authInitialMode}
        onRegistrationSuccess={() => {
          const current = getStoredProfile();
          if (!current.hasCompletedOnboarding) {
            setIsOnboardingOpen(true);
          }
        }}
        onProfileUpdate={(p) => setProfile(p)}
        onSyncComplete={() => {
          setSessions(getStoredSessions());
          setTasks(getStoredTasks());
          setProfile(getStoredProfile());
        }}
      />

      {/* PWA Hoş Geldin & Uygulama Yükleme Bildirim Çubuğu */}
      {showWelcomeBanner && !isSessionActive && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] p-3 sm:p-3.5 rounded-2xl bg-neutral-900/95 border border-[#ff5500]/40 backdrop-blur-xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff5500] to-amber-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-[#ff5500]/25">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white tracking-tight">Fokus'u Masaüstü/Mobil Uygulama Olarak Yükle</h4>
              <p className="text-[11px] text-neutral-400 truncate">Hızlı açılış, tam ekran deneyimi ve kalıcı oturum</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={installApp}
              className="px-3 py-1.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold shadow-md shadow-[#ff5500]/20 transition-all cursor-pointer"
            >
              Yükle
            </button>
            <button
              onClick={dismissBanner}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Multi-Device & Minimized Floating Mini Focus Pill (Matches User Photo) */}
      {(localMinimizedSession || cloudActiveSession) && !isSessionActive && (
        <FloatingMiniFocusPill
          session={(localMinimizedSession || cloudActiveSession)!}
          isMobile={isMobile}
          isAudioPlaying={Boolean(currentAmbientTrack)}
          onToggleAudio={() => {
            if (currentAmbientTrack) {
              soundEngine.stopAmbient();
              setCurrentAmbientTrack(null);
            } else {
              soundEngine.playAmbient('forest');
              setCurrentAmbientTrack('forest');
            }
          }}
          onToggleBreak={async () => {
            const target = localMinimizedSession || cloudActiveSession;
            if (!target) return;
            const now = Date.now();
            const nextCamp = !target.isCampActive;
            let nextAccFocus = target.accumulatedFocusSeconds ?? target.elapsedSeconds ?? 0;
            let nextAnchor: number | null = target.anchorTimestamp ?? null;
            let nextAccBreak = target.accumulatedBreakSeconds ?? target.breakSeconds ?? 0;
            let nextBreakAnchor: number | null = target.breakAnchorTimestamp ?? null;

            if (nextCamp) {
              if (!target.isPaused && target.anchorTimestamp) {
                nextAccFocus += Math.max(0, Math.floor((now - target.anchorTimestamp) / 1000));
              }
              nextBreakAnchor = now;
              nextAnchor = now;
            } else {
              if (!target.isPaused && target.breakAnchorTimestamp) {
                nextAccBreak += Math.max(0, Math.floor((now - target.breakAnchorTimestamp) / 1000));
              }
              nextAnchor = now;
              nextBreakAnchor = now;
            }

            const patch = {
              isCampActive: nextCamp,
              accumulatedFocusSeconds: nextAccFocus,
              anchorTimestamp: nextAnchor,
              accumulatedBreakSeconds: nextAccBreak,
              breakAnchorTimestamp: nextBreakAnchor,
              elapsedSeconds: nextAccFocus,
              breakSeconds: nextAccBreak,
            };

            if (localMinimizedSession) {
              setLocalMinimizedSession((prev) => (prev ? { ...prev, ...patch } : null));
            }
            if (cloudActiveSession) {
              setCloudActiveSession((prev) => (prev ? { ...prev, ...patch } : null));
            }
            try {
              const raw = localStorage.getItem('fokus_active_session_running');
              if (raw) {
                const parsed = JSON.parse(raw);
                localStorage.setItem(
                  'fokus_active_session_running',
                  JSON.stringify({
                    ...parsed,
                    ...patch,
                    elapsedCountUp: nextAccFocus,
                    updatedAt: now,
                  })
                );
              }
            } catch {}
            if (currentUser) {
              try {
                await updateDoc(doc(db, 'users', currentUser.uid, 'active_focus', 'current'), {
                  ...patch,
                  lastUpdatedByDeviceId: getDeviceId(),
                  updatedAt: now,
                });
              } catch {}
            }
          }}
          onTogglePause={async () => {
            const target = localMinimizedSession || cloudActiveSession;
            if (!target) return;
            const now = Date.now();
            const nextPaused = !target.isPaused;
            let nextAccFocus = target.accumulatedFocusSeconds ?? target.elapsedSeconds ?? 0;
            let nextAnchor: number | null = target.anchorTimestamp ?? null;

            if (nextPaused) {
              if (target.anchorTimestamp) {
                nextAccFocus += Math.max(0, Math.floor((now - target.anchorTimestamp) / 1000));
              }
              nextAnchor = null;
            } else {
              nextAnchor = now;
            }

            if (localMinimizedSession) {
              setLocalMinimizedSession((prev) =>
                prev
                  ? {
                      ...prev,
                      isPaused: nextPaused,
                      accumulatedFocusSeconds: nextAccFocus,
                      anchorTimestamp: nextAnchor,
                      elapsedSeconds: nextAccFocus,
                    }
                  : null
              );
            }
            if (cloudActiveSession) {
              setCloudActiveSession((prev) =>
                prev
                  ? {
                      ...prev,
                      isPaused: nextPaused,
                      accumulatedFocusSeconds: nextAccFocus,
                      anchorTimestamp: nextAnchor,
                      elapsedSeconds: nextAccFocus,
                    }
                  : null
              );
            }
            try {
              const raw = localStorage.getItem('fokus_active_session_running');
              if (raw) {
                const parsed = JSON.parse(raw);
                localStorage.setItem(
                  'fokus_active_session_running',
                  JSON.stringify({
                    ...parsed,
                    isPaused: nextPaused,
                    accumulatedFocusSeconds: nextAccFocus,
                    anchorTimestamp: nextAnchor,
                    elapsedSeconds: nextAccFocus,
                    elapsedCountUp: nextAccFocus,
                    updatedAt: now,
                  })
                );
              }
            } catch {}
            if (currentUser) {
              try {
                await updateDoc(doc(db, 'users', currentUser.uid, 'active_focus', 'current'), {
                  isPaused: nextPaused,
                  accumulatedFocusSeconds: nextAccFocus,
                  anchorTimestamp: nextAnchor,
                  elapsedSeconds: nextAccFocus,
                  lastUpdatedByDeviceId: getDeviceId(),
                  updatedAt: now,
                });
              } catch {}
            }
          }}
          onComplete={async () => {
            const activeSession = localMinimizedSession || cloudActiveSession;
            if (!activeSession) return;
            markSessionTerminated(activeSession.startedAt);
            const nowMs = Date.now();
            const liveElapsed =
              !activeSession.isPaused && !activeSession.isCampActive && activeSession.anchorTimestamp
                ? (activeSession.accumulatedFocusSeconds ?? 0) +
                  Math.max(0, Math.floor((nowMs - activeSession.anchorTimestamp) / 1000))
                : activeSession.accumulatedFocusSeconds ?? activeSession.elapsedSeconds ?? 0;
            const completedSecs = Math.max(1, liveElapsed || 1);
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const finalSubjectName = activeSession.selectedTaskId
              ? activeSession.subject?.name || 'Serbest Çalışma'
              : 'Serbest Çalışma';
            const newSession: FocusSession = {
              id: `sess-${Date.now()}`,
              userId: currentUser?.uid || 'guest',
              mode: activeSession.mode,
              subjectId: activeSession.selectedTaskId ? activeSession.subject?.id || 'sub-serbest-calisma' : 'sub-serbest-calisma',
              subjectName: finalSubjectName,
              subjectColor: activeSession.selectedTaskId ? activeSession.subject?.color || '#6366f1' : '#6366f1',
              plannedMinutes: activeSession.plannedMinutes || 45,
              completedSeconds: completedSecs,
              breakSeconds: activeSession.breakSeconds || 0,
              completed: true,
              dateString: dateStr,
              startTimeString: timeStr,
              endTimeString: timeStr,
              timestamp: Date.now(),
              note: activeSession.selectedTaskTitle || `${finalSubjectName} seansı`,
              taskId: activeSession.selectedTaskId,
              taskTitle: activeSession.selectedTaskTitle,
            };
            const updated = saveSession(newSession);
            setSessions(updated);
            soundEngine.playCompletionBell();
            backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();

            const effectiveUid = currentUser?.uid || auth.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null);
            if (effectiveUid) {
              try {
                const activeRef = doc(db, 'users', effectiveUid, 'active_focus', 'current');
                safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                await deleteDoc(activeRef).catch(() => {});
                if (currentUser) {
                  await syncAllToFirestore(currentUser, updated, tasks, dynamicProfile);
                }
              } catch {}
            }
            try {
              localStorage.removeItem('fokus_active_session_running');
            } catch {}
            setLocalMinimizedSession(null);
            setCloudActiveSession(null);
          }}
          onMaximize={() => {
            const sess = localMinimizedSession || cloudActiveSession;
            if (!sess) return;
            // Write exact wall-clock anchor state to localStorage BEFORE mounting ActiveFocusSession
            // so cross-device "Göster" or local maximize opens at the exact same second!
            try {
              localStorage.setItem(
                'fokus_active_session_running',
                JSON.stringify({
                  startTime: sess.startedAt,
                  anchorTimestamp: sess.anchorTimestamp,
                  accumulatedFocusSeconds: sess.accumulatedFocusSeconds ?? sess.elapsedSeconds ?? 0,
                  breakAnchorTimestamp: sess.breakAnchorTimestamp ?? null,
                  accumulatedBreakSeconds: sess.accumulatedBreakSeconds ?? sess.breakSeconds ?? 0,
                  mode: sess.mode,
                  subject: sess.subject || SERBEST_CALISMA_SUBJECT,
                  plannedMinutes: sess.plannedMinutes,
                  timerType: sess.timerType,
                  elapsedSeconds: sess.elapsedSeconds,
                  elapsedCountUp: sess.elapsedSeconds,
                  breakSeconds: sess.breakSeconds || 0,
                  isPaused: sess.isPaused,
                  isCampActive: Boolean(sess.isCampActive),
                  selectedTaskId: sess.selectedTaskId,
                  selectedTaskTitle: sess.selectedTaskTitle,
                  selectedTreeSpecies: sess.selectedTreeSpecies,
                  originAirport: sess.originAirport,
                  destAirport: sess.destAirport,
                  deviceId: sess.deviceId || getDeviceId(),
                  deviceName: sess.deviceName || getDeviceName(),
                  updatedAt: Date.now(),
                })
              );
            } catch {}

            setCurrentActiveMode(sess.mode);
            setSelectedSubject(sess.subject || SERBEST_CALISMA_SUBJECT);
            setDurationMinutes(sess.plannedMinutes);
            setTimerType(sess.timerType);
            if (sess.selectedTaskId) {
              setSelectedTask(tasks.find((t) => t.id === sess.selectedTaskId) || null);
            }
            if (sess.originAirport) setOriginAirport(sess.originAirport);
            if (sess.destAirport) setDestAirport(sess.destAirport);
            if (sess.selectedTreeSpecies) setSelectedTreeSpecies(sess.selectedTreeSpecies);
            setLocalMinimizedSession(null);
            setIsSessionActive(true);
          }}
          onDismiss={async () => {
            const target = localMinimizedSession || cloudActiveSession;
            markSessionTerminated(target?.startedAt);
            backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();
            setLocalMinimizedSession(null);
            setCloudActiveSession(null);
            try {
              localStorage.removeItem('fokus_active_session_running');
            } catch {}
            const effectiveUid = currentUser?.uid || auth.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null);
            if (effectiveUid) {
              try {
                const activeRef = doc(db, 'users', effectiveUid, 'active_focus', 'current');
                safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                await deleteDoc(activeRef).catch(() => {});
              } catch {}
            }
          }}
        />
      )}

      {/* Modern Mobile Bottom Navigation Bar */}
      {isMobile && !isSessionActive && (
        <BottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onOpenSettings={() => {
            setSettingsInitialTab('modes');
            setIsSettingsModalOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          activeModeTitle="Odaklan"
        />
      )}
    </div>
  );
}
