import React, { useState, useEffect } from 'react';
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
} from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
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
import { Flame, X } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'focus' | 'tasks' | 'stats' | 'rooms' | 'students'>('focus');

  // Dedicated Mode Architecture
  const [currentActiveMode, setCurrentActiveMode] = useState<FocusModeType | null>(null);
  const [transitioningToMode, setTransitioningToMode] = useState<FocusModeType | null>(null);

  // Firebase auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  // Persistence data
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [peers, setPeers] = useState<StudentPeer[]>([]);

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

  // Active focus session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // Modals state
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isMarketModalOpen, setIsMarketModalOpen] = useState<boolean>(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

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

  // Firebase Auth listener and Firestore sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch user document from Firestore to sync profile
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            const mergedProfile = updateStoredProfile({
              userId: user.uid,
              email: user.email || '',
              name: data.name || data.displayName || user.displayName || 'Öğrenci',
              avatarUrl: data.avatarUrl || '',
              avatarColor: data.avatarColor || '#ff5500',
              targetUniversity: data.targetUniversity || '',
              targetDepartment: data.targetDepartment || '',
              targetExam: data.targetExam || 'YKS 2026 Sayısal',
              studyTrack: data.studyTrack || 'Sayısal',
              dailyGoalHours: data.dailyGoalHours || 6,
              hasCompletedOnboarding: true,
            });
            setProfile(mergedProfile);
          } else {
            // Document doesn't exist yet for this logged in user, create default safely
            const defaultUserData = {
              userId: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Öğrenci',
              name: user.displayName || user.email?.split('@')[0] || 'Öğrenci',
              targetExam: 'YKS 2026 Sayısal',
              studyTrack: 'Sayısal',
              dailyGoalHours: 6,
              streakDays: 1,
              totalFocusMinutes: 0,
              hasCompletedOnboarding: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await setDoc(userDocRef, defaultUserData, { merge: true });
            const mergedProfile = updateStoredProfile(defaultUserData);
            setProfile(mergedProfile);
          }
        } catch (err) {
          console.warn('User profile fetch notice:', err);
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
            setSessions(cloudSessions);
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
            setTasks(cloudTasks);
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
                const cheerData = change.doc.data() as CheerNotification;
                // Only alert if within last 60 seconds
                if (Date.now() - (cheerData.createdAt || 0) < 60000) {
                  soundEngine.playCompletionBell();
                  setIncomingCheer(cheerData);
                  setTimeout(() => {
                    setIncomingCheer((curr) => (curr?.id === cheerData.id ? null : curr));
                  }, 6000);
                }
              }
            });
          },
          () => {
            // ignore
          }
        );

        return () => {
          unsubSessions();
          unsubTasks();
          unsubCheers();
        };
      } else {
        // Visitor is not logged in: Never show onboarding! Show landing page instead.
        setIsOnboardingOpen(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Compute 100% Real Stats & Real Streak
  const realStreak = calculateRealStreak(sessions);
  const realTotalHours = calculateTotalFocusHours(sessions);
  const todayMinutes = calculateTodayMinutes(sessions);

  // Sync computed stats into dynamic profile representation
  const dynamicProfile: UserProfile = {
    ...profile,
    currentStreakDays: realStreak,
    totalFocusHours: realTotalHours,
    todayTotalMinutes: todayMinutes,
  };

  // Sync user status to Firestore for real community visibility (safe setDoc)
  const updateCloudStatus = async (status: 'studying' | 'idle' | 'break', subjectName?: string) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(
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

    if (currentUser) {
      try {
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSession.id);
        await setDoc(sessionDocRef, {
          ...newSession,
          userId: currentUser.uid,
        });

        // Update user's aggregate stats in Firestore (safe setDoc)
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userDocRef,
          {
            status: 'idle',
            currentSubject: '',
            todayTotalMinutes: todayMinutes + Math.round(newSession.completedSeconds / 60),
            totalFocusMinutes: Math.round(realTotalHours * 60 + newSession.completedSeconds / 60),
            streakDays: calculateRealStreak([newSession, ...sessions]),
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
      currentStreakDays: calculateRealStreak([newSession, ...sessions]),
    });
    setProfile(updatedProfile);

    setCurrentTab('stats');
  };

  const handleAbandonSession = () => {
    setIsSessionActive(false);
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
        await setDoc(taskDocRef, newTask);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}/tasks/${newTask.id}`);
      }
    }
  };

  const handleToggleTask = async (taskId: string) => {
    soundEngine.playClick();
    const updated = toggleTaskDone(taskId);
    setTasks(updated);

    const changed = updated.find((t) => t.id === taskId);
    if (currentUser && changed) {
      try {
        const taskDocRef = doc(db, 'users', currentUser.uid, 'tasks', taskId);
        await updateDoc(taskDocRef, {
          isCompleted: changed.isCompleted,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}/tasks/${taskId}`);
      }
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
        await updateDoc(userDocRef, {
          ...updatedData,
          updatedAt: Date.now(),
        });
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
        await setDoc(
          userDocRef,
          {
            ...completeProfileData,
            email: currentUser.email || '',
            userId: currentUser.uid,
            createdAt: Date.now(),
            status: 'idle',
            todayTotalMinutes: 0,
            streakDays: 1,
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
      await updateCloudStatus('idle');
      await signOut(auth);
      setCurrentUser(null);
    } catch {
      // ignore
    }
  };

  const handleAccountDeleted = () => {
    setCurrentUser(null);
    const fresh = getStoredProfile();
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

  // YENİ TARAYICIDA / İLK KEZ SİTEYE GİRİLDİĞİNDE:
  // Onboarding ASLA açılmaz; sağ üstte Giriş Yap ve Kaydol butonları olan Tanıtım Sayfası (LandingPage) gösterilir!
  if (!currentUser) {
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
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          initialMode={authInitialMode}
          onRegistrationSuccess={() => {
            setIsOnboardingOpen(true);
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
          onSelectTab={(tab) => {
            soundEngine.playClick();
            if (tab === 'focus' && currentTab === 'focus' && !isSessionActive) {
              setCurrentActiveMode(null);
            }
            setCurrentTab(tab);
          }}
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

      {/* Main Viewport Content */}
      <main className="flex-1 flex flex-col">
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
            onSessionComplete={handleSessionComplete}
            onAbandonSession={handleAbandonSession}
            onToggleAudioModal={() => setIsAudioModalOpen(true)}
            isAudioPlaying={Boolean(currentAmbientTrack)}
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
                  />
                )}
              </>
            )}

            {currentTab === 'tasks' && (
              <TasksView
                tasks={tasks}
                subjects={subjects}
                studentTrack={dynamicProfile.studyTrack || 'Sayısal'}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onStartTaskWithMode={handleStartTaskWithMode}
              />
            )}

            {currentTab === 'stats' && (
              <StatisticsView sessions={sessions} profile={dynamicProfile} />
            )}

            {currentTab === 'rooms' && (
              <StudentsView
                peers={peers}
                profile={dynamicProfile}
                currentUser={currentUser}
                onCheerPeer={handleCheerPeer}
                isCurrentUserStudying={isSessionActive}
                activeViewTab="rooms"
                onSwitchTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'students' && (
              <StudentsView
                peers={peers}
                profile={dynamicProfile}
                currentUser={currentUser}
                onCheerPeer={handleCheerPeer}
                isCurrentUserStudying={isSessionActive}
                activeViewTab="students"
                onSwitchTab={(tab) => setCurrentTab(tab)}
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
        profile={dynamicProfile}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onAccountDeleted={handleAccountDeleted}
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
          setIsOnboardingOpen(true);
        }}
      />
    </div>
  );
}
