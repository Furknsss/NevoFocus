import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  Target,
  Clock,
  User,
  Upload,
  CheckCircle2,
  Check
} from 'lucide-react';
import { UserProfile } from '../types';
import { soundEngine } from '../utils/audio';

interface OnboardingModalProps {
  isOpen: boolean;
  initialProfile: UserProfile;
  userEmail?: string;
  onComplete: (data: Partial<UserProfile>) => void;
}

const POPULAR_UNIVERSITIES = [
  'Boğaziçi Üniversitesi',
  'ODTÜ',
  'İstanbul Teknik Üniversitesi (İTÜ)',
  'Hacettepe Üniversitesi',
  'Koç Üniversitesi',
  'Bilkent Üniversitesi',
  'İstanbul Üniversitesi (Cerrahpaşa)',
  'Yıldız Teknik Üniversitesi',
  'Ankara Üniversitesi',
  'Ege Üniversitesi',
];

const POPULAR_DEPARTMENTS = [
  'Bilgisayar Mühendisliği',
  'Tıp Fakültesi',
  'Hukuk Fakültesi',
  'Diş Hekimliği',
  'Elektrik-Elektronik Müh.',
  'Yazılım Mühendisliği',
  'Makine Mühendisliği',
  'Psikoloji',
  'Endüstri Mühendisliği',
  'İşletme / İktisat',
];

const STUDY_TRACKS = [
  { id: 'Sayısal', label: 'YKS - Sayısal (MF)', desc: 'Matematik, Fizik, Kimya, Biyoloji' },
  { id: 'Eşit Ağırlık', label: 'YKS - Eşit Ağırlık (TM)', desc: 'Matematik, Edebiyat, Coğrafya, Tarih' },
  { id: 'Sözel', label: 'YKS - Sözel (TS)', desc: 'Edebiyat, Tarih, Coğrafya, Felsefe' },
  { id: 'Dil', label: 'YKS - YDT (Yabancı Dil)', desc: 'İngilizce / Yabancı Dil' },
  { id: 'KPSS', label: 'KPSS & Kamu Sınavları', desc: 'Genel Yetenek & Genel Kültür' },
  { id: 'Genel', label: 'Üniversite / Proje / Kod', desc: 'Yazılım, Proje, Kariyer Odaklanması' },
];

