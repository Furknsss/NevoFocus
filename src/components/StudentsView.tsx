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
  AlertCircle
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
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ROOMS_CACHE_KEY = 'fokus_study_rooms_cache_v3';
const CHEER_COOLDOWN_KEY = 'fokus_cheer_cooldowns_v3';
const UNLOCKED_ROOMS_KEY = 'fokus_unlocked_rooms_v3';

export const StudentsView: React.FC<StudentsViewProps> = ({
  peers,
  profile,
  currentUser,
  onCheerPeer,
  isCurrentUserStudying = false,
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

  // Cheer / Flame 1-Hour Cooldown tracker
  const [cheerCooldowns, setCheerCooldowns] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem(CHEER_COOLDOWN_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Toast notice for cheer actions (cooldown warning or success)
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

  // Room Join Password Modal
  const [passwordModalRoom, setPasswordModalRoom] = useState<StudyRoom | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Active Chat State
  const [activeChatRoom, setActiveChatRoom] = useState<StudyRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
      await updateDoc(peerRef, {
        cheersReceived: increment(1),
      });

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

    setNewRoomName('');
    setNewRoomDesc('');
    setNewRoomPassword('');
    setIsPrivateRoom(false);
    setIsCreateRoomOpen(false);
    setSelectedRoomId(roomId);
    setActiveChatRoom(newRoom);
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
        await updateDoc(roomDocRef, {
          participants: arrayUnion(currentUser.uid),
          memberCount: increment(1),
        });
      } catch {
        // ignore
      }
    }

    setSelectedRoomId(targetRoomId);
    setActiveChatRoom(passwordModalRoom);
    setPasswordModalRoom(null);
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

  // Filter peers by search & room
  const filteredPeers = livePeers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.currentSubject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.targetUniversity && p.targetUniversity.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  // Active studying peers
  const activeStudyingPeers = filteredPeers.filter((p) => p.status === 'studying');

  // Leaderboard ranking by today's total studied minutes
  const leaderboard = [...filteredPeers].sort((a, b) => b.todayTotalMinutes - a.todayTotalMinutes);

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

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              CANLI TOPLULUK & ÇALIŞMA ODALARI
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Öğrenciler & Canlı Odaklanma Odaları
          </h1>
        </div>

        {/* Actions: Search & Create Room */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Öğrenci veya üniversite ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
            />
          </div>

          <button
            onClick={() => setIsCreateRoomOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Oda Kur</span>
          </button>
        </div>
      </div>

      {/* TOP STUDY ROOMS BAR (Odaya basınca odaya girilir) */}
      <div className="mb-6 p-4 rounded-3xl bg-neutral-900/80 border border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-[#ff5500]" />
            <span>Canlı Çalışma Odaları ({rooms.length})</span>
          </h3>
          <span className="text-[11px] text-neutral-500 hidden sm:inline">
            Odaya tıklayarak katılabilirsin. Özel odalar şifreyle kilitlidir.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Default General Room */}
          <div
            onClick={() => {
              setSelectedRoomId('room-all');
              setActiveChatRoom(null);
            }}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedRoomId === 'room-all' && !activeChatRoom
                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white truncate">Tüm Öğrenciler Masası</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Açık</span>
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-2">
              Tüm alanlardan öğrencilerin ortak çalıştığı genel kütüphane masası.
            </p>
          </div>

          {/* User-created & Persistent Firestore Rooms */}
          {rooms.map((room) => {
            const isSelected = selectedRoomId === room.id;
            const isPrivate = room.isPrivate || room.hasPassword;
            const isUnlocked = isUserRoomParticipant(room);

            return (
              <div
                key={room.id}
                onClick={() => handleAttemptJoinRoom(room)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'border-[#ff5500] bg-[#ff5500]/10 shadow-md ring-1 ring-[#ff5500]/30'
                    : isPrivate && !isUnlocked
                    ? 'border-neutral-800 bg-neutral-950/40 hover:border-amber-500/50'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {isPrivate && (
                      <Lock className={`w-3.5 h-3.5 shrink-0 ${isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`} />
                    )}
                    <span className="text-xs font-bold text-white truncate">{room.name}</span>
                  </div>

                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                    isPrivate
                      ? isUnlocked
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}>
                    {isPrivate ? (isUnlocked ? 'Katıldın' : 'Kilitli') : `#${room.code}`}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 line-clamp-1 mb-2">
                  {room.description}
                </p>

                <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-2 border-t border-neutral-800/80">
                  <span className="text-sky-400 font-semibold">{room.category}</span>
                  <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                    <MessageSquare className="w-3 h-3" />
                    <span>{isPrivate && !isUnlocked ? 'Şifreyle Gir' : 'Odaya Gir'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Live Feed, Chat, Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Live Studying Feed OR Active Room Chat */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Room Chat Drawer (if a room is selected) */}
          {activeChatRoom && (
            <div className="p-5 rounded-3xl bg-neutral-900/90 border border-[#ff5500]/40 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#ff5500]/15 text-[#ff5500]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{activeChatRoom.name}</span>
                      <span className="text-xs font-mono text-neutral-400">
                        (Kod: {activeChatRoom.code})
                      </span>
                      {(activeChatRoom.isPrivate || activeChatRoom.hasPassword) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Özel Oda</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-400">{activeChatRoom.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveChatRoom(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                  title="Sohbeti Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* KİLİTLİ ODA KORUMASI: Katılımcı olmayanlar içeriği ve sohbeti göremez! */}
              {(activeChatRoom.isPrivate || activeChatRoom.hasPassword) && !isUserRoomParticipant(activeChatRoom) ? (
                <div className="p-8 text-center rounded-2xl bg-neutral-950/80 border border-amber-500/30 my-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Bu Oda Gizli ve Kilitlidir 🔒</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                    Katılımcı olmayanlar bu odanın içindeki sohbeti ve öğrencileri göremez. Odaya dahil olmak için lütfen oda şifresini giriniz.
                  </p>
                  <button
                    onClick={() => {
                      setPasswordModalRoom(activeChatRoom);
                      setEnteredPassword('');
                      setPasswordError('');
                    }}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/25 cursor-pointer"
                  >
                    Şifre Gir & Odaya Katıl
                  </button>
                </div>
              ) : (
                <>
                  {/* Chat Messages Log */}
                  <div className="h-60 overflow-y-auto space-y-2.5 pr-2 mb-3">
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
                              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
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

                  {/* Chat Input */}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Odadaki arkadaşlarına mesaj yaz..."
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
                </>
              )}
            </div>
          )}

          {/* Section: Canlı Odaklananlar (Active Studios) */}
          <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Şu Anda Canlı Odaklananlar ({activeStudyingPeers.length})</span>
              </h2>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gerçek zamanlı</span>
              </span>
            </div>

            {activeStudyingPeers.length === 0 ? (
              <div className="p-10 rounded-2xl border border-neutral-800/80 bg-neutral-950/40 text-center">
                <Clock className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-neutral-300">
                  Şu an aktif odaklanan kimse yok
                </p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Odaklan sekmesine geçip seansını başlat; adın, profil resmin ve çalıştığın süre burada anında yeşil ve canlı görünecektir!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeStudyingPeers.map((peer) => {
                  const cooldownLeft = getCooldownMinutesLeft(peer.id);

                  return (
                    <div
                      key={peer.id}
                      className="p-3.5 rounded-2xl bg-neutral-900/90 border border-emerald-500/40 hover:border-emerald-500 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20"
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {peer.avatarUrl ? (
                            <img
                              src={peer.avatarUrl}
                              alt={peer.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
                              {peer.initials}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black bg-emerald-500 animate-pulse" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{peer.name}</span>
                            {peer.isCurrentUser && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff5500]/20 text-[#ff5500] border border-[#ff5500]/30">
                                Sen
                              </span>
                            )}
                            {peer.targetUniversity && (
                              <span className="text-xs text-neutral-400 font-normal hidden sm:inline flex items-center gap-1">
                                · <GraduationCap className="w-3 h-3 text-[#ff5500]" /> {peer.targetUniversity}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/30">
                              {getModeIcon(peer.currentMode)}
                              <span>{peer.currentSubject}</span>
                            </span>
                            {/* Canlı çalışan süre: aktif yeşil sayaç */}
                            <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>{formatSecsToMin(peer.currentSeconds)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Today's Total & Cheer Button (1 Saat Kuralı) */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-800/60">
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] text-neutral-500 block">Bugün Toplam</span>
                          <span className="text-xs font-bold text-neutral-200 font-mono">
                            {Math.floor(peer.todayTotalMinutes / 60)}s {peer.todayTotalMinutes % 60}dk
                          </span>
                        </div>

                        <button
                          onClick={() => handleCheer(peer)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-transform cursor-pointer active:scale-95 border ${
                            cooldownLeft > 0
                              ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-amber-300'
                              : 'bg-[#ff5500]/20 border-[#ff5500]/60 text-[#ff5500] hover:bg-[#ff5500] hover:text-white shadow-sm'
                          }`}
                          title={cooldownLeft > 0 ? `Yeni alev için ${cooldownLeft} dk beklemelisin` : 'Moral alevi gönder'}
                        >
                          <Flame className={`w-3.5 h-3.5 ${cooldownLeft === 0 ? 'fill-current' : ''}`} />
                          <span>{cooldownLeft > 0 ? `${cooldownLeft} dk` : 'Alev'}</span>
                          <span className="text-[10px] opacity-75">({peer.cheersReceived || 0})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Tüm Kayıtlı Öğrenciler (All Peers Grid) */}
          <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800">
            <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#ff5500]" />
                <span>Kütüphanedeki Tüm Öğrenciler ({filteredPeers.length})</span>
              </div>
              <span className="text-xs text-neutral-400 font-normal">
                {profile.studyTrack || 'Sayısal'} ve Diğer Alanlar
              </span>
            </h2>

            {filteredPeers.length === 0 ? (
              <p className="text-xs text-neutral-500 py-8 text-center">Aramanızla eşleşen öğrenci bulunamadı.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredPeers.map((peer) => {
                  const isStudying = peer.status === 'studying';
                  const cooldownLeft = getCooldownMinutesLeft(peer.id);

                  return (
                    <div
                      key={peer.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isStudying
                          ? 'border-emerald-500/40 bg-neutral-900/90'
                          : 'border-neutral-800/80 bg-neutral-950/60'
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
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${
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

                      {/* Cheer action with 1-hour cooldown */}
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

        {/* Right 4 Cols: Leaderboard */}
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
    </div>
  );
};
