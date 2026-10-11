import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Flame,
  Search,
  Trophy,
  Trees,
  Mountain,
  Plane,
  Waves,
  Radio,
  Clock,
  GraduationCap,
  Plus,
  Lock,
  DoorOpen,
  MessageSquare,
  Send,
  X,
  KeyRound,
  ShieldCheck,
  Globe,
  Sparkles,
  AlertCircle,
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
  SlidersHorizontal
} from 'lucide-react';
import { StudentPeer, StudyRoom, UserProfile, RoomChatMessage } from '../types';
import { soundEngine } from '../utils/audio';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DEFAULT_ROOMS } from '../utils/storage';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  orderBy,
  limit,
  arrayUnion
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

export const StudentsView: React.FC<StudentsViewProps> = ({
  peers,
  profile,
  currentUser,
  onCheerPeer,
  isCurrentUserStudying = false,
  activeViewTab = 'students',
  onSwitchTab,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [livePeers, setLivePeers] = useState<StudentPeer[]>([]);

  // Room State with Persistent Caching (Never vanishes on exit/refresh)
  const [rooms, setRooms] = useState<StudyRoom[]>(() => {
    try {
      const cached = localStorage.getItem(ROOMS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StudyRoom[];
        if (parsed.length > 0) return parsed;
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

  // Toast notice for cheer actions & room updates (cooldown warning or success)
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
  const [isPrivateRoom, setIsPrivateRoom] = useState(false); // Herkese Açık vs Özel/Gizli
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
        const cached = localStorage.getItem(ROOMS_CACHE_KEY);
        const parsed = cached ? (JSON.parse(cached) as StudyRoom[]) : DEFAULT_ROOMS;
        const found = parsed.find((r: StudyRoom) => r.id === savedRoomId);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sub-tab when inside students view: 'room' or 'all'
  const [studentViewSubTab, setStudentViewSubTab] = useState<'room' | 'all'>('room');

  // Filters for efficient all students view
  const [studentTrackFilter, setStudentTrackFilter] = useState<string>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'studying' | 'idle'>('all');
  const [studentSortBy, setStudentSortBy] = useState<'time' | 'cheers' | 'streak'>('time');

  // Filters for rooms view
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>('all');
  const [roomPrivacyFilter, setRoomPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');

  // Sync activeChatRoom when rooms are updated from Firestore
  useEffect(() => {
    if (activeChatRoom) {
      const updated = rooms.find((r) => r.id === activeChatRoom.id);
      if (updated) {
        setActiveChatRoom(updated);
      }
    }
  }, [rooms]);

  // Leave active room
  const handleLeaveRoom = () => {
    soundEngine.playClick();
    const roomName = activeChatRoom?.name || 'Oda';
    setActiveChatRoom(null);
    setSelectedRoomId('room-all');
    try {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
    } catch {
      // ignore
    }
    setCheerToast({
      message: `"${roomName}" masasından başarıyla ayrıldınız. 👋`,
      type: 'success',
    });
  };

  // Auto-dismiss cheer toasts after 4 seconds
  useEffect(() => {
    if (!cheerToast) return;
    const t = setTimeout(() => setCheerToast(null), 4000);
    return () => clearTimeout(t);
  }, [cheerToast]);

  // Helper: check how many minutes left for a peer's cheer cooldown
  const getCooldownMinutesLeft = (peerId: string) => {
    const lastCheered = cheerCooldowns[peerId];
    if (!lastCheered) return 0;
    const elapsed = Date.now() - lastCheered;
    if (elapsed >= ONE_HOUR_MS) return 0;
    return Math.ceil((ONE_HOUR_MS - elapsed) / 60000);
  };

  // Helper: check if current user is an authorized participant in the room
  const isUserRoomParticipant = (room: StudyRoom) => {
    if (!room.isPrivate && !room.hasPassword) return true;
    if (currentUser && room.createdBy === currentUser.uid) return true;
    if (currentUser && room.participants?.includes(currentUser.uid)) return true;
    return Boolean(unlockedRoomIds[room.id]);
  };

  // Helper: check if current user is the owner/creator of the room
  const isRoomOwner = (room: StudyRoom) => {
    if (
      room.id === 'room-all' ||
      room.id === 'room-yks-say' ||
      room.id === 'room-yks-ea' ||
      room.id === 'room-kpss' ||
      room.id === 'room-kod'
    ) {
      return false; // Sistem varsayılan şablon odaları silinemez
    }
    if (currentUser && room.createdBy && room.createdBy === currentUser.uid) return true;
    if (myCreatedRoomIds[room.id]) return true;
    if (room.createdByName && room.createdByName === profile.name) return true;
    return false;
  };

  // Copy code or password with visual feedback
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

  // Open Room Edit Modal
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

  // Save Room Edit
  const handleSaveEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editName.trim()) return;

    if (editIsPrivate && !editPassword.trim()) {
      alert('Özel oda oluşturmak veya güncellemek için lütfen bir şifre belirleyin.');
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
      password: editIsPrivate ? editPassword.trim() : undefined,
    };

    // Update in Firestore
    if (currentUser) {
      try {
        const roomRef = doc(db, 'study_rooms', editingRoom.id);
        await updateDoc(roomRef, {
          name: updatedRoom.name,
          category: updatedRoom.category,
          targetExam: updatedRoom.targetExam,
          description: updatedRoom.description,
          isPrivate: updatedRoom.isPrivate,
          hasPassword: updatedRoom.hasPassword,
          password: updatedRoom.password || null,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.warn('Edit room firestore update notice:', err);
      }
    }

    // Update local state
    const nextRooms = rooms.map((r) => (r.id === editingRoom.id ? updatedRoom : r));
    setRooms(nextRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(nextRooms));
    } catch {
      // ignore
    }

    if (activeChatRoom?.id === editingRoom.id) {
      setActiveChatRoom(updatedRoom);
    }

    setEditingRoom(null);
    setCheerToast({
      message: `"${updatedRoom.name}" odası başarıyla güncellendi! ✓`,
      type: 'success',
    });
  };

  // Prompt Room Deletion
  const handlePromptDeleteRoom = (room: StudyRoom, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundEngine.playClick();
    setRoomToDelete(room);
  };

  // Confirm Room Deletion
  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    soundEngine.playClick();

    const targetId = roomToDelete.id;
    const targetName = roomToDelete.name;

    // Delete in Firestore
    if (currentUser) {
      try {
        const roomRef = doc(db, 'study_rooms', targetId);
        await deleteDoc(roomRef);
      } catch (err) {
        console.warn('Delete room firestore notice:', err);
      }
    }

    // Update local state
    const nextRooms = rooms.filter((r) => r.id !== targetId);
    setRooms(nextRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(nextRooms));
    } catch {
      // ignore
    }

    // If active room is the one being deleted, reset cleanly
    if (activeChatRoom?.id === targetId) {
      setActiveChatRoom(null);
      setSelectedRoomId('room-all');
      try {
        localStorage.removeItem(ACTIVE_ROOM_KEY);
      } catch {
        // ignore
      }
    }

    setRoomToDelete(null);
    setCheerToast({
      message: `"${targetName}" odası başarıyla silindi.`,
      type: 'success',
    });
  };

  // Join Room By 6-Digit Code
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().replace(/^#/, '');
    if (!cleanCode) return;

    soundEngine.playClick();
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

  // 1. Real-time Firestore sync with all registered students
  useEffect(() => {
    try {
      const usersCol = collection(db, 'users');
      const unsubscribe = onSnapshot(
        usersCol,
        (snapshot) => {
          const cloudPeers: StudentPeer[] = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isMe = currentUser ? docSnap.id === currentUser.uid : false;

            const peerName = data.name || data.displayName || 'Öğrenci';
            const initials = peerName
              .split(' ')
              .map((p: string) => p[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'Ö';

            let finalStatus: 'studying' | 'break' | 'idle' = data.status === 'studying' ? 'studying' : data.status === 'break' ? 'break' : 'idle';
            if (isMe) {
              finalStatus = isCurrentUserStudying ? 'studying' : 'idle';
            }

            cloudPeers.push({
              id: docSnap.id,
              name: peerName,
              initials,
              avatarBg: data.avatarColor ? '' : 'bg-emerald-600',
              avatarUrl: data.avatarUrl || '',
              status: finalStatus,
              currentSubject: data.currentSubject || (isMe && profile.currentSubject) || 'Genel Odak',
              currentMode: data.currentMode || (isMe && profile.currentMode) || 'forest',
              currentSeconds: data.currentSeconds || 0,
              todayTotalMinutes: data.todayTotalMinutes || 0,
              roomName: data.targetExam || data.studyTrack || 'Sayısal',
              streakDays: data.streakDays || data.currentStreakDays || 0,
              cheersReceived: data.cheersReceived || 0,
              targetUniversity: data.targetUniversity || '',
              targetDepartment: data.targetDepartment || '',
              targetExam: data.targetExam || '',
              isCurrentUser: isMe,
            });
          });

          if (currentUser && !cloudPeers.some((p) => p.id === currentUser.uid)) {
            cloudPeers.push({
              id: currentUser.uid,
              name: profile.name,
              initials: profile.initials,
              avatarBg: 'bg-[#ff5500]',
              avatarUrl: profile.avatarUrl,
              status: isCurrentUserStudying ? 'studying' : 'idle',
              currentSubject: profile.currentSubject || 'Genel Odak',
              currentMode: profile.currentMode || 'forest',
              currentSeconds: 0,
              todayTotalMinutes: profile.todayTotalMinutes || 0,
              roomName: profile.targetExam,
              streakDays: profile.currentStreakDays,
              cheersReceived: profile.cheersReceived || 0,
              targetUniversity: profile.targetUniversity,
              targetDepartment: profile.targetDepartment,
              targetExam: profile.targetExam,
              isCurrentUser: true,
            });
          }

          setLivePeers(cloudPeers);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );

      return () => unsubscribe();
    } catch {
      // fallback
    }
  }, [currentUser, profile, isCurrentUserStudying]);

  // 2. Real-time Firestore sync for study rooms (Always persistent)
  useEffect(() => {
    try {
      const roomsCol = collection(db, 'study_rooms');
      const unsubscribe = onSnapshot(
        roomsCol,
        (snapshot) => {
          const list: StudyRoom[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as StudyRoom);
          });

          // Merge Firestore rooms with default templates
          const combined = [...list];
          DEFAULT_ROOMS.forEach((def) => {
            if (!combined.some((c) => c.id === def.id)) {
              combined.push(def);
            }
          });

          combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setRooms(combined);

          try {
            localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(combined));
          } catch {
            // ignore
          }
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

  // 3. Real-time Room Chat messages listener
  useEffect(() => {
    if (!activeChatRoom) return;

    try {
      const messagesCol = collection(db, 'study_rooms', activeChatRoom.id, 'messages');
      const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(80));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: RoomChatMessage[] = [];
        snapshot.forEach((snap) => {
          msgs.push({ id: snap.id, ...snap.data() } as RoomChatMessage);
        });
        setChatMessages(msgs);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });

      return () => unsubscribe();
    } catch {
      // fallback
    }
  }, [activeChatRoom]);

  // 4. Live ticker for studying peers (seconds count up)
  useEffect(() => {
    const interval = window.setInterval(() => {
      setLivePeers((prev) =>
        prev.map((p) => {
          if (p.status === 'studying') {
            return { ...p, currentSeconds: p.currentSeconds + 1 };
          }
          return p;
        })
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Cheer Peer action with 1-HOUR ANTI-SPAM RULE
  const handleCheer = async (peer: StudentPeer) => {
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

    // Update cooldown
    const now = Date.now();
    const updatedCooldowns = { ...cheerCooldowns, [peer.id]: now };
    setCheerCooldowns(updatedCooldowns);
    try {
      localStorage.setItem(CHEER_COOLDOWN_KEY, JSON.stringify(updatedCooldowns));
    } catch {
      // ignore
    }

    setCheerToast({
      message: `${peer.name} öğrencisine moral alevi başarıyla gönderildi! 🔥`,
      type: 'success',
    });

    setLivePeers((prev) =>
      prev.map((p) => (p.id === peer.id ? { ...p, cheersReceived: p.cheersReceived + 1 } : p))
    );

    try {
      const peerRef = doc(db, 'users', peer.id);
      await setDoc(
        peerRef,
        {
          cheersReceived: increment(1),
        },
        { merge: true }
      );

      const cheerId = `cheer-${now}`;
      const cheerRef = doc(db, 'users', peer.id, 'cheers', cheerId);
      await setDoc(cheerRef, {
        id: cheerId,
        fromUserId: currentUser?.uid || 'guest',
        fromUserName: profile.name,
        fromUserAvatarUrl: profile.avatarUrl || '',
        toUserId: peer.id,
        createdAt: now,
        read: false,
      });
    } catch {
      // ignore
    }
  };

  // Create New Room (Public vs Private)
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    if (isPrivateRoom && !newRoomPassword.trim()) {
      alert('Özel oda oluşturmak için lütfen bir şifre belirleyin.');
      return;
    }

    soundEngine.playClick();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const roomId = `room-${Date.now()}`;
    const myUid = currentUser?.uid || 'guest';

    const newRoom: StudyRoom = {
      id: roomId,
      code,
      name: newRoomName.trim(),
      category: newRoomCategory,
      description: newRoomDesc.trim() || 'Birlikte odaklanıp hedeflerimize ulaşıyoruz.',
      targetExam: newRoomCategory,
      createdBy: myUid,
      createdByName: profile.name,
      createdAt: Date.now(),
      isPrivate: isPrivateRoom,
      hasPassword: isPrivateRoom,
      password: isPrivateRoom ? newRoomPassword.trim() : undefined,
      memberCount: 1,
      onlineCount: 1,
      participants: [myUid],
    };

    // Save to Firestore
    try {
      await setDoc(doc(db, 'study_rooms', roomId), newRoom);
    } catch (err) {
      console.error('Room create error', err);
    }

    // Update local cached state
    const updatedRooms = [newRoom, ...rooms];
    setRooms(updatedRooms);
    try {
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(updatedRooms));
    } catch {
      // ignore
    }

    // Auto-unlock for creator
    const nextUnlocked = { ...unlockedRoomIds, [roomId]: true };
    setUnlockedRoomIds(nextUnlocked);
    try {
      localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));
    } catch {
      // ignore
    }

    // Record room as created by current user
    const nextMyRooms = { ...myCreatedRoomIds, [roomId]: true };
    setMyCreatedRoomIds(nextMyRooms);
    try {
      localStorage.setItem(MY_CREATED_ROOMS_KEY, JSON.stringify(nextMyRooms));
    } catch {
      // ignore
    }

    setNewRoomName('');
    setNewRoomDesc('');
    setNewRoomPassword('');
    setIsPrivateRoom(false);
    setIsCreateRoomOpen(false);
    setSelectedRoomId(roomId);
    setActiveChatRoom(newRoom);
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
    } catch {
      // ignore
    }
    setStudentViewSubTab('room');
    onSwitchTab?.('students');
    setCheerToast({
      message: `"${newRoom.name}" odanız başarıyla kuruldu ve masaya geçtiniz! 🚀`,
      type: 'success',
    });
  };

  // Join Room verification
  const handleAttemptJoinRoom = (room: StudyRoom) => {
    soundEngine.playClick();
    setSelectedRoomId(room.id);

    // If private and user not participant, show password modal
    if ((room.isPrivate || room.hasPassword) && !isUserRoomParticipant(room)) {
      setPasswordModalRoom(room);
      setEnteredPassword('');
      setPasswordError('');
      setActiveChatRoom(room); // active for showing the locked screen
    } else {
      setActiveChatRoom(room);
      try {
        localStorage.setItem(ACTIVE_ROOM_KEY, room.id);
      } catch {
        // ignore
      }
      setStudentViewSubTab('room');
      onSwitchTab?.('students');
      setCheerToast({
        message: `"${room.name}" odasına katıldınız! Masanız hazır. ✨`,
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

    // Record as unlocked locally
    const nextUnlocked = { ...unlockedRoomIds, [targetRoomId]: true };
    setUnlockedRoomIds(nextUnlocked);
    try {
      localStorage.setItem(UNLOCKED_ROOMS_KEY, JSON.stringify(nextUnlocked));
    } catch {
      // ignore
    }

    // Add user to room's participants in Firestore
    if (currentUser) {
      try {
        const roomDocRef = doc(db, 'study_rooms', targetRoomId);
        await setDoc(
          roomDocRef,
          {
            participants: arrayUnion(currentUser.uid),
            memberCount: increment(1),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }
    }

    setSelectedRoomId(targetRoomId);
    setActiveChatRoom(passwordModalRoom);
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, targetRoomId);
    } catch {
      // ignore
    }
    setPasswordModalRoom(null);
    setStudentViewSubTab('room');
    onSwitchTab?.('students');
    setCheerToast({
      message: `"${passwordModalRoom.name}" odasına başarıyla katıldınız! ✨`,
      type: 'success',
    });
  };

  // Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChatRoom) return;

    soundEngine.playClick();
    const text = messageInput.trim();
    setMessageInput('');

    const msgId = `msg-${Date.now()}`;
    const newMsg: RoomChatMessage = {
      id: msgId,
      roomId: activeChatRoom.id,
      userId: currentUser?.uid || 'guest',
      userName: profile.name,
      userAvatarUrl: profile.avatarUrl,
      userAvatarColor: profile.avatarColor,
      text,
      createdAt: Date.now(),
    };

    try {
      const msgRef = doc(db, 'study_rooms', activeChatRoom.id, 'messages', msgId);
      await setDoc(msgRef, newMsg);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const formatSecsToMin = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins} dk ${String(remainderSecs).padStart(2, '0')} sn`;
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
        return <Trees className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  // Filter peers by search & track & status
  const filteredPeers = livePeers.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.currentSubject.toLowerCase().includes(query) ||
      (p.targetUniversity && p.targetUniversity.toLowerCase().includes(query)) ||
      (p.targetDepartment && p.targetDepartment.toLowerCase().includes(query)) ||
      (p.roomName && p.roomName.toLowerCase().includes(query));

    const matchesTrack =
      studentTrackFilter === 'all' ||
      (p.roomName && p.roomName.toLowerCase().includes(studentTrackFilter.toLowerCase())) ||
      (p.targetExam && p.targetExam.toLowerCase().includes(studentTrackFilter.toLowerCase()));

    const matchesStatus =
      studentStatusFilter === 'all' ||
      (studentStatusFilter === 'studying' && p.status === 'studying') ||
      (studentStatusFilter === 'idle' && p.status !== 'studying');

    return matchesSearch && matchesTrack && matchesStatus;
  });

  // Sorted peers
  const sortedPeers = [...filteredPeers].sort((a, b) => {
    if (studentSortBy === 'time') {
      return b.todayTotalMinutes - a.todayTotalMinutes;
    }
    if (studentSortBy === 'cheers') {
      return (b.cheersReceived || 0) - (a.cheersReceived || 0);
    }
    if (studentSortBy === 'streak') {
      return b.streakDays - a.streakDays;
    }
    return a.name.localeCompare(b.name);
  });

  // Active studying peers
  const activeStudyingPeers = livePeers.filter((p) => p.status === 'studying');

  // Peers in current active room
  const roomPeers = activeChatRoom?.id === 'room-all'
    ? livePeers
    : livePeers.filter((p) => {
        if (!activeChatRoom) return false;
        if (p.roomName === activeChatRoom.category || p.targetExam === activeChatRoom.targetExam) return true;
        return false;
      });
  const displayRoomPeers = roomPeers.length > 0 ? roomPeers : livePeers;

  // Filter rooms for Rooms Tab
  const filteredRooms = rooms.filter((r) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      r.name.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.category.toLowerCase().includes(query);

    const matchesCategory =
      roomCategoryFilter === 'all' || r.category === roomCategoryFilter;

    const matchesPrivacy =
      roomPrivacyFilter === 'all' ||
      (roomPrivacyFilter === 'public' && !r.isPrivate && !r.hasPassword) ||
      (roomPrivacyFilter === 'private' && (r.isPrivate || r.hasPassword));

    return matchesSearch && matchesCategory && matchesPrivacy;
  });

  // Leaderboard ranking by today's total studied minutes
  const leaderboard = [...livePeers].sort((a, b) => b.todayTotalMinutes - a.todayTotalMinutes);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Toast Alert for Cheer / Flame Actions */}
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
              className="p-1 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW A: ODALAR SEKMESİ (Mevcut Sistemdeki Çalışma Odaları Listesi) */}
      {/* ============================================================== */}
      {activeViewTab === 'rooms' && (
        <div>
          {/* Top Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DoorOpen className="w-4 h-4 text-[#ff5500]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#ff5500]">
                  CANLI ÇALIŞMA ODALARI
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Çalışma Odaları & Masalar ({rooms.length})
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Mevcut masalara katılabilir veya arkadaşlarınla çalışmak için yeni bir oda açabilirsin.
              </p>
            </div>

            {/* Actions: Search, Join by Code & Create Room */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Oda veya alan ara..."
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
                title="6 Haneli Oda Kodu ile Katıl"
              >
                <Hash className="w-3.5 h-3.5 text-[#ff5500]" />
                <span>Kodla Katıl</span>
              </button>

              <button
                onClick={() => setIsCreateRoomOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Oda Kur</span>
              </button>
            </div>
          </div>

          {/* Aktif Bir Odan Varsa Gösterilen Hatırlatma Çubuğu */}
          {activeChatRoom && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Şu Anda Katıldığın Oda
                  </span>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white">
                      {activeChatRoom.name}
                    </h4>
                    <span className="text-xs text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                      {activeChatRoom.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onSwitchTab?.('students');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <span>Odaya Git</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-neutral-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  title="Odadan Ayrıl"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Odadan Ayrıl</span>
                </button>
              </div>
            </div>
          )}

          {/* Filtre Butonları (Alan & Gizlilik) */}
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

          {/* Odalar Izgarası */}
          {filteredRooms.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800">
              <DoorOpen className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-300">Filtrenize uygun oda bulunamadı</p>
              <p className="text-xs text-neutral-500 mt-1">Farklı bir alan seçebilir veya yeni bir oda kurabilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const isCurrentActive = activeChatRoom?.id === room.id;
                const isPrivate = room.isPrivate || room.hasPassword;
                const isUnlocked = isUserRoomParticipant(room);
                const isOwner = isRoomOwner(room);

                return (
                  <div
                    key={room.id}
                    onClick={() => handleAttemptJoinRoom(room)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isCurrentActive
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-lg ring-2 ring-emerald-500/40'
                        : isPrivate && !isUnlocked
                        ? 'border-neutral-800 bg-neutral-950/50 hover:border-amber-500/50'
                        : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 truncate">
                          {isPrivate && (
                            <Lock className={`w-3.5 h-3.5 shrink-0 ${isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`} />
                          )}
                          <h3 className="text-sm font-bold text-white truncate">{room.name}</h3>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 ${
                          isCurrentActive
                            ? 'bg-emerald-500 text-white'
                            : isPrivate
                            ? isUnlocked
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700/60'
                        }`}>
                          {isCurrentActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Aktif Masan</span>
                            </>
                          ) : isPrivate ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>{isUnlocked ? 'Katıldın' : 'Özel'}</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3" />
                              <span>Açık</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                        {room.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                      <span className="text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                        {room.category}
                      </span>

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
                          <span>{isCurrentActive ? 'Odaya Git' : isPrivate && !isUnlocked ? 'Şifreyle Gir' : 'Odaya Gir'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW B: ÖĞRENCİLER SEKMESİ (Doğrudan Girilen Oda Veya Tüm Öğrenciler) */}
      {/* ============================================================== */}
      {activeViewTab === 'students' && (
        <div>
          {/* CASE 1: KULLANICI BİR ODAYA GİRMİŞ DURUMDA ("normalde öğrencilere basınca benim girdiğim odada olayım direkt") */}
          {activeChatRoom ? (
            <div className="space-y-6">
              {/* Aktif Oda Ana Başlık Kartı */}
              <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-[#ff5500]/40 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#ff5500]/20 text-[#ff5500] flex items-center justify-center shrink-0">
                      <DoorOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-extrabold text-white">
                          {activeChatRoom.name}
                        </h2>
                        <span className="text-xs text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          {activeChatRoom.category}
                        </span>
                        {(activeChatRoom.isPrivate || activeChatRoom.hasPassword) ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Özel Masa</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            <span>Herkese Açık</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{activeChatRoom.description}</p>
                    </div>
                  </div>

                  {/* Sağ Kontroller: Düzenle, Sil, ve ODADAN ÇIKIŞ BUTONU */}
                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                    {isRoomOwner(activeChatRoom) && (
                      <>
                        <button
                          onClick={(e) => handleOpenEditRoom(activeChatRoom, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 hover:text-white border border-neutral-700 transition-all cursor-pointer active:scale-95 shadow-sm"
                          title="Odayı Düzenle"
                        >
                          <Pencil className="w-3.5 h-3.5 text-sky-400" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          onClick={(e) => handlePromptDeleteRoom(activeChatRoom, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-400 border border-rose-500/30 transition-all cursor-pointer active:scale-95 shadow-sm"
                          title="Odayı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Sil</span>
                        </button>
                      </>
                    )}

                    {/* ODADAN ÇIK BUTONU (Kullanıcı istediğinde odadan ayrılır) */}
                    <button
                      onClick={handleLeaveRoom}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-rose-500/20 text-neutral-200 hover:text-rose-400 border border-neutral-700/80 hover:border-rose-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Bu çalışma masasından ayrıl"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Odadan Ayrıl</span>
                    </button>
                  </div>
                </div>

                {/* ODA KODLARI ODAYA GİRİLİNCE GÖRÜLÜR (Oda Kodu & Şifre Bilgisi) */}
                <div className="mt-4 p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Oda Kodu ve Kopyalama */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700/80 text-xs font-mono">
                      <Hash className="w-3.5 h-3.5 text-[#ff5500]" />
                      <span className="text-neutral-400">Oda Kodu:</span>
                      <strong className="text-white tracking-wider text-sm">#{activeChatRoom.code}</strong>
                      <button
                        onClick={() => handleCopyText(activeChatRoom.code, 'code')}
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

                    {/* Özel Oda İse Şifre Gösterme & Kopyalama */}
                    {(activeChatRoom.isPrivate || activeChatRoom.hasPassword) && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300">Oda Şifresi:</span>
                        <strong className="text-amber-200 text-sm">
                          {showRoomPassword ? (activeChatRoom.password || '—') : '••••••'}
                        </strong>
                        <button
                          onClick={() => setShowRoomPassword(!showRoomPassword)}
                          className="p-1 rounded-lg text-amber-400/80 hover:text-amber-200 cursor-pointer"
                          title={showRoomPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                        >
                          {showRoomPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {activeChatRoom.password && (
                          <button
                            onClick={() => handleCopyText(activeChatRoom.password!, 'password')}
                            className="p-1 rounded-lg text-amber-400/80 hover:text-amber-200 cursor-pointer"
                            title="Şifreyi Kopyala"
                          >
                            {copiedField === 'password' ? (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Kopyalandı
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] text-neutral-500 hidden md:inline">
                    Arkadaşlarını odaya davet etmek için 6 haneli oda kodunu paylaşabilirsin.
                  </span>
                </div>

                {/* Alt Sekme Seçici: Odamızın Masası & Sohbet vs Tüm Öğrenciler */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-800">
                  <button
                    onClick={() => setStudentViewSubTab('room')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      studentViewSubTab === 'room'
                        ? 'bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/25'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700'
                    }`}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Odamızın Masası & Sohbet</span>
                  </button>

                  <button
                    onClick={() => setStudentViewSubTab('all')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      studentViewSubTab === 'all'
                        ? 'bg-[#ff5500] text-white shadow-md shadow-[#ff5500]/25'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Tüm Öğrencileri Gör (Topluluk)</span>
                  </button>
                </div>
              </div>

              {/* Alt İçerik 1: ODA MASASI VE SOHBETİ */}
              {studentViewSubTab === 'room' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Sol 7 Kolon: Odadaki Çalışanlar */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span>Bu Masadaki Öğrenciler ({displayRoomPeers.length})</span>
                        </h3>
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Canlı Takip</span>
                        </span>
                      </div>

                      <div className="space-y-3">
                        {displayRoomPeers.map((peer) => {
                          const cooldownLeft = getCooldownMinutesLeft(peer.id);
                          const isStudying = peer.status === 'studying';

                          return (
                            <div
                              key={peer.id}
                              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                                isStudying
                                  ? 'border-emerald-500/40 bg-neutral-900/90 shadow-md shadow-emerald-950/20'
                                  : 'border-neutral-800 bg-neutral-950/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  {peer.avatarUrl ? (
                                    <img
                                      src={peer.avatarUrl}
                                      alt={peer.name}
                                      className={`w-11 h-11 rounded-full object-cover border-2 ${
                                        isStudying ? 'border-emerald-500 shadow-md' : 'border-neutral-700'
                                      }`}
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-white">
                                      {peer.initials}
                                    </div>
                                  )}
                                  <span
                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                                      isStudying ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white truncate">{peer.name}</span>
                                    {peer.isCurrentUser && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#ff5500]/20 text-[#ff5500] border border-[#ff5500]/30">
                                        Sen
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/30">
                                      {getModeIcon(peer.currentMode)}
                                      <span>{peer.currentSubject}</span>
                                    </span>
                                    {isStudying && (
                                      <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        <span>{formatSecsToMin(peer.currentSeconds)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-800/60">
                                <div className="text-left sm:text-right">
                                  <span className="text-[10px] text-neutral-500 block">Bugün</span>
                                  <span className="text-xs font-bold text-neutral-300 font-mono">
                                    {Math.floor(peer.todayTotalMinutes / 60)}s {peer.todayTotalMinutes % 60}dk
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleCheer(peer)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-transform cursor-pointer active:scale-95 border ${
                                    cooldownLeft > 0
                                      ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400'
                                      : 'bg-[#ff5500]/20 border-[#ff5500]/60 text-[#ff5500] hover:bg-[#ff5500] hover:text-white shadow-sm'
                                  }`}
                                  title={cooldownLeft > 0 ? `Yeni alev için ${cooldownLeft} dk beklemelisin` : 'Moral alevi gönder'}
                                >
                                  <Flame className={`w-3.5 h-3.5 ${cooldownLeft === 0 ? 'fill-current' : ''}`} />
                                  <span>{cooldownLeft > 0 ? `${cooldownLeft} dk` : 'Alev'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sağ 5 Kolon: Canlı Oda Sohbeti */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex flex-col h-[520px]">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[#ff5500]" />
                          <span>Masa Sohbeti</span>
                        </h3>
                        <span className="text-[11px] text-neutral-500">Canlı Mesajlaşma</span>
                      </div>

                      {/* Mesaj Akışı */}
                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 mb-3">
                        {chatMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 text-xs">
                            <MessageSquare className="w-8 h-8 text-neutral-700 mb-1" />
                            <p>Bu odada henüz mesaj yok. İlk mesajı sen yaz!</p>
                          </div>
                        ) : (
                          chatMessages.map((msg) => {
                            const isMe = msg.userId === currentUser?.uid;
                            return (
                              <div
                                key={msg.id}
                                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                              >
                                {msg.userAvatarUrl ? (
                                  <img
                                    src={msg.userAvatarUrl}
                                    alt={msg.userName}
                                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-neutral-700"
                                  />
                                ) : (
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                                    style={{ backgroundColor: msg.userAvatarColor || '#ff5500' }}
                                  >
                                    {msg.userName.charAt(0).toUpperCase()}
                                  </div>
                                )}

                                <div
                                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                    isMe
                                      ? 'bg-[#ff5500] text-white rounded-tr-none'
                                      : 'bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700/60'
                                  }`}
                                >
                                  <span className="block text-[10px] font-bold opacity-75 mb-0.5">
                                    {msg.userName}
                                  </span>
                                  <p>{msg.text}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatBottomRef} />
                      </div>

                      {/* Mesaj Gönderme Formu */}
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                        <input
                          type="text"
                          placeholder="Masa arkadaşlarına yaz..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                        />
                        <button
                          type="submit"
                          className="p-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white transition-colors cursor-pointer shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CASE 2: KULLANICI HENÜZ ODA SEÇMEDİ VEYA ODADAN AYRILDI */
            <div className="mb-8 p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800/90 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-3">
                <DoorOpen className="w-6 h-6 text-[#ff5500]" />
              </div>
              <h3 className="text-base font-extrabold text-white">Şu An Herhangi Bir Çalışma Masasında Değilsin</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                Odalar sekmesinden ilgini çeken bir çalışma masasına katılabilir veya kendi odanı kurarak arkadaşlarınla birlikte odaklanabilirsin.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onSwitchTab?.('rooms');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/25 cursor-pointer flex items-center gap-1.5"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Odaları Keşfet & Katıl</span>
                </button>
                <button
                  onClick={() => setIsCreateRoomOpen(true)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yeni Oda Kur</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TÜM ÖĞRENCİLER BÖLÜMÜ (Tüm Öğrencileri Görmeyi Daha Verimli Kullanalım) */}
          {/* ============================================================== */}
          {(!activeChatRoom || studentViewSubTab === 'all') && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Verimli Üst Bar: Arama, Filtreler ve Sıralama */}
              <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-[#ff5500]" />
                      <span>Kütüphanedeki Tüm Öğrenciler ({sortedPeers.length})</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Farklı alanlardan çalışan tüm öğrencileri filtrele, incele ve moral alevi gönder.
                    </p>
                  </div>

                  {/* Hızlı Arama */}
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Öğrenci, hedef veya ders ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>
                </div>

                {/* Filtre ve Sıralama Çubuğu */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800/80">
                  {/* Alan Filtreleri */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-neutral-400 mr-1 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-[#ff5500]" /> Alan:
                    </span>
                    {['all', 'Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil'].map((track) => (
                      <button
                        key={track}
                        onClick={() => {
                          soundEngine.playClick();
                          setStudentTrackFilter(track);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          studentTrackFilter === track
                            ? 'bg-[#ff5500] text-white'
                            : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        {track === 'all' ? 'Tümü' : track}
                      </button>
                    ))}
                  </div>

                  {/* Durum & Sıralama */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Durum Filtresi */}
                    <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
                      <button
                        onClick={() => setStudentStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                          studentStatusFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
                        }`}
                      >
                        Tümü
                      </button>
                      <button
                        onClick={() => setStudentStatusFilter('studying')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                          studentStatusFilter === 'studying' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Canlı Çalışanlar</span>
                      </button>
                      <button
                        onClick={() => setStudentStatusFilter('idle')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                          studentStatusFilter === 'idle' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-400'
                        }`}
                      >
                        Mola / Çevrimdışı
                      </button>
                    </div>

                    {/* Sıralama */}
                    <select
                      value={studentSortBy}
                      onChange={(e) => setStudentSortBy(e.target.value as any)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 focus:outline-none focus:border-[#ff5500] cursor-pointer"
                    >
                      <option value="time">En Çok Çalışanlar</option>
                      <option value="cheers">En Çok Alev Alanlar</option>
                      <option value="streak">En Yüksek Seri</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 12 Kolon: Öğrenci Kartları + Liderlik Tablosu */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sol 8 Kolon: Öğrenciler Izgarası */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Canlı Odaklananlar Öncelikli Vitrini */}
                  {activeStudyingPeers.length > 0 && studentStatusFilter !== 'idle' && (
                    <div className="p-5 rounded-3xl bg-neutral-900/80 border border-emerald-500/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Şu Anda Masada Odaklananlar ({activeStudyingPeers.length})</span>
                        </h4>
                        <span className="text-xs text-emerald-400 font-mono font-bold">Canlı Ticker</span>
                      </div>

                      <div className="space-y-2.5">
                        {activeStudyingPeers.map((peer) => {
                          const cooldownLeft = getCooldownMinutesLeft(peer.id);
                          return (
                            <div
                              key={peer.id}
                              className="p-3 rounded-2xl bg-neutral-950/80 border border-emerald-500/40 hover:border-emerald-500 transition-all flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  {peer.avatarUrl ? (
                                    <img
                                      src={peer.avatarUrl}
                                      alt={peer.name}
                                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                                      {peer.initials}
                                    </div>
                                  )}
                                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black bg-emerald-500 animate-pulse" />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white truncate">{peer.name}</span>
                                    {peer.isCurrentUser && (
                                      <span className="text-[10px] font-bold px-1 rounded bg-[#ff5500]/20 text-[#ff5500]">Sen</span>
                                    )}
                                    {peer.targetUniversity && (
                                      <span className="text-[11px] text-neutral-400 truncate hidden sm:inline">
                                        · {peer.targetUniversity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                      {getModeIcon(peer.currentMode)}
                                      <span>{peer.currentSubject}</span>
                                    </span>
                                    <span className="text-neutral-600">·</span>
                                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                                      {formatSecsToMin(peer.currentSeconds)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleCheer(peer)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-transform cursor-pointer active:scale-95 border shrink-0 ${
                                  cooldownLeft > 0
                                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500'
                                    : 'bg-[#ff5500]/20 border-[#ff5500]/60 text-[#ff5500] hover:bg-[#ff5500] hover:text-white'
                                }`}
                                title={cooldownLeft > 0 ? `Yeni alev için ${cooldownLeft} dk beklemelisin` : 'Alev Gönder'}
                              >
                                <Flame className={`w-3.5 h-3.5 ${cooldownLeft === 0 ? 'fill-current' : ''}`} />
                                <span>{cooldownLeft > 0 ? `${cooldownLeft}m` : 'Alev'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tüm Öğrenciler Izgarası */}
                  <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800">
                    <h4 className="text-sm font-bold text-white mb-3">
                      Öğrenci Listesi ({sortedPeers.length})
                    </h4>

                    {sortedPeers.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-8 text-center">Filtre kriterlerine uygun öğrenci bulunamadı.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sortedPeers.map((peer) => {
                          const isStudying = peer.status === 'studying';
                          const cooldownLeft = getCooldownMinutesLeft(peer.id);

                          return (
                            <div
                              key={peer.id}
                              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                isStudying
                                  ? 'border-emerald-500/40 bg-neutral-950/80'
                                  : 'border-neutral-800 bg-neutral-950/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  {peer.avatarUrl ? (
                                    <img
                                      src={peer.avatarUrl}
                                      alt={peer.name}
                                      className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-white">
                                      {peer.initials}
                                    </div>
                                  )}
                                  <span
                                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black ${
                                      isStudying ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">
                                    {peer.name} {peer.isCurrentUser && '(Sen)'}
                                  </p>
                                  <p className="text-[10px] text-neutral-400 truncate">
                                    {peer.targetUniversity || peer.roomName || 'YKS Hazırlık'}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        isStudying ? 'text-emerald-400' : 'text-neutral-500'
                                      }`}
                                    >
                                      {isStudying ? 'Odaklanıyor' : 'Mola / Çevrimdışı'}
                                    </span>
                                    <span className="text-neutral-600 text-[10px]">·</span>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      {Math.floor(peer.todayTotalMinutes / 60)}s {peer.todayTotalMinutes % 60}dk
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleCheer(peer)}
                                className={`p-2 rounded-xl text-xs font-bold transition-transform cursor-pointer active:scale-95 border shrink-0 flex items-center gap-1 ${
                                  cooldownLeft > 0
                                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500'
                                    : 'bg-neutral-850 hover:bg-[#ff5500]/20 border-neutral-800 hover:border-[#ff5500]/50 text-neutral-400 hover:text-[#ff5500]'
                                }`}
                                title={cooldownLeft > 0 ? `Yeni alev için ${cooldownLeft} dk beklemelisin` : 'Alev Gönder'}
                              >
                                <Flame className={`w-3.5 h-3.5 ${cooldownLeft === 0 ? 'text-[#ff5500] fill-current' : ''}`} />
                                {cooldownLeft > 0 ? (
                                  <span className="text-[10px]">{cooldownLeft}m</span>
                                ) : (
                                  <span className="text-[10px] text-neutral-400">{peer.cheersReceived || 0}</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sağ 4 Kolon: Günün Liderlik Tablosu */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800">
                    <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Günün Odak Sıralaması</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4">
                      Bugün en yüksek süreye ulaşan öğrenciler listelenir.
                    </p>

                    {leaderboard.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-6 text-center">Henüz veri yok.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {leaderboard.slice(0, 10).map((student, idx) => {
                          let rankBadge = (
                            <span className="w-5 text-center text-xs font-bold text-neutral-500 font-mono">
                              #{idx + 1}
                            </span>
                          );
                          if (idx === 0) rankBadge = <span className="text-sm">🥇</span>;
                          if (idx === 1) rankBadge = <span className="text-sm">🥈</span>;
                          if (idx === 2) rankBadge = <span className="text-sm">🥉</span>;

                          return (
                            <div
                              key={student.id}
                              className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                                student.isCurrentUser
                                  ? 'border-[#ff5500]/60 bg-[#ff5500]/10'
                                  : idx < 3
                                  ? 'border-neutral-800 bg-neutral-950/70'
                                  : 'border-neutral-850 bg-neutral-950/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="shrink-0 flex items-center justify-center w-5">
                                  {rankBadge}
                                </div>

                                {student.avatarUrl ? (
                                  <img
                                    src={student.avatarUrl}
                                    alt={student.name}
                                    className="w-8 h-8 rounded-full object-cover border border-neutral-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                    {student.initials}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate leading-tight">
                                    {student.name} {student.isCurrentUser && '(Sen)'}
                                  </p>
                                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                    <Flame className="w-2.5 h-2.5 text-[#ff5500] fill-current" />
                                    <span>{student.streakDays} gün seri</span>
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-xs font-mono font-bold text-emerald-400">
                                  {Math.floor(student.todayTotalMinutes / 60)}s {student.todayTotalMinutes % 60}d
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Oda Kurma (Herkese Açık vs Özel/Gizli) */}
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
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Oda Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 2026 Sayısal Derece Grubu"
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
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Oda Açıklaması
                </label>
                <input
                  type="text"
                  placeholder="Günde 6 saat çalışma hedefi olanlar..."
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              {/* ODA TÜRÜ SEÇİMİ: Herkese Açık mı Özel mi */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">
                  Oda Gizlilik Türü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrivateRoom(false);
                      setNewRoomPassword('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      !isPrivateRoom
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold">Herkese Açık</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Şifresizdir. Tüm öğrenciler doğrudan katılabilir.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrivateRoom(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isPrivateRoom
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold">Özel / Gizli</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Şifrelidir. Katılımcılar haricinde kilitli kalır.
                    </span>
                  </button>
                </div>
              </div>

              {/* ÖZEL ODA İSE ZORUNLU ŞİFRE GİRİŞİ */}
              {isPrivateRoom && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-amber-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Oda Şifresi Belirleyin *</span>
                    </span>
                    <span className="text-[10px] text-amber-400">Zorunlu</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Örn: derece2026"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black border border-amber-500/40 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1.5">
                    Bu şifreyi bilmeyenler odanın içeriğine ve çalışma arkadaşlarına bakamaz.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold shadow-md shadow-[#ff5500]/20 transition-all cursor-pointer"
                >
                  Odayı Oluştur & Katıl
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Şifreli Odaya Katılma */}
      {passwordModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              {passwordModalRoom.name}
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              Bu oda özel ve şifrelidir. Odaya dahil olmak ve sohbeti görebilmek için oda şifresini giriniz.
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

              {passwordError && (
                <p className="text-[11px] text-red-400 font-medium">{passwordError}</p>
              )}

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
                  className="flex-1 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold cursor-pointer shadow-md shadow-[#ff5500]/20"
                >
                  Şifreyi Onayla & Gir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Oda Düzenleme */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-sky-400" />
                <span>Çalışma Odasını Düzenle</span>
              </h3>
              <button
                onClick={() => setEditingRoom(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Oda Adı *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
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
                  <option value="Kariyer & Kod">Kariyer & Kod</option>
                  <option value="Üniversite Hazırlık">Üniversite Hazırlık</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Oda Açıklaması
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              {/* ODA GİZLİLİK TÜRÜ */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">
                  Oda Gizlilik Türü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditIsPrivate(false);
                      setEditPassword('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      !editIsPrivate
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold">Herkese Açık</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Şifresiz oda.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditIsPrivate(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editIsPrivate
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold">Özel / Gizli</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      Şifreli oda.
                    </span>
                  </button>
                </div>
              </div>

              {/* ÖZEL ODA İSE ŞİFRE GİRİŞİ */}
              {editIsPrivate && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-in fade-in duration-200">
                  <label className="block text-xs font-bold text-amber-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Oda Şifresi *</span>
                    </span>
                    <span className="text-[10px] text-amber-400">Zorunlu</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Şifreyi giriniz..."
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black border border-amber-500/40 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold shadow-md shadow-[#ff5500]/20 transition-all cursor-pointer"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Oda Silme Onayı */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Odayı Silmek İstiyor Musunuz?
            </h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              <strong className="text-white font-semibold">"{roomToDelete.name}"</strong> odası ve tüm sohbet geçmişi kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Evet, Odayı Sil</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Kod ile Odaya Katıl */}
      {isJoinByCodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl relative text-center">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#ff5500]" />
                <span>Oda Kodu ile Katıl</span>
              </h3>
              <button
                onClick={() => setIsJoinByCodeOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-4 text-left">
              Arkadaşının paylaştığı 6 haneli oda kodunu girerek odaya doğrudan giriş yapabilirsin.
            </p>

            <form onSubmit={handleJoinByCode} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-sm">#</span>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={10}
                  placeholder="Örn: 102938"
                  value={joinCodeInput}
                  onChange={(e) => {
                    setJoinCodeInput(e.target.value);
                    setJoinCodeError('');
                  }}
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-[#ff5500] font-mono tracking-wider text-center"
                />
              </div>

              {joinCodeError && (
                <p className="text-[11px] text-red-400 font-medium text-left">{joinCodeError}</p>
              )}

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
                  className="flex-1 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold cursor-pointer shadow-md shadow-[#ff5500]/20"
                >
                  Odaya Gir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