const AVATAR_OPTIONS = [
  { emoji: '⚡', label: 'Odak Yıldırımı', bg: '#ff5500' },
  { emoji: '🚀', label: 'Kozmik Kaşif', bg: '#0284c7' },
  { emoji: '🦉', label: 'Gece Bilgesi', bg: '#7c3aed' },
  { emoji: '🌲', label: 'Orman Koruyucusu', bg: '#059669' },
  { emoji: '🌊', label: 'Derin Dalgıç', bg: '#0d9488' },
  { emoji: '🔥', label: 'Ateşli Disiplin', bg: '#ea580c' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialProfile,
  userEmail,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(initialProfile.name === 'Öğrenci' ? '' : initialProfile.name);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || '');
  const [selectedEmoji, setSelectedEmoji] = useState('⚡');
  const [avatarColor, setAvatarColor] = useState(initialProfile.avatarColor || '#ff5500');

  const [targetUniversity, setTargetUniversity] = useState(initialProfile.targetUniversity || '');
  const [targetDepartment, setTargetDepartment] = useState(initialProfile.targetDepartment || '');
  const [studyTrack, setStudyTrack] = useState(initialProfile.studyTrack || 'Sayısal');
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(initialProfile.dailyGoalHours || 6);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Fotoğraf boyutu en fazla 2MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    soundEngine.playClick();
    if (step < 3) {
      setStep((prev) => (prev + 1) as 2 | 3);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    soundEngine.playClick();
    const initials = (name.trim() || 'Ö')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    onComplete({
      name: name.trim() || 'Öğrenci',
      initials,
      avatarUrl,
      avatarColor,
      targetUniversity: targetUniversity.trim() || 'Hedef Üniversite',
      targetDepartment: targetDepartment.trim() || 'Hedef Bölüm',
      studyTrack,
      targetExam: studyTrack.startsWith('YKS') ? studyTrack : `YKS ${studyTrack}`,
      dailyGoalHours,
      hasCompletedOnboarding: true,
      email: userEmail || initialProfile.email,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl border border-neutral-800 bg-[#12141a] p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Subtle glowing ambient backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff5500]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Progress Bar */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-2">
            <span className="flex items-center gap-1.5 text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#ff5500]" />
              <span>Fokus Başlangıç Kurulumu</span>
            </span>
            <span>Adım {step} / 3</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff5500] to-[#ff8800] transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Kişisel Bilgiler & Profil Fotoğrafı */}
        {step === 1 && (
          <div className="relative z-10 space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Hoş Geldin! Seni Tanıyalım 👋
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Kişiselleştirilmiş YPT odak çalışma ortamını oluşturmak için temel bilgilerini gir.
              </p>
            </div>

            {/* Avatar & Photo Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profil"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#ff5500] shadow-lg"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg border-2 border-white/10"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {selectedEmoji}
                  </div>
                )}

                <label
                  htmlFor="onboarding-avatar-file"
                  className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#ff5500] text-white hover:scale-110 transition-transform cursor-pointer shadow-md"
                  title="Fotoğraf Yükle"
                >
                  <Upload className="w-3.5 h-3.5" />
                </label>
                <input
                  id="onboarding-avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex-1 text-center sm:text-left">
                <span className="text-xs font-bold text-neutral-300 block mb-1.5">
                  Profil Resmi veya Avatar
                </span>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.label}
                      type="button"
                      onClick={() => {
                        setSelectedEmoji(av.emoji);
                        setAvatarColor(av.bg);
                        setAvatarUrl('');
                      }}
                      className={`w-8 h-8 rounded-xl text-sm flex items-center justify-center transition-all cursor-pointer ${
                        !avatarUrl && avatarColor === av.bg
                          ? 'scale-110 ring-2 ring-white shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{ backgroundColor: av.bg }}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Ad Soyad
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="örn: Ahmet Yılmaz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="w-full py-3.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-[#ff5500]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Devam Et: Hedeflerini Belirle</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Hedef Üniversite & Bölüm */}
        {step === 2 && (
          <div className="relative z-10 space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Büyük Hedefin Neresi? 🎯
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Kazanmak istediğin üniversite ve hayalindeki bölümü belirle.
              </p>
            </div>

            {/* Target University */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>Hedef Üniversite</span>
                <span className="text-[11px] text-neutral-500">Aşağıdan seç veya yaz</span>
              </label>
              <div className="relative mb-2">
                <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="örn: Boğaziçi Üniversitesi veya ODTÜ"
                  value={targetUniversity}
                  onChange={(e) => setTargetUniversity(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {POPULAR_UNIVERSITIES.slice(0, 6).map((uni) => (
                  <button
                    key={uni}
                    type="button"
                    onClick={() => setTargetUniversity(uni)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      targetUniversity === uni
                        ? 'bg-[#ff5500]/20 border-[#ff5500] text-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {uni}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Department */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5 flex items-center justify-between">
                <span>Hedef Bölüm</span>
                <span className="text-[11px] text-neutral-500">Aşağıdan seç veya yaz</span>
              </label>
              <div className="relative mb-2">
                <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="örn: Bilgisayar Mühendisliği veya Tıp Fakültesi"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {POPULAR_DEPARTMENTS.slice(0, 6).map((dep) => (
                  <button
                    key={dep}
                    type="button"
                    onClick={() => setTargetDepartment(dep)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      targetDepartment === dep
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {dep}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Geri
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-3.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white font-bold text-sm shadow-lg shadow-[#ff5500]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Devam Et: Çalışma Hedefleri</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Alan & Günlük Saat Hedefi */}
        {step === 3 && (
          <div className="relative z-10 space-y-5 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Çalışma Alanın & Günlük Hedefin ⏳
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                YPT tarzı günlük ilerleme çubuğun bu hedefe göre hesaplanacaktır.
              </p>
            </div>

            {/* Study Track Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-2">
                Hazırlık Alanı / Sınav Türü
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STUDY_TRACKS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStudyTrack(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      studyTrack === t.id
                        ? 'border-[#ff5500] bg-[#ff5500]/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{t.label}</p>
                      <p className="text-[10px] text-neutral-400">{t.desc}</p>
                    </div>
                    {studyTrack === t.id && (
                      <Check className="w-4 h-4 text-[#ff5500] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Hours Goal */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#ff5500]" />
                  <span>Günlük Odak Hedefi</span>
                </span>
                <span className="text-[#ff5500] text-sm font-black">{dailyGoalHours} Saat / Gün</span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                {[3, 4, 6, 8, 10].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDailyGoalHours(h)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      dailyGoalHours === h
                        ? 'bg-[#ff5500] border-[#ff5500] text-white shadow-md'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {h} Saat
                  </button>
                ))}
              </div>

              <input
                type="range"
                min="1"
                max="16"
                value={dailyGoalHours}
                onChange={(e) => setDailyGoalHours(parseInt(e.target.value, 10))}
                className="w-full accent-[#ff5500] cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Geri
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-[#ff5500]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kurulumu Tamamla & Fokus'a Başla!</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
