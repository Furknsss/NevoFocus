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
  Bell
} from 'lucide-react';
import { FocusModeType, FocusSession, SubjectItem, FlightAirport, FocusTask } from '../types';
import { ActiveForestCanvas } from './visuals/ActiveForestCanvas';
import { ActiveClimbCanvas } from './visuals/ActiveClimbCanvas';
import { ActiveDiveCanvas } from './visuals/ActiveDiveCanvas';
import { WorldMap2DFlight } from './visuals/WorldMap2DFlight';
import { NotificationPreviewModal } from './NotificationPreviewModal';
import { MyForestModal } from './forest/MyForestModal';
import { soundEngine } from '../utils/audio';
import { POPULAR_AIRPORTS } from '../utils/airports';

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
  isAudioPlaying: boolean;
  desktopNotificationsEnabled?: boolean;
  liveNotificationsEnabled?: boolean;
}

const MOTIVATIONAL_QUOTES = [
  'Derin odaklanma, sıradan anları şahesere dönüştürür.',
  'Şu anda gösterdiğin sabır, gelecekteki en büyük zaferin olacak.',
  'Zirveler sadece tırmanmaktan vazgeçmeyenlerin ayakları altındadır.',
  'Uçuş irtifasına ulaşıldı; hedefine doğru emin adımlarla süzül.',
  'En derin denizler bile cesur dalgıçların önünde sırlarını açar.',
  'Zihnini tek bir hedefe kitle; dünya etrafında dönmeye devam etsin.',
];

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
  isAudioPlaying,
  desktopNotificationsEnabled = true,
  liveNotificationsEnabled = false,
}) => {
  const totalSeconds = plannedMinutes * 60;
  const [currentTimerType, setCurrentTimerType] = useState<'countdown' | 'stopwatch'>(timerType);
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [elapsedCountUp, setElapsedCountUp] = useState<number>(0);

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
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<FocusSession | null>(null);

  // Background Notification Preview Modal
  const [isNotificationPreviewOpen, setIsNotificationPreviewOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');

  // CLIMB CAMPING & BREAK SYSTEM
  const [isCampActive, setIsCampActive] = useState<boolean>(false);
  const [breakSeconds, setBreakSeconds] = useState<number>(0);
  const [breakCount, setBreakCount] = useState<number>(0);

  // FLIGHT 3D GLOBE / COCKPIT TOGGLE
  const [flightViewMode, setFlightViewMode] = useState<'cockpit' | 'globe'>('globe');
  const [isMyForestOpen, setIsMyForestOpen] = useState(false);

  // Mini task checklist: ONLY when stopwatch is active
  const [showTasksPanel, setShowTasksPanel] = useState(false);

  const quoteRef = useRef(
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  const startTimeRef = useRef(Date.now());
  const lastTickTimeRef = useRef(Date.now());

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

  const toggleCampBreak = () => {
    soundEngine.playClick();
    if (!isCampActive) {
      setIsCampActive(true);
      setBreakCount((prev) => prev + 1);
      soundEngine.playAmbient('campfire');
    } else {
      setIsCampActive(false);
    }
  };

  const handleFinish = (isCompletedNaturally: boolean) => {
    soundEngine.playCompletionBell();

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

    const session: FocusSession = {
      id: `session-${Date.now()}`,
      mode,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      plannedMinutes,
      completedSeconds: elapsedSeconds,
      breakSeconds,
      completed: isCompletedNaturally,
      timestamp: Date.now(),
      dateString: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      startTimeString: `${pad(startD.getHours())}:${pad(startD.getMinutes())}`,
      endTimeString: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      note: selectedTaskTitle || `${subject.name} seansı (${plannedMinutes} dk)`,
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
              treeSpecies: 'Mistik Zümrüt Bonsai',
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
              treeSpecies: 'Mistik Zümrüt Bonsai',
              treeLevel: Math.max(1, Math.floor(progress * 5)),
            }
          : undefined,
    };

    onAbandonSession(partialSession);
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] min-h-[600px] bg-black overflow-hidden flex flex-col justify-between select-none">
      {/* Visual Canvas Backdrop */}
      <div className="absolute inset-0 z-0">
        {mode === 'forest' && (
          <ActiveForestCanvas
            progress={progress}
            isPaused={isPaused}
            elapsedSeconds={elapsedSeconds}
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
            isFlightActive={!isPaused}
            onCompleteLanding={() => handleFinish(true)}
          />
        )}
        {mode === 'dive' && (
          <ActiveDiveCanvas
            progress={progress}
            isPaused={isPaused}
            elapsedSeconds={elapsedSeconds}
          />
        )}
      </div>

      {/* Top Floating Info Bar (Clean Non-Overlapping Header) */}
      <div className="relative z-10 w-full px-4 sm:px-8 pt-4 sm:pt-6 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Left: Mode Title & Subject Badge & My Forest Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs sm:text-sm font-bold shadow-lg">
            {mode === 'forest' && <Trees className="w-4 h-4 text-emerald-400" />}
            {mode === 'climb' && <Mountain className="w-4 h-4 text-orange-400" />}
            {mode === 'flight' && <Plane className="w-4 h-4 text-sky-400" />}
            {mode === 'dive' && <Waves className="w-4 h-4 text-teal-400" />}
            <span className="capitalize">
              {mode === 'forest' ? 'Kadim Orman' : mode === 'climb' ? 'Dağcı Kampı' : mode === 'flight' ? 'Focus Flight 2D' : 'Derin Dalış'}
            </span>
          </div>

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-lg text-white"
            style={{ backgroundColor: `${subject.color}33`, borderColor: subject.color, borderWidth: 1 }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
            <span>{subject.name}</span>
          </div>

          {/* Ormanım Button for Forest Mode */}
          {mode === 'forest' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setIsMyForestOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
              <span>🌳 Ormanım</span>
            </button>
          )}

          {/* Camp break button for Climb Mode */}
          {mode === 'climb' && (
            <button
              type="button"
              onClick={toggleCampBreak}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all cursor-pointer ${
                isCampActive
                  ? 'bg-orange-500 text-black border border-orange-400 animate-pulse'
                  : 'bg-black/75 hover:bg-black/90 border border-orange-500/40 text-orange-300'
              }`}
            >
              <Tent className="w-3.5 h-3.5" />
              <span>{isCampActive ? '⛺ Kamptan Ayrıl & Devam Et' : '⛺ Kamp Ateşi Molası Ver'}</span>
            </button>
          )}
        </div>

        {/* Right: Quick Action Controls (Audio & Fullscreen only - zero clutter) */}
        <div className="flex items-center gap-2">
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

          {/* Fullscreen */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-full bg-black/50 border border-white/10 text-neutral-300 hover:text-white hover:bg-black/80 transition-all cursor-pointer"
            title="Tam Ekran"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Center Focus Timer Display */}
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
      <div className="relative z-10 w-full px-4 sm:px-8 pb-6 flex items-center justify-center gap-3 sm:gap-4 pointer-events-auto flex-wrap">
        {/* Climb Mode Specific: Campfire / Break Button */}
        {mode === 'climb' && (
          <button
            onClick={toggleCampBreak}
            className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all shadow-lg cursor-pointer border ${
              isCampActive
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-400 animate-pulse'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-orange-400 border-orange-500/40 backdrop-blur-md'
            }`}
          >
            <Tent className="w-4 h-4" />
            <span>{isCampActive ? '⛺ Tırmanışa Devam Et' : '⛺ Kamp Kur / Mola Ver'}</span>
          </button>
        )}

        {/* Pause / Resume */}
        {!isCampActive && (
          <button
            onClick={() => {
              soundEngine.playClick();
              setIsPaused(!isPaused);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all shadow-lg cursor-pointer ${
              isPaused
                ? 'bg-[#10b981] text-black shadow-emerald-500/20 hover:bg-[#20c991]'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? 'Devam Et' : 'Duraklat'}</span>
          </button>
        )}

        {/* Complete Session */}
        <button
          onClick={() => handleFinish(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-black/60 hover:bg-black/80 text-emerald-400 border border-emerald-500/40 text-sm font-semibold transition-all backdrop-blur-md cursor-pointer"
          title="Seansı Başarıyla Tamamla"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Tamamla</span>
        </button>

        {/* Abandon */}
        <button
          onClick={() => setShowAbandonModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-black/60 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-sm font-semibold transition-all backdrop-blur-md cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Vazgeç</span>
        </button>
      </div>

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
            </p>

            {/* Recap */}
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 mb-6 text-left">
              <div>
                <span className="text-[11px] text-neutral-400">Ders</span>
                <p className="text-sm font-bold text-white truncate">{subject.name}</p>
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

      {/* Kişisel Ormanım Modal */}
      <MyForestModal
        isOpen={isMyForestOpen}
        onClose={() => setIsMyForestOpen(false)}
      />
    </div>
  );
};
