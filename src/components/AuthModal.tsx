import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  AlertCircle,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound
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
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
  type User,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  initialMode?: 'login' | 'register';
  onRegistrationSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'login',
  onRegistrationSuccess,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Google Sign-In Password Creation Step
  const [googleStepActive, setGoogleStepActive] = useState(false);
  const [googleUserForPassword, setGoogleUserForPassword] = useState<User | null>(null);
  const [googleNewPassword, setGoogleNewPassword] = useState('');
  const [googleConfirmPassword, setGoogleConfirmPassword] = useState('');
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [googlePasswordError, setGooglePasswordError] = useState<string | null>(null);

  React.useEffect(() => {
    setIsRegisterMode(initialMode === 'register');
    setGoogleStepActive(false);
    setGoogleUserForPassword(null);
    setGoogleNewPassword('');
    setGoogleConfirmPassword('');
    setGooglePasswordError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      soundEngine.playClick();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Sync user profile to Firestore
      const userRef = doc(db, 'users', user.uid);
      try {
        await safeSetDoc(
          userRef,
          {
            userId: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Öğrenci',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      // Check if user already has a password set on this account
      const hasPassword = user.providerData.some((p) => p.providerId === 'password');
      if (!hasPassword) {
        // Prompt user to set a password so they can login with email & password later!
        setGoogleUserForPassword(user);
        setGoogleStepActive(true);
      } else {
        onClose();
        if (isRegisterMode && onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google ile giriş yapılırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGooglePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUserForPassword) return;

    if (googleNewPassword.length < 6) {
      setGooglePasswordError('Parola en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }
    if (googleNewPassword !== googleConfirmPassword) {
      setGooglePasswordError('Girdiğiniz parolalar birbiriyle eşleşmiyor.');
      return;
    }

    try {
      setLoading(true);
      setGooglePasswordError(null);
      soundEngine.playClick();

      // Properly link Email/Password provider credential to the Google account
      const cred = EmailAuthProvider.credential(googleUserForPassword.email!, googleNewPassword);
      try {
        await linkWithCredential(googleUserForPassword, cred);
      } catch (linkErr: any) {
        if (
          linkErr.code === 'auth/provider-already-linked' ||
          linkErr.code === 'auth/credential-already-in-use' ||
          linkErr.code === 'auth/email-already-in-use'
        ) {
          await updatePassword(googleUserForPassword, googleNewPassword);
        } else {
          // Fallback to direct password update
          await updatePassword(googleUserForPassword, googleNewPassword);
        }
      }

      // Save flag in Firestore
      try {
        const userRef = doc(db, 'users', googleUserForPassword.uid);
        await safeSetDoc(
          userRef,
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
      setGoogleStepActive(false);
      setGoogleUserForPassword(null);
      onClose();

      if (isRegisterMode && onRegistrationSuccess) {
        onRegistrationSuccess();
      }
    } catch (err: any) {
      console.error('Save Google password error', err);
      if (err.code === 'auth/weak-password') {
        setGooglePasswordError('Belirlediğiniz parola çok zayıf. Lütfen daha güçlü bir parola seçin.');
      } else {
        setGooglePasswordError(err.message || 'Parola kaydedilirken bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkipGooglePassword = () => {
    soundEngine.playClick();
    setGoogleStepActive(false);
    setGoogleUserForPassword(null);
    onClose();
    if (isRegisterMode && onRegistrationSuccess) {
      onRegistrationSuccess();
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      soundEngine.playClick();

      if (isRegisterMode) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        const userRef = doc(db, 'users', user.uid);
        try {
          await safeSetDoc(
            userRef,
            {
              userId: user.uid,
              email: user.email || '',
              displayName: displayName.trim() || email.split('@')[0],
              hasPassword: true,
              dailyGoalHours: 6,
              streakDays: 1,
              totalFocusMinutes: 0,
              targetExam: 'YKS 2026',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg =
          'Hatalı e-posta veya şifre girdiniz. Daha önce Google ile kayıt olduysanız lütfen "Google ile Giriş Yap" butonunu kullanın.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Bu e-posta adresi ile zaten bir hesap var.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Şifre en az 6 karakter olmalıdır.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-white">
              {googleStepActive
                ? 'Parola Belirle'
                : currentUser
                ? 'Hesap Bilgileri'
                : isRegisterMode
                ? 'Fokus Hesabı Oluştur'
                : "Fokus'a Giriş Yap"}
            </h3>
            <p className="text-xs text-neutral-400">
              {googleStepActive
                ? 'E-posta ve parola ile giriş yapabilmek için şifre oluşturun'
                : currentUser
                ? 'Firestore senkronizasyonu aktif'
                : 'YPT istatistiklerini ve verilerini bulutta sakla'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {googleStepActive && googleUserForPassword ? (
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-[#ff5500]/10 border border-[#ff5500]/30 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#ff5500]/20 text-[#ff5500] shrink-0 mt-0.5">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  E-posta Girişi İçin Parola Belirleyin
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h4>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  Google hesabınızla başarıyla bağlandınız! İleride Google olmadan sadece{' '}
                  <span className="font-semibold text-white">{googleUserForPassword.email}</span> e-postanız ve
                  şifrenizle giriş yapabilmek için şimdi bir parola belirleyin.
                </p>
              </div>
            </div>

            {googlePasswordError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{googlePasswordError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGooglePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  Yeni Parola (en az 6 karakter)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showGooglePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="En az 6 karakter"
                    value={googleNewPassword}
                    onChange={(e) => setGoogleNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGooglePassword(!showGooglePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  Parolayı Doğrula
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showGooglePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Parolanızı tekrar yazın"
                    value={googleConfirmPassword}
                    onChange={(e) => setGoogleConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors shadow-lg shadow-[#ff5500]/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Kaydediliyor...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Parolayı Oluştur ve Hesaba Bağla</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkipGooglePassword}
                  className="w-full py-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 text-xs transition-colors cursor-pointer text-center"
                >
                  Şimdilik Atla (Daha Sonra Ayarlardan Belirle)
                </button>
              </div>
            </form>
          </div>
        ) : currentUser ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
              <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-lg font-bold text-white">
                {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {currentUser.displayName || 'Öğrenci'}
                </p>
                <p className="text-xs text-neutral-400 truncate">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Firestore Bağlantısı Aktif 🟢
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors cursor-pointer"
            >
              Oturumu Kapat
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google Fast Sign In */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Google ile Hızlı Giriş Yap</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-neutral-800" />
              <span className="text-[11px] text-neutral-500 uppercase">veya e-posta</span>
              <div className="h-[1px] flex-1 bg-neutral-800" />
            </div>

            {/* Email form */}
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
                      placeholder="Kenan Erdem"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@ogrenci.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    required
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-xs transition-colors shadow-lg shadow-[#ff5500]/25 cursor-pointer flex items-center justify-center gap-2"
              >
                {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{isRegisterMode ? 'Kayıt Ol & Başla' : 'Giriş Yap'}</span>
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorMsg(null);
                }}
                className="text-xs text-neutral-400 hover:text-white underline transition-colors cursor-pointer"
              >
                {isRegisterMode ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Hemen kayıt olun'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
