import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  Volume2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  Award,
  Plane,
  Waves,
  Mountain,
  Trees,
  Bell,
  Coffee,
} from 'lucide-react';
import { FocusModeType, FocusSession, SubjectItem, FlightAirport, FocusTask } from '../types';
import { ActiveForestCanvas } from './visuals/ActiveForestCanvas';
import { ActiveClimbCanvas } from './visuals/ActiveClimbCanvas';
import { ActiveDiveCanvas } from './visuals/ActiveDiveCanvas';
import { WorldMap2DFlight } from './visuals/WorldMap2DFlight';
import { ActiveClockCanvas } from './visuals/ActiveClockCanvas';
import { isNativeFocusAvailable, nativeFocus } from '../services/nativeFocus';
import { isTwaFocusPage } from '../services/twaFocusBridge';
import { elapsedSecondsAtTransition } from '../utils/focusTimerTransitions';
import { SpotifyFocusWidget } from './visuals/SpotifyFocusWidget';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { soundEngine } from '../utils/audio';
import { POPULAR_AIRPORTS } from '../utils/airports';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { auth, db, safeSetDoc, parseNumericField } from '../firebase';
import { doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import {
  getLocalDateString,
  getCurrentWeekKey,
  getCurrentMonthKey,
  calculateTodayMinutes,
  calculateWeeklyMinutes,
  calculateMonthlyStatsSummary,
  calculateTotalFocusHours,
} from '../utils/stats';
import { saveSession, getStoredSessions } from '../utils/storage';
import {
  backgroundFocus,
  getDeviceId,
  getDeviceName,
  formatTimerDisplay,
  LiveNotificationPayload,
  markSessionTerminated,
  isSessionTerminated,
} from '../utils/backgroundFocus';

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
  onOpenSettingsConnections?: () => void;
}

const MOTIVATIONAL_QUOTES = [
  'Derin odaklanma, sıradan anları şahesere dönüştürür.',
  'Şu anda gösterdiğin sabır, gelecekteki en büyük zaferin olacak.',
  'Zirveler sadece tırmanmaktan vazgeçmeyenlerin ayakları altındadır.',
  'Uçuş irtifasına ulaşıldı; hedefine doğru emin adımlarla süzül.',
  'En derin denizler bile cesur dalgıçların önünde sırlarını açar.',
  'Zihnini tek bir hedefe kitle; dünya etrafında dönmeye devam etsin.',
];

