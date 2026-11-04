import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  Cloud,
  RefreshCw,
  Copy,
  Download,
  Upload,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  db,
  handleFirestoreError,
  OperationType,
  safeSetDoc,
} from '../firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  getAdditionalUserInfo,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';
import { isAndroidNativeAuth, signInWithNativeGoogle, signOutNativeGoogle, getNativeGoogleOAuthDiagnosticReport } from '../services/nativeGoogleAuth';
import {
  syncAllToFirestore,
  restoreAllFromFirestore,
  getLastSyncTime,
  exportLocalBackup,
  importLocalBackup,
} from '../services/syncService';
import {
  getStoredSessions,
  getStoredTasks,
  getStoredProfile,
  updateStoredProfile,
} from '../utils/storage';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  initialMode?: 'login' | 'register';
  onRegistrationSuccess?: () => void;
  onSyncComplete?: () => void;
  onProfileUpdate?: (profile: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'login',
  onRegistrationSuccess,
  onSyncComplete,
  onProfileUpdate,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginSuccessState, setLoginSuccessState] = useState<{
    name: string;
    avatarUrl?: string;
    email?: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(2);

  // Forgot password flow
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Cloud sync status
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [restoringCloud, setRestoringCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Domain authorization banner for Google sign-in
  const [domainErrorHostname, setDomainErrorHostname] = useState<string | null>(null);
  const [androidOAuthReport, setAndroidOAuthReport] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Hidden file input for backup restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsRegisterMode(initialMode === 'register');
    setIsForgotPassword(false);
    setResetSentSuccess(false);
    setErrorMsg(null);
    setSyncNotice(null);
    setDomainErrorHostname(null);
    setAndroidOAuthReport(null);
    setCopiedDomain(false);
    setLoginSuccessState(null);
    setRedirectCountdown(2);
  }, [initialMode, isOpen]);

  // Auto-redirect to home screen after 2-3 seconds when connected
  useEffect(() => {
    if (!loginSuccessState) return;

    setRedirectCountdown(2);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLoginSuccessState(null);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loginSuccessState, onClose]);

  if (!isOpen) return null;

  // 1. Google ile Giriş
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setDomainErrorHostname(null);
      setAndroidOAuthReport(null);
      soundEngine.playClick();

      // Android's native Google account picker avoids Chrome/WebView storage separation.
      // Keep the existing popup flow exactly as-is on the website and PWA.
      const result = isAndroidNativeAuth
        ? await signInWithNativeGoogle()
        : await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalInfo?.isNewUser ?? false;

      const userPhoto = user.photoURL || '';
      const userDisplayName = user.displayName || user.email?.split('@')[0] || 'Öğrenci';
      const firstNameOnly = userDisplayName.trim().split(' ')[0] || userDisplayName;

      // Cihaz hatırlama / kalıcı giriş anahtarları
      try {
        localStorage.setItem('fokus_user_authenticated', 'true');
        localStorage.setItem('fokus_user_uid', user.uid);
        localStorage.setItem('fokus_user_email', user.email || '');
        localStorage.removeItem('fokus_guest_mode');
      } catch {}

      // 1. Hemen yerel profili Google verileriyle güncelle & anında üst bileşene ilet (sayfa yenileme GEREKTİRMEZ)
      const immediateProfile = updateStoredProfile({
        userId: user.uid,
        email: user.email || '',
        name: userDisplayName,
        avatarUrl: userPhoto,
        hasCompletedOnboarding: true,
      });

      if (onProfileUpdate) {
        onProfileUpdate(immediateProfile);
      }

      // 2. Firestore'daki mevcut profili güvenle kontrol et & kaydet
      const userRef = doc(db, 'users', user.uid);
      let userAlreadyHadProfile = false;
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          userAlreadyHadProfile = true;
          const data = snap.data();
          const resolvedAvatar = (typeof data.avatarUrl === 'string' && data.avatarUrl) ? data.avatarUrl : userPhoto;
          const resolvedName = (typeof data.name === 'string' && data.name) ? data.name : userDisplayName;
          const merged = updateStoredProfile({
            userId: user.uid,
            name: resolvedName,
            avatarUrl: resolvedAvatar,
            targetUniversity: data.targetUniversity || '',
            targetDepartment: data.targetDepartment || '',
            studyTrack: data.studyTrack || 'Sayısal',
            hasCompletedOnboarding: true,
          });
          if (onProfileUpdate) {
            onProfileUpdate(merged);
          }
        } else {
          // Yeni doküman oluştur
          await safeSetDoc(
            userRef,
            {
              userId: user.uid,
              email: user.email || '',
              displayName: userDisplayName,
              name: userDisplayName,
              avatarUrl: userPhoto,
              targetExam: immediateProfile.targetExam || 'YKS 2026 Sayısal',
              studyTrack: immediateProfile.studyTrack || 'Sayısal',
              dailyGoalHours: immediateProfile.dailyGoalHours || 6,
              streakDays: Math.max(1, immediateProfile.currentStreakDays || 1),
              totalFocusMinutes: Math.round((immediateProfile.totalFocusHours || 0) * 60),
              hasCompletedOnboarding: true,
              updatedAt: Date.now(),
              createdAt: Date.now(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      // 3. Silent bidirectional sync with Firestore (pull & merge first, then push)
      try {
        const restored = await restoreAllFromFirestore(user);
        if (restored.profile && onProfileUpdate) {
          onProfileUpdate(restored.profile);
        }
        await syncAllToFirestore(
          user,
          restored.sessions,
          restored.tasks,
          restored.profile || getStoredProfile()
        );
      } catch (syncErr) {
        console.warn('Google login background sync notice:', syncErr);
      }

      soundEngine.playCompletionBell();

      // ONBOARDING SADECE ve SADECE kullanıcı Kayıt Ol modundayken VE yepyeni ilk kez kaydolan hesapsa açılır!
      if (isRegisterMode && isNewUser && !userAlreadyHadProfile) {
        onClose();
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      } else {
        // Normal Giriş: 2-3 saniye "bağlandı" ekranını göster ve ardından otomatik ana sayfaya yönlendir
        setLoginSuccessState({
          name: firstNameOnly,
          avatarUrl: userPhoto,
          email: user.email || undefined,
        });
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      if (isAndroidNativeAuth) {
        try {
          setAndroidOAuthReport(await getNativeGoogleOAuthDiagnosticReport());
        } catch (diagnosticError) {
          console.warn('Android signing certificate diagnostics unavailable:', diagnosticError);
          setAndroidOAuthReport('Kurulu APK imzası okunamadı. Bu sürümde tanılama desteklenmiyor.');
        }
      }
      if (isAndroidNativeAuth && /UNREGISTERED_ON_API_CONSOLE|Account reauth failed/i.test(err.message || '')) {
        setErrorMsg('Google Cloud\'da bu APK için Android OAuth istemcisi bulunamadı. Paket adı ve SHA-1 sertifikasını kaydedin.');
      } else if (isAndroidNativeAuth && err.code === 'SIGN_IN_CANCELED') {
        setErrorMsg('Google hesap seçimi iptal edildi. Tekrar deneyebilirsiniz. Hesap seçtikten sonra bu hata oluşuyorsa Android OAuth SHA-1 kaydını kontrol edin.');
      } else if (isAndroidNativeAuth && err.code === 'SIGN_IN_FAILED') {
        setErrorMsg('Android Google giriş servisi başarısız oldu. Google Play Hizmetleri, bağlantı ve Android OAuth ayarlarını kontrol edin.');
      } else if (err.code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'run.app';
        setDomainErrorHostname(hostname);
        setErrorMsg(
          `Google Girişi için mevcut alan adı (${hostname}) Firebase Konsolu'nda yetkilendirilmiş olmalıdır. Alan adını kopyalayıp ekleyebilir veya aşağıdaki E-posta & Şifre alanıyla hemen giriş yapabilirsiniz.`
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Giriş penceresi kapatıldı.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Tarayıcınız açılır pencereyi engelledi. Lütfen açılır pencerelere izin verip tekrar deneyin.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setErrorMsg('Bu e-posta adresi daha önce farklı giriş yöntemiyle kaydedilmiş. Önce mevcut yönteminizle giriş yapın.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMsg('Google girişinde internet bağlantısı kurulamadı. Bağlantınızı kontrol edin.');
      } else if (isAndroidNativeAuth && err.code === 'auth/invalid-credential') {
        setErrorMsg('Google kimliği Firebase tarafından kabul edilmedi. Google Cloud Android OAuth ve web istemci ayarlarını kontrol edin.');
      } else {
        setErrorMsg(err.message || 'Google ile giriş yapılırken bir sorun oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. E-posta & Şifre ile Giriş / Kayıt Ol
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Lütfen e-posta adresinizi ve şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      soundEngine.playClick();

      if (isRegisterMode) {
        // Yeni Kullanıcı Kaydı
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = result.user;
        const stored = getStoredProfile();

        // Cihaz hatırlama / kalıcı giriş anahtarları
        try {
          localStorage.setItem('fokus_user_authenticated', 'true');
          localStorage.setItem('fokus_user_uid', user.uid);
          localStorage.setItem('fokus_user_email', user.email || cleanEmail);
          localStorage.removeItem('fokus_guest_mode');
        } catch {}

        const userDisplayName = displayName.trim() || cleanEmail.split('@')[0];
        const registeredProfile = updateStoredProfile({
          userId: user.uid,
          email: user.email || cleanEmail,
          name: userDisplayName,
          hasCompletedOnboarding: true,
        });
        if (onProfileUpdate) {
          onProfileUpdate(registeredProfile);
        }

        const userRef = doc(db, 'users', user.uid);
        try {
          await safeSetDoc(
            userRef,
            {
              userId: user.uid,
              email: user.email || cleanEmail,
              displayName: userDisplayName,
              name: userDisplayName,
              dailyGoalHours: stored.dailyGoalHours || 6,
              streakDays: Math.max(1, stored.currentStreakDays || 1),
              totalFocusMinutes: Math.round((stored.totalFocusHours || 0) * 60),
              targetExam: stored.targetExam || 'YKS 2026 Sayısal',
              studyTrack: stored.studyTrack || 'Sayısal',
              hasCompletedOnboarding: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }

        // Yerel verileri bu yeni hesaba sessizce yedekle
        try {
          await syncAllToFirestore(
            user,
            getStoredSessions(),
            getStoredTasks(),
            getStoredProfile()
          );
        } catch (syncErr) {
          console.warn('Initial register sync notice:', syncErr);
        }

        soundEngine.playCompletionBell();
        onClose();
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      } else {
        // Mevcut Kullanıcı Girişi
        const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = result.user;

        // Cihaz hatırlama / kalıcı giriş anahtarları
        try {
          localStorage.setItem('fokus_user_authenticated', 'true');
          localStorage.setItem('fokus_user_uid', user.uid);
          localStorage.setItem('fokus_user_email', user.email || cleanEmail);
          localStorage.removeItem('fokus_guest_mode');
        } catch {}

        const userPhoto = user.photoURL || '';
        const userDisplayName = user.displayName || user.email?.split('@')[0] || cleanEmail.split('@')[0];
        const firstNameOnly = userDisplayName.trim().split(' ')[0] || userDisplayName;

        // Hemen yerel profili güncelle & üst bileşene ilet
        const immediateProfile = updateStoredProfile({
          userId: user.uid,
          email: user.email || cleanEmail,
          name: userDisplayName,
          avatarUrl: userPhoto,
          hasCompletedOnboarding: true,
        });
        if (onProfileUpdate) {
          onProfileUpdate(immediateProfile);
        }

        // Buluttaki verileri yerel ile sessizce birleştir
        try {
          const restored = await restoreAllFromFirestore(user, cleanEmail);
          if (restored.profile && onProfileUpdate) {
            onProfileUpdate(restored.profile);
          }
          await syncAllToFirestore(
            user,
            restored.sessions,
            restored.tasks,
            restored.profile || getStoredProfile()
          );
        } catch (syncErr) {
          console.warn('Login sync notice:', syncErr);
        }

        soundEngine.playCompletionBell();
        setLoginSuccessState({
          name: firstNameOnly,
          avatarUrl: userPhoto,
          email: user.email || cleanEmail,
        });
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Email Auth error:', err);
      let msg = err.message || 'Giriş yapılamadı.';

      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        msg =
          'E-posta veya şifre hatalı. Hesabınız yoksa lütfen "Kayıt Ol" sekmesini seçin veya şifrenizi unuttuysanız "Şifremi Unuttum" bağlantısını kullanın.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Bu e-posta adresiyle zaten kayıtlı bir hesap var. Lütfen "Giriş Yap" sekmesinden giriş yapın.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Şifreniz en az 6 karakter uzunluğunda olmalıdır.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Lütfen geçerli bir e-posta adresi formatı girin (örnek: ogrenci@gmail.com).';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Çok fazla başarısız deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin veya şifrenizi sıfırlayın.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Firebase üzerinde E-posta/Şifre giriş yöntemi etkin değil. Yönetici tarafından etkinleştirilmesi gerekiyor.';
      } else if (err.code === 'auth/user-disabled') {
        msg = 'Bu hesap devre dışı bırakılmış. Destek ile iletişime geçin.';
      } else if (err.code === 'auth/web-storage-unsupported') {
        msg = 'Bu cihazda oturum saklama kullanılamıyor. Android WebView ve Chrome bileşenlerini güncelleyin.';
      } else if (/API_KEY|REFERER_BLOCKED|blocked by API key/i.test(err.message || '')) {
        msg = 'Android uygulamasının Firebase API anahtarı yetkisi engelleniyor. Proje API anahtarı kısıtlamaları kontrol edilmeli.';
      }

      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Şifre Sıfırlama
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Lütfen şifre sıfırlama bağlantısı için e-posta adresinizi girin.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSentSuccess(true);
      soundEngine.playCompletionBell();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setErrorMsg('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı.');
      } else {
        setErrorMsg(err.message || 'Şifre sıfırlama bağlantısı gönderilemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Manuel Bulut Eşitlemesi & Geri Yükleme
  const handleManualSyncNow = async () => {
    try {
      setSyncingCloud(true);
      setSyncNotice(null);
      soundEngine.playClick();
      const res = await syncAllToFirestore(
        currentUser || auth.currentUser,
        getStoredSessions(),
        getStoredTasks(),
        getStoredProfile(),
        { allowEmptyOverwrite: true }
      );
      if (res.success) {
        setSyncNotice(`${res.sessionsUploaded} seans ve ${res.tasksUploaded} görev buluta yedeklendi! ☁️`);
        soundEngine.playCompletionBell();
      } else {
        setSyncNotice(res.message || 'Yedekleme tamamlandı.');
      }
      if (onSyncComplete) onSyncComplete();
    } catch {
      setSyncNotice('Bulut eşitlemesi tamamlandı.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleManualRestoreNow = async () => {
    try {
      setRestoringCloud(true);
      setSyncNotice(null);
      soundEngine.playClick();
      const res = await restoreAllFromFirestore(currentUser || auth.currentUser, email.trim() || undefined);
      if (res.success) {
        if (res.profile && onProfileUpdate) {
          onProfileUpdate(res.profile);
        }
        setSyncNotice(`${res.sessions.length} seans ve ${res.tasks.length} görev buluttan geri yüklendi! ☁️`);
        soundEngine.playCompletionBell();
      } else {
        setSyncNotice(res.message || 'Geri yükleme tamamlandı.');
      }
      if (onSyncComplete) onSyncComplete();
    } catch {
      setSyncNotice('Buluttan geri yükleme tamamlandı.');
    } finally {
      setRestoringCloud(false);
    }
  };

  // 5. Oturumu Kapat
  const handleSignOut = async () => {
    try {
      soundEngine.playClick();
      await signOut(auth);
      await signOutNativeGoogle();
      onClose();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // 6. JSON Yedek Dosyası İndir
  const handleExportJSON = () => {
    soundEngine.playClick();
    exportLocalBackup(getStoredSessions(), getStoredTasks(), getStoredProfile());
  };

  // 7. JSON Yedekten Geri Yükle
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importLocalBackup(text, currentUser);
      if (res.success) {
        setSyncNotice(res.message);
        soundEngine.playCompletionBell();
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg('Yedek dosyası okunamadı: ' + (err.message || 'Geçersiz dosya'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-[#12141a] p-5 sm:p-6 shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800/80">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {loginSuccessState
                ? 'Giriş Başarılı'
                : currentUser
                ? 'Hesap & Bulut Senkronizasyonu'
                : isRegisterMode
                ? 'Fokus Hesabı Oluştur'
                : "Fokus'a Giriş Yap"}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {loginSuccessState
                ? 'Hesabınız bağlandı, ana sayfaya yönlendiriliyorsunuz'
                : currentUser
                ? 'Firestore bulut verileriniz ve cihaz yedekleriniz'
                : 'Verilerinizi buluta yedekleyin ve tüm cihazlarınızda erişin'}
            </p>
          </div>
          <button
            onClick={() => {
              setLoginSuccessState(null);
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. BAĞLANTI BAŞARILI & 2-3 SANİYE SONRA OTOMATİK ANA SAYFAYA GEÇİŞ */}
        {loginSuccessState ? (
          <div className="py-6 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/60">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Firestore Bulut Bağlantısı Aktif
              </span>
              <h3 className="text-xl font-black text-white pt-2">
                Hesabınıza Başarıyla Bağlandı!
              </h3>
              <p className="text-xs text-neutral-300">
                Hoş geldin, <span className="font-bold text-emerald-300">{loginSuccessState.name}</span>! Tüm ilerlemen güvende.
              </p>
            </div>

            {/* Profil Önizleme Kartı */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-sm mx-auto text-left">
              {loginSuccessState.avatarUrl ? (
                <img
                  src={loginSuccessState.avatarUrl}
                  alt={loginSuccessState.name}
                  className="w-11 h-11 rounded-full object-cover border border-[#ff5500] shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff5500] to-amber-500 flex items-center justify-center text-base font-bold text-white shadow-md shrink-0">
                  {loginSuccessState.name.charAt(0).toUpperCase() || 'Ö'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {loginSuccessState.name}
                </p>
                {loginSuccessState.email && (
                  <p className="text-xs text-neutral-400 truncate font-mono">{loginSuccessState.email}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Bağlandı · Senkronize
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 max-w-sm mx-auto space-y-2">
              <p className="text-[11px] text-neutral-400 font-mono">
                {redirectCountdown > 0
                  ? `${redirectCountdown} saniye sonra ana sayfaya yönlendiriliyorsunuz...`
                  : 'Ana sayfaya yönlendiriliyorsunuz...'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoginSuccessState(null);
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff5500]/25 transition-all cursor-pointer active:scale-98"
              >
                <span>Hemen Ana Sayfaya Git</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : currentUser ? (
          <div className="py-4 space-y-4">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Profil'}
                  className="w-11 h-11 rounded-full object-cover border border-[#ff5500] shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#ff5500] to-amber-500 flex items-center justify-center text-base font-bold text-white shadow-md shrink-0">
                  {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'Ö'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {(currentUser.displayName || 'Öğrenci').trim().split(' ')[0]}
                </p>
                <p className="text-xs text-neutral-400 truncate">{currentUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Firestore Bulut Bağlantısı Aktif
                  </span>
                </div>
              </div>
            </div>

            {/* Cloud Sync Status */}
            <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 flex items-center gap-1.5 font-medium">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  Bulut Eşitlemesi
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  {getLastSyncTime()
                    ? `Son: ${new Date(getLastSyncTime()!).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Otomatik'}
                </span>
              </div>

              {syncNotice && (
                <p className="text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-800/40 p-2 rounded-lg flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{syncNotice}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleManualSyncNow}
                  disabled={syncingCloud || restoringCloud}
                  className="py-2.5 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${syncingCloud ? 'animate-spin' : ''}`} />
                  <span>{syncingCloud ? 'Yedekleniyor...' : 'Buluta Yedekle'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualRestoreNow}
                  disabled={restoringCloud || syncingCloud}
                  className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Cloud className={`w-3.5 h-3.5 text-emerald-400 ${restoringCloud ? 'animate-bounce' : ''}`} />
                  <span>{restoringCloud ? 'Yükleniyor...' : 'Buluttan Geri Yükle'}</span>
                </button>
              </div>
            </div>

            {/* Offline JSON Backup / Restore */}
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800/70 space-y-2">
              <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Çevrimdışı JSON Yedekleme</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Tüm çalışma seanslarınızı ve görevlerinizi bilgisayarınıza indirip saklayabilir veya başka bir cihaza yükleyebilirsiniz.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Yedek İndir</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Yedek Yükle</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportJSON}
                />
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors cursor-pointer"
            >
              Oturumu Kapat
            </button>
          </div>
        ) : isForgotPassword ? (
          /* FORGOT PASSWORD VIEW */
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Şifrenizi mi Unuttunuz?</h4>
                <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed">
                  Hesabınıza kayıtlı e-posta adresinizi girin. Size şifrenizi sıfırlamanız için güvenli bir bağlantı göndereceğiz.
                </p>
              </div>
            </div>

            {resetSentSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="font-bold">Sıfırlama Bağlantısı Gönderildi!</p>
                <p className="text-[11px] text-neutral-300">
                  <span className="text-white font-semibold">{email}</span> adresine sıfırlama bağlantısı iletildi. Lütfen gelen kutunuzu kontrol edin.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSentSuccess(false);
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs cursor-pointer"
                >
                  Giriş Ekranına Dön
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    Kayıtlı E-posta Adresi
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      placeholder="ornek@ogrenci.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors shadow-lg shadow-[#ff5500]/25 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setErrorMsg(null);
                    }}
                    className="w-full py-2 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer text-center"
                  >
                    Vazgeç ve Giriş Ekranına Dön
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* LOGIN & REGISTER MAIN VIEW */
          <div className="py-4 space-y-4">
            
            {/* 1. GOOGLE SIGN IN (TOP PRIORITY - 1 CLICK) */}
            <div>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md hover:border-neutral-600 disabled:opacity-50 active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Google ile bağlanılıyor...' : 'Google ile Giriş Yap (Tek Tık)'}</span>
              </button>
            </div>

            {/* DOMAIN AUTHORIZATION HELPER BANNER (IF UNAUTHORIZED DOMAIN) */}
            {domainErrorHostname && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-300">Google Girişi Alan Adı Bildirimi</p>
                    <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                      Google OAuth güvenliği gereği, bu çalışma adresinin Firebase Konsolu'nda "Authorized domains" listesine eklenmesi gerekir:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-amber-800/40">
                  <span className="font-mono text-[11px] text-amber-100 truncate flex-1 select-all">
                    {domainErrorHostname}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (domainErrorHostname) {
                        navigator.clipboard.writeText(domainErrorHostname);
                        setCopiedDomain(true);
                        setTimeout(() => setCopiedDomain(false), 2500);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                  >
                    {copiedDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDomain ? 'Kopyalandı ✓' : 'Kopyala'}</span>
                  </button>
                </div>

                <p className="text-[10px] text-neutral-400">
                  İpucu: Dilerseniz yukarıdaki adresi kopyalamadan da aşağıdaki e-posta ve şifre formunu kullanarak hemen kesintisiz giriş yapabilirsiniz.
                </p>
              </div>
            )}

            {/* DIVIDER */}
            <div className="flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-neutral-800" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                veya e-posta ile
              </span>
              <div className="h-[1px] flex-1 bg-neutral-800" />
            </div>

            {/* TAB SELECTOR: GİRİŞ YAP / KAYIT OL */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setIsRegisterMode(false);
                  setErrorMsg(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !isRegisterMode
                    ? 'bg-[#ff5500] text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setIsRegisterMode(true);
                  setErrorMsg(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isRegisterMode
                    ? 'bg-[#ff5500] text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {/* ERROR BANNER */}
            {errorMsg && !domainErrorHostname && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Error-only native APK identity report. Never includes user secrets or tokens. */}
            {isAndroidNativeAuth && androidOAuthReport && errorMsg && (
              <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 p-3 space-y-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-neutral-200">Android Google giriş tanılama bilgileri</span>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(androidOAuthReport); }}
                    className="shrink-0 flex items-center gap-1 rounded-md border border-neutral-600 px-2 py-1 text-[10px] text-neutral-300"
                  >
                    <Copy className="h-3 w-3" /> Kopyala
                  </button>
                </div>
                <pre className="select-text whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-neutral-400 max-h-44 overflow-auto">{androidOAuthReport}</pre>
              </div>
            )}

            {isAndroidNativeAuth && errorMsg && (
              <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-left text-[11px] leading-relaxed text-amber-100/90">
                <p className="font-semibold text-amber-200">Google Cloud erişimi olmadan aynı hesabınla giriş</p>
                <p className="mt-1">NevoFocus web sitesinde Google hesabınla oturum açıp
                  <strong> Ayarlar → Güvenlik → Hesabına Parola Belirle</strong> işlemini yap.
                  Sonra burada <strong>aynı e-posta ve belirlediğin parolayla</strong> giriş yap.
                  Yeni hesap açma; mevcut çalışma geçmişin aynı Firebase hesabında kalır.
                </p>
              </div>
            )}
            {/* DIRECT EMAIL & PASSWORD FORM */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1">
                    Ad Soyad
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      required
                      placeholder="Örn: Kenan Erdem"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    placeholder="ornek@ogrenci.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-400">
                    Parola
                  </label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setIsForgotPassword(true);
                        setErrorMsg(null);
                      }}
                      className="text-[11px] text-[#ff5500] hover:underline cursor-pointer"
                    >
                      Şifremi Unuttum?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors shadow-lg shadow-[#ff5500]/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>
                  {loading
                    ? 'İşleniyor...'
                    : isRegisterMode
                    ? 'Hesap Oluştur & Başla'
                    : 'E-posta ile Giriş Yap'}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
