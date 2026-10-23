import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Flame,
  Search,
  Trophy,
  Trees,
  Mountain,
  Plane,
  Waves,
  Clock,
  GraduationCap,
  Plus,
  Lock,
  DoorOpen,
  MessageSquare,
  Send,
  X,
  KeyRound,
  Globe,
  Trash2,
  Pencil,
  Copy,
  Check,
  Eye,
  EyeOff,
  Hash,
  LogOut,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { StudentPeer, StudyRoom, UserProfile, RoomChatMessage } from '../types';
import { soundEngine } from '../utils/audio';
import { auth, db, handleFirestoreError, OperationType, safeSetDoc, parseNumericField } from '../firebase';
import { DEFAULT_ROOMS, getStoredSessions } from '../utils/storage';
import {
  getLocalDateString,
  getCurrentWeekKey,
  getCurrentMonthKey,
  calculateTodayMinutes,
  calculateWeeklyMinutes,
  calculateMonthlyStatsSummary,
  calculateTotalFocusHours,
} from '../utils/stats';
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  increment,
  query,
  orderBy,
  limit,
  arrayUnion,
} from 'firebase/firestore';

interface StudentsViewProps {
  peers: StudentPeer[];
  profile: UserProfile;
  currentUser: any;
  onCheerPeer: (peerId: string) => void;
  isCurrentUserStudying?: boolean;
  activeViewTab?: 'rooms' | 'students';
  onSwitchTab?: (tab: 'rooms' | 'students') => void;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ROOMS_CACHE_KEY = 'fokus_study_rooms_cache_v3';
const CHEER_COOLDOWN_KEY = 'fokus_cheer_cooldowns_v3';
const UNLOCKED_ROOMS_KEY = 'fokus_unlocked_rooms_v3';
const MY_CREATED_ROOMS_KEY = 'fokus_my_created_rooms_v3';
const ACTIVE_ROOM_KEY = 'fokus_active_joined_room_id_v3';

const GENERAL_DEFAULT_ROOM: StudyRoom = {
  id: 'room-all',
  code: '100000',
  name: 'Genel Odak & Çalışma Salonu',
  category: 'Tüm Alanlar',
  description: 'Tüm öğrencilerin bir arada canlı odaklandığı, sıralamayı takip ettiği ve sohbet ettiği ana çalışma masası.',
  targetExam: 'YKS / Genel',
  isPrivate: false,
  hasPassword: false,
  memberCount: 1,
  onlineCount: 1,
  participants: [],
};

export const StudentsView: React.FC<StudentsViewProps> = ({
  profile,
  currentUser,
  onCheerPeer,
  isCurrentUserStudying = false,
  activeViewTab = 'students',
  onSwitchTab,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [livePeers, setLivePeers] = useState<StudentPeer[]>([]);

  // Leaderboard period toggle: Daily ('daily') vs Weekly ('weekly')
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'daily' | 'weekly'>('daily');
  // Leaderboard scope toggle: Room ('room') vs All ('all')
  const [leaderboardScope, setLeaderboardScope] = useState<'room' | 'all'>('room');

  // Top-right "Öğrenci Listesi" modal state
  const [isStudentListModalOpen, setIsStudentListModalOpen] = useState<boolean>(false);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');
  const [studentTrackFilter, setStudentTrackFilter] = useState<string>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'studying' | 'idle'>('all');

  // Clicked Student Profile & Monthly Statistics Modal state
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  // Room State with Persistent Caching
  const [rooms, setRooms] = useState<StudyRoom[]>(() => {
    try {
      const cached = localStorage.getItem(ROOMS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StudyRoom[];
        return parsed.filter(
          (r) => !['room-yks-say', 'room-yks-ea', 'room-kpss', 'room-kod', 'room-yks-sayisal'].includes(r.id)
        );
      }
    } catch {
      // ignore
    }
    return DEFAULT_ROOMS;
  });

  // Track user-created rooms in current device/account
  const [myCreatedRoomIds, setMyCreatedRoomIds] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem(MY_CREATED_ROOMS_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Cheer / Flame 1-Hour Cooldown tracker
  const [cheerCooldowns, setCheerCooldowns] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem(CHEER_COOLDOWN_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Toast notice for cheer actions & room updates
  const [cheerToast, setCheerToast] = useState<{
    message: string;
    type: 'success' | 'cooldown';
  } | null>(null);

  // Unlocked private rooms for current user
  const [unlockedRoomIds, setUnlockedRoomIds] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem(UNLOCKED_ROOMS_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Room Creation Modal
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState(profile.studyTrack || 'Sayısal');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');

  // Room Edit Modal
  const [editingRoom, setEditingRoom] = useState<StudyRoom | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Sayısal');
  const [editDesc, setEditDesc] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  // Delete Room Confirmation Modal
  const [roomToDelete, setRoomToDelete] = useState<StudyRoom | null>(null);

  // Copy Feedback & Visibility inside room
  const [copiedField, setCopiedField] = useState<'code' | 'password' | null>(null);
  const [showRoomPassword, setShowRoomPassword] = useState(false);

  // Join By Code Modal
  const [isJoinByCodeOpen, setIsJoinByCodeOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinCodeError, setJoinCodeError] = useState('');

  // Room Join Password Modal
  const [passwordModalRoom, setPasswordModalRoom] = useState<StudyRoom | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Active Chat / Room State with Persistence
  const [activeChatRoom, setActiveChatRoom] = useState<StudyRoom | null>(() => {
    try {
      const savedRoomId = localStorage.getItem(ACTIVE_ROOM_KEY);
      if (savedRoomId) {
        if (savedRoomId === 'room-all') return GENERAL_DEFAULT_ROOM;
        const cached = localStorage.getItem(ROOMS_CACHE_KEY);
        const parsed = cached ? (JSON.parse(cached) as StudyRoom[]) : DEFAULT_ROOMS;
        const found = parsed.find((r: StudyRoom) => r.id === savedRoomId);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return GENERAL_DEFAULT_ROOM;
  });

  const currentRoom: StudyRoom = activeChatRoom || GENERAL_DEFAULT_ROOM;

  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Filters for rooms view
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>('all');
  const [roomPrivacyFilter, setRoomPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');

  // Local user's computed weekly & monthly stats for immediate accuracy
  const myLocalStats = useMemo(() => {
    const sess = getStoredSessions();
    return {
      todayMins: calculateTodayMinutes(sess),
      weeklyMins: calculateWeeklyMinutes(sess),
      monthlySummary: calculateMonthlyStatsSummary(sess),
      totalMins: Math.round(calculateTotalFocusHours(sess) * 60),
    };
  }, [profile.todayTotalMinutes, profile.totalFocusHours]);

  // Sync activeChatRoom when rooms are updated from Firestore
  useEffect(() => {
    if (activeChatRoom && activeChatRoom.id !== 'room-all') {
      const updated = rooms.find((r) => r.id === activeChatRoom.id);
      if (updated) {
        setActiveChatRoom(updated);
      }
    }
  }, [rooms, activeChatRoom?.id]);

  // Leave active custom room -> back to General Room
  const handleLeaveRoom = () => {
    soundEngine.playClick();
    const roomName = activeChatRoom?.name || 'Oda';
    setActiveChatRoom(GENERAL_DEFAULT_ROOM);
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, 'room-all');
    } catch {
      // ignore
    }
    const myUid =
      currentUser?.uid ||
      auth.currentUser?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null);
    if (myUid) {
      safeSetDoc(
        doc(db, 'users', myUid),
        {
          activeRoomId: 'room-all',
          activeRoomName: GENERAL_DEFAULT_ROOM.name,
          lastActiveAt: Date.now(),
        },
        { merge: true }
      ).catch(() => {});
    }
    setCheerToast({
      message: `"${roomName}" masasından ayrıldınız, Genel Salona geçildi.`,
      type: 'success',
    });
  };

  // Auto-dismiss cheer toasts after 4 seconds
  useEffect(() => {
    if (!cheerToast) return;
    const t = setTimeout(() => setCheerToast(null), 4000);
    return () => clearTimeout(t);
  }, [cheerToast]);

  const getCooldownMinutesLeft = (peerId: string) => {
    const lastCheered = cheerCooldowns[peerId];
    if (!lastCheered) return 0;
    const elapsed = Date.now() - lastCheered;
    if (elapsed >= ONE_HOUR_MS) return 0;
    return Math.ceil((ONE_HOUR_MS - elapsed) / 60000);
  };

  const isUserRoomParticipant = (room: StudyRoom) => {
    if (!room.isPrivate && !room.hasPassword) return true;
    if (currentUser && room.createdBy === currentUser.uid) return true;
    if (currentUser && room.participants?.includes(currentUser.uid)) return true;
    return Boolean(unlockedRoomIds[room.id]);
  };

  const isRoomOwner = (room: StudyRoom) => {
    if (
      room.id === 'room-all' ||
      room.id === 'room-yks-say' ||
      room.id === 'room-yks-ea' ||
      room.id === 'room-kpss' ||
      room.id === 'room-kod'
    ) {
      return false;
    }
    if (currentUser && room.createdBy && room.createdBy === currentUser.uid) return true;
    if (myCreatedRoomIds[room.id]) return true;
    if (room.createdByName && room.createdByName === profile.name) return true;
    return false;
  };

  const handleCopyText = (text: string, field: 'code' | 'password') => {
    soundEngine.playClick();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleOpenEditRoom = (room: StudyRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundEngine.playClick();
    setEditingRoom(room);
    setEditName(room.name);
    setEditCategory(room.category || 'Sayısal');
    setEditDesc(room.description || '');
    setEditIsPrivate(Boolean(room.isPrivate || room.hasPassword));
    setEditPassword(room.password || '');
  };

  const handleSaveEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editName.trim()) return;

    if (editIsPrivate && !editPassword.trim()) {
      setCheerToast({
        message: 'Özel oda için lütfen bir şifre belirleyin.',
        type: 'cooldown',
      });
      return;
    }

    soundEngine.playCompletionBell();

    const updatedRoom: StudyRoom = {
      ...editingRoom,
      name: editName.trim(),
      category: editCategory,
      targetExam: editCategory,
      description: editDesc.trim() || 'Birlikte odaklanıp hedeflerimize ulaşıyoruz.',
      isPrivate: editIsPrivate,
      hasPassword: editIsPrivate,
      password: editIsPrivate ? editPassword.trim() : (null as any),
    };

    try {
      const roomRef = doc(db, 'study_rooms', editingRoom.id);
      await safeSetDoc(
        roomRef,
        {
          name: updatedRoom.name,
          category: updatedRoom.category,
          targetExam: updatedRoom.targetExam,
          description: updatedRoom.description,
          isPrivate: updatedRoom.isPrivate,
          hasPassword: updatedRoom.hasPassword,
          password: updatedRoom.password || null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Edit room firestore update notice:', err);
    }

    const nextRooms = rooms.map((r) => (r.id === editingRoom.id ? updatedRoom : r));
    setRooms(nextRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(nextRooms));
    } catch {}

    if (activeChatRoom?.id === editingRoom.id) {
      setActiveChatRoom(updatedRoom);
    }

    setEditingRoom(null);
    setCheerToast({
      message: `"${updatedRoom.name}" odası güncellendi! ✓`,
      type: 'success',
    });
  };

  const handlePromptDeleteRoom = (room: StudyRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundEngine.playClick();
    setRoomToDelete(room);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    soundEngine.playClick();

    const targetId = roomToDelete.id;
    const targetName = roomToDelete.name;

    try {
      const roomRef = doc(db, 'study_rooms', targetId);
      await deleteDoc(roomRef);
    } catch (err) {
      console.warn('Delete room firestore notice:', err);
    }

    const nextRooms = rooms.filter((r) => r.id !== targetId);
    setRooms(nextRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(nextRooms));
    } catch {}

    if (activeChatRoom?.id === targetId) {
      setActiveChatRoom(GENERAL_DEFAULT_ROOM);
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, 'room-all');
      } catch {}
    }

    setRoomToDelete(null);
    setCheerToast({
      message: `"${targetName}" odası silindi.`,
      type: 'success',
    });
  };

  // Join Room By 6-Digit Code
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().replace(/^#/, '');
    if (!cleanCode) return;

    soundEngine.playClick();
    if (cleanCode === '100000') {
      setIsJoinByCodeOpen(false);
      setJoinCodeInput('');
      setJoinCodeError('');
      handleAttemptJoinRoom(GENERAL_DEFAULT_ROOM);
      return;
    }

    const found = rooms.find((r) => r.code === cleanCode);
    if (!found) {
      setJoinCodeError('Bu koda sahip bir oda bulunamadı. Lütfen 6 haneli kodu kontrol edin.');
      return;
    }

    setIsJoinByCodeOpen(false);
    setJoinCodeInput('');
    setJoinCodeError('');
    handleAttemptJoinRoom(found);
  };

  // 1. Real-time Firestore sync with all registered students (with STRICT DEDUPLICATION so "2 ben varım" NEVER happens!)
  useEffect(() => {
    try {
      const usersCol = collection(db, 'users');
      const unsubscribe = onSnapshot(
        usersCol,
        (snapshot) => {
          const nowMs = Date.now();
          const todayStr = getLocalDateString(new Date());
          const weekStr = getCurrentWeekKey(new Date());
          const monthStr = getCurrentMonthKey(new Date());

          const myEffectiveUid =
            currentUser?.uid ||
            auth.currentUser?.uid ||
            (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null) ||
            profile.userId ||
            'user_current';

          const myEmailLower = (currentUser?.email || profile.email || '').trim().toLowerCase();
          const myFullNameLower = (profile.name || '').trim().toLowerCase();

          // Read live local running seconds if current user is studying
          let myLocalLiveSecs = 0;
          let myLocalLiveStatus: 'studying' | 'break' | 'idle' = isCurrentUserStudying ? 'studying' : 'idle';
          let myLocalSubject = profile.currentSubject || 'Serbest Çalışma';
          try {
            const rawRunning = localStorage.getItem('fokus_active_session_running');
            if (rawRunning) {
              const parsed = JSON.parse(rawRunning);
              if (parsed && !parsed.isFinished && parsed.isActive !== false) {
                const isPaused = Boolean(parsed.isPaused);
                const isCamp = Boolean(parsed.isCampActive);
                const acc =
                  typeof parsed.accumulatedFocusSeconds === 'number'
                    ? parsed.accumulatedFocusSeconds
                    : parsed.elapsedCountUp || parsed.elapsedSeconds || 0;
                const anchor = typeof parsed.anchorTimestamp === 'number' ? parsed.anchorTimestamp : null;
                myLocalLiveSecs =
                  !isPaused && !isCamp && anchor
                    ? acc + Math.max(0, Math.floor((nowMs - anchor) / 1000))
                    : acc;
                myLocalLiveStatus = isPaused || isCamp ? 'break' : 'studying';
                myLocalSubject = parsed.selectedTaskTitle
                  ? `${parsed.subject?.name || 'Odak'} · ${parsed.selectedTaskTitle}`
                  : parsed.subject?.name || 'Serbest Çalışma';
              }
            }
          } catch {}

          const deduplicatedMap = new Map<string, StudentPeer>();
          let myMergedPeer: StudentPeer | null = null;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rawFullName = (data.name || data.displayName || 'Öğrenci').trim();
            const initials =
              rawFullName
                .split(' ')
                .filter(Boolean)
                .map((p: string) => p[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'Ö';

            const docEmailLower = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
            const docNameLower = rawFullName.toLowerCase();

            // Detect if this document belongs to the current user
            const isMe = Boolean(
              docSnap.id === myEffectiveUid ||
                (profile.userId && docSnap.id === profile.userId) ||
                (myEmailLower && docEmailLower && myEmailLower === docEmailLower) ||
                (myFullNameLower &&
                  myFullNameLower !== 'öğrenci' &&
                  docNameLower === myFullNameLower &&
                  (!docEmailLower || !myEmailLower || docEmailLower === myEmailLower))
            );

            // If there is a duplicate orphan document in Firestore for the current user (different ID from myEffectiveUid),
            // clean it up silently so it never lingers in the database
            if (isMe && myEffectiveUid && myEffectiveUid !== 'user_current' && docSnap.id !== myEffectiveUid) {
              deleteDoc(doc(db, 'users', docSnap.id)).catch(() => {});
            }

            const lastActive = parseNumericField(data.lastActiveAt || data.updatedAt, 0);
            const isStudyStale = lastActive > 0 && nowMs - lastActive > 5 * 60 * 1000;
            const isBreakStale = lastActive > 0 && nowMs - lastActive > 20 * 60 * 1000;

            let finalStatus: 'studying' | 'break' | 'idle' =
              data.status === 'studying' && !isStudyStale
                ? 'studying'
                : data.status === 'break' && !isBreakStale
                ? 'break'
                : 'idle';

            if (isMe) {
              finalStatus = isCurrentUserStudying ? myLocalLiveStatus : 'idle';
              if (
                !isCurrentUserStudying &&
                docSnap.id === myEffectiveUid &&
                (data.status === 'studying' || data.status === 'break' || data.currentSeconds > 0)
              ) {
                safeSetDoc(
                  doc(db, 'users', docSnap.id),
                  {
                    status: 'idle',
                    currentSubject: '',
                    currentSeconds: 0,
                    isOnline: true,
                    lastActiveAt: nowMs,
                  },
                  { merge: true }
                ).catch(() => {});
              }
            }

            const currentSecs = isMe
              ? isCurrentUserStudying
                ? Math.max(myLocalLiveSecs, parseNumericField(data.currentSeconds, 0))
                : 0
              : finalStatus === 'studying' || finalStatus === 'break'
              ? parseNumericField(data.currentSeconds, 0)
              : 0;

            const currentSubj = isMe
              ? isCurrentUserStudying
                ? myLocalSubject || data.currentSubject || 'Genel Odak'
                : ''
              : data.currentSubject || 'Genel Odak';

            const docTodayDate = typeof data.todayDateString === 'string' ? data.todayDateString : todayStr;
            const isDocFromToday = docTodayDate === todayStr;
            const rawDocTodayMins = isDocFromToday ? parseNumericField(data.todayTotalMinutes, 0) : 0;
            const rawBaseTodayMins =
              isDocFromToday && data.baseTodayMinutes !== undefined
                ? parseNumericField(data.baseTodayMinutes, rawDocTodayMins)
                : rawDocTodayMins;

            const liveSessionBonusMins =
              finalStatus === 'studying' || finalStatus === 'break' ? Math.floor(currentSecs / 60) : 0;

            const resolvedTodayMinutes = isMe
              ? Math.max(
                  myLocalStats.todayMins + liveSessionBonusMins,
                  rawBaseTodayMins + liveSessionBonusMins
                )
              : data.baseTodayMinutes !== undefined
              ? Math.max(rawDocTodayMins, rawBaseTodayMins + liveSessionBonusMins)
              : rawDocTodayMins;

            const docWeekStr = typeof data.weekDateString === 'string' ? data.weekDateString : weekStr;
            const isDocFromThisWeek = docWeekStr === weekStr;
            const rawDocWeeklyMins = isDocFromThisWeek
              ? parseNumericField(data.weeklyTotalMinutes, resolvedTodayMinutes)
              : resolvedTodayMinutes;
            const rawBaseWeeklyMins =
              isDocFromThisWeek && data.baseWeeklyMinutes !== undefined
                ? parseNumericField(data.baseWeeklyMinutes, rawDocWeeklyMins)
                : rawDocWeeklyMins;

            const resolvedWeeklyMinutes = isMe
              ? Math.max(
                  resolvedTodayMinutes,
                  myLocalStats.weeklyMins + liveSessionBonusMins,
                  rawBaseWeeklyMins + liveSessionBonusMins
                )
              : Math.max(
                  resolvedTodayMinutes,
                  data.baseWeeklyMinutes !== undefined
                    ? rawBaseWeeklyMins + liveSessionBonusMins
                    : rawDocWeeklyMins
                );

            const docMonthStr = typeof data.monthDateString === 'string' ? data.monthDateString : monthStr;
            const isDocFromThisMonth = docMonthStr === monthStr;
            const rawDocMonthlyMins = isDocFromThisMonth
              ? parseNumericField(data.monthlyTotalMinutes, resolvedWeeklyMinutes)
              : resolvedWeeklyMinutes;
            const rawBaseMonthlyMins =
              isDocFromThisMonth && data.baseMonthlyMinutes !== undefined
                ? parseNumericField(data.baseMonthlyMinutes, rawDocMonthlyMins)
                : rawDocMonthlyMins;

            const resolvedMonthlyMinutes = isMe
              ? Math.max(
                  resolvedWeeklyMinutes,
                  myLocalStats.monthlySummary.monthlyMinutes + liveSessionBonusMins,
                  rawBaseMonthlyMins + liveSessionBonusMins
                )
              : Math.max(
                  resolvedWeeklyMinutes,
                  data.baseMonthlyMinutes !== undefined
                    ? rawBaseMonthlyMins + liveSessionBonusMins
                    : rawDocMonthlyMins
                );

            const resolvedTotalMinutes = isMe
              ? Math.max(
                  resolvedMonthlyMinutes,
                  myLocalStats.totalMins + liveSessionBonusMins,
                  parseNumericField(data.totalFocusMinutes, Math.round(parseNumericField(data.totalFocusHours, 0) * 60))
                )
              : Math.max(
                  resolvedMonthlyMinutes,
                  parseNumericField(data.totalFocusMinutes, Math.round(parseNumericField(data.totalFocusHours, 0) * 60))
                );

            const isOnlineNow = Boolean(
              isMe ||
                finalStatus === 'studying' ||
                finalStatus === 'break' ||
                (data.isOnline !== false && lastActive > 0 && nowMs - lastActive < 90 * 1000)
            );

            const peerObj: StudentPeer = {
              id: isMe ? myEffectiveUid : docSnap.id,
              name: isMe ? (profile.name?.trim() || rawFullName) : rawFullName,
              initials: isMe ? profile.initials || initials : initials,
              avatarBg: data.avatarColor ? '' : 'bg-emerald-600',
              avatarUrl: isMe ? profile.avatarUrl || data.avatarUrl || '' : data.avatarUrl || '',
              status: finalStatus,
              currentSubject: currentSubj,
              currentMode: isMe ? profile.currentMode || data.currentMode || 'forest' : data.currentMode || 'forest',
              currentSeconds: currentSecs,
              todayTotalMinutes: resolvedTodayMinutes,
              weeklyTotalMinutes: resolvedWeeklyMinutes,
              monthlyTotalMinutes: resolvedMonthlyMinutes,
              totalFocusMinutes: resolvedTotalMinutes,
              monthlySessionsCount: isMe
                ? Math.max(
                    myLocalStats.monthlySummary.monthlySessionsCount,
                    parseNumericField(data.monthlySessionsCount, 0)
                  )
                : parseNumericField(
                    data.monthlySessionsCount,
                    Math.max(1, Math.round(resolvedMonthlyMinutes / 40))
                  ),
              monthlyActiveDays: isMe
                ? Math.max(
                    myLocalStats.monthlySummary.monthlyActiveDays,
                    resolvedTodayMinutes > 0 ? 1 : 0,
                    parseNumericField(data.monthlyActiveDays, 0)
                  )
                : Math.max(
                    resolvedMonthlyMinutes > 0 ? 1 : 0,
                    parseNumericField(data.monthlyActiveDays, 0)
                  ),
              favoriteSubject: isMe
                ? myLocalStats.monthlySummary.favoriteSubject || data.favoriteSubject || 'Genel Odak'
                : data.favoriteSubject || currentSubj || 'Genel Odak',
              dailyGoalHours: isMe
                ? profile.dailyGoalHours || 6
                : parseNumericField(data.dailyGoalHours, 6),
              roomName: isMe
                ? profile.studyTrack || profile.targetExam || 'Sayısal'
                : data.studyTrack || data.targetExam || 'Sayısal',
              activeRoomId: isMe
                ? currentRoom.id || data.activeRoomId || 'room-all'
                : data.activeRoomId || 'room-all',
              activeRoomName: isMe
                ? currentRoom.name || data.activeRoomName || GENERAL_DEFAULT_ROOM.name
                : data.activeRoomName || GENERAL_DEFAULT_ROOM.name,
              lastActiveAt: isMe ? nowMs : lastActive,
              isOnline: isOnlineNow,
              todayDateString: docTodayDate,
              weekDateString: docWeekStr,
              monthDateString: docMonthStr,
              streakDays: isMe
                ? Math.max(parseNumericField(profile.currentStreakDays, 0), parseNumericField(data.streakDays, 0))
                : parseNumericField(data.streakDays || data.currentStreakDays, 0),
              cheersReceived: isMe
                ? Math.max(parseNumericField(profile.cheersReceived, 0), parseNumericField(data.cheersReceived, 0))
                : parseNumericField(data.cheersReceived, 0),
              targetUniversity: isMe
                ? profile.targetUniversity || data.targetUniversity || ''
                : data.targetUniversity || '',
              targetDepartment: isMe
                ? profile.targetDepartment || data.targetDepartment || ''
                : data.targetDepartment || '',
              targetExam: isMe
                ? profile.targetExam || data.targetExam || 'YKS 2026'
                : data.targetExam || 'YKS 2026',
              isCurrentUser: isMe,
            };

            if (isMe) {
              if (!myMergedPeer) {
                myMergedPeer = peerObj;
              } else {
                // Merge any duplicate current-user documents into a single record
                myMergedPeer = {
                  ...myMergedPeer,
                  todayTotalMinutes: Math.max(myMergedPeer.todayTotalMinutes, peerObj.todayTotalMinutes),
                  weeklyTotalMinutes: Math.max(myMergedPeer.weeklyTotalMinutes || 0, peerObj.weeklyTotalMinutes || 0),
                  monthlyTotalMinutes: Math.max(myMergedPeer.monthlyTotalMinutes || 0, peerObj.monthlyTotalMinutes || 0),
                  totalFocusMinutes: Math.max(myMergedPeer.totalFocusMinutes || 0, peerObj.totalFocusMinutes || 0),
                  streakDays: Math.max(myMergedPeer.streakDays, peerObj.streakDays),
                  cheersReceived: Math.max(myMergedPeer.cheersReceived, peerObj.cheersReceived),
                };
              }
            } else {
              // Deduplicate other users by email or normalized name so no friend ever appears twice
              const dedupKey = docEmailLower || `name_${docNameLower}`;
              const existing = deduplicatedMap.get(dedupKey);
              if (!existing) {
                deduplicatedMap.set(dedupKey, peerObj);
              } else {
                const preferNew =
                  (peerObj.status === 'studying' && existing.status !== 'studying') ||
                  (peerObj.lastActiveAt || 0) > (existing.lastActiveAt || 0);
                const base = preferNew ? peerObj : existing;
                deduplicatedMap.set(dedupKey, {
                  ...base,
                  todayTotalMinutes: Math.max(existing.todayTotalMinutes, peerObj.todayTotalMinutes),
                  weeklyTotalMinutes: Math.max(existing.weeklyTotalMinutes || 0, peerObj.weeklyTotalMinutes || 0),
                  monthlyTotalMinutes: Math.max(existing.monthlyTotalMinutes || 0, peerObj.monthlyTotalMinutes || 0),
                  totalFocusMinutes: Math.max(existing.totalFocusMinutes || 0, peerObj.totalFocusMinutes || 0),
                  streakDays: Math.max(existing.streakDays, peerObj.streakDays),
                  cheersReceived: Math.max(existing.cheersReceived, peerObj.cheersReceived),
                });
              }
            }
          });

          if (!myMergedPeer) {
            const liveBonus = isCurrentUserStudying ? Math.floor(myLocalLiveSecs / 60) : 0;
            myMergedPeer = {
              id: myEffectiveUid,
              name: profile.name?.trim() || 'Öğrenci',
              initials: profile.initials || 'Ö',
              avatarBg: 'bg-[#ff5500]',
              avatarUrl: profile.avatarUrl,
              status: isCurrentUserStudying ? myLocalLiveStatus : 'idle',
              currentSubject: isCurrentUserStudying ? myLocalSubject : '',
              currentMode: profile.currentMode || 'forest',
              currentSeconds: isCurrentUserStudying ? myLocalLiveSecs : 0,
              todayTotalMinutes: myLocalStats.todayMins + liveBonus,
              weeklyTotalMinutes: myLocalStats.weeklyMins + liveBonus,
              monthlyTotalMinutes: myLocalStats.monthlySummary.monthlyMinutes + liveBonus,
              totalFocusMinutes: myLocalStats.totalMins + liveBonus,
              monthlySessionsCount: myLocalStats.monthlySummary.monthlySessionsCount,
              monthlyActiveDays: Math.max(
                isCurrentUserStudying ? 1 : 0,
                myLocalStats.monthlySummary.monthlyActiveDays
              ),
              favoriteSubject: myLocalStats.monthlySummary.favoriteSubject,
              dailyGoalHours: profile.dailyGoalHours || 6,
              roomName: profile.studyTrack || profile.targetExam || 'Sayısal',
              activeRoomId: currentRoom.id,
              activeRoomName: currentRoom.name,
              lastActiveAt: nowMs,
              isOnline: true,
              todayDateString: todayStr,
              weekDateString: weekStr,
              monthDateString: monthStr,
              streakDays: parseNumericField(profile.currentStreakDays, 0),
              cheersReceived: parseNumericField(profile.cheersReceived, 0),
              targetUniversity: profile.targetUniversity,
              targetDepartment: profile.targetDepartment,
              targetExam: profile.targetExam,
              isCurrentUser: true,
            };
          }

          const finalPeers = [myMergedPeer, ...Array.from(deduplicatedMap.values())];
          setLivePeers(finalPeers);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );

      return () => unsubscribe();
    } catch {
      // fallback
    }
  }, [currentUser, profile, isCurrentUserStudying, currentRoom.id, currentRoom.name, myLocalStats]);

  // 2. Real-time Firestore sync for study rooms
  useEffect(() => {
    try {
      const roomsCol = collection(db, 'study_rooms');
      const unsubscribe = onSnapshot(
        roomsCol,
        (snapshot) => {
          const list: StudyRoom[] = [];
          snapshot.forEach((snap) => {
            if (snap.id === 'room-all') return;
            const rData = snap.data();
            list.push({
              id: snap.id,
              ...rData,
              name: typeof rData.name === 'string' ? rData.name : 'Çalışma Masası',
              description: typeof rData.description === 'string' ? rData.description : '',
              category: typeof rData.category === 'string' ? rData.category : 'Sayısal',
              code: typeof rData.code === 'string' ? rData.code : snap.id.slice(-6).toUpperCase(),
              memberCount: parseNumericField(
                rData.memberCount,
                Array.isArray(rData.participants) ? Math.max(1, rData.participants.length) : 1
              ),
              participants: Array.isArray(rData.participants) ? rData.participants : [],
              createdAt: parseNumericField(rData.createdAt, Date.now()),
            } as StudyRoom);
          });

          const combined = [...list];
          DEFAULT_ROOMS.forEach((def) => {
            if (def.id !== 'room-all' && !combined.some((c) => c.id === def.id)) {
              combined.push(def);
            }
          });

          combined.sort((a, b) => parseNumericField(b.createdAt, 0) - parseNumericField(a.createdAt, 0));
          setRooms(combined);

          try {
            localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(combined));
          } catch {}
        },
        () => {
          // offline fallback
        }
      );
      return () => unsubscribe();
    } catch {
      // fallback
    }
  }, []);

  // 3. Real-time Room Chat messages listener (works for all rooms including General Room)
  useEffect(() => {
    const targetRoomId = currentRoom.id || 'room-all';
    try {
      const messagesCol = collection(db, 'study_rooms', targetRoomId, 'messages');
      const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(100));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs: RoomChatMessage[] = [];
          snapshot.forEach((snap) => {
            const d = snap.data();
            if (d && d.text) {
              msgs.push({
                id: snap.id,
                roomId: targetRoomId,
                userId: d.userId || 'guest',
                userName: d.userName || 'Öğrenci',
                userAvatarUrl: d.userAvatarUrl || '',
                userAvatarColor: d.userAvatarColor || '#ff5500',
                text: d.text,
                createdAt: parseNumericField(d.createdAt, Date.now()),
              });
            }
          });
          msgs.sort((a, b) => a.createdAt - b.createdAt);
          setChatMessages(msgs);
          setTimeout(() => {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        },
        () => {
          // fallback if index not ready
        }
      );

      return () => unsubscribe();
    } catch {
      // fallback
    }
  }, [currentRoom.id]);

  // 4. Live 1-second ticker: increments currentSeconds and live daily/weekly/monthly focus minutes for studying peers!
  useEffect(() => {
    const interval = window.setInterval(() => {
      const nowMs = Date.now();
      setLivePeers((prev) =>
        prev.map((p) => {
          const isStaleOnline =
            !p.isCurrentUser && p.status === 'idle' && p.lastActiveAt
              ? nowMs - p.lastActiveAt >= 90 * 1000
              : false;

          if (p.status === 'studying') {
            const nextSecs = p.currentSeconds + 1;
            const crossedMinute = nextSecs > 0 && nextSecs % 60 === 0;
            return {
              ...p,
              currentSeconds: nextSecs,
              todayTotalMinutes: crossedMinute ? p.todayTotalMinutes + 1 : p.todayTotalMinutes,
              weeklyTotalMinutes: crossedMinute
                ? (p.weeklyTotalMinutes ?? p.todayTotalMinutes) + 1
                : p.weeklyTotalMinutes ?? p.todayTotalMinutes,
              monthlyTotalMinutes: crossedMinute
                ? (p.monthlyTotalMinutes ?? p.weeklyTotalMinutes ?? p.todayTotalMinutes) + 1
                : p.monthlyTotalMinutes ?? p.weeklyTotalMinutes ?? p.todayTotalMinutes,
              totalFocusMinutes: crossedMinute
                ? (p.totalFocusMinutes || 0) + 1
                : p.totalFocusMinutes,
              isOnline: true,
            };
          }

          if (isStaleOnline && p.isOnline) {
            return { ...p, isOnline: false };
          }
          return p;
        })
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Cheer Peer action with 1-HOUR ANTI-SPAM RULE
  const handleCheer = async (peer: StudentPeer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const minsLeft = getCooldownMinutesLeft(peer.id);
    if (minsLeft > 0) {
      soundEngine.playClick();
      setCheerToast({
        message: `${peer.name} öğrencisine son 1 saat içinde alev gönderdin! Yeni alev için ${minsLeft} dakika beklemelisin. 🔥`,
        type: 'cooldown',
      });
      return;
    }

    soundEngine.playCompletionBell();
    onCheerPeer(peer.id);

    const now = Date.now();
    const updatedCooldowns = { ...cheerCooldowns, [peer.id]: now };
    setCheerCooldowns(updatedCooldowns);
    try {
      localStorage.setItem(CHEER_COOLDOWN_KEY, JSON.stringify(updatedCooldowns));
    } catch {}

    setCheerToast({
      message: `${peer.name} öğrencisine moral alevi gönderildi! 🔥`,
      type: 'success',
    });

    setLivePeers((prev) =>
      prev.map((p) => (p.id === peer.id ? { ...p, cheersReceived: parseNumericField(p.cheersReceived, 0) + 1 } : p))
    );

    try {
      const peerRef = doc(db, 'users', peer.id);
      await safeSetDoc(
        peerRef,
        {
          cheersReceived: increment(1),
        },
        { merge: true }
      );

      const cheerId = `cheer-${now}`;
      const cheerRef = doc(db, 'users', peer.id, 'cheers', cheerId);
      await safeSetDoc(cheerRef, {
        id: cheerId,
        fromUserId: currentUser?.uid || 'guest',
        fromUserName: profile.name?.trim() || 'Öğrenci',
        fromUserAvatarUrl: profile.avatarUrl || '',
        toUserId: peer.id,
        createdAt: now,
        read: false,
      });
    } catch {}
  };

  // Sync user's active room & participant membership in Firestore
  const syncUserRoomMembership = async (room: StudyRoom) => {
    const myUid =
      currentUser?.uid ||
      auth.currentUser?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null) ||
      profile.userId;
    if (!myUid) return;

    try {
      await safeSetDoc(
        doc(db, 'users', myUid),
        {
          activeRoomId: room.id,
          activeRoomName: room.name,
          isOnline: true,
          lastActiveAt: Date.now(),
        },
        { merge: true }
      );
      if (room.id !== 'room-all') {
        const alreadyParticipant = Array.isArray(room.participants) && room.participants.includes(myUid);
        await safeSetDoc(
          doc(db, 'study_rooms', room.id),
          {
            participants: arrayUnion(myUid),
            ...(alreadyParticipant ? {} : { memberCount: increment(1) }),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
    } catch {}
  };

  // Create New Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    if (isPrivateRoom && !newRoomPassword.trim()) {
      setCheerToast({
        message: 'Özel oda oluşturmak için lütfen bir şifre belirleyin.',
        type: 'cooldown',
      });
      return;
    }

    soundEngine.playClick();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const roomId = `room-${Date.now()}`;
    const myUid =
      currentUser?.uid ||
      auth.currentUser?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null) ||
      profile.userId ||
      'guest';

    const newRoom: StudyRoom = {
      id: roomId,
      code,
      name: newRoomName.trim(),
      category: newRoomCategory,
      description: newRoomDesc.trim() || 'Birlikte odaklanıp hedeflerimize ulaşıyoruz.',
      targetExam: newRoomCategory,
      createdBy: myUid,
      createdByName: profile.name || 'Öğrenci',
      createdAt: Date.now(),
      isPrivate: isPrivateRoom,
      hasPassword: isPrivateRoom,
      password: isPrivateRoom ? newRoomPassword.trim() : (null as any),
      memberCount: 1,
      onlineCount: 1,
      participants: [myUid],
    };

    try {
      await safeSetDoc(doc(db, 'study_rooms', roomId), newRoom);
      await syncUserRoomMembership(newRoom);
    } catch (err) {
      console.error('Room create error', err);
    }

    const updatedRooms = [newRoom, ...rooms];
    setRooms(updatedRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(updatedRooms));
    } catch {}

    const nextUnlocked = { ...unlockedRoomIds, [roomId]: true };
    setUnlockedRoomIds(nextUnlocked);
    try {
      localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));
    } catch {}

    const nextMyRooms = { ...myCreatedRoomIds, [roomId]: true };
    setMyCreatedRoomIds(nextMyRooms);
    try {
      localStorage.setItem(MY_CREATED_ROOMS_KEY, JSON.stringify(nextMyRooms));
    } catch {}

    setNewRoomName('');
    setNewRoomDesc('');
    setNewRoomPassword('');
    setIsPrivateRoom(false);
    setIsCreateRoomOpen(false);
    setActiveChatRoom(newRoom);
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
    } catch {}
    onSwitchTab?.('students');
    setCheerToast({
      message: `"${newRoom.name}" odası kuruldu! Odalar listesine eklendi ve masaya geçildi. 🚀`,
      type: 'success',
    });
  };

  // Join Room verification
  const handleAttemptJoinRoom = (room: StudyRoom) => {
    soundEngine.playClick();

    if ((room.isPrivate || room.hasPassword) && !isUserRoomParticipant(room)) {
      setPasswordModalRoom(room);
      setEnteredPassword('');
      setPasswordError('');
    } else {
      setActiveChatRoom(room);
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, room.id);
      } catch {}
      syncUserRoomMembership(room);
      onSwitchTab?.('students');
      setCheerToast({
        message: `"${room.name}" odasına katıldınız! ✨`,
        type: 'success',
      });
    }
  };

  // Unlock private room with password
  const handleConfirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalRoom) return;

    if (passwordModalRoom.password && enteredPassword !== passwordModalRoom.password) {
      setPasswordError('Girdiğiniz oda şifresi hatalı, lütfen tekrar deneyin.');
      soundEngine.playClick();
      return;
    }

    soundEngine.playCompletionBell();
    const targetRoomId = passwordModalRoom.id;

    const nextUnlocked = { ...unlockedRoomIds, [targetRoomId]: true };
    setUnlockedRoomIds(nextUnlocked);
    try {
      localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));
    } catch {}

    await syncUserRoomMembership(passwordModalRoom);

    setActiveChatRoom(passwordModalRoom);
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, targetRoomId);
    } catch {}
    setPasswordModalRoom(null);
    onSwitchTab?.('students');
    setCheerToast({
      message: `"${passwordModalRoom.name}" odasına başarıyla katıldınız! ✨`,
      type: 'success',
    });
  };

  // Send Chat Message (with instant optimistic update + Firestore persistence)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text) return;

    soundEngine.playClick();
    setMessageInput('');

    const targetRoomId = currentRoom.id || 'room-all';
    const myUid =
      currentUser?.uid ||
      auth.currentUser?.uid ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null) ||
      profile.userId ||
      'guest';

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: RoomChatMessage = {
      id: msgId,
      roomId: targetRoomId,
      userId: myUid,
      userName: profile.name?.trim() || 'Öğrenci',
      userAvatarUrl: profile.avatarUrl || '',
      userAvatarColor: profile.avatarColor || '#ff5500',
      text,
      createdAt: Date.now(),
    };

    // Optimistic UI update so message appears immediately
    setChatMessages((prev) => (prev.some((m) => m.id === msgId) ? prev : [...prev, newMsg]));
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);

    try {
      const msgRef = doc(db, 'study_rooms', targetRoomId, 'messages', msgId);
      await safeSetDoc(msgRef, newMsg);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const formatSecsToMin = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins}dk ${String(remainderSecs).padStart(2, '0')}sn`;
  };

  const formatMinutesWithLiveSecs = (totalMins: number, status: string, currentSecs: number) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (status === 'studying') {
      const remSecs = currentSecs % 60;
      return `${hrs}s ${mins}dk ${String(remSecs).padStart(2, '0')}sn`;
    }
    return `${hrs}s ${mins}dk`;
  };

  const formatLastSeen = (lastActiveAt?: number) => {
    if (!lastActiveAt || lastActiveAt <= 0) return 'Çevrimdışı';
    const diffMins = Math.floor((Date.now() - lastActiveAt) / 60000);
    if (diffMins < 2) return 'Az önce aktif';
    if (diffMins < 60) return `${diffMins} dk önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} sa önce`;
    return `${Math.floor(diffHours / 24)} gün önce`;
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'forest':
        return <Trees className="w-3.5 h-3.5 text-emerald-400" />;
      case 'climb':
        return <Mountain className="w-3.5 h-3.5 text-orange-400" />;
      case 'flight':
        return <Plane className="w-3.5 h-3.5 text-sky-400" />;
      case 'dive':
        return <Waves className="w-3.5 h-3.5 text-teal-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  // Peers in current active room
  const roomPeers =
    currentRoom.id === 'room-all'
      ? livePeers
      : livePeers.filter((p) => {
          if (p.isCurrentUser) return true;
          if (p.activeRoomId && p.activeRoomId === currentRoom.id) return true;
          if (Array.isArray(currentRoom.participants) && currentRoom.participants.includes(p.id)) return true;
          if (currentRoom.createdBy && currentRoom.createdBy === p.id) return true;
          return false;
        });

  // Sort room members: Actively Studying ("Çalışıyor") first, then Break, then Online, then Offline; within each, by live focus time!
  const displayRoomPeers = [...roomPeers].sort((a, b) => {
    const rankStatus = (peer: StudentPeer) => {
      if (peer.status === 'studying') return 3;
      if (peer.status === 'break') return 2;
      if (peer.isOnline) return 1;
      return 0;
    };
    const diffStatus = rankStatus(b) - rankStatus(a);
    if (diffStatus !== 0) return diffStatus;
    const scoreA = a.todayTotalMinutes * 60 + (a.status === 'studying' ? a.currentSeconds % 60 : 0);
    const scoreB = b.todayTotalMinutes * 60 + (b.status === 'studying' ? b.currentSeconds % 60 : 0);
    return scoreB - scoreA;
  });

  // Live Leaderboard (Daily vs Weekly, Room vs All)
  const leaderboardSource = leaderboardScope === 'room' ? roomPeers : livePeers;
  const sortedLeaderboard = [...leaderboardSource].sort((a, b) => {
    const minsA =
      leaderboardPeriod === 'weekly'
        ? a.weeklyTotalMinutes ?? a.todayTotalMinutes
        : a.todayTotalMinutes;
    const minsB =
      leaderboardPeriod === 'weekly'
        ? b.weeklyTotalMinutes ?? b.todayTotalMinutes
        : b.todayTotalMinutes;
    const liveSecsA = minsA * 60 + (a.status === 'studying' ? a.currentSeconds % 60 : 0);
    const liveSecsB = minsB * 60 + (b.status === 'studying' ? b.currentSeconds % 60 : 0);
    if (liveSecsB !== liveSecsA) return liveSecsB - liveSecsA;
    if (a.status === 'studying' && b.status !== 'studying') return -1;
    if (b.status === 'studying' && a.status !== 'studying') return 1;
    return b.streakDays - a.streakDays;
  });

  // Filter rooms for Rooms Tab
  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.code && r.code.includes(q));

    const matchesCategory = roomCategoryFilter === 'all' || r.category === roomCategoryFilter;

    const matchesPrivacy =
      roomPrivacyFilter === 'all' ||
      (roomPrivacyFilter === 'public' && !r.isPrivate && !r.hasPassword) ||
      (roomPrivacyFilter === 'private' && (r.isPrivate || r.hasPassword));

    return matchesSearch && matchesCategory && matchesPrivacy;
  });

  // Filtered students for the Top-Right "Öğrenci Listesi" modal
  const filteredModalStudents = livePeers
    .filter((p) => {
      const q = modalSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.currentSubject.toLowerCase().includes(q) ||
        (p.targetUniversity && p.targetUniversity.toLowerCase().includes(q)) ||
        (p.targetDepartment && p.targetDepartment.toLowerCase().includes(q));

      const matchesTrack =
        studentTrackFilter === 'all' ||
        (p.roomName && p.roomName.toLowerCase().includes(studentTrackFilter.toLowerCase())) ||
        (p.targetExam && p.targetExam.toLowerCase().includes(studentTrackFilter.toLowerCase()));

      const matchesStatus =
        studentStatusFilter === 'all' ||
        (studentStatusFilter === 'studying' && (p.status === 'studying' || p.status === 'break')) ||
        (studentStatusFilter === 'idle' && p.status === 'idle');

      return matchesSearch && matchesTrack && matchesStatus;
    })
    .sort((a, b) => {
      if (a.status === 'studying' && b.status !== 'studying') return -1;
      if (b.status === 'studying' && a.status !== 'studying') return 1;
      return b.todayTotalMinutes - a.todayTotalMinutes;
    });

  // Selected peer for Profile & Monthly Statistics Modal (always live-updated from livePeers)
  const selectedPeerProfile = useMemo(() => {
    if (!selectedPeerId) return null;
    return livePeers.find((p) => p.id === selectedPeerId) || null;
  }, [selectedPeerId, livePeers]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {cheerToast && (
        <div className="fixed top-20 right-5 z-[80] animate-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl max-w-sm border-2 ${
              cheerToast.type === 'cooldown'
                ? 'bg-neutral-950 border-amber-500 text-amber-200'
                : 'bg-neutral-950 border-[#ff5500] text-white'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[#ff5500]/20 flex items-center justify-center text-[#ff5500] shrink-0">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <p className="text-xs font-bold leading-snug flex-1">{cheerToast.message}</p>
            <button
              onClick={() => setCheerToast(null)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW A: ODALAR SEKMESİ (Çalışma Odaları Listesi & Oda Kurma) */}
      {/* ============================================================== */}
      {activeViewTab === 'rooms' && (
        <div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DoorOpen className="w-4 h-4 text-[#ff5500]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#ff5500]">
                  CANLI ÇALIŞMA ODALARI
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Çalışma Odaları ({rooms.length + 1})
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kurulan odalara buradan tek tıkla veya 6 haneli kodla katılabilir, arkadaşlarınla canlı çalışabilirsin.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 md:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Oda adı veya kod ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <button
                onClick={() => {
                  soundEngine.playClick();
                  setIsJoinByCodeOpen(true);
                  setJoinCodeInput('');
                  setJoinCodeError('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <Hash className="w-3.5 h-3.5 text-[#ff5500]" />
                <span>Kodla Katıl</span>
              </button>

              <button
                onClick={() => setIsCreateRoomOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Oda Kur</span>
              </button>
            </div>
          </div>

          {/* Alan & Gizlilik Filtreleri */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-bold text-neutral-400 mr-1 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#ff5500]" /> Alan:
            </span>
            {['all', 'Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  soundEngine.playClick();
                  setRoomCategoryFilter(cat);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  roomCategoryFilter === cat
                    ? 'bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/25'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {cat === 'all' ? 'Tüm Alanlar' : cat}
              </button>
            ))}
            <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block" />
            {['all', 'public', 'private'].map((priv) => (
              <button
                key={priv}
                onClick={() => {
                  soundEngine.playClick();
                  setRoomPrivacyFilter(priv as any);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  roomPrivacyFilter === priv
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {priv === 'all' ? 'Tüm Odalar' : priv === 'public' ? 'Herkese Açık' : 'Özel / Şifreli'}
              </button>
            ))}
          </div>

          {/* Odalar Izgarası (Genel Salon + Kurulan Tüm Odalar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Genel Odak Salonu Kartı */}
            {roomPrivacyFilter !== 'private' && (
              <div
                onClick={() => handleAttemptJoinRoom(GENERAL_DEFAULT_ROOM)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  currentRoom.id === 'room-all'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                    : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-extrabold text-white truncate">
                      {GENERAL_DEFAULT_ROOM.name}
                    </h3>
                    <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                      {livePeers.length} Öğrenci
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                    {GENERAL_DEFAULT_ROOM.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-neutral-400 font-mono">Kod: #100000</span>
                  <span className="flex items-center gap-1 font-bold text-[#ff5500]">
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>{currentRoom.id === 'room-all' ? 'Aktif Masan' : 'Salona Katıl'}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Kullanıcıların Kurduğu ve Varsayılan Odalar */}
            {filteredRooms.map((room) => {
              const isCurrentActive = currentRoom.id === room.id;
              const isPrivate = room.isPrivate || room.hasPassword;
              const isUnlocked = isUserRoomParticipant(room);
              const isOwner = isRoomOwner(room);
              const activeInThisRoomCount = livePeers.filter(
                (p) =>
                  p.activeRoomId === room.id ||
                  (Array.isArray(room.participants) && room.participants.includes(p.id))
              ).length;

              return (
                <div
                  key={room.id}
                  onClick={() => handleAttemptJoinRoom(room)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                    isCurrentActive
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                      : isPrivate && !isUnlocked
                      ? 'border-neutral-800 bg-neutral-950/50 hover:border-amber-500/50'
                      : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 truncate">
                        {isPrivate ? (
                          <Lock className={`w-3.5 h-3.5 shrink-0 ${isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`} />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <h3 className="text-sm font-extrabold text-white truncate">{room.name}</h3>
                      </div>

                      <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                        #{room.code}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                      {room.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="text-sky-400 font-semibold">{room.category}</span>
                      <span>·</span>
                      <span>{Math.max(activeInThisRoomCount, room.memberCount || 1)} kişi</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleOpenEditRoom(room, e)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 transition-colors"
                            title="Odayı Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handlePromptDeleteRoom(room, e)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                            title="Odayı Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <span className="flex items-center gap-1 font-bold text-[#ff5500] group-hover:underline">
                        <DoorOpen className="w-3.5 h-3.5" />
                        <span>
                          {isCurrentActive
                            ? 'Odaya Git'
                            : isPrivate && !isUnlocked
                            ? 'Şifreyle Gir'
                            : 'Odaya Gir'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW B: ÖĞRENCİLER SEKMESİ (Üstte Oda Başlığı + Sağ Üstte Öğrenci Listesi Butonu + Canlı Masa + Sıralama + Chat) */}
      {/* ============================================================== */}
      {activeViewTab === 'students' && (
        <div className="space-y-6">
          {/* 1. EN ÜSTTE: AKTİF ODANIN ADI, KATILIM KODU, AÇIKLAMASI & SAĞ ÜSTTE ÖĞRENCİ LİSTESİ BUTONU */}
          <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#ff5500]/15 border border-[#ff5500]/30 text-[#ff5500] flex items-center justify-center shrink-0">
                  <DoorOpen className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-extrabold text-white truncate">
                      {currentRoom.name}
                    </h1>
                    <span className="text-xs text-sky-400 font-semibold">
                      · {currentRoom.category}
                    </span>
                    <span className="text-xs text-neutral-400">
                      · {currentRoom.isPrivate || currentRoom.hasPassword ? 'Özel Oda' : 'Herkese Açık'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {currentRoom.description}
                  </p>
                </div>
              </div>

              {/* SAĞ ÜST BUTONLAR: Öğrenci Listesi + Oda Değiştir / Düzenle / Ayrıl */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* SAĞ ÜST ÖĞRENCİ LİSTESİ BUTONU */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsStudentListModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#ff5500]/25 active:scale-95 whitespace-nowrap"
                >
                  <Users className="w-4 h-4" />
                  <span>Öğrenci Listesi ({livePeers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onSwitchTab?.('rooms');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  <DoorOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Odalar</span>
                </button>

                {isRoomOwner(currentRoom) && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditRoom(currentRoom, e)}
                      className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition-all cursor-pointer"
                      title="Odayı Düzenle"
                    >
                      <Pencil className="w-4 h-4 text-sky-400" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePromptDeleteRoom(currentRoom, e)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                      title="Odayı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                {currentRoom.id !== 'room-all' && (
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-neutral-700 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                    title="Bu odadan ayrıl"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Ayrıl</span>
                  </button>
                )}
              </div>
            </div>

            {/* Oda Katılım Kodu, Şifre & Hızlı Kodla Katıl Çubuğu */}
            <div className="mt-4 pt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono">
                  <Hash className="w-3.5 h-3.5 text-[#ff5500]" />
                  <span className="text-neutral-400">Katılım Kodu:</span>
                  <strong className="text-white tracking-wider text-sm">#{currentRoom.code || '100000'}</strong>
                  <button
                    type="button"
                    onClick={() => handleCopyText(currentRoom.code || '100000', 'code')}
                    className="ml-1 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer transition-colors"
                    title="Oda Kodunu Kopyala"
                  >
                    {copiedField === 'code' ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Kopyalandı
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {(currentRoom.isPrivate || currentRoom.hasPassword) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Şifre:</span>
                    <strong className="text-amber-200 text-sm">
                      {showRoomPassword ? currentRoom.password || '—' : '••••••'}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setShowRoomPassword(!showRoomPassword)}
                      className="p-1 rounded-lg text-amber-400/80 hover:text-amber-200 cursor-pointer"
                    >
                      {showRoomPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {currentRoom.password && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(currentRoom.password!, 'password')}
                        className="p-1 rounded-lg text-amber-400/80 hover:text-amber-200 cursor-pointer"
                      >
                        {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsJoinByCodeOpen(true);
                    setJoinCodeInput('');
                    setJoinCodeError('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  Başka Koda Katıl
                </button>
              </div>

              <span className="text-[11px] text-neutral-400">
                Profilini ve aylık istatistiğini görmek istediğin öğrencinin fotoğrafına veya ismine tıkla.
              </span>
            </div>
          </div>

          {/* 2. ANA İÇERİK IZGARASI: SOLDA (ODADAKİ ÖĞRENCİLER + CANLI GÜNLÜK/HAFTALIK SIRALAMA), SAĞDA (CANLI SOHBET) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* SOL 7 KOLON: Odadaki Katılımcılar & Canlı Odak Sıralaması */}
            <div className="lg:col-span-7 space-y-6">
              {/* KART 1: Bu Odadaki Öğrenciler (Canlı Çalışma & Saat Takibi) */}
              <div className="p-5 rounded-3xl bg-neutral-900/85 border border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Odadaki Öğrenciler ({displayRoomPeers.length})</span>
                    </h2>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      O an odaklananların durumu <strong className="text-emerald-400">Çalışıyor</strong> olarak görünür ve toplam odağı canlı sayılır.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {displayRoomPeers.filter((p) => p.status === 'studying').length} Çalışıyor
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayRoomPeers.map((peer) => {
                    const cooldownLeft = getCooldownMinutesLeft(peer.id);
                    const isStudying = peer.status === 'studying';
                    const isOnBreak = peer.status === 'break';
                    const isOnline = Boolean(peer.isOnline || isStudying || isOnBreak || peer.isCurrentUser);
                    const weeklyMins = peer.weeklyTotalMinutes ?? peer.todayTotalMinutes;

                    return (
                      <div
                        key={peer.id}
                        onClick={() => {
                          soundEngine.playClick();
                          setSelectedPeerId(peer.id);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          isStudying
                            ? 'border-emerald-500/45 bg-neutral-950/90 hover:border-emerald-400'
                            : isOnBreak
                            ? 'border-amber-500/40 bg-neutral-950/80 hover:border-amber-400'
                            : isOnline
                            ? 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
                            : 'border-neutral-800/70 bg-neutral-950/40 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            {peer.avatarUrl ? (
                              <img
                                src={peer.avatarUrl}
                                alt={peer.name}
                                referrerPolicy="no-referrer"
                                className={`w-11 h-11 rounded-full object-cover border-2 ${
                                  isStudying
                                    ? 'border-emerald-500'
                                    : isOnBreak
                                    ? 'border-amber-400'
                                    : isOnline
                                    ? 'border-sky-400'
                                    : 'border-neutral-700'
                                }`}
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-white border border-neutral-700">
                                {peer.initials}
                              </div>
                            )}
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                                isStudying
                                  ? 'bg-emerald-500'
                                  : isOnBreak
                                  ? 'bg-amber-400'
                                  : isOnline
                                  ? 'bg-sky-400'
                                  : 'bg-neutral-600'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white hover:text-[#ff5500] transition-colors truncate">
                                {peer.name}
                              </span>
                              {peer.isCurrentUser && (
                                <span className="text-[11px] font-bold text-[#ff5500]">(Sen)</span>
                              )}
                              <span className="text-neutral-600">·</span>
                              <span
                                className={`text-xs font-bold ${
                                  isStudying
                                    ? 'text-emerald-400'
                                    : isOnBreak
                                    ? 'text-amber-300'
                                    : isOnline
                                    ? 'text-sky-300'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {isStudying
                                  ? `Çalışıyor 🔥 · ${formatSecsToMin(peer.currentSeconds)}`
                                  : isOnBreak
                                  ? `Molada ☕ · ${formatSecsToMin(peer.currentSeconds)}`
                                  : isOnline
                                  ? 'Çevrimiçi'
                                  : `Çevrimdışı (${formatLastSeen(peer.lastActiveAt)})`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-neutral-400">
                              {(isStudying || isOnBreak) && peer.currentSubject ? (
                                <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                                  {getModeIcon(peer.currentMode)}
                                  <span>{peer.currentSubject}</span>
                                </span>
                              ) : (
                                <span>
                                  {peer.targetUniversity
                                    ? `${peer.targetUniversity} ${peer.targetDepartment || ''}`
                                    : peer.roomName || 'YKS Hazırlık'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sağ: Canlı Bugün & Bu Hafta Odak + Alev */}
                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-800/60">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-neutral-400 block">
                              Bugün Toplam Odak
                            </span>
                            <span className="text-xs font-extrabold text-emerald-400 font-mono tabular-nums block">
                              {formatMinutesWithLiveSecs(peer.todayTotalMinutes, peer.status, peer.currentSeconds)}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono tabular-nums block">
                              Bu Hafta: {Math.floor(weeklyMins / 60)}s {weeklyMins % 60}dk
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleCheer(peer, e)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-transform cursor-pointer active:scale-95 border shrink-0 ${
                              cooldownLeft > 0
                                ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400'
                                : 'bg-[#ff5500]/15 border-[#ff5500]/50 text-[#ff5500] hover:bg-[#ff5500] hover:text-white'
                            }`}
                            title={cooldownLeft > 0 ? `${cooldownLeft} dk sonra tekrar gönderebilirsin` : 'Moral alevi gönder'}
                          >
                            <Flame className={`w-3.5 h-3.5 ${cooldownLeft === 0 ? 'fill-current' : ''}`} />
                            <span>{cooldownLeft > 0 ? `${cooldownLeft}dk` : peer.cheersReceived || 'Alev'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KART 2: CANLI ODAK SIRALAMASI (GÜNLÜK & HAFTALIK) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/85 border border-neutral-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>
                        {leaderboardPeriod === 'daily' ? 'Günün Canlı Odak Sıralaması' : 'Haftalık Canlı Odak Sıralaması'}
                      </span>
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {leaderboardPeriod === 'daily'
                        ? 'Bugün toplam çalışılan süreye (aktif çalışanların canlı saniyeleri dahil) göre sıralanır.'
                        : 'Bu hafta (Pazartesi–Pazar) toplam çalışılan odak süresine göre canlı sıralanır.'}
                    </p>
                  </div>

                  {/* Günlük | Haftalık ve Oda | Genel Seçiciler */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-950 border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setLeaderboardPeriod('daily');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          leaderboardPeriod === 'daily'
                            ? 'bg-[#ff5500] text-white'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Günlük
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setLeaderboardPeriod('weekly');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          leaderboardPeriod === 'weekly'
                            ? 'bg-[#ff5500] text-white'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Haftalık
                      </button>
                    </div>

                    {currentRoom.id !== 'room-all' && (
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-950 border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setLeaderboardScope('room')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            leaderboardScope === 'room'
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Bu Oda
                        </button>
                        <button
                          type="button"
                          onClick={() => setLeaderboardScope('all')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            leaderboardScope === 'all'
                              ? 'bg-neutral-800 text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Genel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {sortedLeaderboard.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-6 text-center">Henüz sıralama verisi yok.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedLeaderboard.slice(0, 15).map((student, idx) => {
                      const isStudying = student.status === 'studying';
                      const isOnBreak = student.status === 'break';
                      const isOnline = Boolean(student.isOnline || isStudying || isOnBreak || student.isCurrentUser);
                      const targetMinutes =
                        leaderboardPeriod === 'weekly'
                          ? student.weeklyTotalMinutes ?? student.todayTotalMinutes
                          : student.todayTotalMinutes;

                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            soundEngine.playClick();
                            setSelectedPeerId(student.id);
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            student.isCurrentUser
                              ? 'border-[#ff5500]/60 bg-[#ff5500]/10 hover:border-[#ff5500]'
                              : isStudying
                              ? 'border-emerald-500/40 bg-neutral-950/80 hover:border-emerald-400'
                              : 'border-neutral-800 bg-neutral-950/50 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-6 text-center font-mono text-xs font-extrabold shrink-0 ${
                                idx === 0
                                  ? 'text-amber-400'
                                  : idx === 1
                                  ? 'text-neutral-200'
                                  : idx === 2
                                  ? 'text-amber-600'
                                  : 'text-neutral-500'
                              }`}
                            >
                              #{idx + 1}
                            </span>

                            <div className="relative shrink-0">
                              {student.avatarUrl ? (
                                <img
                                  src={student.avatarUrl}
                                  alt={student.name}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover border border-neutral-700"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white">
                                  {student.initials}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-white truncate">
                                  {student.name}
                                </span>
                                {student.isCurrentUser && (
                                  <span className="text-[11px] font-bold text-[#ff5500]">(Sen)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] mt-0.5 flex-wrap">
                                <span
                                  className={`font-semibold ${
                                    isStudying
                                      ? 'text-emerald-400'
                                      : isOnBreak
                                      ? 'text-amber-300'
                                      : isOnline
                                      ? 'text-sky-400'
                                      : 'text-neutral-500'
                                  }`}
                                >
                                  {isStudying
                                    ? `Çalışıyor 🔥 (${formatSecsToMin(student.currentSeconds)})`
                                    : isOnBreak
                                    ? 'Molada ☕'
                                    : isOnline
                                    ? 'Çevrimiçi'
                                    : 'Çevrimdışı'}
                                </span>
                                <span className="text-neutral-600">·</span>
                                <span className="text-neutral-400 font-mono">
                                  🔥 {student.streakDays} gün seri
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs sm:text-sm font-mono font-extrabold text-emerald-400 tabular-nums block">
                              {formatMinutesWithLiveSecs(targetMinutes, student.status, student.currentSeconds)}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono block">
                              {leaderboardPeriod === 'daily' ? 'Bugün Canlı' : 'Bu Hafta Canlı'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ 5 KOLON: CANLI ODA SOHBETİ (CHAT) */}
            <div className="lg:col-span-5">
              <div className="p-5 rounded-3xl bg-neutral-900/85 border border-neutral-800 flex flex-col h-[620px]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#ff5500]" />
                      <span>Oda Sohbeti</span>
                    </h2>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {currentRoom.name} · Anlık Mesajlaşma
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-semibold">Canlı</span>
                </div>

                {/* Mesaj Listesi */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 mb-3">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 text-xs px-4">
                      <MessageSquare className="w-8 h-8 text-neutral-700 mb-2" />
                      <p className="font-semibold text-neutral-300">Sohbet hazır!</p>
                      <p className="mt-1">Bu odadaki arkadaşlarına ilk mesajı sen gönder.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const myUid =
                        currentUser?.uid ||
                        auth.currentUser?.uid ||
                        (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_uid') : null) ||
                        profile.userId;
                      const isMe = Boolean(
                        (myUid && msg.userId === myUid) ||
                          (profile.name && msg.userName.toLowerCase() === profile.name.trim().toLowerCase())
                      );
                      const msgDate = new Date(msg.createdAt || Date.now());
                      const timeLabel = `${String(msgDate.getHours()).padStart(2, '0')}:${String(
                        msgDate.getMinutes()
                      ).padStart(2, '0')}`;

                      const matchedPeer = livePeers.find(
                        (p) =>
                          p.id === msg.userId ||
                          p.name.toLowerCase() === msg.userName.toLowerCase() ||
                          (isMe && p.isCurrentUser)
                      );

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (matchedPeer) {
                                soundEngine.playClick();
                                setSelectedPeerId(matchedPeer.id);
                              }
                            }}
                            className="shrink-0 cursor-pointer focus:outline-none"
                            title={`${msg.userName} profilini gör`}
                          >
                            {msg.userAvatarUrl ? (
                              <img
                                src={msg.userAvatarUrl}
                                alt={msg.userName}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover border border-neutral-700 hover:border-[#ff5500] transition-colors"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                style={{ backgroundColor: msg.userAvatarColor || '#ff5500' }}
                              >
                                {msg.userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </button>

                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                              isMe
                                ? 'bg-[#ff5500] text-white rounded-tr-none'
                                : 'bg-neutral-800 text-neutral-100 rounded-tl-none border border-neutral-700/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (matchedPeer) {
                                    soundEngine.playClick();
                                    setSelectedPeerId(matchedPeer.id);
                                  }
                                }}
                                className="text-[10px] font-extrabold opacity-85 hover:underline cursor-pointer"
                              >
                                {msg.userName}
                              </button>
                              <span className="text-[9px] font-mono opacity-65">{timeLabel}</span>
                            </div>
                            <p className="break-words">{msg.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Mesaj Gönderme Formu */}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 pt-2.5 border-t border-neutral-800"
                >
                  <input
                    type="text"
                    placeholder="Odaya mesaj yaz..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gönder</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: SAĞ ÜST "ÖĞRENCİ LİSTESİ" PENCERESİ */}
      {/* ============================================================== */}
      {isStudentListModalOpen && (
        <div
          onClick={() => setIsStudentListModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[85vh] rounded-3xl border border-neutral-800 bg-[#101218] p-5 sm:p-6 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#ff5500]" />
                  <span>Tüm Öğrenciler Listesi ({filteredModalStudents.length})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Herhangi bir öğrencinin fotoğrafına veya üstüne basarak profilini ve aylık istatistiğini açabilirsin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentListModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Arama & Filtreler */}
            <div className="py-3.5 border-b border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Öğrenci adı, hedef üniversite veya ders ara..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {['all', 'studying', 'idle'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStudentStatusFilter(st as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      studentStatusFilter === st
                        ? 'bg-[#ff5500] text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {st === 'all' ? 'Tümü' : st === 'studying' ? 'Çalışanlar 🔥' : 'Çevrimiçi / Mola'}
                  </button>
                ))}
              </div>
            </div>

            {/* Öğrenci Listesi Kaydırılabilir Alan */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
              {filteredModalStudents.length === 0 ? (
                <p className="text-xs text-neutral-500 py-10 text-center">Aramanıza uygun öğrenci bulunamadı.</p>
              ) : (
                filteredModalStudents.map((peer) => {
                  const isStudying = peer.status === 'studying';
                  const isOnBreak = peer.status === 'break';
                  const isOnline = Boolean(peer.isOnline || isStudying || isOnBreak || peer.isCurrentUser);
                  const cooldownLeft = getCooldownMinutesLeft(peer.id);

                  return (
                    <div
                      key={peer.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedPeerId(peer.id);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isStudying
                          ? 'border-emerald-500/40 bg-neutral-950/90 hover:border-emerald-400'
                          : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {peer.avatarUrl ? (
                            <img
                              src={peer.avatarUrl}
                              alt={peer.name}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover border border-neutral-700"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-white">
                              {peer.initials}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                              isStudying
                                ? 'bg-emerald-500'
                                : isOnBreak
                                ? 'bg-amber-400'
                                : isOnline
                                ? 'bg-sky-400'
                                : 'bg-neutral-600'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">
                              {peer.name} {peer.isCurrentUser && '(Sen)'}
                            </span>
                            <span className="text-neutral-600">·</span>
                            <span
                              className={`text-xs font-bold ${
                                isStudying
                                  ? 'text-emerald-400'
                                  : isOnBreak
                                  ? 'text-amber-300'
                                  : isOnline
                                  ? 'text-sky-400'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {isStudying
                                ? `Çalışıyor 🔥 (${formatSecsToMin(peer.currentSeconds)})`
                                : isOnBreak
                                ? 'Molada ☕'
                                : isOnline
                                ? 'Çevrimiçi'
                                : 'Çevrimdışı'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            {peer.targetUniversity
                              ? `${peer.targetUniversity} · ${peer.targetDepartment || peer.roomName}`
                              : peer.roomName || 'YKS Hazırlık'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-mono font-extrabold text-emerald-400 tabular-nums block">
                            Bugün: {Math.floor(peer.todayTotalMinutes / 60)}s {peer.todayTotalMinutes % 60}dk
                          </span>
                          <span className="text-[11px] font-mono text-neutral-400 tabular-nums block">
                            Ay: {Math.floor((peer.monthlyTotalMinutes || peer.todayTotalMinutes) / 60)}s{' '}
                            {(peer.monthlyTotalMinutes || peer.todayTotalMinutes) % 60}dk
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleCheer(peer, e)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                            cooldownLeft > 0
                              ? 'bg-neutral-900 border-neutral-800 text-neutral-500'
                              : 'bg-[#ff5500]/15 border-[#ff5500]/50 text-[#ff5500] hover:bg-[#ff5500] hover:text-white'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>{cooldownLeft > 0 ? `${cooldownLeft}dk` : peer.cheersReceived || 'Alev'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ÖĞRENCİ PROFİLİ & AYLIK İSTATİSTİK PENCERESİ (PP / İSİM TIKLANINCA AÇILIR) */}
      {/* ============================================================== */}
      {selectedPeerProfile && (
        <div
          onClick={() => setSelectedPeerId(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#0d0f14] p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Kapat Butonu */}
            <button
              type="button"
              onClick={() => setSelectedPeerId(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Üst Kısım: PP + Ad Soyad + Durum + Hedef */}
            <div className="flex flex-col items-center text-center pt-2 pb-5 border-b border-neutral-800">
              <div className="relative mb-3">
                {selectedPeerProfile.avatarUrl ? (
                  <img
                    src={selectedPeerProfile.avatarUrl}
                    alt={selectedPeerProfile.name}
                    referrerPolicy="no-referrer"
                    className={`w-24 h-24 rounded-full object-cover border-4 shadow-xl ${
                      selectedPeerProfile.status === 'studying'
                        ? 'border-emerald-500'
                        : selectedPeerProfile.status === 'break'
                        ? 'border-amber-400'
                        : selectedPeerProfile.isOnline
                        ? 'border-sky-400'
                        : 'border-neutral-700'
                    }`}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-neutral-800 border-4 border-neutral-700 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                    {selectedPeerProfile.initials}
                  </div>
                )}
                <span
                  className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-black ${
                    selectedPeerProfile.status === 'studying'
                      ? 'bg-emerald-500'
                      : selectedPeerProfile.status === 'break'
                      ? 'bg-amber-400'
                      : selectedPeerProfile.isOnline
                      ? 'bg-sky-400'
                      : 'bg-neutral-600'
                  }`}
                />
              </div>

              <h3 className="text-xl font-extrabold text-white tracking-tight">
                {selectedPeerProfile.name}
              </h3>

              <p className="text-xs text-neutral-400 mt-1">
                {selectedPeerProfile.targetUniversity
                  ? `${selectedPeerProfile.targetUniversity} · ${selectedPeerProfile.targetDepartment || selectedPeerProfile.roomName}`
                  : `${selectedPeerProfile.roomName || 'YKS 2026'} Hedefi`}
              </p>

              {/* Canlı Durum Satırı */}
              <div className="mt-2.5 text-xs font-bold">
                {selectedPeerProfile.status === 'studying' ? (
                  <span className="text-emerald-400 font-mono">
                    Çalışıyor 🔥 · {selectedPeerProfile.currentSubject || 'Odaklanma'} (
                    {formatSecsToMin(selectedPeerProfile.currentSeconds)})
                  </span>
                ) : selectedPeerProfile.status === 'break' ? (
                  <span className="text-amber-300 font-mono">
                    Molada ☕ · {formatSecsToMin(selectedPeerProfile.currentSeconds)}
                  </span>
                ) : selectedPeerProfile.isOnline ? (
                  <span className="text-sky-400">Çevrimiçi · Aktif</span>
                ) : (
                  <span className="text-neutral-500">
                    Çevrimdışı ({formatLastSeen(selectedPeerProfile.lastActiveAt)})
                  </span>
                )}
              </div>

              {/* Moral Alevi Gönder Butonu */}
              <button
                type="button"
                onClick={(e) => handleCheer(selectedPeerProfile, e)}
                className="mt-4 px-5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-[#ff5500]/25 flex items-center gap-2 active:scale-95"
              >
                <Flame className="w-4 h-4 fill-current" />
                <span>
                  Moral Alevi Gönder ({selectedPeerProfile.cheersReceived || 0})
                </span>
              </button>
            </div>

            {/* Alt Kısım: AYLIK İSTATİSTİK ÖZETİ */}
            {(() => {
              const monthMins =
                selectedPeerProfile.monthlyTotalMinutes ??
                selectedPeerProfile.weeklyTotalMinutes ??
                selectedPeerProfile.todayTotalMinutes;
              const weekMins =
                selectedPeerProfile.weeklyTotalMinutes ?? selectedPeerProfile.todayTotalMinutes;
              const todayMins = selectedPeerProfile.todayTotalMinutes;
              const activeDays = Math.max(
                monthMins > 0 ? 1 : 0,
                selectedPeerProfile.monthlyActiveDays || 1
              );
              const dailyAvgMins = monthMins > 0 ? Math.round(monthMins / activeDays) : 0;
              const monthlyGoalMins = (selectedPeerProfile.dailyGoalHours || 6) * 30 * 60;
              const monthProgressPct = Math.min(100, Math.round((monthMins / Math.max(60, monthlyGoalMins)) * 100));

              return (
                <div className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#ff5500]" />
                      <span>Aylık Odak İstatistiği</span>
                    </h4>
                    <span className="text-[11px] font-mono text-neutral-400">
                      🔥 {selectedPeerProfile.streakDays} Gün Seri
                    </span>
                  </div>

                  {/* Ana Aylık Saat Kartı */}
                  <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="text-[11px] text-neutral-400 block">Bu Ay Toplam Çalışma</span>
                        <span className="text-2xl font-black text-white font-mono tabular-nums">
                          {formatMinutesWithLiveSecs(
                            monthMins,
                            selectedPeerProfile.status,
                            selectedPeerProfile.currentSeconds
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        %{monthProgressPct} Aylık Hedef
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${ Math.max(4, monthProgressPct) }%` }}
                      />
                    </div>
                  </div>

                  {/* 4'lü Aylık Metrik Izgarası */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Bugün Çalışılan</span>
                      </span>
                      <p className="text-sm font-extrabold text-white font-mono tabular-nums mt-1">
                        {Math.floor(todayMins / 60)} saat {todayMins % 60} dk
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                        <span>Bu Hafta Toplam</span>
                      </span>
                      <p className="text-sm font-extrabold text-white font-mono tabular-nums mt-1">
                        {Math.floor(weekMins / 60)} saat {weekMins % 60} dk
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Aylık Günlük Ort.</span>
                      </span>
                      <p className="text-sm font-extrabold text-white font-mono tabular-nums mt-1">
                        {Math.floor(dailyAvgMins / 60)}s {dailyAvgMins % 60}dk / gün
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-[#ff5500]" />
                        <span>Aylık Favori Ders</span>
                      </span>
                      <p className="text-xs font-extrabold text-white truncate mt-1.5">
                        {selectedPeerProfile.favoriteSubject || 'Genel Odak'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: Oda Kurma */}
      {isCreateRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-[#ff5500]" />
                <span>Yeni Çalışma Odası Kur</span>
              </h3>
              <button
                onClick={() => setIsCreateRoomOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Oda Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 2026 Sayısal Derece Masası"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Kategori / Alan</label>
                <select
                  value={newRoomCategory}
                  onChange={(e) => setNewRoomCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="Sayısal">Sayısal</option>
                  <option value="Eşit Ağırlık">Eşit Ağırlık</option>
                  <option value="Sözel">Sözel</option>
                  <option value="Dil">Dil</option>
                  <option value="KPSS">KPSS</option>
                  <option value="Tıp / YKS">Tıp / YKS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Oda Açıklaması</label>
                <input
                  type="text"
                  placeholder="Günde 6 saat çalışma hedefi olanlar..."
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">Oda Gizlilik Türü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrivateRoom(false);
                      setNewRoomPassword('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      !isPrivateRoom
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold">Herkese Açık</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block">Şifresiz, herkes katılabilir.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrivateRoom(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isPrivateRoom
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold">Özel / Şifreli</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block">Sadece şifreyi bilenler girer.</span>
                  </button>
                </div>
              </div>

              {isPrivateRoom && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <label className="block text-xs font-bold text-amber-300 mb-1.5">Oda Şifresi *</label>
                  <input
                    type="password"
                    required
                    placeholder="Örn: derece2026"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black border border-amber-500/40 text-white font-mono"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold shadow-md shadow-[#ff5500]/20 cursor-pointer"
                >
                  Odayı Kur & Katıl
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Şifreli Odaya Katılma */}
      {passwordModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">{passwordModalRoom.name}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Bu odaya katılmak için lütfen oda şifresini giriniz.
            </p>

            <form onSubmit={handleConfirmPassword} className="space-y-3">
              <input
                type="password"
                required
                autoFocus
                placeholder="Oda şifresi..."
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setPasswordError('');
                }}
                className="w-full px-3.5 py-2.5 text-center text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500] font-mono"
              />

              {passwordError && <p className="text-[11px] text-red-400 font-medium">{passwordError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold cursor-pointer"
                >
                  Onayla & Gir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Oda Düzenleme */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-sky-400" />
                <span>Çalışma Odasını Düzenle</span>
              </h3>
              <button
                onClick={() => setEditingRoom(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Oda Adı *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Kategori / Alan</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="Sayısal">Sayısal</option>
                  <option value="Eşit Ağırlık">Eşit Ağırlık</option>
                  <option value="Sözel">Sözel</option>
                  <option value="Dil">Dil</option>
                  <option value="KPSS">KPSS</option>
                  <option value="Tıp / YKS">Tıp / YKS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">Oda Açıklaması</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Oda Silme Onayı */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">Odayı Silmek İstiyor Musunuz?</h3>
            <p className="text-xs text-neutral-400 mb-5">
              <strong className="text-white">"{roomToDelete.name}"</strong> odası kalıcı olarak silinecektir.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white text-xs font-bold cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Odayı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 6 Haneli Kod ile Odaya Katıl */}
      {isJoinByCodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5500]/20 text-[#ff5500] flex items-center justify-center mx-auto mb-3">
              <Hash className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">6 Haneli Kod ile Katıl</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Arkadaşının paylaştığı 6 haneli oda kodunu girerek doğrudan çalışma masasına katıl.
            </p>

            <form onSubmit={handleJoinByCode} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                maxLength={7}
                placeholder="Örn: 849201"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value);
                  setJoinCodeError('');
                }}
                className="w-full px-4 py-3 text-center text-base font-extrabold tracking-widest rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500] font-mono"
              />

              {joinCodeError && <p className="text-[11px] text-rose-400 font-medium">{joinCodeError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinByCodeOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Odaya Katıl</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
