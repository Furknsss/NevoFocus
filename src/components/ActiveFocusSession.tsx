import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  Flame,
  Award,
  Tent,
  Plane,
  Globe2,
  Compass,
  Waves,
  Mountain,
  Trees,
  Bell,
  Coffee,
  Sun,
  Clock,
} from 'lucide-react';
import { FocusModeType, FocusSession, SubjectItem, FlightAirport, FocusTask } from '../types';
import { ActiveForestCanvas } from './visuals/ActiveForestCanvas';
import { ActiveClimbCanvas } from './visuals/ActiveClimbCanvas';
import { ActiveDiveCanvas } from './visuals/ActiveDiveCanvas';
import { WorldMap2DFlight } from './visuals/WorldMap2DFlight';
import { ActiveClockCanvas } from './visuals/ActiveClockCanvas';
import { SpotifyFocusWidget } from './visuals/SpotifyFocusWidget';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { soundEngine } from '../utils/audio';
import { POPULAR_AIRPORTS } from '../utils/airports';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { auth, db, safeSetDoc } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface ActiveFocusSessionProps {
  mode: FocusModeType;
  subject: SubjectItem;
  plannedMinutes: number;
  originAirport?: FlightAirport;
  destAirport?: FlightAirport;
  selectedTaskId?: string;
  selectedTaskTitle?: string;
  timerType?: 'countdown' | 'stopwatch';
  tasksList?: FocusTask[];
  onToggleTaskDone?: (taskId: string) => void;
  onSessionComplete: (session: FocusSession) => void;
  onAbandonSession: (partialSession?: FocusSession) => void;
  onToggleAudioModal: () => void;
  onMinimize?: () => void;
  isAudioPlaying: boolean;
  desktopNotificationsEnabled?: boolean;
  liveNotificationsEnabled?: boolean;
  selectedTreeSpecies?: string;
}

const MOTIVATIONAL_QUOTES = [
  'Derin odaklanma, sıradan anları şahesere dönüştürür.',
  'Şu anda gösterdiğin sabır, gelecekteki en büyük zaferin olacak.',
  'Zirveler sadece tırmanmaktan vazgeçmeyenlerin ayakları altındadır.',
  'Uçuş irtifasına ulaşıldı; hedefine doğru emin adımlarla süzül.',
  'En derin denizler bile cesur dalgıçların önünde sırlarını açar.',
  'Zihnini tek bir hedefe kitle; dünya etrafında dönmeye devam etsin.',
];

const MODE_BREAK_CONFIG: Record<
  FocusModeType,
  {
    buttonIcon: any;
    startLabel: string;
    resumeLabel: string;
    hudTitle: string;
    hudDesc: string;
    themePillBg: string;
    themeActiveBtn: string;
    themeInactiveBtn: string;
    ambientSound: 'campfire' | 'white_noise' | 'waves' | 'forest';
  }
> = {
  climb: {
    buttonIcon: Coffee,
    startLabel: 'Mola Ver',
    resumeLabel: 'Devam Et',
    hudTitle: 'Mola',
    hudDesc: 'Mola veriyorsun.',
    themePillBg: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
    themeActiveBtn: 'bg-amber-500 text-black border-amber-400',
    themeInactiveBtn: 'bg-neutral-900/80 hover:bg-neutral-800 text-amber-400 border-amber-500/40',
    ambientSound: 'campfire',
  },
  flight: {
    buttonIcon: Coffee,
    startLabel: 'Mola Ver',
    resumeLabel: 'Devam Et',
    hudTitle: 'Mola',
    hudDesc: 'Mola veriyorsun.',
    themePillBg: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
    themeActiveBtn: 'bg-amber-500 text-black border-amber-400',
    themeInactiveBtn: 'bg-neutral-900/80 hover:bg-neutral-800 text-amber-400 border-amber-500/40',
    ambientSound: 'white_noise',
  },
  dive: {
    buttonIcon: Coffee,
    startLabel: 'Mola Ver',
    resumeLabel: 'Devam Et',
    hudTitle: 'Mola',
    hudDesc: 'Mola veriyorsun.',
    themePillBg: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
    themeActiveBtn: 'bg-amber-500 text-black border-amber-400',
    themeInactiveBtn: 'bg-neutral-900/80 hover:bg-neutral-800 text-amber-400 border-amber-500/40',
    ambientSound: 'waves',
  },
  forest: {
    buttonIcon: Coffee,
    startLabel: 'Mola Ver',
    resumeLabel: 'Devam Et',
    hudTitle: 'Mola',
    hudDesc: 'Mola veriyorsun.',
    themePillBg: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
    themeActiveBtn: 'bg-amber-500 text-black border-amber-400',
    themeInactiveBtn: 'bg-neutral-900/80 hover:bg-neutral-800 text-amber-400 border-amber-500/40',
    ambientSound: 'forest',
  },
  clock: {
    buttonIcon: Coffee,
    startLabel: 'Mola Ver',
    resumeLabel: 'Devam Et',
    hudTitle: 'Mola',
    hudDesc: 'Mola veriyorsun.',
    themePillBg: 'bg-neutral-900 border-neutral-700 text-neutral-200',
    themeActiveBtn: 'bg-white text-black border-neutral-300',
    themeInactiveBtn: 'bg-neutral-900/80 hover:bg-neutral-800 text-white border-neutral-700',
    ambientSound: 'white_noise',
  },
};

