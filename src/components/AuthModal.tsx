import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  LogIn,
  UserPlus
} from 'lucide-react';
import {
  auth,
  googleProvider,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        await setDoc(
          userRef,
          {
            userId: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Öğrenci',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google ile giriş yapılırken hata oluştu.');
    } finally {
      setLoading(false);
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
          await setDoc(userRef, {
            userId: user.uid,
            email: user.email || '',
            displayName: displayName.trim() || email.split('@')[0],
            dailyGoalHours: 6,
            streakDays: 1,
            totalFocusMinutes: 0,
            targetExam: 'YKS 2026',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Hatalı e-posta veya şifre girdiniz.';
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
              {currentUser ? 'Hesap Bilgileri' : isRegisterMode ? 'Fokus Hesabı Oluştur' : 'Fokus\'a Giriş Yap'}
            </h3>
            <p className="text-xs text-neutral-400">
              {currentUser ? 'Firestore senkronizasyonu aktif' : 'YPT istatistiklerini ve verilerini bulutta sakla'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentUser ? (
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
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
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
