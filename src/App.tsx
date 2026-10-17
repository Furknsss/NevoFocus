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
  FOCUS_MODES,
} from './utils/storage';
import { calculateRealStreak, calculateTotalFocusHours, calculateTodayMinutes } from './utils/stats';
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
} from './services/syncService';
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
import { ModeHubSelection } from './components/ModeHubSelection';
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
import { CinematicTransitionCurtain } from './components/visuals/CinematicTransitionCurtain';
import { useDeviceMode } from './hooks/useDeviceMode';
import { usePWAInstall } from './hooks/usePWAInstall';
import { BottomNav } from './components/BottomNav';
import { FloatingMiniFocusPill, ActiveFocusData } from './components/FloatingMiniFocusPill';
import { Flame, X, Download } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'focus' | 'tasks' | 'stats' | 'rooms' | 'students'>('focus');

  // Dedicated Mode Architecture
  const [currentActiveMode, setCurrentActiveMode] = useState<FocusModeType | null>(null);
  const [transitioningToMode, setTransitioningToMode] = useState<FocusModeType | null>(null);

  // Firebase auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  // Cloud active focus sync across devices (e.g. tablet <-> phone)
  const [cloudActiveSession, setCloudActiveSession] = useState<ActiveFocusData | null>(null);

  // Tablet & Phone authentication persistence: never flash or dump user to landing screen
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
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

  // Live Toast for Incoming Alev / Cheer Notifications
  const [incomingCheer, setIncomingCheer] = useState<CheerNotification | null>(null);

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
  const [timerType, setTimerType] = useState<'countdown' | 'stopwatch'>('countdown');

  // Forest selected tree species
  const [selectedTreeSpecies, setSelectedTreeSpecies] = useState<string>('Meşe Ağacı');

  // Today's date string & calculated planned task minutes
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayPlannedMinutes = useMemo(() => {
    return tasks
      .filter((t) => !t.dateString || t.dateString === todayStr)
      .reduce((sum, t) => sum + (t.plannedMinutes || 45), 0);
  }, [tasks, todayStr]);

  // Active focus session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // Modals state
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'breaks' | 'notifications' | 'theme' | 'security' | 'backup'>('breaks');
  const [isMarketModalOpen, setIsMarketModalOpen] = useState<boolean>(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // PWA (Progressive Web App) Install Hook
  const { isInstallable, installApp, showWelcomeBanner, dismissBanner } = usePWAInstall();

  const [currentAmbientTrack, setCurrentAmbientTrack] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0.5);

  // Load initial local storage data
  useEffect(() => {
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

    // Check if an active focus session was running in localStorage
    try {
      const runningRaw = localStorage.getItem('fokus_active_session_running');
      if (runningRaw) {
        const saved = JSON.parse(runningRaw);
        if (saved && saved.mode && saved.subject) {
          setCurrentActiveMode(saved.mode);
          setSelectedSubject(saved.subject);
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
  }, []);

  // Update selected subject when profile's track changes
  useEffect(() => {
    const trackSubjects = getDefaultSubjectsForTrack(profile.studyTrack || 'Sayısal');
    if (trackSubjects.length > 0) {
      const isStillValid = trackSubjects.some((s) => s.name === selectedSubject?.name);
      if (!isStillValid) {
        setSelectedSubject(trackSubjects[0]);
      }
    }
  }, [profile.studyTrack]);

  // Fast loading safety timeout: unlock within max 500ms so user never waits
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAuthChecking(false);
    }, 500);
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
              studyTrack: typeof data.studyTrack === 'string' ? data.studyTrack : 'Sayısal',
              dailyGoalHours: parseNumericField(data.dailyGoalHours, 6),
              currentStreakDays: parseNumericField(data.streakDays ?? data.currentStreakDays, 0),
              totalFocusHours: parseNumericField(data.totalFocusHours, 0),
              cheersReceived: parseNumericField(data.cheersReceived, 0),
              weeklyRestDays: Array.isArray(data.weeklyRestDays) ? data.weeklyRestDays : (immediateProfile.weeklyRestDays || [0]),
              customRestDates: Array.isArray(data.customRestDates) ? data.customRestDates : (immediateProfile.customRestDates || []),
              hasCompletedOnboarding: true,
            });
            setProfile(mergedProfile);
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

          // 2. Bidirectional sync: Pull cloud sessions & tasks, merge with local data
          const restoreResult = await restoreAllFromFirestore(user);
          if (restoreResult.success) {
            setSessions(restoreResult.sessions);
            setTasks(restoreResult.tasks);
          }

          // 3. Upload any unsynced local sessions and tasks to Firestore
          await syncAllToFirestore(
            user,
            getStoredSessions(),
            getStoredTasks(),
            getStoredProfile()
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
            snapshot.forEach((d) => {
              cloudSessions.push(d.data() as FocusSession);
            });
            cloudSessions.sort((a, b) => b.timestamp - a.timestamp);
            if (cloudSessions.length > 0) {
              setSessions(cloudSessions);
              setAllStoredSessions(cloudSessions);
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
            snapshot.forEach((d) => {
              const data = d.data() as FocusTask;
              if (data && !(data as any).deleted) {
                cloudTasks.push(data);
              }
            });
            if (cloudTasks.length > 0) {
              setTasks(cloudTasks);
              setAllStoredTasks(cloudTasks);
            }
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

        // Attach Firestore listener for cross-device active focus session sync (tablet <-> phone)
        const activeFocusDoc = doc(db, 'users', user.uid, 'active_focus', 'current');
        const unsubActiveFocus = onSnapshot(
          activeFocusDoc,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data && data.mode && data.subject) {
                setCloudActiveSession({
                  mode: data.mode,
                  subject: data.subject,
                  plannedMinutes: parseNumericField(data.plannedMinutes, 45),
                  startedAt: parseNumericField(data.startedAt, Date.now()),
                  elapsedSeconds: parseNumericField(data.elapsedSeconds, 0),
                  isPaused: Boolean(data.isPaused),
                  isCampActive: Boolean(data.isCampActive),
                  breakSeconds: parseNumericField(data.breakSeconds, 0),
                  timerType: data.timerType === 'stopwatch' ? 'stopwatch' : 'countdown',
                  selectedTreeSpecies: data.selectedTreeSpecies,
                  originAirport: data.originAirport,
                  destAirport: data.destAirport,
                  selectedTaskId: data.selectedTaskId,
                });
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
        // Visitor is not logged in: Never show onboarding! Show landing page instead.
        setIsOnboardingOpen(false);
        setSessions(getStoredSessions());
        setTasks(getStoredTasks());
        setProfile(getStoredProfile());
        setCloudActiveSession(null);

        try {
          const isGuest = localStorage.getItem('fokus_guest_mode') === 'true';
          if (!isGuest) {
            localStorage.removeItem('fokus_user_authenticated');
            localStorage.removeItem('fokus_user_uid');
          }
        } catch {}
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

  // Instant tab transition without delay
  const handleSelectTab = useCallback((tab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students') => {
    // Non-blocking tactile feedback
    setTimeout(() => {
      soundEngine.playClick();
    }, 0);

    if (tab === 'focus' && currentTab === 'focus' && !isSessionActive) {
      setCurrentActiveMode(null);
    }

    setCurrentTab(tab);
  }, [currentTab, isSessionActive]);

  // Sync user status to Firestore for real community visibility (safe setDoc)
  const updateCloudStatus = async (status: 'studying' | 'idle' | 'break', subjectName?: string) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await safeSetDoc(
        userDocRef,
        {
          status,
          currentSubject: subjectName || '',
          currentMode: currentActiveMode || 'forest',
          todayTotalMinutes: todayMinutes,
          streakDays: realStreak,
          lastActiveAt: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // ignore
    }
  };

  // Mode Selection Flow with Cinematic Shutter (Kepenk) Transition
  const handleSelectModeFromHub = (mode: FocusModeType) => {
    setCurrentActiveMode(mode);
    setTransitioningToMode(mode);
  };

  const handleTransitionCurtainMidpoint = () => {
    if (transitioningToMode) {
      setCurrentActiveMode(transitioningToMode);
    }
  };

  const handleTransitionCurtainEnd = () => {
    setTransitioningToMode(null);
  };

  const handleStartSession = () => {
    const subToUse = selectedSubject || subjects[0];
    if (!subToUse) return;
    if (!selectedSubject) setSelectedSubject(subToUse);
    setIsSessionActive(true);
    updateCloudStatus('studying', subToUse.name);
  };

  const handleSessionComplete = async (newSession: FocusSession) => {
    const updated = saveSession(newSession);
    setSessions(updated);
    setIsSessionActive(false);

    try {
      localStorage.removeItem('fokus_active_session_running');
    } catch {
      // ignore
    }

    if (currentUser) {
      try {
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSession.id);
        await safeSetDoc(sessionDocRef, {
          ...newSession,
          note: newSession.note || '',
          taskId: newSession.taskId || null,
          userId: currentUser.uid,
        });

        // Update user's aggregate stats in Firestore (safe setDoc)
        const userDocRef = doc(db, 'users', currentUser.uid);
        await safeSetDoc(
          userDocRef,
          {
            status: 'idle',
            currentSubject: '',
            todayTotalMinutes: todayMinutes + Math.round(newSession.completedSeconds / 60),
            totalFocusMinutes: Math.round(realTotalHours * 60 + newSession.completedSeconds / 60),
            streakDays: calculateRealStreak([newSession, ...sessions], profile),
            lastActiveAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/sessions/${newSession.id}`);
      }
    }

    if (newSession.taskId) {
      handleToggleTask(newSession.taskId);
    }

    const updatedProfile = updateStoredProfile({
      totalFocusHours: calculateTotalFocusHours([newSession, ...sessions]),
      currentStreakDays: calculateRealStreak([newSession, ...sessions], profile),
    });
    setProfile(updatedProfile);

    setCurrentTab('stats');
  };

  const handleAbandonSession = async (partialSession?: FocusSession) => {
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

    setIsSessionActive(false);
    try {
      localStorage.removeItem('fokus_active_session_running');
    } catch {
      // ignore
    }
    updateCloudStatus('idle');
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
        await safeSetDoc(taskDocRef, newTask);
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
          await safeSetDoc(
            userDocRef,
            {
              todayTotalMinutes: todayMinutes + manualDurationMinutes,
              totalFocusMinutes: Math.round(realTotalHours * 60 + manualDurationMinutes),
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
    const updated = deleteTask(taskId);
    setTasks(updated);

    if (currentUser) {
      try {
        const taskDocRef = doc(db, 'users', currentUser.uid, 'tasks', taskId);
        await deleteDoc(taskDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/tasks/${taskId}`);
      }
    }
  };

  const handleStartTaskWithMode = (task: FocusTask) => {
    soundEngine.playClick();
    setSelectedTask(task);
    setDurationMinutes(task.plannedMinutes);

    const matchedSubject = subjects.find((s) => s.name === task.subjectName);
    if (matchedSubject) {
      setSelectedSubject(matchedSubject);
    }

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
      localStorage.removeItem('fokus_guest_mode');
      setIsGuestMode(false);
      await updateCloudStatus('idle');
      await signOut(auth);
      setCurrentUser(null);
      const fresh = getStoredProfile();
      fresh.userId = '';
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
      localStorage.removeItem('fokus_guest_mode');
    } catch {}
    setIsGuestMode(false);
    const fresh = getStoredProfile();
    fresh.userId = '';
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
  const isExistingUser = Boolean(
    currentUser ||
    isGuestMode ||
    profile.userId ||
    (typeof window !== 'undefined' && (
      localStorage.getItem('fokus_user_authenticated') === 'true' ||
      localStorage.getItem('fokus_user_uid')
    ))
  );

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
          onOpenSettings={() => setIsSettingsModalOpen(true)}
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

      {/* Cinematic Transition Curtain (Roller Shutter / Kepenk) */}
      {transitioningToMode && (
        <CinematicTransitionCurtain
          mode={transitioningToMode}
          onMidpoint={handleTransitionCurtainMidpoint}
          onTransitionEnd={handleTransitionCurtainEnd}
        />
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
            onMinimize={() => setIsSessionActive(false)}
            isAudioPlaying={Boolean(currentAmbientTrack)}
            desktopNotificationsEnabled={Boolean(dynamicProfile.desktopNotifications)}
            liveNotificationsEnabled={Boolean(dynamicProfile.liveNotifications)}
            selectedTreeSpecies={selectedTreeSpecies}
          />
        ) : (
          <>
            {currentTab === 'focus' && (
              <>
                {/* 1. Mode Selection Hub: 4 Cards */}
                {!currentActiveMode && (
                  <ModeHubSelection
                    onSelectMode={handleSelectModeFromHub}
                    todayMinutes={todayMinutes}
                    streakDays={realStreak}
                    dailyGoalHours={dynamicProfile.dailyGoalHours}
                    todayPlannedMinutes={todayPlannedMinutes}
                  />
                )}

                {/* 2. Dedicated Mode Hub for chosen mode */}
                {currentActiveMode && (
                  <DedicatedModeScreen
                    mode={currentActiveMode}
                    onBackToHub={() => setCurrentActiveMode(null)}
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
              </>
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
              />
            )}

            {(currentTab === 'rooms' || currentTab === 'students') && (
              <StudentsView
                peers={peers}
                profile={dynamicProfile}
                currentUser={currentUser}
                onCheerPeer={handleCheerPeer}
                isCurrentUserStudying={isSessionActive}
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
      {cloudActiveSession && !isSessionActive && (
        <FloatingMiniFocusPill
          session={cloudActiveSession}
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
          onTogglePause={async () => {
            const nextPaused = !cloudActiveSession.isPaused;
            setCloudActiveSession((prev) => (prev ? { ...prev, isPaused: nextPaused } : null));
            if (currentUser) {
              try {
                await updateDoc(doc(db, 'users', currentUser.uid, 'active_focus', 'current'), {
                  isPaused: nextPaused,
                  updatedAt: Date.now(),
                });
              } catch {}
            }
          }}
          onComplete={async () => {
            const completedSecs = Math.max(60, cloudActiveSession.elapsedSeconds || 60);
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const newSession: FocusSession = {
              id: `sess-${Date.now()}`,
              userId: currentUser?.uid || 'guest',
              mode: cloudActiveSession.mode,
              subjectId: cloudActiveSession.subject?.id || 'sub-genel',
              subjectName: cloudActiveSession.subject?.name || 'Serbest Çalışma',
              subjectColor: cloudActiveSession.subject?.color || '#ff5500',
              plannedMinutes: cloudActiveSession.plannedMinutes || 45,
              completedSeconds: completedSecs,
              breakSeconds: cloudActiveSession.breakSeconds || 0,
              completed: true,
              dateString: dateStr,
              startTimeString: timeStr,
              endTimeString: timeStr,
              timestamp: Date.now(),
              note: 'Hızlı yüzen çubuk üzerinden başarıyla tamamlandı.',
            };
            const updated = saveSession(newSession);
            setSessions(updated);
            soundEngine.playCompletionBell();

            if (currentUser) {
              try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'active_focus', 'current'));
                await syncAllToFirestore(currentUser, updated, tasks, dynamicProfile);
              } catch {}
            }
            try {
              localStorage.removeItem('fokus_active_session_running');
            } catch {}
            setCloudActiveSession(null);
          }}
          onMaximize={() => {
            setCurrentActiveMode(cloudActiveSession.mode);
            setSelectedSubject(cloudActiveSession.subject);
            setDurationMinutes(cloudActiveSession.plannedMinutes);
            setTimerType(cloudActiveSession.timerType);
            if (cloudActiveSession.selectedTaskId) {
              setSelectedTask(tasks.find((t) => t.id === cloudActiveSession.selectedTaskId) || null);
            }
            if (cloudActiveSession.originAirport) setOriginAirport(cloudActiveSession.originAirport);
            if (cloudActiveSession.destAirport) setDestAirport(cloudActiveSession.destAirport);
            if (cloudActiveSession.selectedTreeSpecies) setSelectedTreeSpecies(cloudActiveSession.selectedTreeSpecies);
            setIsSessionActive(true);
          }}
        />
      )}

      {/* Modern Mobile Bottom Navigation Bar */}
      {isMobile && !isSessionActive && (
        <BottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          activeModeTitle={currentActiveMode ? FOCUS_MODES.find((m) => m.id === currentActiveMode)?.title : undefined}
        />
      )}
    </div>
  );
}
