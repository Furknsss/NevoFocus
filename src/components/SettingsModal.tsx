import React, { useState } from 'react';
import {
  X,
  Bell,
  Volume2,
  Palette,
  Shield,
  Trash2,
  Mail,
  KeyRound,
  Check,
  AlertTriangle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  Database,
  Smartphone,
  Tablet,
  Monitor,
  Coffee,
  Calendar,
  Plus,
  Link2,
  Music,
  Play,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, FocusSession, FocusTask, MusicPlatform, MusicConnectionsConfig } from '../types';
import { auth, db, handleFirestoreError, OperationType, safeSetDoc } from '../firebase';
import {
  sendPasswordResetEmail,
  deleteUser,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';
import { isDateRestDay } from '../utils/stats';
import {
  syncAllToFirestore,
  restoreAllFromFirestore,
  exportLocalBackup,
  importLocalBackup,
  getLastSyncTime,
} from '../services/syncService';
import { spotifyService, PLATFORM_METADATA, UNIVERSAL_SAFE_REDIRECT_URI } from '../services/spotifyService';
import { PlatformIcon } from './visuals/SpotifyFocusWidget';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  currentUser: any;
  sessions?: FocusSession[];
  tasks?: FocusTask[];
  deviceMode?: 'auto' | 'mobile' | 'tablet' | 'desktop';
  detectedDevice?: 'mobile' | 'tablet' | 'desktop';
  onSelectDeviceMode?: (mode: 'auto' | 'mobile' | 'tablet' | 'desktop') => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onAccountDeleted: () => void;
  onSyncComplete?: (sessions: FocusSession[], tasks: FocusTask[], profile?: UserProfile) => void;
  onOpenAuth?: () => void;
  initialTab?: 'breaks' | 'notifications' | 'connections' | 'theme' | 'security' | 'backup';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentUser,
  sessions = [],
  tasks = [],
  deviceMode = 'auto',
  detectedDevice = 'desktop',
  onSelectDeviceMode,
  onUpdateProfile,
  onAccountDeleted,
  onSyncComplete,
  onOpenAuth,
  initialTab = 'breaks',
}) => {
  const [activeTab, setActiveTab] = useState<'breaks' | 'notifications' | 'connections' | 'theme' | 'security' | 'backup'>(
    initialTab || 'breaks'
  );

  // Sync activeTab when initialTab or isOpen changes
  React.useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Music Connections State (Spotify, YouTube Music, Apple Music)
  const [musicConnections, setMusicConnections] = useState<MusicConnectionsConfig>(() =>
    spotifyService.getConnectionsConfig()
  );
  const [liveTrack, setLiveTrack] = useState(() => spotifyService.getCurrentTrack());
  const [connectingPlatform, setConnectingPlatform] = useState<MusicPlatform | null>(null);
  const [showSpotifyAuthStep, setShowSpotifyAuthStep] = useState(false);
  const [showYouTubeAuthStep, setShowYouTubeAuthStep] = useState(false);
  const [spotifyClientIdInput, setSpotifyClientIdInput] = useState(() =>
    spotifyService.getSavedClientId()
  );
  const [spotifyCodeOrTokenInput, setSpotifyCodeOrTokenInput] = useState('');
  const [ytQuickInput, setYtQuickInput] = useState('');
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [connNotice, setConnNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  React.useEffect(() => {
    if (profile.musicConnections) {
      spotifyService.syncFromProfile(profile.musicConnections);
    }
    const unsubConn = spotifyService.subscribeConnections((cfg) => {
      setMusicConnections(cfg);
    });
    const unsubTrack = spotifyService.subscribe((t) => {
      if (t) setLiveTrack(t);
    });
    return () => {
      unsubConn();
      unsubTrack();
    };
  }, [profile.musicConnections]);

  const persistMusicConnectionsToCloud = (updatedConfig: MusicConnectionsConfig) => {
    onUpdateProfile({ musicConnections: updatedConfig });
    if (currentUser) {
      safeSetDoc(
        doc(db, 'users', currentUser.uid),
        {
          musicConnections: updatedConfig,
          updatedAt: Date.now(),
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  const handleDirectPlatformAuthConnect = async (platform: MusicPlatform) => {
    soundEngine.playClick();
    setConnNotice(null);

    if (platform === 'youtube_music') {
      setConnectingPlatform('youtube_music');
      try {
        const res = await spotifyService.connectYouTubeMusicDirect(
          currentUser?.displayName || currentUser?.email || profile.name || 'YouTube Music Hesabım'
        );
        const updated = spotifyService.getConnectionsConfig();
        persistMusicConnectionsToCloud(updated);
        setShowYouTubeAuthStep(true);
        soundEngine.playCompletionBell();
        setConnNotice({
          type: 'success',
          text: `YouTube Music (${res.accountName}) doğrudan bağlandı! Aşağıdan dilediğiniz parçayı anında başlatabilir veya canlı cihaz senkronizasyonu yapabilirsiniz.`,
        });
      } finally {
        setConnectingPlatform(null);
      }
      return;
    }

    if (platform === 'apple_music') {
      setConnectingPlatform('apple_music');
      try {
        await spotifyService.connectAppleMusicWithPopup(
          currentUser?.displayName || profile.name || 'Apple Music Hesabım'
        );
        const updated = spotifyService.getConnectionsConfig();
        persistMusicConnectionsToCloud(updated);
        soundEngine.playCompletionBell();
        setConnNotice({
          type: 'success',
          text: 'Apple Music giriş penceresi açıldı ve hesabınız bağlandı!',
        });
      } finally {
        setConnectingPlatform(null);
      }
      return;
    }

    // Platform === 'spotify'
    soundEngine.playClick();
    setShowSpotifyAuthStep(true);
    setConnNotice(null);
  };

  const handleCompleteSpotifyAuth = async (rawInput?: string) => {
    soundEngine.playClick();
    setConnNotice(null);
    setConnectingPlatform('spotify');

    try {
      let targetInput = (rawInput ?? spotifyCodeOrTokenInput).trim();
      if (!targetInput && navigator.clipboard?.readText) {
        try {
          targetInput = (await navigator.clipboard.readText()).trim();
        } catch {}
      }

      if (!targetInput) {
        setConnNotice({
          type: 'error',
          text: 'Lütfen Spotify Access Token veya yönlendirilen adresi yapıştırın.',
        });
        setConnectingPlatform(null);
        return;
      }

      const res = await spotifyService.exchangeCodeOrUrl(targetInput);
      if (res.success) {
        await spotifyService.pollSpotifyNowPlaying();
        const updated = spotifyService.getConnectionsConfig();
        persistMusicConnectionsToCloud(updated);
        setShowSpotifyAuthStep(false);
        setSpotifyCodeOrTokenInput('');
        soundEngine.playCompletionBell();
        setConnNotice({
          type: 'success',
          text: `Spotify (${res.userName || 'Hesabım'}) başarıyla bağlandı! Spotify uygulamasında açtığınız her şarkı otomatik algılanıp yansıyacak.`,
        });
      } else {
        setConnNotice({
          type: 'error',
          text: res.error || 'Spotify doğrulaması başarısız oldu.',
        });
      }
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleYouTubeQuickSearchOrConnect = async (overrideQuery?: string) => {
    soundEngine.playClick();
    const q = (overrideQuery ?? ytQuickInput).trim();
    if (!q) return;

    setIsSearchingYt(true);
    setConnNotice(null);
    try {
      // Check if it's a single-word Last.fm username first
      if (!q.includes(' ') && !q.includes('http') && q.startsWith('lastfm:')) {
        const res = await spotifyService.connectYouTubeMusicDirect(
          currentUser?.displayName || profile.name || 'YouTube Music',
          q
        );
        const updated = spotifyService.getConnectionsConfig();
        persistMusicConnectionsToCloud(updated);
        soundEngine.playCompletionBell();
        setConnNotice({
          type: 'success',
          text: `YouTube Music canlı scrobble (${res.accountName}) bağlandı!`,
        });
        return;
      }

      const items = await spotifyService.searchYouTubeMusicTracks(q);
      setYtSearchResults(items);
      if (items.length > 0) {
        const played = await spotifyService.playYouTubeMusicTrackImmediate(items[0]);
        const updated = spotifyService.getConnectionsConfig();
        persistMusicConnectionsToCloud(updated);
        soundEngine.playCompletionBell();
        setConnNotice({
          type: 'success',
          text: `YouTube Music'te çalıyor: ${played.name} – ${played.artists.join(', ')}`,
        });
      } else {
        setConnNotice({
          type: 'error',
          text: 'Parça bulunamadı, lütfen farklı bir şarkı veya sanatçı adı deneyin.',
        });
      }
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleDisconnectPlatform = (platform: MusicPlatform) => {
    soundEngine.playClick();
    const updated = spotifyService.disconnectPlatform(platform);
    persistMusicConnectionsToCloud(updated);
    if (platform === 'spotify') {
      setShowSpotifyAuthStep(false);
    }
    if (platform === 'youtube_music') {
      setShowYouTubeAuthStep(false);
      setYtSearchResults([]);
    }
    setConnNotice({
      type: 'success',
      text: `${PLATFORM_METADATA[platform].name} bağlantısı kaldırıldı.`,
    });
  };

  // Rest Days (Haftalık Mola & Dinlenme Günleri)
  const [weeklyRestDays, setWeeklyRestDays] = useState<number[]>(
    profile.restDaySelectionMode === 'weekly' && Array.isArray(profile.weeklyRestDays) ? profile.weeklyRestDays : []
  );
  const [customRestDates, setCustomRestDates] = useState<string[]>(
    Array.isArray(profile.customRestDates) ? profile.customRestDates : []
  );
  const [excludedRestDates, setExcludedRestDates] = useState<string[]>(
    Array.isArray(profile.excludedRestDates) ? profile.excludedRestDates : []
  );
  const [manualDateInput, setManualDateInput] = useState('');

  // Keep in sync with profile updates
  React.useEffect(() => {
    setWeeklyRestDays(profile.restDaySelectionMode === 'weekly' && Array.isArray(profile.weeklyRestDays) ? profile.weeklyRestDays : []);
    setCustomRestDates(Array.isArray(profile.customRestDates) ? profile.customRestDates : []);
    setExcludedRestDates(Array.isArray(profile.excludedRestDates) ? profile.excludedRestDates : []);
  }, [profile.restDaySelectionMode, profile.weeklyRestDays, profile.customRestDates, profile.excludedRestDates]);

  const handleToggleWeeklyDay = (dayIndex: number) => {
    soundEngine.playClick();
    const updated = weeklyRestDays.includes(dayIndex)
      ? weeklyRestDays.filter((d) => d !== dayIndex)
      : [...weeklyRestDays, dayIndex].sort();
    setWeeklyRestDays(updated);
    onUpdateProfile({ restDaySelectionMode: 'weekly', weeklyRestDays: updated });
    if (currentUser) {
      safeSetDoc(doc(db, 'users', currentUser.uid), { restDaySelectionMode: 'weekly', weeklyRestDays: updated, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    }
  };

  // Toggle rest status for any specific date across weeks
  const handleToggleDateRest = (dateStr: string) => {
    soundEngine.playClick();
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = d.getDay();
    const isWeeklyRecurring = weeklyRestDays.includes(dayOfWeek);

    let newCustom = [...customRestDates];
    let newExcluded = [...excludedRestDates];

    const isCurrentlyRest = (newCustom.includes(dateStr) || isWeeklyRecurring) && !newExcluded.includes(dateStr);

    if (isCurrentlyRest) {
      // Deactivate rest day for this specific date
      if (newCustom.includes(dateStr)) {
        newCustom = newCustom.filter((x) => x !== dateStr);
      }
      if (isWeeklyRecurring && !newExcluded.includes(dateStr)) {
        newExcluded.push(dateStr);
      }
    } else {
      // Activate rest day for this specific date
      if (newExcluded.includes(dateStr)) {
        newExcluded = newExcluded.filter((x) => x !== dateStr);
      }
      if (!isWeeklyRecurring && !newCustom.includes(dateStr)) {
        newCustom.push(dateStr);
      }
    }

    setCustomRestDates(newCustom);
    setExcludedRestDates(newExcluded);
    onUpdateProfile({ customRestDates: newCustom, excludedRestDates: newExcluded });
    if (currentUser) {
      safeSetDoc(doc(db, 'users', currentUser.uid), {
        customRestDates: newCustom,
        excludedRestDates: newExcluded,
        updatedAt: Date.now(),
      }, { merge: true }).catch(() => {});
    }
  };

  const handleSetPreset = (preset: 'sunday_only' | 'wed_sun' | 'weekend' | 'none') => {
    soundEngine.playClick();
    let days: number[] = [0];
    if (preset === 'sunday_only') days = [0];
    if (preset === 'wed_sun') days = [3, 0];
    if (preset === 'weekend') days = [6, 0];
    if (preset === 'none') days = [];
    setWeeklyRestDays(days);
    onUpdateProfile({ restDaySelectionMode: 'weekly', weeklyRestDays: days });
    if (currentUser) {
      safeSetDoc(doc(db, 'users', currentUser.uid), { restDaySelectionMode: 'weekly', weeklyRestDays: days, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    }
  };

  // Generate 4 full upcoming weeks (Monday to Sunday) for week-specific rest day planning
  const upcomingWeeks = React.useMemo(() => {
    const weeks = [];
    const now = new Date();
    // Monday-based index (0 = Monday, 6 = Sunday)
    const dayOfWeek = (now.getDay() + 6) % 7;
    const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

    const pad = (n: number) => String(n).padStart(2, '0');
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const titles = ['Bu Hafta', 'Gelecek Hafta', '3. Hafta', '4. Hafta'];

    for (let w = 0; w < 4; w++) {
      const monday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + w * 7);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

      const dateSpan = `${monday.getDate()} ${monthNames[monday.getMonth()]} - ${sunday.getDate()} ${monthNames[sunday.getMonth()]}`;

      const days = [];
      let restCount = 0;
      const restNames: string[] = [];

      for (let d = 0; d < 7; d++) {
        const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d);
        const dateStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        const isToday = cur.toDateString() === now.toDateString();

        const isRest = isDateRestDay(dateStr, {
          weeklyRestDays,
          customRestDates,
          excludedRestDates,
        } as UserProfile);

        if (isRest) {
          restCount++;
          restNames.push(dayNames[d]);
        }

        days.push({
          dateStr,
          dayNum: cur.getDate(),
          dayName: dayNames[d],
          shortName: dayNames[d],
          isToday,
          isRest,
        });
      }

      weeks.push({
        title: titles[w] || `${w + 1}. Hafta`,
        isCurrentWeek: w === 0,
        dateSpan,
        days,
        restDaysSummary: restCount > 0 ? `${restNames.join(', ')} (${restCount} Gün Mola)` : 'Molasız Hafta',
      });
    }

    return weeks;
  }, [weeklyRestDays, customRestDates, excludedRestDates]);

  // Notifications
  const [soundNotifications, setSoundNotifications] = useState(profile.soundNotifications ?? true);
  const [breakReminders, setBreakReminders] = useState(profile.breakReminders ?? true);
  const [desktopNotifications, setDesktopNotifications] = useState(profile.desktopNotifications ?? false);
  const [liveNotifications, setLiveNotifications] = useState(profile.liveNotifications ?? false);

  // Theme
  const [currentTheme, setCurrentTheme] = useState(profile.theme || 'dark');

  // Security
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Direct Password Set / Update (Google and Email accounts)
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Check if current user already has password credentials
  // Check the Firebase Auth providers directly. A cached profile flag is not
  // proof that a password credential was actually linked to this Firebase UID.
  const hasPasswordProvider =
    Boolean(currentUser?.providerData?.some((p: { providerId: string }) => p.providerId === 'password'));

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Backup & Cloud sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncEmailInput, setSyncEmailInput] = useState<string>(() => {
    return (
      currentUser?.email ||
      profile.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_email') || '' : '')
    );
  });
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBackupNow = async () => {
    try {
      setIsSyncing(true);
      setBackupNotice(null);
      soundEngine.playClick();

      const cleanEmail = syncEmailInput.trim();
      const updatedProf = cleanEmail && cleanEmail !== profile.email
        ? { ...profile, email: cleanEmail }
        : profile;
      if (cleanEmail) {
        try {
          localStorage.setItem('fokus_user_email', cleanEmail);
        } catch {}
        onUpdateProfile({ email: cleanEmail });
      }

      const res = await syncAllToFirestore(currentUser || auth.currentUser, sessions, tasks, updatedProf, {
        allowEmptyOverwrite: true,
      });
      if (res.success) {
        soundEngine.playCompletionBell();
        setBackupNotice({
          type: 'success',
          text: `Başarılı! ${res.sessionsUploaded} çalışma seansı ve ${res.tasksUploaded} görev Firestore bulutuna yedeklendi. Tabletten veya başka cihazdan anında geri yükleyebilirsiniz.`,
        });
      } else {
        setBackupNotice({ type: 'error', text: res.message || 'Yedekleme yapılamadı.' });
      }
    } catch (err: any) {
      setBackupNotice({ type: 'error', text: err.message || 'Yedekleme sırasında hata oluştu.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreNow = async () => {
    try {
      setIsRestoring(true);
      setBackupNotice(null);
      soundEngine.playClick();

      const cleanEmail = syncEmailInput.trim();
      if (cleanEmail) {
        try {
          localStorage.setItem('fokus_user_email', cleanEmail);
        } catch {}
      }

      const res = await restoreAllFromFirestore(currentUser || auth.currentUser, cleanEmail || undefined);
      if (res.success) {
        soundEngine.playCompletionBell();
        if (onSyncComplete) {
          onSyncComplete(res.sessions, res.tasks, res.profile as UserProfile);
        }
        // Also sync merged state back to cloud so all devices share the unified state
        await syncAllToFirestore(
          currentUser || auth.currentUser,
          res.sessions,
          res.tasks,
          (res.profile as UserProfile) || profile
        ).catch(() => {});

        setBackupNotice({
          type: 'success',
          text: `Geri yükleme tamamlandı! ${res.sessions.length} çalışma seansı ve ${res.tasks.length} görev buluttan cihazınıza aktarıldı.`,
        });
      } else {
        setBackupNotice({ type: 'error', text: res.message || 'Geri yükleme yapılamadı.' });
      }
    } catch (err: any) {
      setBackupNotice({ type: 'error', text: err.message || 'Geri yükleme sırasında hata oluştu.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportJson = () => {
    soundEngine.playClick();
    exportLocalBackup(sessions, tasks, profile);
    setBackupNotice({
      type: 'success',
      text: 'Çevrimdışı JSON yedeğiniz bilgisayarınıza / cihazınıza başarıyla indirildi.',
    });
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = await importLocalBackup(content, currentUser);
      if (res.success) {
        soundEngine.playCompletionBell();
        if (onSyncComplete) {
          onSyncComplete(res.mergedSessions, res.mergedTasks, res.mergedProfile);
        }
        setBackupNotice({
          type: 'success',
          text: res.message,
        });
      } else {
        setBackupNotice({
          type: 'error',
          text: res.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleToggleDesktopNotif = async () => {
    if (!desktopNotifications) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setDesktopNotifications(true);
          onUpdateProfile({ desktopNotifications: true });
        } else {
          alert('Tarayıcı bildirim izni verilmedi.');
        }
      }
    } else {
      setDesktopNotifications(false);
      onUpdateProfile({ desktopNotifications: false });
    }
  };

  const handleToggleSound = (val: boolean) => {
    setSoundNotifications(val);
    onUpdateProfile({ soundNotifications: val });
  };

  const handleToggleBreak = (val: boolean) => {
    setBreakReminders(val);
    onUpdateProfile({ breakReminders: val });
  };

  const handleToggleLiveNotif = async () => {
    if (!liveNotifications) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setLiveNotifications(true);
          onUpdateProfile({ liveNotifications: true });
        } else {
          alert('Canlı bildirimler için tarayıcı bildirim izni verilmedi.');
        }
      } else {
        setLiveNotifications(true);
        onUpdateProfile({ liveNotifications: true });
      }
    } else {
      setLiveNotifications(false);
      onUpdateProfile({ liveNotifications: false });
    }
  };

  const handleSelectTheme = (themeId: string) => {
    soundEngine.playClick();
    setCurrentTheme(themeId);
    onUpdateProfile({ theme: themeId });
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = currentUser?.email || profile.email;
    if (!targetEmail) {
      setSecurityMsg({ type: 'error', text: 'Kayıtlı bir e-posta adresi bulunamadı.' });
      return;
    }
    try {
      soundEngine.playClick();
      await sendPasswordResetEmail(auth, targetEmail);
      setPasswordResetSent(true);
      setSecurityMsg({ type: 'success', text: `Şifre sıfırlama bağlantısı ${targetEmail} adresine gönderildi.` });
    } catch (err: any) {
      setSecurityMsg({ type: 'error', text: err.message || 'Şifre sıfırlama bağlantısı gönderilemedi.' });
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newEmail.trim()) return;

    try {
      setIsUpdatingEmail(true);
      setSecurityMsg(null);
      await updateEmail(currentUser, newEmail.trim());

      // Update safely in Firestore
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          email: newEmail.trim(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      onUpdateProfile({ email: newEmail.trim() });
      setSecurityMsg({ type: 'success', text: 'E-posta adresiniz başarıyla güncellendi.' });
      setNewEmail('');
    } catch (err: any) {
      setSecurityMsg({
        type: 'error',
        text: err.code === 'auth/requires-recent-login'
          ? 'Güvenlik nedeniyle e-posta değiştirmeden önce tekrar giriş yapmalısınız.'
          : err.message || 'E-posta güncellenemedi.',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdateOrSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (newPasswordInput.length < 6) {
      setPasswordErrorMsg('Parola en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordErrorMsg('Girdiğiniz parolalar birbiriyle eşleşmiyor.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      soundEngine.playClick();

      // Add email/password to the existing Google Firebase UID, never create
      // another account or silently fall back to an unrelated operation.
      if (!currentUser.email) {
        throw new Error('Hesabınızda doğrulanmış bir e-posta adresi bulunamadı.');
      }
      if (hasPasswordProvider) {
        await updatePassword(currentUser, newPasswordInput);
      } else {
        const cred = EmailAuthProvider.credential(currentUser.email, newPasswordInput);
        await linkWithCredential(currentUser, cred);
      }

      // Record in Firestore user profile safely
      try {
        await safeSetDoc(
          doc(db, 'users', currentUser.uid),
          {
            hasPassword: true,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }

      soundEngine.playCompletionBell();
      setPasswordSuccessMsg(
        hasPasswordProvider
          ? 'Parolanız başarıyla güncellendi!'
          : 'Hesabınıza parola başarıyla eklendi ve bağlandı! Artık hem Google hem de e-posta ve bu şifrenizle doğrudan giriş yapabilirsiniz.'
      );
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      onUpdateProfile({ hasPassword: true });
    } catch (err: any) {
      console.error('Password update error', err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordErrorMsg('Güvenlik nedeniyle parola işleminden önce lütfen çıkış yapıp tekrar giriş yapın.');
      } else if (err.code === 'auth/weak-password') {
        setPasswordErrorMsg('Belirlediğiniz parola çok zayıf. Lütfen en az 6 karakterli güçlü bir parola girin.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setPasswordErrorMsg('Bu Firebase projesinde e-posta/şifre ile giriş etkinleştirilmemiş. Bu işlem için proje ayarı gerekiyor.');
      } else if (err.code === 'auth/email-already-in-use' || err.code === 'auth/credential-already-in-use') {
        setPasswordErrorMsg('Bu e-posta başka bir Firebase hesabına bağlı. Verilerinizin karışmaması için otomatik hesap birleştirme yapılmadı.');
      } else if (err.code === 'auth/provider-already-linked') {
        setPasswordErrorMsg('Parola sağlayıcısı zaten bağlı. Sayfayı yenileyip Parolayı Değiştir bölümünden tekrar deneyin.');
      } else {
        setPasswordErrorMsg(err.message || 'Parola güncellenirken bir hata oluştu.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      setIsDeleting(true);
      // Remove user doc from firestore
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid));
      } catch (err) {
        // continue
      }
      // Delete user from auth
      await deleteUser(currentUser);
      onAccountDeleted();
      onClose();
    } catch (err: any) {
      alert(
        err.code === 'auth/requires-recent-login'
          ? 'Hesabınızı silmek için son oturumunuz eski. Lütfen tekrar çıkış yapıp giriş yaptıktan sonra deneyin.'
          : 'Hesap silinirken hata oluştu: ' + err.message
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Uygulama & Hesap Ayarları</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Bildirim tercihlerini, tema görünümünü ve hesap güvenliğini yönet
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 my-4 p-1 rounded-xl bg-neutral-900 border border-neutral-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('breaks')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'breaks'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span>Mola Günleri</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'notifications'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-[#ff5500]" />
            <span>Bildirimler</span>
          </button>

          <button
            onClick={() => setActiveTab('connections')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'connections'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Bağlantılar</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'theme'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>Tema</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'security'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Güvenlik</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              activeTab === 'backup'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Bulut & Yedek</span>
          </button>
        </div>

        {/* TAB 0: MOLA & DİNLENME GÜNLERİ */}
        {activeTab === 'breaks' && (
          <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Explanatory Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-neutral-900/50 border border-amber-500/30 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Coffee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Haftalık Mola & Dinlenme Sistemi</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    ☕ 100% Planlı
                  </span>
                </h4>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Düzenli haftalık mola günlerini seçebilir veya her hafta için farklı mola günleri belirleyebilirsin. Belirlenen mola günleri aylık takvimde günün sağında <strong className="text-amber-300 font-semibold">☕ Mola Günü</strong> olarak gösterilir.
                </p>
              </div>
            </div>

            {/* Hızlı Şablonlar */}
            <div>
              <label className="text-xs font-bold text-neutral-300 mb-2 block flex items-center justify-between">
                <span>Hızlı Mola Şablonları</span>
                <span className="text-[11px] text-neutral-400">Tek tıkla ayarla</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetPreset('sunday_only')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    weeklyRestDays.length === 1 && weeklyRestDays[0] === 0
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span>☕ Sadece Pazar</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Haftada 1 Gün</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('wed_sun')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    weeklyRestDays.length === 2 && weeklyRestDays.includes(3) && weeklyRestDays.includes(0)
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span>☕ Çar & Pazar</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Haftada 2 Gün</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('weekend')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    weeklyRestDays.length === 2 && weeklyRestDays.includes(6) && weeklyRestDays.includes(0)
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span>☕ Cmt & Pazar</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Hafta Sonu</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetPreset('none')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    weeklyRestDays.length === 0
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span>⚡ Molasız</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Her Gün Çalış</span>
                </button>
              </div>
            </div>

            {/* 1. Düzenli Haftalık Gün Seçimi */}
            <div>
              <label className="text-xs font-bold text-neutral-300 mb-2 block flex items-center justify-between">
                <span>1. Düzenli Haftalık Mola Günleri</span>
                <span className="text-[11px] text-amber-400 font-mono">
                  {weeklyRestDays.length > 0 ? `${weeklyRestDays.length} Gün Seçili` : 'Mola Yok'}
                </span>
              </label>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {[
                  { id: 1, name: 'Pazartesi', short: 'Pzt' },
                  { id: 2, name: 'Salı', short: 'Sal' },
                  { id: 3, name: 'Çarşamba', short: 'Çar' },
                  { id: 4, name: 'Perşembe', short: 'Per' },
                  { id: 5, name: 'Cuma', short: 'Cum' },
                  { id: 6, name: 'Cumartesi', short: 'Cmt' },
                  { id: 0, name: 'Pazar', short: 'Paz' },
                ].map((day) => {
                  const isSelected = weeklyRestDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => handleToggleWeeklyDay(day.id)}
                      className={`p-2 sm:p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-500/40'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] sm:text-xs">{day.short}</span>
                      {isSelected ? (
                        <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 my-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Her Hafta Farklı / Özel Mola Günleri Belirleme */}
            <div className="pt-3 border-t border-neutral-800 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="text-xs font-bold text-white block flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. Haftalık Mola Programı (Her Hafta Farklı Seçilebilir)</span>
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Her haftanın programı bağımsızdır. Dilediğin güne dokunarak o haftanın mola günlerini kolayca belirleyebilirsin:
                  </p>
                </div>
              </div>

              {/* 4 Upcoming Weeks Cards */}
              <div className="space-y-2.5">
                {upcomingWeeks.map((week) => (
                  <div
                    key={week.title}
                    className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700/80 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{week.title}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">({week.dateSpan})</span>
                        {week.isCurrentWeek && (
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Aktif Hafta
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] text-amber-300 font-semibold font-mono">
                        <span>☕</span>
                        <span>{week.restDaysSummary}</span>
                      </div>
                    </div>

                    {/* 7 Days Grid for This Specific Week */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {week.days.map((day) => {
                        return (
                          <button
                            key={day.dateStr}
                            type="button"
                            onClick={() => handleToggleDateRest(day.dateStr)}
                            className={`p-1.5 sm:p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-between gap-0.5 ${
                              day.isRest
                                ? 'bg-amber-500/25 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/40 shadow-sm'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                            } ${day.isToday ? 'ring-2 ring-sky-400/90' : ''}`}
                            title={`${day.dateStr} (${day.dayName}): ${day.isRest ? 'Mola Günü' : 'Çalışma Günü'}`}
                          >
                            <span className="text-[9px] sm:text-[10px] font-semibold block opacity-80">{day.shortName}</span>
                            <span className="text-xs sm:text-sm font-bold font-mono block my-0.5">{day.dayNum}</span>
                            <span className="text-[8px] sm:text-[9px] font-medium block">
                              {day.isRest ? (
                                <span className="text-amber-300 font-bold inline-flex items-center gap-0.5">
                                  <span>☕</span>
                                  <span className="hidden sm:inline">Mola</span>
                                </span>
                              ) : (
                                <span className="text-neutral-500">Çalış</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Specific Date Picker / Adder */}
              <div className="p-3 rounded-2xl bg-neutral-950/50 border border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-neutral-300 font-medium">Tarih ile Özel Mola Ekle/Kaldır:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={manualDateInput}
                    onChange={(e) => setManualDateInput(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    disabled={!manualDateInput}
                    onClick={() => {
                      if (manualDateInput) {
                        handleToggleDateRest(manualDateInput);
                        setManualDateInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    Uygula
                  </button>
                </div>
              </div>

              {/* Custom dates and exclusions list badge */}
              {(customRestDates.length > 0 || excludedRestDates.length > 0) && (
                <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2">
                  {customRestDates.length > 0 && (
                    <div>
                      <span className="text-[11px] text-amber-400 block mb-1 font-semibold">
                        Eklenen Özel Mola Günleri ({customRestDates.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {customRestDates.map((dateStr) => (
                          <span
                            key={dateStr}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-950/70 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold"
                          >
                            <span>☕ {dateStr}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleDateRest(dateStr)}
                              className="hover:text-white cursor-pointer ml-0.5"
                              title="Kaldır"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {excludedRestDates.length > 0 && (
                    <div>
                      <span className="text-[11px] text-sky-400 block mb-1 font-semibold">
                        O Hafta İçin Çalışma Gününe Çevrilenler ({excludedRestDates.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {excludedRestDates.map((dateStr) => (
                          <span
                            key={dateStr}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-950/70 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-bold"
                          >
                            <span>⚡ {dateStr}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleDateRest(dateStr)}
                              className="hover:text-white cursor-pointer ml-0.5"
                              title="Tekrar Molaya Al"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#ff5500]" />
                  <span>Seans Bitiş Zili & Sesli Uyarılar</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Odaklanma seansı ve sayaç bittiğinde zafer gongu çalsın.
                </p>
              </div>
              <input
                type="checkbox"
                checked={soundNotifications}
                onChange={(e) => handleToggleSound(e.target.checked)}
                className="w-5 h-5 accent-[#ff5500] cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span>Çalışma Arası & Mola Hatırlatıcıları</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Uzun seanslarda dinlenme ve kamp kurma molalarını hatırlat.
                </p>
              </div>
              <input
                type="checkbox"
                checked={breakReminders}
                onChange={(e) => handleToggleBreak(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span>Masaüstü / Tarayıcı Bildirimleri</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Farklı bir sekmedeyken seans tamamlanınca bildirim gönder.
                </p>
              </div>
              <input
                type="checkbox"
                checked={desktopNotifications}
                onChange={handleToggleDesktopNotif}
                className="w-5 h-5 accent-sky-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Canlı Odaklanma Bildirimleri</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Arka planda veya kilit ekranında canlı seans ilerleme kartı gösterilsin.
                </p>
              </div>
              <input
                type="checkbox"
                checked={liveNotifications}
                onChange={handleToggleLiveNotif}
                className="w-5 h-5 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 1.5: BAĞLANTILAR (SPOTIFY, YOUTUBE MUSIC, APPLE MUSIC) */}
        {activeTab === 'connections' && (
          <div className="space-y-4 py-2 max-h-[62vh] overflow-y-auto pr-1">
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Music className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white">
                  Doğrudan Hesap Bağlantısı & Canlı Müzik Senkronizasyonu
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                  Spotify, YouTube Music veya Apple Music için <strong>Hesabı Bağla</strong> tuşuna bastığınızda doğrudan ilgili platformun resmi giriş sayfasına yönlendirilirsiniz. Bağlandığınızda ne çalınıyorsa uygulama otomatik olarak şarkıyı, kapağı ve platform logosunu çeker.
                </p>
              </div>
            </div>

            {connNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  connNotice.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}
              >
                <span>{connNotice.text}</span>
                <button
                  type="button"
                  onClick={() => setConnNotice(null)}
                  className="text-neutral-400 hover:text-white cursor-pointer ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {(['spotify', 'youtube_music', 'apple_music'] as MusicPlatform[]).map((platform) => {
              const meta = PLATFORM_METADATA[platform];
              const info = musicConnections[platform];
              const isConnected = spotifyService.isPlatformConnected(platform);
              const isAutoPlayingNow =
                Boolean(liveTrack?.isPlaying) && liveTrack?.source === platform;
              const isConnecting = connectingPlatform === platform;
              const hasLiveToken =
                platform === 'spotify'
                  ? spotifyService.hasSpotifyLiveToken()
                  : platform === 'youtube_music'
                  ? spotifyService.hasYouTubeLiveToken()
                  : true;

              const currentPlatformTrack =
                liveTrack?.source === platform
                  ? liveTrack
                  : spotifyService.buildStreamTrackForPlatform(platform);

              return (
                <div
                  key={platform}
                  className="p-4 rounded-2xl bg-neutral-900/80 border transition-all space-y-3"
                  style={{
                    borderColor: isAutoPlayingNow
                      ? meta.accentHex
                      : isConnected && hasLiveToken
                      ? `${meta.accentHex}55`
                      : '#262626',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black/80 border border-neutral-800 flex items-center justify-center shrink-0 shadow-md">
                        <PlatformIcon platform={platform} className="w-full h-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-extrabold text-white">{meta.name}</h5>
                          {isConnected && hasLiveToken ? (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border"
                              style={{
                                backgroundColor: `${meta.accentHex}20`,
                                borderColor: `${meta.accentHex}50`,
                                color: meta.accentHex,
                              }}
                            >
                              Bağlı · {info?.accountName || meta.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-neutral-800 text-neutral-400">
                              Bağlı Değil
                            </span>
                          )}
                          {isAutoPlayingNow && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
                              style={{
                                backgroundColor: meta.accentHex,
                                color: meta.textOnAccent === 'black' ? '#000' : '#fff',
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                              <span>Şu An Çalıyor (Otomatik)</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {isConnected && hasLiveToken
                            ? currentPlatformTrack &&
                              !currentPlatformTrack.id.endsWith('-awaiting') &&
                              currentPlatformTrack.id !== 'spotify-idle'
                              ? `Şu An Yansıyan: ${currentPlatformTrack.name} – ${currentPlatformTrack.artists.join(', ')}`
                              : `${meta.name} canlı senkronizasyonu hazır (${meta.name} üzerinden şarkı açtığınızda otomatik algılanır)`
                            : platform === 'youtube_music'
                            ? 'YouTube Music hesabınızı bağlayarak açtığınız şarkıları otomatik algılatın ve yansıtın'
                            : platform === 'spotify'
                            ? 'Spotify hesabınızı bağlayarak telefon/bilgisayarda çaldığınız şarkıları otomatik algılatın'
                            : 'Apple Music hesabınızı bağlayarak çaldığınız şarkıları anında yansıtın'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConnected && hasLiveToken ? (
                        <>
                          {platform === 'spotify' && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playClick();
                                setShowSpotifyAuthStep(!showSpotifyAuthStep);
                              }}
                              className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                            >
                              Yenile
                            </button>
                          )}

                          {platform === 'youtube_music' && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playClick();
                                setShowYouTubeAuthStep(!showYouTubeAuthStep);
                              }}
                              className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                            >
                              Yenile
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDisconnectPlatform(platform)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                          >
                            Bağlantıyı Kes
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isConnecting}
                          onClick={() => handleDirectPlatformAuthConnect(platform)}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 shadow-lg ${
                            meta.textOnAccent === 'black' ? 'text-black' : 'text-white'
                          }`}
                          style={{ backgroundColor: meta.accentHex }}
                        >
                          {isConnecting ? 'Bağlanıyor...' : 'Hesabı Bağla'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SPOTIFY CONNECTION PANEL */}
                  {platform === 'spotify' && (showSpotifyAuthStep || !isConnected || !hasLiveToken) && (
                    <div className="pt-3 border-t border-neutral-800 space-y-3 animate-in fade-in duration-150">
                      <div className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1DB954] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>1. Hızlı & Kesintisiz Bağlantı (Token İle - 0 Hata)</span>
                          </span>
                          <a
                            href="https://developer.spotify.com/documentation/web-api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                          >
                            <span>Spotify Konsolu</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          Spotify&apos;da çaldığınız parçanın uygulamaya 1 saniyede otomatik yansıması için Spotify Access Token&apos;ınızı buraya yapıştırın.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            placeholder="Spotify Access Token (BQ...) veya Yönlendirilen URL"
                            value={spotifyCodeOrTokenInput}
                            onChange={(e) => setSpotifyCodeOrTokenInput(e.target.value)}
                            className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (navigator.clipboard?.readText) {
                                try {
                                  const text = (await navigator.clipboard.readText())?.trim();
                                  if (text) {
                                    setSpotifyCodeOrTokenInput(text);
                                    handleCompleteSpotifyAuth(text);
                                    return;
                                  }
                                } catch {}
                              }
                              handleCompleteSpotifyAuth();
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors cursor-pointer shrink-0 shadow-md"
                          >
                            Panodan Yapıştır & Bağla
                          </button>
                        </div>

                        {/* Method 2: Custom Client ID */}
                        <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                          <span className="text-xs font-bold text-neutral-300 block">
                            2. Kendi Spotify Developer Client ID&apos;niz İle
                          </span>
                          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 text-[11px] space-y-1.5">
                            <div className="flex items-center justify-between text-neutral-400">
                              <span>Gerekli Redirect URI (Geliştirici paneline ekleyin):</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof window !== 'undefined') {
                                    navigator.clipboard?.writeText(`${window.location.origin}/auth/callback`);
                                    soundEngine.playClick();
                                    setConnNotice({
                                      type: 'success',
                                      text: 'Redirect URI panoya kopyalandı! Spotify Developer App ayarlarınıza ekleyin.',
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[#1DB954] hover:underline cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Kopyala</span>
                              </button>
                            </div>
                            <code className="block p-1.5 rounded bg-black text-[#1DB954] font-mono text-[10.5px] select-all break-all">
                              {typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''}
                            </code>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="Spotify Client ID (Örn: 4b8f9e...)"
                              value={spotifyClientIdInput}
                              onChange={(e) => {
                                setSpotifyClientIdInput(e.target.value);
                                spotifyService.setSavedClientId(e.target.value);
                              }}
                              className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!spotifyClientIdInput.trim()) {
                                  setConnNotice({
                                    type: 'error',
                                    text: 'Lütfen Spotify Client ID girin.',
                                  });
                                  return;
                                }
                                spotifyService.startSpotifyLogin(spotifyClientIdInput.trim());
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer shrink-0"
                            >
                              Giriş Penceresini Aç
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* YOUTUBE MUSIC DIRECT IN-APP PLAYER & LIVE SYNC (ZERO TOKEN REQUIRED) */}
                  {platform === 'youtube_music' && (isConnected || showYouTubeAuthStep) && (
                    <div className="pt-3 border-t border-neutral-800 space-y-3 animate-in fade-in duration-150">
                      <div className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-[#FF0000] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Doğrudan YouTube Music Çalar & Anında Senkronizasyon (Tokensız)</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                          Hiçbir token veya izinle uğraşmadan doğrudan şarkı ya da sanatçı adını yazıp <strong>Hemen Çal</strong>&apos;a basın; parça tam sürüm olarak YouTube Music üzerinden başlar ve odak ekranına otomatik yansır:
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            placeholder="YouTube Music'te çalmak istediğiniz şarkı veya sanatçı adı..."
                            value={ytQuickInput}
                            onChange={(e) => setYtQuickInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleYouTubeQuickSearchOrConnect();
                              }
                            }}
                            className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF0000]"
                          />
                          <button
                            type="button"
                            disabled={isSearchingYt}
                            onClick={() => handleYouTubeQuickSearchOrConnect()}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#FF0000] text-white hover:bg-[#e60000] transition-colors cursor-pointer shrink-0 shadow-md flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{isSearchingYt ? 'Aranıyor...' : 'Hemen Çal'}</span>
                          </button>
                        </div>

                        {ytSearchResults.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 max-h-44 overflow-y-auto pr-1">
                            {ytSearchResults.map((item) => {
                              const isCurrent = liveTrack?.id === item.id && liveTrack?.isPlaying;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={async () => {
                                    soundEngine.playClick();
                                    await spotifyService.playYouTubeMusicTrackImmediate(item);
                                    const updated = spotifyService.getConnectionsConfig();
                                    persistMusicConnectionsToCloud(updated);
                                  }}
                                  className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-[#FF0000]/15 border-[#FF0000] text-white'
                                      : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 text-neutral-200'
                                  }`}
                                >
                                  <img
                                    src={item.cover}
                                    alt={item.name}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-lg object-cover shrink-0 bg-neutral-800"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                    <p className="text-[10.5px] text-neutral-400 truncate">{item.artist}</p>
                                  </div>
                                  <Play className="w-3.5 h-3.5 text-[#FF0000] fill-current shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CONNECTED LIVE STATUS BADGE */}
                  {isConnected && hasLiveToken && (
                    <div className="pt-2 border-t border-neutral-800/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11.5px] font-medium">
                          Otomatik Algılama aktif. Hangi platformdan şarkı açarsanız kendiliğinden o platform devreye girer.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: THEME & DEVICE */}
        {activeTab === 'theme' && (
          <div className="space-y-4 py-2">
            {/* Device Mode Selector */}
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span>Cihaz & Ekran Görünüm Modu</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Uygulamanın PC, tablet veya telefon için optimize edilmiş arayüzünü seçin. Otomatik modda cihazınız kendiliğinden algılanır.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  {
                    id: 'auto' as const,
                    label: 'Otomatik',
                    sub: `(${detectedDevice === 'mobile' ? 'Telefon' : detectedDevice === 'tablet' ? 'Tablet' : 'PC'})`,
                    icon: Sparkles,
                    color: 'text-amber-400',
                  },
                  {
                    id: 'mobile' as const,
                    label: 'Telefon',
                    sub: 'Alt menü barı',
                    icon: Smartphone,
                    color: 'text-emerald-400',
                  },
                  {
                    id: 'tablet' as const,
                    label: 'Tablet',
                    sub: '2 sütunlu düzen',
                    icon: Tablet,
                    color: 'text-sky-400',
                  },
                  {
                    id: 'desktop' as const,
                    label: 'Masaüstü / PC',
                    sub: 'Geniş radar HUD',
                    icon: Monitor,
                    color: 'text-purple-400',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = deviceMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        if (onSelectDeviceMode) {
                          onSelectDeviceMode(item.id);
                        }
                        onUpdateProfile({ deviceModePreference: item.id });
                      }}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'border-[#ff5500] bg-neutral-800/90 shadow-md text-white'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-xs font-bold leading-tight">{item.label}</span>
                      <span className="text-[10px] text-neutral-500 font-mono leading-tight">{item.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Colors */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">
                Renk Teması
              </p>
              {[
                { id: 'dark', name: 'Karanlık Grafit (Varsayılan)', hex: '#0b0c10', border: 'border-neutral-700' },
                { id: 'ocean', name: 'Derin Okyanus Mavisi', hex: '#05131f', border: 'border-cyan-800' },
                { id: 'emerald', name: 'Zümrüt Orman Yeşili', hex: '#06170e', border: 'border-emerald-800' },
                { id: 'midnight', name: 'Gece Yarısı Moru', hex: '#0d081f', border: 'border-purple-800' },
              ].map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => handleSelectTheme(th.id)}
                className={`w-full p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                  currentTheme === th.id
                    ? 'border-[#ff5500] bg-neutral-900/90 shadow-lg shadow-[#ff5500]/10'
                    : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg border ${th.border} shadow-inner`}
                    style={{ backgroundColor: th.hex }}
                  />
                  <div>
                    <p className="text-xs font-bold text-white">{th.name}</p>
                    <p className="text-[11px] text-neutral-400 font-mono">{th.hex}</p>
                  </div>
                </div>
                {currentTheme === th.id && (
                  <Check className="w-4 h-4 text-[#ff5500]" />
                )}
              </button>
            ))}
            </div>
          </div>
        )}

        {/* TAB 3: SECURITY & ACCOUNT */}
        {activeTab === 'security' && (
          <div className="space-y-4 py-2">
            {securityMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  securityMsg.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/40 border-red-800 text-red-300'
                }`}
              >
                <span>{securityMsg.text}</span>
              </div>
            )}

            {/* Email update */}
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>Kayıtlı E-posta Adresi</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Mevcut: <strong className="text-white font-mono">{currentUser?.email || profile.email || (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_email') : '') || (profile.userId ? 'Kayıtlı Öğrenci Hesabı' : 'Giriş yapılmadı')}</strong>
                </p>
              </div>

              {currentUser && (
                <form onSubmit={handleUpdateEmail} className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Yeni e-posta adresi..."
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingEmail}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingEmail ? 'Güncelleniyor...' : 'Güncelle'}
                  </button>
                </form>
              )}
            </div>

            {/* Direct Password Management (Parola Koy / Parola Değiştir) */}
            {currentUser && (
              <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#ff5500]" />
                      <span>{hasPasswordProvider ? 'Parolayı Değiştir' : 'Hesabına Parola Belirle'}</span>
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {hasPasswordProvider
                        ? 'Hesabınızın giriş parolasını buradan güncelleyebilirsiniz.'
                        : 'Google hesabınıza bir parola tanımlayarak daha sonra e-posta ve şifrenizle de giriş yapabilirsiniz.'}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasPasswordProvider
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {hasPasswordProvider ? 'Parolalı Hesap' : 'Parola Yok (Google)'}
                  </span>
                </div>

                {passwordSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}

                {passwordErrorMsg && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateOrSetPassword} className="space-y-2.5 pt-1">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={hasPasswordProvider ? 'Yeni Parola (en az 6 karakter)...' : 'Belirlemek istediğiniz parola (en az 6 karakter)...'}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Yeni Parola Tekrar..."
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-bold transition-all shadow-md shadow-[#ff5500]/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{hasPasswordProvider ? 'Parolayı Güncelle' : 'Parolayı Oluştur'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Password Reset Via Email Link */}
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Şifre Sıfırlama E-postası</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  E-posta adresinize güvenli şifre sıfırlama bağlantısı gönderir.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
              >
                {passwordResetSent ? 'Tekrar Gönder' : 'Bağlantı Gönder'}
              </button>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-3">
              <div>
                <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Hesabı ve Verileri Kalıcı Olarak Sil</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Hesabınızı sildiğinizde tüm çalışma seanslarınız ve görevleriniz geri döndürülemez şekilde silinir.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 transition-colors cursor-pointer"
                >
                  Hesabı Sil
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-neutral-950 border border-red-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-red-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Emin misiniz? Bu işlem geri alınamaz!</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteAccount}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isDeleting ? 'Siliniyor...' : 'Evet, Kalıcı Olarak Sil'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white text-xs font-semibold cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CLOUD & BACKUP (BULUT & YEDEKLEME) */}
        {activeTab === 'backup' && (
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {backupNotice && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                  backupNotice.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/60 border-red-500/50 text-red-200'
                }`}
              >
                {backupNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{backupNotice.text}</span>
              </div>
            )}

            {/* Firestore Cloud Status & Action Card */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <span>Firestore Bulut Eşitleme & Cihazlar Arası Senkronizasyon</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Bilgisayar, telefon ve tabletiniz arasında tüm odak seanslarınızı, görevlerinizi ve istatistiklerinizi tek dokunuşla yedekleyin veya geri yükleyin.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Bulut Aktif
                  </span>
                </div>
              </div>

              {/* Automatic Backup After Focus Session Badge */}
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Her Focus Tamamlandığında Otomatik Buluta Yedekleme</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AÇIK
                </span>
              </div>

              {/* Optional Account Email Sync Key for Instant Cross-Device Restore */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-neutral-300">
                  Eşitleme E-postası / Hesap Anahtarı (Tablet & Telefon & PC Ortak Yedek):
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={syncEmailInput}
                      onChange={(e) => setSyncEmailInput(e.target.value)}
                      placeholder="E-posta adresiniz (örn: ogrenci@gmail.com)"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Action Buttons: ALWAYS ENABLED & TOUCH FRIENDLY */}
              <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isSyncing || isRestoring}
                  onClick={handleBackupNow}
                  className="py-3 px-4 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 active:scale-[0.99] border border-sky-500/40 text-sky-200 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-sky-950/30"
                >
                  <RefreshCw className={`w-4 h-4 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Buluta Yedekleniyor...' : 'Buluta Yedekle'}</span>
                </button>

                <button
                  type="button"
                  disabled={isRestoring || isSyncing}
                  onClick={handleRestoreNow}
                  className="py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-[0.99] border border-emerald-500/50 text-emerald-200 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950/30"
                >
                  <Cloud className={`w-4 h-4 text-emerald-400 ${isRestoring ? 'animate-bounce' : ''}`} />
                  <span>{isRestoring ? 'Buluttan Yükleniyor...' : 'Buluttan Geri Yükle'}</span>
                </button>
              </div>

              {!currentUser && (
                <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-400">
                    Farklı bir hesapla oturum açmak ister misiniz?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#ff5500]/20 hover:bg-[#ff5500]/30 border border-[#ff5500]/40 text-[#ff5500] font-bold text-xs transition-all cursor-pointer"
                  >
                    Hesaba Giriş Yap
                  </button>
                </div>
              )}
            </div>

            {/* Offline JSON Backup / Restore (Dosya İndir / Yükle) */}
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>Çevrimdışı JSON Yedekleme</span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tüm çalışma seanslarınızı, görevlerinizi ve hedeflerinizi JSON formatında cihazınıza kaydedin veya geri yükleyin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Export JSON */}
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Yedek İndir (.json)</span>
                </button>

                {/* Import JSON */}
                <label className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Yedekten İçe Aktar</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between flex-wrap gap-2">
              <span>Mevcut Cihaz Seansları: <strong className="text-white">{sessions.length}</strong></span>
              <span>Aktif Görevler: <strong className="text-white">{tasks.length}</strong></span>
              <span>Son Senkronizasyon: <strong className="text-emerald-400">{getLastSyncTime() ? new Date(getLastSyncTime()!).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Hazır'}</strong></span>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