export const ActiveFocusSession: React.FC<ActiveFocusSessionProps> = ({
  mode,
  subject,
  plannedMinutes,
  originAirport = POPULAR_AIRPORTS[0],
  destAirport = POPULAR_AIRPORTS[1],
  selectedTaskId,
  selectedTaskTitle,
  timerType = 'countdown',
  tasksList = [],
  onToggleTaskDone,
  onSessionComplete,
  onAbandonSession,
  onToggleAudioModal,
  onMinimize,
  isAudioPlaying,
  desktopNotificationsEnabled = true,
  liveNotificationsEnabled = false,
  selectedTreeSpecies = 'Meşe Ağacı',
}) => {
  // Check if restoring an active session from localStorage
  const savedState = useMemo(() => {
    try {
      const raw = localStorage.getItem('fokus_active_session_running');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.mode === mode) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }, [mode]);

  const totalSeconds = plannedMinutes * 60;
  const [currentTimerType, setCurrentTimerType] = useState<'countdown' | 'stopwatch'>(() => {
    if (savedState?.timerType) return savedState.timerType;
    return timerType;
  });

  // Calculate elapsed & remaining considering time spent while browser/tab was away
  const wallClockDelta = useMemo(() => {
    if (!savedState || !savedState.lastTickTime) return 0;
    return Math.max(0, Math.round((Date.now() - savedState.lastTickTime) / 1000));
  }, [savedState]);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (savedState) {
      if (savedState.isPaused || savedState.isCampActive) return savedState.secondsRemaining;
      return Math.max(0, savedState.secondsRemaining - wallClockDelta);
    }
    return totalSeconds;
  });

  const [elapsedCountUp, setElapsedCountUp] = useState<number>(() => {
    if (savedState) {
      if (savedState.isPaused || savedState.isCampActive) return savedState.elapsedCountUp;
      return savedState.elapsedCountUp + wallClockDelta;
    }
    return 0;
  });

  // Today's formatted date (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // Today's tasks from user task list
  const todayTasks = useMemo(() => {
    return tasksList.filter((t) => !t.dateString || t.dateString === todayStr);
  }, [tasksList, todayStr]);

  const [isPaused, setIsPaused] = useState<boolean>(() => {
    return savedState ? Boolean(savedState.isPaused) : false;
  });

  const handleTogglePause = () => {
    soundEngine.playClick();
    setIsPaused((prev) => !prev);
  };
  const { isWakeLockActive } = useScreenWakeLock(!isPaused);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<FocusSession | null>(null);

  // Background Notification Preview Modal
  const [isNotificationPreviewOpen, setIsNotificationPreviewOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');

  // THEMATIC BREAK SYSTEM FOR ALL MODES
  const [isCampActive, setIsCampActive] = useState<boolean>(() => {
    return savedState ? Boolean(savedState.isCampActive) : false;
  });
  const [breakSeconds, setBreakSeconds] = useState<number>(() => {
    if (savedState) {
      if (!savedState.isPaused && savedState.isCampActive) {
        return (savedState.breakSeconds || 0) + wallClockDelta;
      }
      return savedState.breakSeconds || 0;
    }
    return 0;
  });
  const [breakCount, setBreakCount] = useState<number>(() => {
    return savedState?.breakCount || 0;
  });

  const breakConfig = MODE_BREAK_CONFIG[mode] || MODE_BREAK_CONFIG.climb;
  const BreakIcon = breakConfig.buttonIcon;

  // FLIGHT 3D GLOBE / COCKPIT TOGGLE
  const [flightViewMode, setFlightViewMode] = useState<'cockpit' | 'globe'>('globe');

  // Mini task checklist: ONLY when stopwatch is active
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [clockStyle, setClockStyle] = useState<'ipad' | 'flip'>('ipad');

  // Today's date formatted in Turkish (e.g. 18 Ekim 2026 Pazar)
  const todayFormattedTurkish = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const days = [
      'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
    ];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()} ${days[d.getDay()]}`;
  }, []);

  const quoteRef = useRef(
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  const startTimeRef = useRef(savedState?.startTime || Date.now());
  const lastTickTimeRef = useRef(Date.now());
  const lastCloudSyncRef = useRef<number>(0);
  const lastPausedRef = useRef<boolean>(isPaused);
  const lastCampRef = useRef<boolean>(isCampActive);

  // Check Notification permission support on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    } else {
      setPermissionState('unsupported');
    }
  }, []);

  const handleRequestNotificationPermission = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
      } catch {
        // ignore
      }
    }
  };

  const elapsedSeconds = currentTimerType === 'stopwatch' ? elapsedCountUp : (totalSeconds - secondsRemaining);
  const progress = Math.min(1, Math.max(0, elapsedSeconds / totalSeconds));

  const displayMins = currentTimerType === 'stopwatch' ? Math.floor(elapsedCountUp / 60) : Math.floor(secondsRemaining / 60);
  const displaySecs = currentTimerType === 'stopwatch' ? (elapsedCountUp % 60) : (secondsRemaining % 60);
  const timeFormatted = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(2, '0')}`;

  // Page Title Live Sync for Background Tab Viewing
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `(${timeFormatted}) ${subject.name} | Fokus Premium`;

    return () => {
      document.title = originalTitle;
    };
  }, [timeFormatted, subject.name]);

  // Delta-based Wall-Clock Precision Timer
  useEffect(() => {
    if (showCompletionModal) return;

    lastTickTimeRef.current = Date.now();

    const interval = window.setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.round((now - lastTickTimeRef.current) / 1000);

      if (deltaSeconds >= 1) {
        lastTickTimeRef.current = now;

        if (isCampActive) {
          setBreakSeconds((prev) => prev + deltaSeconds);
        } else if (!isPaused) {
          setElapsedCountUp((prev) => prev + deltaSeconds);

          if (currentTimerType === 'countdown') {
            setSecondsRemaining((prev) => {
              if (prev <= deltaSeconds) {
                window.clearInterval(interval);
                handleFinish(true);
                return 0;
              }
              return prev - deltaSeconds;
            });
          }
        }
      }
    }, 1000);

    // Document Visibility / Tab Switching Listener
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When user returns to tab, resync delta immediately
        const now = Date.now();
        const delta = Math.round((now - lastTickTimeRef.current) / 1000);
        if (delta > 1) {
          lastTickTimeRef.current = now;
          if (isCampActive) {
            setBreakSeconds((prev) => prev + delta);
          } else if (!isPaused) {
            setElapsedCountUp((prev) => prev + delta);
            if (currentTimerType === 'countdown') {
              setSecondsRemaining((prev) => {
                if (prev <= delta) {
                  handleFinish(true);
                  return 0;
                }
                return prev - delta;
              });
            }
          }
        }
      } else {
        // Tab went to background: if notification enabled in settings and permission granted
        if (
          (liveNotificationsEnabled || desktopNotificationsEnabled) &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          !isPaused
        ) {
          try {
            new Notification('Fokus Premium · Odaklanma Devam Ediyor ⏳', {
              body: `${subject.name} seansı (${timeFormatted} kaldı) arka planda aktif tutuluyor.`,
              icon: '/favicon.ico',
              silent: true,
            });
          } catch {
            // ignore
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPaused, isCampActive, showCompletionModal, currentTimerType, timeFormatted, subject.name]);

  const toggleThematicBreak = () => {
    soundEngine.playClick();
    if (!isCampActive) {
      setIsCampActive(true);
      setBreakCount((prev) => prev + 1);
      if (breakConfig.ambientSound) {
        soundEngine.playAmbient(breakConfig.ambientSound);
      }
    } else {
      setIsCampActive(false);
    }
  };

  // Continuous sync to localStorage so if tab is closed or reloaded, state is preserved
  useEffect(() => {
    if (showCompletionModal) return;
    try {
      const stateToPersist = {
        mode,
        subject,
        plannedMinutes,
        timerType: currentTimerType,
        originAirport,
        destAirport,
        selectedTaskId,
        selectedTaskTitle,
        selectedTreeSpecies,
        startTime: startTimeRef.current,
        lastTickTime: Date.now(),
        elapsedCountUp,
        secondsRemaining,
        breakSeconds,
        breakCount,
        isCampActive,
        isPaused,
      };
      localStorage.setItem('fokus_active_session_running', JSON.stringify(stateToPersist));

      // Sync active session to Firestore for cross-device tablet <-> phone sync
      const userId = auth.currentUser?.uid;
      if (userId) {
        const now = Date.now();
        if (
          now - lastCloudSyncRef.current > 4000 ||
          isPaused !== lastPausedRef.current ||
          isCampActive !== lastCampRef.current
        ) {
          lastCloudSyncRef.current = now;
          lastPausedRef.current = isPaused;
          lastCampRef.current = isCampActive;
          const cloudPayload = {
            mode,
            subject,
            plannedMinutes,
            startedAt: startTimeRef.current,
            elapsedSeconds,
            isPaused,
            isCampActive,
            breakSeconds,
            timerType: currentTimerType,
            selectedTreeSpecies: selectedTreeSpecies || null,
            originAirport: originAirport || null,
            destAirport: destAirport || null,
            selectedTaskId: selectedTaskId || null,
            selectedTaskTitle: selectedTaskTitle || null,
            updatedAt: now,
          };
          safeSetDoc(doc(db, 'users', userId, 'active_focus', 'current'), cloudPayload, { merge: true }).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }, [
    mode,
    subject,
    plannedMinutes,
    currentTimerType,
    originAirport,
    destAirport,
    selectedTaskId,
    selectedTaskTitle,
    selectedTreeSpecies,
    elapsedCountUp,
    secondsRemaining,
    elapsedSeconds,
    breakSeconds,
    breakCount,
    isCampActive,
    isPaused,
    showCompletionModal,
  ]);

  const handleFinish = (isCompletedNaturally: boolean) => {
    soundEngine.playCompletionBell();

    // Clear background running session state locally and in cloud
    try {
      localStorage.removeItem('fokus_active_session_running');
      const userId = auth.currentUser?.uid;
      if (userId) {
        deleteDoc(doc(db, 'users', userId, 'active_focus', 'current')).catch(() => {});
      }
    } catch {
      // ignore
    }

    if (isCompletedNaturally) {
      try {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#ff5500', '#10b981', '#38bdf8', '#fbbf24', '#ffffff'],
        });
      } catch {
        // ignore
      }
    }

    const now = new Date();
    const startD = new Date(startTimeRef.current);
    const pad = (n: number) => String(n).padStart(2, '0');

    // Calculate actual worked seconds accurately (erken bitirmede net süre esas alınır):
    const actualCompletedSeconds = Math.max(
      10,
      currentTimerType === 'stopwatch'
        ? elapsedCountUp
        : Math.min(totalSeconds, totalSeconds - secondsRemaining)
    );
    const actualCompletedMinutes = Math.max(1, Math.round(actualCompletedSeconds / 60));

    const resolvedSubjectName = selectedTaskTitle
      ? subject.name
      : (!selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock')
      ? 'Serbest Çalışma'
      : subject.name;

    const resolvedSubjectColor = (!selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock')
      ? '#6366f1'
      : subject.color;

    const session: FocusSession = {
      id: `session-${Date.now()}`,
      mode,
      subjectId: (!selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock') ? 'sub-serbest-calisma' : subject.id,
      subjectName: resolvedSubjectName,
      subjectColor: resolvedSubjectColor,
      plannedMinutes,
      completedSeconds: actualCompletedSeconds,
      breakSeconds,
      completed: isCompletedNaturally,
      timestamp: Date.now(),
      dateString: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      startTimeString: `${pad(startD.getHours())}:${pad(startD.getMinutes())}`,
      endTimeString: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      note: selectedTaskTitle || `${resolvedSubjectName} seansı (${actualCompletedMinutes} dk çalışıldı)`,
      taskId: selectedTaskId,
      taskTitle: selectedTaskTitle,
      flightInfo:
        mode === 'flight'
          ? {
              origin: `${originAirport.city} (${originAirport.code})`,
              destination: `${destAirport.city} (${destAirport.code})`,
              flightCode: `FK-${Math.floor(200 + Math.random() * 700)}`,
              seat: '12A',
            }
          : undefined,
      climbInfo:
        mode === 'climb'
          ? {
              peakName: 'Kaçkar Zirvesi (3,937m)',
              campsSet: breakCount > 0 ? breakCount : isCampActive ? 1 : 0,
              flagPlanted: isCompletedNaturally,
            }
          : undefined,
      diveInfo:
        mode === 'dive'
          ? {
              fishCityReached: isCompletedNaturally,
              depthMeters: 1000,
            }
          : undefined,
      forestInfo:
        mode === 'forest'
          ? {
              treeSpecies: selectedTreeSpecies,
              treeLevel: Math.min(5, Math.floor(plannedMinutes / 20) + 1),
            }
          : undefined,
    };

    // When naturally finished, if a task was attached to this session, mark it completed!
    if (isCompletedNaturally && selectedTaskId && onToggleTaskDone) {
      const target = tasksList.find((t) => t.id === selectedTaskId);
      if (target && !target.isCompleted) {
        onToggleTaskDone(selectedTaskId);
      }
    }

    setCompletedSessionData(session);
    setShowCompletionModal(true);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleToggleTodayTask = (taskId: string) => {
    soundEngine.playClick();
    if (onToggleTaskDone) {
      onToggleTaskDone(taskId);
    }
  };

  const handleConfirmAbandon = () => {
    soundEngine.playClick();
    setShowAbandonModal(false);

    try {
      localStorage.removeItem('fokus_active_session_running');
      const userId = auth.currentUser?.uid;
      if (userId) {
        deleteDoc(doc(db, 'users', userId, 'active_focus', 'current')).catch(() => {});
      }
    } catch {
      // ignore
    }

    const now = new Date();
    const startD = new Date(startTimeRef.current);
    const pad = (n: number) => String(n).padStart(2, '0');

    // Save actual worked seconds accurately without faking full completion
    const partialSession: FocusSession = {
      id: `session-${Date.now()}`,
      mode,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      plannedMinutes,
      completedSeconds: elapsedSeconds,
      breakSeconds,
      completed: false, // Incomplete session saved accurately
      timestamp: Date.now(),
      dateString: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      startTimeString: `${pad(startD.getHours())}:${pad(startD.getMinutes())}`,
      endTimeString: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      note: selectedTaskTitle || `${subject.name} seansı (Vazgeçildi: ${Math.round(elapsedSeconds / 60)} dk)`,
      taskId: selectedTaskId,
      taskTitle: selectedTaskTitle,
      flightInfo:
        mode === 'flight'
          ? {
              origin: `${originAirport.city} (${originAirport.code})`,
              destination: `${destAirport.city} (${destAirport.code})`,
              flightCode: `TK-101`,
              seat: '12A',
            }
          : undefined,
      climbInfo:
        mode === 'climb'
          ? {
              peakName: 'Kaçkar Zirvesi (3,937m)',
              campsSet: breakCount > 0 ? breakCount : isCampActive ? 1 : 0,
              flagPlanted: false,
            }
          : undefined,
      diveInfo:
        mode === 'dive'
          ? {
              fishCityReached: false,
              depthMeters: Math.round(1000 * progress),
            }
          : undefined,
      forestInfo:
        mode === 'forest'
          ? {
              treeSpecies: selectedTreeSpecies,
              treeLevel: Math.max(1, Math.floor(progress * 5)),
            }
          : undefined,
    };

    onAbandonSession(partialSession);
  };

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 w-full h-full min-h-[100dvh] max-h-[100dvh] bg-black overflow-hidden flex flex-col justify-between select-none">
      {/* Sol Üstte Zarif Spotify Widget (Canlı Müzik Çaları) */}
      <SpotifyFocusWidget />

      {/* Visual Canvas Backdrop - Fullscreen edge-to-edge */}
      <div className="absolute inset-0 z-0 w-full h-full overflow-hidden">
        {mode === 'forest' && (
          <ActiveForestCanvas
            progress={progress}
            isPaused={isPaused}
            isCampActive={isCampActive}
            elapsedSeconds={elapsedSeconds}
            treeSpecies={selectedTreeSpecies}
          />
        )}
        {mode === 'climb' && (
          <ActiveClimbCanvas
            progress={progress}
            isPaused={isPaused}
            isCampActive={isCampActive}
            elapsedSeconds={elapsedSeconds}
            breakSeconds={breakSeconds}
          />
        )}
        {mode === 'flight' && (
          <WorldMap2DFlight
            origin={originAirport}
            destination={destAirport}
            progress={progress}
            isFlightActive={!isPaused && !isCampActive}
            onCompleteLanding={() => handleFinish(true)}
          />
        )}
        {mode === 'dive' && (
          <ActiveDiveCanvas
            progress={progress}
            isPaused={isPaused}
            isCampActive={isCampActive}
            elapsedSeconds={elapsedSeconds}
          />
        )}
        {mode === 'clock' && (
          <ActiveClockCanvas
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onFinish={() => handleFinish(true)}
            onAbandon={() => setShowAbandonModal(true)}
            onTakeBreak={toggleThematicBreak}
            isBreakActive={isCampActive}
            breakSeconds={breakSeconds}
            timerType={currentTimerType}
            remainingSeconds={secondsRemaining}
            clockStyle={clockStyle}
            onToggleClockStyle={setClockStyle}
          />
        )}
      </div>

      {/* Top Floating Info Bar (Clean Non-Overlapping Header) */}
      <div className="relative z-30 w-full px-4 sm:px-8 pt-4 sm:pt-6 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Left: Mode Title & Subject Badge OR Clean Date for Clock Mode */}
        <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${mode === 'clock' ? 'pl-14 sm:pl-16' : ''}`}>
          {mode === 'clock' ? (
            /* Sol Üstte Sadece Günün Tarihi (Kullanıcı Talebi: Dijital Saat yazısı kaldırıldı, örn: 18 Ekim 2026 Pazar) */
            <span className="text-xs sm:text-sm font-medium text-neutral-400 select-none tracking-wide">
              {todayFormattedTurkish}
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs sm:text-sm font-bold shadow-lg">
                {mode === 'forest' && <Trees className="w-4 h-4 text-emerald-400" />}
                {mode === 'climb' && <Mountain className="w-4 h-4 text-orange-400" />}
                {mode === 'flight' && <Plane className="w-4 h-4 text-sky-400" />}
                {mode === 'dive' && <Waves className="w-4 h-4 text-teal-400" />}
                <span className="capitalize">
                  {mode === 'forest'
                    ? `Kadim Orman (${selectedTreeSpecies})`
                    : mode === 'climb'
                    ? 'Dağcı Kampı'
                    : mode === 'flight'
                    ? 'Focus Flight 2D'
                    : 'Derin Dalış'}
                </span>
              </div>

              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-lg text-white"
                style={{ backgroundColor: `${subject.color}33`, borderColor: subject.color, borderWidth: 1 }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
                <span>{subject.name}</span>
              </div>
            </>
          )}
        </div>

        {/* Center: Clock Style Switcher (Kronometre vs Flip Clock) - Doğrudan tıklanır, saat kaldığı yerden canlı devam eder */}
        {mode === 'clock' && (
          <div className="inline-flex p-1 rounded-full bg-neutral-900/90 border border-neutral-800 backdrop-blur-xl shadow-2xl">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setClockStyle('ipad');
              }}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                clockStyle === 'ipad'
                  ? 'bg-neutral-800 text-white shadow-md border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ⏱️ Kronometre
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setClockStyle('flip');
              }}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                clockStyle === 'flip'
                  ? 'bg-neutral-800 text-white shadow-md border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Flip Clock
            </button>
          </div>
        )}

        {/* Right: Quick Action Controls (Görevler, Audio, ve SADECE BİR TANE Büyüt/Küçült Butonu) */}
        <div className="flex items-center gap-2">
          {/* Görevler Button */}
          <button
            type="button"
            onClick={() => setShowTasksPanel(!showTasksPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showTasksPanel
                ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-md shadow-sky-950/40'
                : 'bg-black/60 border-white/10 text-neutral-300 hover:text-white hover:bg-black/80'
            }`}
            title="Günün Görevleri"
          >
            <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Görevler</span>
            {todayTasks.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-neutral-800 text-[10px] text-neutral-300 font-mono">
                {todayTasks.filter((t) => t.isCompleted).length}/{todayTasks.length}
              </span>
            )}
          </button>

          {/* Audio trigger */}
          <button
            onClick={onToggleAudioModal}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              isAudioPlaying
                ? 'bg-[#ff5500]/20 border-[#ff5500]/60 text-[#ff5500]'
                : 'bg-black/50 border-white/10 text-neutral-300 hover:text-white hover:bg-black/80'
            }`}
            title="Zen Ortam Sesi"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* SADECE BİR TUŞ: Büyütüldüğünde küçült tuşu, küçültüldüğünde büyüt tuşu (Kullanıcı Talebi) */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-full bg-black/50 border border-white/10 text-neutral-300 hover:text-white hover:bg-black/80 transition-all cursor-pointer"
            title={isFullscreen ? 'Küçült' : 'Büyüt'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ACTIVE BREAK HUD BANNER */}
      {isCampActive && (
        <div className="relative z-20 w-full max-w-sm mx-auto px-4 mt-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 rounded-2xl border border-amber-500/40 bg-black/85 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Coffee className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white">Mola Verildi</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-amber-300 border border-amber-500/30 shrink-0">
                    {breakCount}. Mola
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-mono font-bold text-amber-300">
                {String(Math.floor(breakSeconds / 60)).padStart(2, '0')}:{String(breakSeconds % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={toggleThematicBreak}
                className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-black transition-all cursor-pointer shadow-sm"
              >
                Molayı Bitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Focus Timer Display */}
      {mode !== 'clock' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center">
            <div className="relative flex items-center justify-center p-6 sm:p-10 rounded-full">
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-25 transition-all"
                style={{
                  backgroundColor:
                    mode === 'forest'
                      ? '#10b981'
                      : mode === 'climb'
                      ? '#f97316'
                      : mode === 'flight'
                      ? '#38bdf8'
                      : '#2dd4bf',
                }}
              />

              <div className="text-center">
                {/* Task name header if attached */}
                {selectedTaskTitle && (
                  <div className="mb-2 text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-3 py-1 rounded-full inline-block backdrop-blur-sm">
                    {selectedTaskTitle}
                  </div>
                )}

                <div className="font-mono text-6xl sm:text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] tabular-nums">
                  {timeFormatted}
                </div>

                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setCurrentTimerType((prev) => (prev === 'countdown' ? 'stopwatch' : 'countdown'));
                    }}
                    className="text-xs sm:text-sm font-semibold tracking-wide text-neutral-300 bg-black/60 hover:bg-black/80 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all pointer-events-auto"
                    title="Sayaç ve kronometre arasında geçiş yap"
                  >
                    <span>{currentTimerType === 'stopwatch' ? '⏱️ Kronometre' : '⏳ Geri Sayım'}</span>
                    <span className="text-neutral-500">·</span>
                    <span>
                      {isCampActive
                        ? '⛺ Kamp Molası Aktif'
                        : isPaused
                        ? '⏸ Duraklatıldı'
                        : `%${Math.round(progress * 100)}`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-3 max-w-lg text-center text-xs sm:text-sm text-neutral-300/80 italic font-medium px-4 py-1.5 rounded-xl bg-black/40 backdrop-blur-sm">
              "{quoteRef.current}"
            </p>
          </div>
        </div>
      )}

      {/* Floating Task Drawer */}
      {showTasksPanel && (
        <div className="absolute right-4 sm:right-8 top-20 z-20 w-80 max-w-[90vw] p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl text-left pointer-events-auto">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Günün Görevleri</span>
            </h4>
            <span className="text-[10px] text-neutral-400 font-mono">
              {todayTasks.filter((t) => t.isCompleted).length}/{todayTasks.length} tamamlandı
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {todayTasks.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-4">Bugün için görev bulunmuyor.</p>
            ) : (
              todayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onToggleTaskDone && onToggleTaskDone(task.id)}
                  className={`w-full p-2 rounded-xl text-left text-xs transition-all flex items-center gap-2 cursor-pointer ${
                    task.isCompleted
                      ? 'bg-emerald-950/30 text-emerald-400 line-through border border-emerald-900/40'
                      : 'bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800 border border-white/5'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-neutral-600'
                    }`}
                  >
                    {task.isCompleted && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="truncate">{task.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Action Bar: Sadece [ Mola Ver ] [ Tamamla ] [ Vazgeç ] */}
      {mode !== 'clock' && (
        <div className="relative z-10 w-full px-4 sm:px-8 pb-6 sm:pb-8 flex items-center justify-center gap-3 sm:gap-4 pointer-events-auto flex-wrap pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* 1. Mola Ver / Devam Et */}
          <button
            type="button"
            onClick={toggleThematicBreak}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all shadow-lg cursor-pointer border backdrop-blur-md ${
              isCampActive
                ? 'bg-amber-500 text-black border-amber-400 shadow-amber-500/25 animate-pulse'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 border-amber-500/30 hover:border-amber-500/50'
            }`}
          >
            <Coffee className="w-4 h-4" />
            <span>{isCampActive ? 'Devam Et' : 'Mola Ver'}</span>
          </button>

          {/* 2. Tamamla */}
          <button
            type="button"
            onClick={() => handleFinish(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-sm font-bold transition-all backdrop-blur-md cursor-pointer shadow-lg shadow-emerald-950/40"
            title="Seansı Başarıyla Tamamla"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Tamamla</span>
          </button>

          {/* 3. Vazgeç */}
          <button
            type="button"
            onClick={() => setShowAbandonModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-black/60 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-sm font-semibold transition-all backdrop-blur-md cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Vazgeç</span>
          </button>
        </div>
      )}

      {/* Abandon Modal */}
      {showAbandonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Seansı Sonlandır?</h3>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              {mode === 'forest' && 'Seansı erken bitirirsen fidanın kuruyabilir!'}
              {mode === 'climb' && 'Zirveye bu kadar yaklaşmışken ana kampa dönmek istediğine emin misin?'}
              {mode === 'flight' && 'Uçuş rotası tamamlanmadan iniş yapmak üzeresin.'}
              {mode === 'dive' && 'Balık Şehri\'ne ulaşmadan su yüzeyine dönmek istediğine emin misin?'}
              {mode === 'clock' && 'Kronometre çalışma seansını sonlandırmak istediğine emin misin?'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAbandonModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Odaklanmaya Devam Et
              </button>
              <button
                onClick={() => {
                  setShowAbandonModal(false);
                  onAbandonSession();
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-xs font-bold text-red-400 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebration & Completion Modal */}
      {showCompletionModal && completedSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200 pointer-events-auto">
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/30 bg-[#12161a] p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-4 text-black shadow-lg shadow-emerald-500/30">
              <Award className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h2 className="text-2xl font-black text-white mb-1">
              Harika İş! Seans Tamamlandı 🎉
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 mb-6">
              {mode === 'forest' && '🌳 Kadim bir ağaç tamamlandı ve sanal ormanına eklendi!'}
              {mode === 'climb' && '🚩 Zirveye ulaştın ve Zafer Bayrağını diktin!'}
              {mode === 'flight' && `🛬 ${destAirport.city} (${destAirport.code}) Havalimanına başarıyla inildi!`}
              {mode === 'dive' && '🏰 Balık Şehri\'ne ulaşıldı ve sualtı sarayına giriş yapıldı!'}
              {mode === 'clock' && '⏱️ Dijital saat çalışma seansın başarıyla kaydedildi!'}
            </p>

            {/* Recap */}
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 mb-6 text-left">
              <div>
                <span className="text-[11px] text-neutral-400">Ders / Alan</span>
                <p className="text-sm font-bold text-white truncate">
                  {completedSessionData?.subjectName || (selectedTaskTitle ? subject.name : 'Serbest Çalışma')}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400">Net Süre</span>
                <p className="text-sm font-bold text-emerald-400 font-mono">
                  {Math.round(completedSessionData.completedSeconds / 60)} dk
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400">Mola Süresi</span>
                <p className="text-sm font-bold text-amber-400 font-mono">
                  {Math.round(breakSeconds / 60)} dk
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onSessionComplete(completedSessionData);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff6600] text-white font-bold text-sm shadow-xl shadow-[#ff5500]/25 hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>İstatistiklere Kaydet & Devam Et</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Background Notification Preview Modal */}
      <NotificationPreviewModal
        isOpen={isNotificationPreviewOpen}
        onClose={() => setIsNotificationPreviewOpen(false)}
        onRequestPermission={handleRequestNotificationPermission}
        permissionState={permissionState}
        currentRemainingFormatted={timeFormatted}
        currentSubject={subject.name}
      />
    </div>
  );
};
