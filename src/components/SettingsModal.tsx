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
  Database
} from 'lucide-react';
import { UserProfile, FocusSession, FocusTask } from '../types';
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
import {
  syncAllToFirestore,
  restoreAllFromFirestore,
  exportLocalBackup,
  importLocalBackup,
  getLastSyncTime,
} from '../services/syncService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  currentUser: any;
  sessions?: FocusSession[];
  tasks?: FocusTask[];
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onAccountDeleted: () => void;
  onSyncComplete?: (sessions: FocusSession[], tasks: FocusTask[], profile?: UserProfile) => void;
  onOpenAuth?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentUser,
  sessions = [],
  tasks = [],
  onUpdateProfile,
  onAccountDeleted,
  onSyncComplete,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'theme' | 'security' | 'backup'>('notifications');

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
  const hasPasswordProvider =
    currentUser?.providerData?.some((p: any) => p.providerId === 'password') ||
    Boolean(profile.hasPassword);

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Backup & Cloud sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBackupNow = async () => {
    if (!currentUser) return;
    try {
      setIsSyncing(true);
      setBackupNotice(null);
      soundEngine.playClick();
      const res = await syncAllToFirestore(currentUser, sessions, tasks, profile);
      if (res.success) {
        soundEngine.playCompletionBell();
        setBackupNotice({
          type: 'success',
          text: `Başarılı! ${res.sessionsUploaded} çalışma seansı ve ${res.tasksUploaded} görev Firestore bulutuna yedeklendi.`,
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
    if (!currentUser) return;
    try {
      setIsRestoring(true);
      setBackupNotice(null);
      soundEngine.playClick();
      const res = await restoreAllFromFirestore(currentUser);
      if (res.success) {
        soundEngine.playCompletionBell();
        if (onSyncComplete) {
          onSyncComplete(res.sessions, res.tasks, res.profile as UserProfile);
        }
        setBackupNotice({
          type: 'success',
          text: `Geri yükleme tamamlandı! ${res.sessions.length} seans ve ${res.tasks.length} görev buluttan aktarıldı.`,
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

      // Properly link or update credential
      const cred = EmailAuthProvider.credential(currentUser.email!, newPasswordInput);
      try {
        await linkWithCredential(currentUser, cred);
      } catch (linkErr: any) {
        if (
          linkErr.code === 'auth/provider-already-linked' ||
          linkErr.code === 'auth/credential-already-in-use' ||
          linkErr.code === 'auth/email-already-in-use'
        ) {
          await updatePassword(currentUser, newPasswordInput);
        } else {
          // Fallback to updatePassword
          await updatePassword(currentUser, newPasswordInput);
        }
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
        <div className="flex items-center gap-2 my-4 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-[#ff5500]" />
            <span>Bildirimler</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'backup'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Bulut & Yedek</span>
          </button>
        </div>

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

        {/* TAB 2: THEME */}
        {activeTab === 'theme' && (
          <div className="space-y-3 py-2">
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
                  Mevcut: <strong className="text-white font-mono">{currentUser?.email || profile.email || 'Giriş yapılmadı'}</strong>
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
          <div className="space-y-4 py-2">
            {backupNotice && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  backupNotice.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-red-950/40 border-red-800/60 text-red-300'
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

            {/* Firestore Cloud Status Card */}
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <span>Firestore Bulut Eşitleme</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {currentUser
                      ? `${currentUser.email || currentUser.displayName} hesabınızla bulut yedekleme aktif.`
                      : 'Oturum açarak çalışma verilerinizi bulutta güvende tutun.'}
                  </p>
                </div>
                <div className="text-right">
                  {currentUser ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-mono text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Bulut Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800/50 text-[11px] font-mono text-amber-400">
                      Çevrimdışı / Yerel
                    </span>
                  )}
                </div>
              </div>

              {currentUser ? (
                <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={handleBackupNow}
                    className="py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Buluta Yedekleniyor...' : 'Hemen Buluta Yedekle'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={handleRestoreNow}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Cloud className={`w-3.5 h-3.5 ${isRestoring ? 'animate-bounce' : ''}`} />
                    <span>{isRestoring ? 'Buluttan Alınıyor...' : 'Buluttan Geri Yükle & Eşitle'}</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs shadow-lg shadow-[#ff5500]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Giriş Yap veya Kayıt Ol</span>
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
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
              <span>Mevcut Cihaz Seansları: <strong className="text-white">{sessions.length}</strong></span>
              <span>Aktif Görevler: <strong className="text-white">{tasks.length}</strong></span>
              <span>Son Senkronizasyon: <strong className="text-white">{getLastSyncTime() ? new Date(getLastSyncTime()!).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Yerel'}</strong></span>
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
