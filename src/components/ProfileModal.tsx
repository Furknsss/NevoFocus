import React, { useState } from 'react';
import {
  X,
  User,
  GraduationCap,
  Target,
  Clock,
  Upload,
  Check,
  Mail,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';
import { soundEngine } from '../utils/audio';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  currentUser: any;
  onSaveProfile: (updated: Partial<UserProfile>) => void;
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

const STUDY_TRACKS = [
  'YKS Sayısal',
  'YKS Eşit Ağırlık',
  'YKS Sözel',
  'YKS Dil',
  'KPSS',
  'Genel / Kodlama',
];

const AVATAR_PRESETS = [
  { emoji: '⚡', bg: '#ff5500' },
  { emoji: '🚀', bg: '#0284c7' },
  { emoji: '🦉', bg: '#7c3aed' },
  { emoji: '🌲', bg: '#059669' },
  { emoji: '🌊', bg: '#0d9488' },
  { emoji: '🔥', bg: '#ea580c' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentUser,
  onSaveProfile,
}) => {
  const [name, setName] = useState(profile.name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor || '#ff5500');
  const [targetUniversity, setTargetUniversity] = useState(profile.targetUniversity || '');
  const [targetDepartment, setTargetDepartment] = useState(profile.targetDepartment || '');
  const [targetExam, setTargetExam] = useState(profile.targetExam || 'YKS Sayısal');
  const [dailyGoalHours, setDailyGoalHours] = useState(profile.dailyGoalHours || 6);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();

    const initials = (name.trim() || 'Ö')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    onSaveProfile({
      name: name.trim() || 'Öğrenci',
      initials,
      avatarUrl,
      avatarColor,
      targetUniversity: targetUniversity.trim(),
      targetDepartment: targetDepartment.trim(),
      targetExam,
      studyTrack: targetExam,
      dailyGoalHours,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#12141a] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#ff5500]" />
              <span>Öğrenci Profili & Hedefler</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Kişisel bilgilerini, hedef üniversiteni ve günlük süreni güncelle
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Email Info Bar */}
          <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-2 text-xs text-neutral-300">
            <Mail className="w-4 h-4 text-neutral-500 shrink-0" />
            <span className="text-neutral-400">E-posta:</span>
            <span className="font-mono font-bold text-white truncate">
              {currentUser?.email || profile.email || (typeof window !== 'undefined' ? localStorage.getItem('fokus_user_email') : '') || (profile.userId ? 'Kayıtlı Öğrenci' : 'Giriş Yapılmadı')}
            </span>
          </div>

          {/* Avatar Picture & Upload Section */}
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profil"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-[#ff5500] shadow-lg"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg border border-white/10"
                  style={{ backgroundColor: avatarColor }}
                >
                  {name.charAt(0).toUpperCase() || 'Ö'}
                </div>
              )}

              <label
                htmlFor="profile-avatar-file-upload"
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#ff5500] text-white hover:scale-110 transition-transform cursor-pointer shadow-md"
                title="Fotoğraf Yükle"
              >
                <Upload className="w-3.5 h-3.5" />
              </label>
              <input
                id="profile-avatar-file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="text-xs font-bold text-neutral-300 block mb-1">
                Profil Fotoğrafı Ekle / Değiştir
              </span>
              <p className="text-[11px] text-neutral-400 mb-2">
                Kendi fotoğrafını yükleyebilir veya hazır avatar renklerinden seçebilirsin.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                {AVATAR_PRESETS.map((av) => (
                  <button
                    key={av.bg}
                    type="button"
                    onClick={() => {
                      setAvatarColor(av.bg);
                      setAvatarUrl('');
                    }}
                    className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
                      !avatarUrl && avatarColor === av.bg
                        ? 'ring-2 ring-white scale-110'
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

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Ad Soyad
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn: Ahmet Yılmaz"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-[#ff5500]"
            />
          </div>

          {/* Target University */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1 flex items-center justify-between">
              <span>Hedef Üniversite</span>
              <span className="text-[11px] text-neutral-500">Özgürce düzenlenebilir</span>
            </label>
            <div className="relative mb-1.5">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={targetUniversity}
                onChange={(e) => setTargetUniversity(e.target.value)}
                placeholder="örn: Boğaziçi Üniversitesi veya ODTÜ"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-[#ff5500]"
              />
            </div>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {POPULAR_UNIVERSITIES.slice(0, 5).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setTargetUniversity(u)}
                  className="px-2 py-0.5 rounded text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Target Department */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Hedef Bölüm
            </label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                placeholder="örn: Bilgisayar Mühendisliği veya Tıp"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>

          {/* Target Exam / Track */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Hedef Sınav & Alan
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {STUDY_TRACKS.map((track) => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setTargetExam(track)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                    targetExam === track
                      ? 'bg-[#ff5500]/20 border-[#ff5500] text-white shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {track}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Goal Hours */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#ff5500]" />
                <span>Günlük Hedef Saat</span>
              </span>
              <span className="text-[#ff5500] font-black">{dailyGoalHours} Saat / Gün</span>
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

          {/* Action Buttons */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ff5500] hover:bg-[#ff6600] transition-colors shadow-lg shadow-[#ff5500]/20 cursor-pointer"
            >
              Değişiklikleri Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