const MODE_LABELS: Record<FocusModeType, string> = {
  forest: 'Kadim Orman',
  climb: 'Dağcı Kampı',
  flight: 'Focus Flight',
  dive: 'Derin Dalış',
  clock: 'Dijital Saat',
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
  selectedTreeSpecies = 'Meşe Ağacı',
  onOpenSettingsConnections,
}) => {
  const myDeviceId = useMemo(() => getDeviceId(), []);
  const myDeviceName = useMemo(() => getDeviceName(), []);

  // Load persisted active session state from localStorage
  const savedState = useMemo(() => {
    try {
      const raw = localStorage.getItem('fokus_active_session_running');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const startT = parsed?.startTime || parsed?.anchorTimestamp || 0;
      if (parsed?.isFinished || parsed?.isActive === false || isSessionTerminated(startT)) {
        localStorage.removeItem('fokus_active_session_running');
        return null;
      }
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

  // Wall-Clock Anchor Refs for zero-drift background & cross-device synchronization
  const startTimeRef = useRef<number>(savedState?.startTime || Date.now());
  const anchorTimestampRef = useRef<number>(
    savedState?.anchorTimestamp || savedState?.lastTickTime || Date.now()
  );
  const accumulatedFocusSecondsRef = useRef<number>(
    typeof savedState?.accumulatedFocusSeconds === 'number'
      ? savedState.accumulatedFocusSeconds
      : savedState?.elapsedCountUp || 0
  );
  const breakAnchorTimestampRef = useRef<number>(
    savedState?.breakAnchorTimestamp || savedState?.lastTickTime || Date.now()
  );
  const accumulatedBreakSecondsRef = useRef<number>(
    typeof savedState?.accumulatedBreakSeconds === 'number'
      ? savedState.accumulatedBreakSeconds
      : savedState?.breakSeconds || 0
  );

  const [isPaused, setIsPaused] = useState<boolean>(() => Boolean(savedState?.isPaused));
  const [isCampActive, setIsCampActive] = useState<boolean>(() => Boolean(savedState?.isCampActive));
  const [breakCount, setBreakCount] = useState<number>(() => savedState?.breakCount || 0);
  const [clockStyle, setClockStyle] = useState<'ipad' | 'flip'>(() => savedState?.clockStyle || 'ipad');

  const isPausedRef = useRef<boolean>(isPaused);
  const isCampActiveRef = useRef<boolean>(isCampActive);
  isPausedRef.current = isPaused;
  isCampActiveRef.current = isCampActive;

  const computeCurrentFocusSeconds = useCallback(() => {
    if (isPausedRef.current || isCampActiveRef.current) {
      return accumulatedFocusSecondsRef.current;
    }
    const delta = Math.max(0, Math.floor((Date.now() - anchorTimestampRef.current) / 1000));
    return accumulatedFocusSecondsRef.current + delta;
  }, []);

  const computeCurrentBreakSeconds = useCallback(() => {
    if (!isCampActiveRef.current || isPausedRef.current) {
      return accumulatedBreakSecondsRef.current;
    }
    const delta = Math.max(0, Math.floor((Date.now() - breakAnchorTimestampRef.current) / 1000));
    return accumulatedBreakSecondsRef.current + delta;
  }, []);

  const [elapsedCountUp, setElapsedCountUp] = useState<number>(() => computeCurrentFocusSeconds());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    Math.max(0, totalSeconds - computeCurrentFocusSeconds())
  );
  const [breakSeconds, setBreakSeconds] = useState<number>(() => computeCurrentBreakSeconds());

  // Today's formatted local date (YYYY-MM-DD)
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const todayTasks = useMemo(() => {
    return tasksList.filter((t) => {
      if (t.dateString) return t.dateString === todayStr;
      if (t.createdAt) {
        const td = new Date(t.createdAt);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${td.getFullYear()}-${pad(td.getMonth() + 1)}-${pad(td.getDate())}` === todayStr;
      }
      return false;
    });
  }, [tasksList, todayStr]);

  const { isWakeLockActive: _wakeLock } = useScreenWakeLock(!isPaused);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<FocusSession | null>(null);
  const isSessionEndedRef = useRef<boolean>(false);

  // Background Notification Preview Modal
  const [isNotificationPreviewOpen, setIsNotificationPreviewOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [nativeBridgeWarning, setNativeBridgeWarning] = useState<string | null>(null);
  const [showTasksPanel, setShowTasksPanel] = useState(false);

  // Today's date formatted in Turkish
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

  // Live Wall Clock Time
  const [wallClockTime, setWallClockTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setWallClockTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const quoteRef = useRef(
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );
  const lastCloudSyncRef = useRef<number>(0);

  const getEffectiveUid = useCallback(() => {
    return (
      auth.currentUser?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null)
    );
  }, []);

  // Persist state immediately to localStorage and optionally force-sync to Firestore
  const persistSessionState = useCallback(
    (forceCloudSync = false) => {
      if (
        showCompletionModal ||
        isSessionEndedRef.current ||
        isSessionTerminated(startTimeRef.current)
      ) {
        return;
      }
      const now = Date.now();
      const currentFocusSecs = computeCurrentFocusSeconds();
      const currentBreakSecs = computeCurrentBreakSeconds();
      const currentRemSecs = Math.max(0, totalSeconds - currentFocusSecs);

      const stateToPersist = {
        isActive: true,
        isFinished: false,
        deviceId: myDeviceId,
        deviceName: myDeviceName,
        mode,
        subject,
        plannedMinutes,
        timerType: currentTimerType,
        clockStyle,
        originAirport,
        destAirport,
        selectedTaskId,
        selectedTaskTitle,
        selectedTreeSpecies,
        startTime: startTimeRef.current,
        anchorTimestamp: anchorTimestampRef.current,
        accumulatedFocusSeconds: accumulatedFocusSecondsRef.current,
        breakAnchorTimestamp: breakAnchorTimestampRef.current,
        accumulatedBreakSeconds: accumulatedBreakSecondsRef.current,
        lastTickTime: now,
        elapsedCountUp: currentFocusSecs,
        secondsRemaining: currentRemSecs,
        breakSeconds: currentBreakSecs,
        breakCount,
        isCampActive: isCampActiveRef.current,
        isPaused: isPausedRef.current,
      };

      try {
        localStorage.setItem('fokus_active_session_running', JSON.stringify(stateToPersist));
      } catch {
        // ignore
      }

      const userId = getEffectiveUid();
      if (userId && (forceCloudSync || now - lastCloudSyncRef.current > 4000)) {
        lastCloudSyncRef.current = now;
        const cloudPayload = {
          deviceId: myDeviceId,
          deviceName: myDeviceName,
          lastUpdatedByDeviceId: myDeviceId,
          mode,
          subject,
          plannedMinutes,
          startedAt: startTimeRef.current,
          anchorTimestamp: anchorTimestampRef.current,
          accumulatedFocusSeconds: accumulatedFocusSecondsRef.current,
          breakAnchorTimestamp: breakAnchorTimestampRef.current,
          accumulatedBreakSeconds: accumulatedBreakSecondsRef.current,
          elapsedSeconds: currentFocusSecs,
          isPaused: isPausedRef.current,
          isCampActive: isCampActiveRef.current,
          breakSeconds: currentBreakSecs,
          breakCount,
          timerType: currentTimerType,
          selectedTreeSpecies: selectedTreeSpecies || null,
          originAirport: originAirport || null,
          destAirport: destAirport || null,
          selectedTaskId: selectedTaskId || null,
          selectedTaskTitle: selectedTaskTitle || null,
          updatedAt: now,
          isFinished: false,
        };
        safeSetDoc(doc(db, 'users', userId, 'active_focus', 'current'), cloudPayload, { merge: true }).catch(() => {});

        const liveSubjectLabel = selectedTaskTitle
          ? `${subject.name} · ${selectedTaskTitle}`
          : mode === 'clock' && !selectedTaskId
          ? 'Serbest Çalışma'
          : subject.name;

        const storedSessions = getStoredSessions();
        const baseToday = calculateTodayMinutes(storedSessions);
        const baseWeekly = calculateWeeklyMinutes(storedSessions);
        const monthlySummary = calculateMonthlyStatsSummary(storedSessions);
        const baseTotalMins = Math.round(calculateTotalFocusHours(storedSessions) * 60);
        const liveExtraMins = Math.floor(currentFocusSecs / 60);

        safeSetDoc(
          doc(db, 'users', userId),
          {
            status: isCampActiveRef.current || isPausedRef.current ? 'break' : 'studying',
            currentSubject: liveSubjectLabel,
            currentMode: mode,
            currentSeconds: currentFocusSecs,
            todayDateString: getLocalDateString(new Date()),
            weekDateString: getCurrentWeekKey(new Date()),
            monthDateString: getCurrentMonthKey(new Date()),
            baseTodayMinutes: baseToday,
            todayTotalMinutes: baseToday + liveExtraMins,
            baseWeeklyMinutes: baseWeekly,
            weeklyTotalMinutes: baseWeekly + liveExtraMins,
            baseMonthlyMinutes: monthlySummary.monthlyMinutes,
            monthlyTotalMinutes: monthlySummary.monthlyMinutes + liveExtraMins,
            monthlySessionsCount: monthlySummary.monthlySessionsCount,
            monthlyActiveDays: Math.max(1, monthlySummary.monthlyActiveDays),
            favoriteSubject: monthlySummary.favoriteSubject || liveSubjectLabel,
            totalFocusMinutes: baseTotalMins + liveExtraMins,
            isOnline: true,
            lastActiveAt: now,
            updatedAt: now,
          },
          { merge: true }
        ).catch(() => {});
      }
    },
    [
      showCompletionModal,
      computeCurrentFocusSeconds,
      computeCurrentBreakSeconds,
      totalSeconds,
      myDeviceId,
      myDeviceName,
      mode,
      subject,
      plannedMinutes,
      currentTimerType,
      clockStyle,
      originAirport,
      destAirport,
      selectedTaskId,
      selectedTaskTitle,
      selectedTreeSpecies,
      breakCount,
      getEffectiveUid,
    ]
  );

  // Foreground-service chronometer is driven by Android; never a background JS interval.
  const syncNativeState = useCallback(() => {
    if (!isNativeFocusAvailable || isSessionEndedRef.current) return;
    void nativeFocus.sync({
      sessionKey: String(startTimeRef.current),
      isPaused: isPausedRef.current,
      isBreakActive: isCampActiveRef.current,
      elapsedFocusSeconds: computeCurrentFocusSeconds(),
      elapsedBreakSeconds: computeCurrentBreakSeconds(),
      timerType: currentTimerType,
      plannedMinutes,
    }).catch(error => {
      console.warn('[NevoFocus] native sync:', error);
      if (isTwaFocusPage) setNativeBridgeWarning(error instanceof Error ? error.message : 'Android bildirimi başlatılamadı.');
    });
  }, [currentTimerType, plannedMinutes, computeCurrentFocusSeconds, computeCurrentBreakSeconds]);

  // Notification controls still operate while the WebView is paused.
  // Recover authoritative Android time and button states whenever the app returns.
  useEffect(() => {
    // Attach the TWA arrival listener even before Chrome finishes DAL validation.
    // TWA never falls back to a Chrome/site timer notification.
    if (!isNativeFocusAvailable && !isTwaFocusPage) return;
    let mounted = true;
    let busy = false;
    const reconcile = async () => {
      if (busy || !mounted || isSessionEndedRef.current) return;
      busy = true;
      try {
        const state = await nativeFocus.getState();
        if (!mounted || isSessionEndedRef.current) return;
        if (!state.active || state.sessionKey !== String(startTimeRef.current)) {
          syncNativeState();
          return;
        }
        const now = Date.now();
        const controlsChanged =
          isPausedRef.current !== state.isPaused ||
          isCampActiveRef.current !== state.isBreakActive;
        accumulatedFocusSecondsRef.current = Math.max(0, state.elapsedFocusSeconds);
        accumulatedBreakSecondsRef.current = Math.max(0, state.elapsedBreakSeconds);
        anchorTimestampRef.current = now;
        breakAnchorTimestampRef.current = now;
        isPausedRef.current = state.isPaused;
        isCampActiveRef.current = state.isBreakActive;
        setIsPaused(state.isPaused);
        setIsCampActive(state.isBreakActive);
        const focus = computeCurrentFocusSeconds();
        setElapsedCountUp(focus);
        setSecondsRemaining(Math.max(0, totalSeconds - focus));
        setBreakSeconds(computeCurrentBreakSeconds());
        // Don't spam remote Firestore writes when the only change is the
        // ticking Android clock. Persist immediately for notification controls.
        if (controlsChanged) persistSessionState(true);
      } catch (error) {
        console.warn('[NevoFocus] native restore:', error);
      } finally {
        busy = false;
      }
    };
    const onVisible = () => {
      if (isTwaFocusPage) void backgroundFocus.stopWebTimerNotification();
      if (!document.hidden) void reconcile();
    };
    void reconcile();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('nevofocus:twa-connected', onVisible);
    // Returning from Android's notification shade sometimes emits no browser
    // visibility/focus event. The previous 1750ms foreground poll made a
    // pause/break tap appear delayed in the Focus screen. A 650ms poll only
    // runs while the session is visible; busy guards avoid overlapping calls.
    const foregroundPoll = window.setInterval(() => {
      if (!document.hidden && isNativeFocusAvailable) void reconcile();
    }, 650);
    return () => {
      mounted = false;
      window.clearInterval(foregroundPoll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('nevofocus:twa-connected', onVisible);
    };
    // Session identity remains fixed while ActiveFocusSession is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentTimerType]);

  useEffect(() => {
    if (!isTwaFocusPage) return;
    // Close old Chrome/PWA notifications even before Android MessagePort arrives.
    void backgroundFocus.stopWebTimerNotification();
    if (isNativeFocusAvailable) return;
    const timeout = window.setTimeout(() => {
      if (!isNativeFocusAvailable && !isSessionEndedRef.current) {
        setNativeBridgeWarning(
          'Android bildirim bağlantısı kurulamadı. Chrome güncel olmalı ve NevoFocus uygulamasını yeniden açmalısın.'
        );
      }
    }, 25000);
    const connected = () => {
      window.clearTimeout(timeout);
      setNativeBridgeWarning(null);
      void backgroundFocus.stopWebTimerNotification();
    };
    window.addEventListener('nevofocus:twa-connected', connected);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('nevofocus:twa-connected', connected);
    };
  }, []);

  // Pause / Resume with exact Wall-Clock Anchor updates
  const handleTogglePause = useCallback(() => {
    soundEngine.playClick();
    const now = Date.now();

    if (!isPausedRef.current) {
      // Going into pause: lock in elapsed time up to right now
      if (!isCampActiveRef.current) {
        const delta = Math.max(0, Math.floor((now - anchorTimestampRef.current) / 1000));
        accumulatedFocusSecondsRef.current += delta;
      } else {
        const bDelta = Math.max(0, Math.floor((now - breakAnchorTimestampRef.current) / 1000));
        accumulatedBreakSecondsRef.current += bDelta;
      }
      anchorTimestampRef.current = now;
      breakAnchorTimestampRef.current = now;
      isPausedRef.current = true;
      setIsPaused(true);
    } else {
      // Resuming from pause: reset anchors to right now
      anchorTimestampRef.current = now;
      breakAnchorTimestampRef.current = now;
      isPausedRef.current = false;
      setIsPaused(false);
      backgroundFocus.startKeepAlive();
    }

    setElapsedCountUp(computeCurrentFocusSeconds());
    setSecondsRemaining(Math.max(0, totalSeconds - computeCurrentFocusSeconds()));
    setBreakSeconds(computeCurrentBreakSeconds());
    persistSessionState(true);
    syncNativeState();
  }, [computeCurrentFocusSeconds, computeCurrentBreakSeconds, totalSeconds, persistSessionState, syncNativeState]);

  // Thematic Break toggle with exact Wall-Clock Anchor updates
  const toggleThematicBreak = useCallback(() => {
    const now = Date.now();
    // Capture the pause state BEFORE clearing it. Otherwise a break started
    // during a pause would incorrectly add the entire paused interval as work.
    const wasPaused = isPausedRef.current;
    if (wasPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
    }
    if (!isCampActiveRef.current) {
      accumulatedFocusSecondsRef.current += elapsedSecondsAtTransition(
        anchorTimestampRef.current, now, wasPaused
      );
      breakAnchorTimestampRef.current = now;
      isCampActiveRef.current = true;
      setIsCampActive(true);
      setBreakCount((prev) => prev + 1);
    } else {
      accumulatedBreakSecondsRef.current += elapsedSecondsAtTransition(
        breakAnchorTimestampRef.current, now, wasPaused
      );
      anchorTimestampRef.current = now;
      isCampActiveRef.current = false;
      setIsCampActive(false);
    }

    setElapsedCountUp(computeCurrentFocusSeconds());
    setSecondsRemaining(Math.max(0, totalSeconds - computeCurrentFocusSeconds()));
    setBreakSeconds(computeCurrentBreakSeconds());
    persistSessionState(true);
    syncNativeState();
  }, [computeCurrentFocusSeconds, computeCurrentBreakSeconds, totalSeconds, persistSessionState, syncNativeState]);

  // Register pause & break handlers for Lock-Screen MediaSession, PiP Capsule & Service Worker notification buttons
  useEffect(() => {
    backgroundFocus.setPauseHandler(handleTogglePause);
    backgroundFocus.setBreakHandler(toggleThematicBreak);
    if (!isNativeFocusAvailable && !isTwaFocusPage) backgroundFocus.startKeepAlive();
    return () => {
      backgroundFocus.setPauseHandler(null);
      backgroundFocus.setBreakHandler(null);
    };
  }, [handleTogglePause, toggleThematicBreak]);

  // Check Notification permission support on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    } else {
      setPermissionState('unsupported');
    }
  }, []);

  const buildNotificationPayload = useCallback(
    (forceShow = false): LiveNotificationPayload => ({
      mode,
      modeLabel: MODE_LABELS[mode] || 'Odak Modu',
      subjectName: selectedTaskTitle ? subject.name : (mode === 'clock' && !selectedTaskId ? 'Serbest Çalışma' : subject.name),
      taskTitle: selectedTaskTitle,
      timerType: currentTimerType,
      plannedMinutes,
      anchorTimestamp: anchorTimestampRef.current,
      accumulatedFocusSeconds: accumulatedFocusSecondsRef.current,
      breakAnchorTimestamp: breakAnchorTimestampRef.current,
      accumulatedBreakSeconds: accumulatedBreakSecondsRef.current,
      isPaused: isPausedRef.current,
      isCampActive: isCampActiveRef.current,
      forceShow,
    }),
    [mode, subject.name, selectedTaskTitle, selectedTaskId, currentTimerType, plannedMinutes]
  );

  const handleRequestNotificationPermission = async () => {
    // TWA permissions are owned by our Android app, not by the Chrome website.
    if (isTwaFocusPage) return;
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          await backgroundFocus.syncLiveNotification(buildNotificationPayload(true));
        }
      } catch {
        // ignore
      }
    }
  };

  // Real-time Cross-Device Listener: If another device pauses, resumes, or finishes, sync immediately!
  useEffect(() => {
    const userId = getEffectiveUid();
    if (!userId) return;

    const activeDocRef = doc(db, 'users', userId, 'active_focus', 'current');
    const unsub = onSnapshot(
      activeDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;

        // Only apply remote state changes if triggered by another device or if paused/camp state changed
        if (
          data.lastUpdatedByDeviceId &&
          data.lastUpdatedByDeviceId !== myDeviceId
        ) {
          if (typeof data.anchorTimestamp === 'number') {
            anchorTimestampRef.current = data.anchorTimestamp;
          }
          if (typeof data.accumulatedFocusSeconds === 'number') {
            accumulatedFocusSecondsRef.current = data.accumulatedFocusSeconds;
          }
          if (typeof data.breakAnchorTimestamp === 'number') {
            breakAnchorTimestampRef.current = data.breakAnchorTimestamp;
          }
          if (typeof data.accumulatedBreakSeconds === 'number') {
            accumulatedBreakSecondsRef.current = data.accumulatedBreakSeconds;
          }
          const nextPaused = Boolean(data.isPaused);
          const nextCamp = Boolean(data.isCampActive);
          isPausedRef.current = nextPaused;
          isCampActiveRef.current = nextCamp;
          setIsPaused(nextPaused);
          setIsCampActive(nextCamp);
          if (data.timerType === 'stopwatch' || data.timerType === 'countdown') {
            setCurrentTimerType(data.timerType);
          }

          const fSecs = computeCurrentFocusSeconds();
          setElapsedCountUp(fSecs);
          setSecondsRemaining(Math.max(0, totalSeconds - fSecs));
          setBreakSeconds(computeCurrentBreakSeconds());
        }
      },
      () => {
        // ignore
      }
    );

    return () => unsub();
  }, [getEffectiveUid, myDeviceId, computeCurrentFocusSeconds, computeCurrentBreakSeconds, totalSeconds]);

  const elapsedSeconds = currentTimerType === 'stopwatch' ? elapsedCountUp : Math.max(0, totalSeconds - secondsRemaining);
  const progress = Math.min(1, Math.max(0, elapsedSeconds / Math.max(1, totalSeconds)));
  const displayRawSecs = currentTimerType === 'stopwatch' ? elapsedCountUp : secondsRemaining;
  const timeFormatted = formatTimerDisplay(displayRawSecs);

  // Page Title Live Sync for Background Tab Viewing
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `(${timeFormatted}) ${subject.name} | Fokus Premium`;
    return () => {
      document.title = originalTitle;
    };
  }, [timeFormatted, subject.name]);

  // High-Precision Wall-Clock Timer + Visibility / Focus / PageShow Resync + Live Notification Sync
  useEffect(() => {
    if (showCompletionModal || isSessionEndedRef.current) return;

    const syncTick = () => {
      if (isSessionEndedRef.current) return;
      const currentFocus = computeCurrentFocusSeconds();
      const currentBreak = computeCurrentBreakSeconds();
      const currentRem = Math.max(0, totalSeconds - currentFocus);

      setElapsedCountUp(currentFocus);
      setSecondsRemaining(currentRem);
      setBreakSeconds(currentBreak);

      // Update MediaSession & Service Worker notification
      if (!isNativeFocusAvailable && !isTwaFocusPage) backgroundFocus.syncLiveNotification(buildNotificationPayload(false));

      if (currentTimerType === 'countdown' && currentRem <= 0 && !isPausedRef.current && !isCampActiveRef.current) {
        handleFinish(true);
        return;
      }

      persistSessionState(false);
    };

    // Run immediately and then every 500ms for crisp wall-clock accuracy
    syncTick();
    const interval = window.setInterval(syncTick, 500);

    const handleVisibilityOrFocus = () => {
      if (isSessionEndedRef.current) return;
      syncTick();
      if (document.hidden) {
        // User just switched away from the app on phone/tablet/PC: push sticky notification immediately
        persistSessionState(true);
        if (!isNativeFocusAvailable && !isTwaFocusPage) backgroundFocus.syncLiveNotification(buildNotificationPayload(true));
      } else {
        // User returned to the app: keep audio keep-alive active and resync immediately
        if (!isTwaFocusPage) backgroundFocus.startKeepAlive();
        if (!isNativeFocusAvailable && !isTwaFocusPage) backgroundFocus.syncLiveNotification(buildNotificationPayload(false));
      }
    };

    const handlePageUnload = () => {
      if (isSessionEndedRef.current) return;
      persistSessionState(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
    window.addEventListener('pagehide', handlePageUnload);
    window.addEventListener('beforeunload', handlePageUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
      window.removeEventListener('pagehide', handlePageUnload);
      window.removeEventListener('beforeunload', handlePageUnload);
    };
  }, [
    showCompletionModal,
    computeCurrentFocusSeconds,
    computeCurrentBreakSeconds,
    totalSeconds,
    currentTimerType,
    buildNotificationPayload,
    persistSessionState,
  ]);

  const handleFinish = (isCompletedNaturally: boolean) => {
    if (isSessionEndedRef.current) return;
    isSessionEndedRef.current = true;
    markSessionTerminated(startTimeRef.current);

    soundEngine.playCompletionBell();
    backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();

    const finalFocusSecs = computeCurrentFocusSeconds();
    const finalBreakSecs = computeCurrentBreakSeconds();

    // Clear background running session state locally and in cloud
    try {
      const userId = getEffectiveUid();
      if (userId) {
        const activeRef = doc(db, 'users', userId, 'active_focus', 'current');
        safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        deleteDoc(activeRef).catch(() => {});
        safeSetDoc(
          doc(db, 'users', userId),
          {
            status: 'idle',
            currentSubject: '',
            currentSeconds: 0,
            isOnline: true,
            lastActiveAt: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => {});
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

    // Tamamla tuşuna basıldığında (erken de olsa) o ana kadar geçen gerçek odak süresi esas alınır
    const actualCompletedSeconds = Math.max(1, finalFocusSecs);
    const actualCompletedMinutes = Math.max(1, Math.round(actualCompletedSeconds / 60));

    const resolvedSubjectName = selectedTaskTitle
      ? subject.name
      : !selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock'
      ? 'Serbest Çalışma'
      : subject.name;

    const resolvedSubjectColor =
      !selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock'
        ? '#6366f1'
        : subject.color;

    const session: FocusSession = {
      id: `session-${Date.now()}`,
      mode,
      subjectId:
        !selectedTaskId || subject.name === 'TYT Matematik' || mode === 'clock'
          ? 'sub-serbest-calisma'
          : subject.id,
      subjectName: resolvedSubjectName,
      subjectColor: resolvedSubjectColor,
      plannedMinutes,
      completedSeconds: actualCompletedSeconds,
      breakSeconds: finalBreakSecs,
      completed: isCompletedNaturally,
      timestamp: Date.now(),
      dateString: getLocalDateString(startD),
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

    if (isCompletedNaturally && selectedTaskId && onToggleTaskDone) {
      const target = tasksList.find((t) => t.id === selectedTaskId);
      if (target && !target.isCompleted) {
        onToggleTaskDone(selectedTaskId);
      }
    }

    // Immediately save completed session to localStorage so even if page is refreshed while viewing the modal, stats are saved
    try {
      saveSession(session);
    } catch {}

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

  const handleConfirmAbandon = () => {
    isSessionEndedRef.current = true;
    markSessionTerminated(startTimeRef.current);

    soundEngine.playClick();
    setShowAbandonModal(false);
    backgroundFocus.stopAll();
    if (isNativeFocusAvailable) void nativeFocus.stop();

    try {
      const userId = getEffectiveUid();
      if (userId) {
        const activeRef = doc(db, 'users', userId, 'active_focus', 'current');
        safeSetDoc(activeRef, { isFinished: true, isActive: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        deleteDoc(activeRef).catch(() => {});
        safeSetDoc(
          doc(db, 'users', userId),
          {
            status: 'idle',
            currentSubject: '',
            currentSeconds: 0,
            isOnline: true,
            lastActiveAt: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch {
      // ignore
    }

    // Vazgeçildiğinde seans istatistiklere kaydedilmez (sadece Tamamla'ya basıldığında gerçek süre kaydedilir)
    onAbandonSession(undefined);
  };

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 w-full h-full min-h-[100dvh] max-h-[100dvh] bg-black overflow-hidden flex flex-col justify-between select-none">
      {isTwaFocusPage && nativeBridgeWarning && (
        <div role="alert" className="absolute top-14 left-3 right-3 z-[80] rounded-xl border border-orange-500/40 bg-[#171311] px-4 py-3 text-sm text-orange-100 shadow-xl">
          {nativeBridgeWarning}
        </div>
      )}
      {/* Sol Üstte Zarif Müzik Widget (Spotify / YouTube Music / Apple Music) */}
      <SpotifyFocusWidget onOpenSettingsConnections={onOpenSettingsConnections} />

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
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <span className="text-[11px] sm:text-xs md:text-sm font-medium text-neutral-400 select-none tracking-wide">
                {todayFormattedTurkish}
              </span>
              <span className="text-xs sm:text-sm md:text-base font-semibold text-white select-none tracking-wide drop-shadow-sm mt-0.5 sm:mt-1">
                <span className="text-neutral-300 font-medium">Saat :</span>{' '}
                <span className="text-white font-bold">{wallClockTime}</span>
              </span>
            </div>
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

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Bildirim Logosu (Sadece İkon) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setIsNotificationPreviewOpen(true);
            }}
            className={`relative p-2 rounded-full border backdrop-blur-md transition-all cursor-pointer ${
              permissionState === 'granted'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-black/50 border-white/10 text-neutral-300 hover:text-white hover:bg-black/80'
            }`}
            title="Bildirim & Canlı Kapsül"
            aria-label="Bildirim & Canlı Kapsül"
          >
            <Bell className="w-4 h-4 text-[#ff5500]" />
            <span
              className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                permissionState === 'granted' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>

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

          {/* Küçült Tuşu */}
          {onMinimize && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                persistSessionState(true);
                onMinimize();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer text-xs font-semibold backdrop-blur-md active:scale-95 shadow-sm"
              title="Seansı Küçült (Mini Ekrana Geç)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Küçült</span>
            </button>
          )}

          {/* Tam Ekran Büyüt/Küçült */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-full bg-black/50 border border-white/10 text-neutral-300 hover:text-white hover:bg-black/80 transition-all cursor-pointer"
            title={isFullscreen ? 'Küçült' : 'Büyüt'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

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
                    <span>%{Math.round(progress * 100)}</span>
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

      {/* Bottom Floating Action Bar */}
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
            <span>{isCampActive ? 'Devam Et' : 'Mola'}</span>
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
              {mode === 'dive' && "Balık Şehri'ne ulaşmadan su yüzeyine dönmek istediğine emin misin?"}
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
                onClick={handleConfirmAbandon}
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
              {mode === 'dive' && "🏰 Balık Şehri'ne ulaşıldı ve sualtı sarayına giriş yapıldı!"}
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
                  {completedSessionData.completedSeconds < 60
                    ? `${completedSessionData.completedSeconds} sn`
                    : `${Math.round(completedSessionData.completedSeconds / 60)} dk`}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400">Mola Süresi</span>
                <p className="text-sm font-bold text-amber-400 font-mono">
                  {breakSeconds > 0 && breakSeconds < 60
                    ? `${breakSeconds} sn`
                    : `${Math.round(breakSeconds / 60)} dk`}
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
        currentRemainingFormatted={isCampActive ? formatTimerDisplay(breakSeconds) : timeFormatted}
        currentSubject={subject.name}
        timerType={currentTimerType}
        isPaused={isPaused}
        isCampActive={isCampActive}
        onTogglePause={handleTogglePause}
        onToggleBreak={toggleThematicBreak}
        onMinimizeToCapsule={() => {
          if (onMinimize) {
            persistSessionState(true);
            onMinimize();
          }
        }}
        onOpenPipCapsule={() => backgroundFocus.openPipCapsule(buildNotificationPayload(true))}
        onSendTestNotification={() => {
          if (isTwaFocusPage) {
            if (isNativeFocusAvailable) syncNativeState();
            else setNativeBridgeWarning('Android bildirim servisi bağlı değil. NevoFocus uygulamasını yeniden aç.');
          } else {
            backgroundFocus.syncLiveNotification(buildNotificationPayload(true));
          }
        }}
      />
    </div>
  );
};

