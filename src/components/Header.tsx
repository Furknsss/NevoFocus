import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  BarChart3,
  Users,
  Volume2,
  VolumeX,
  ListTodo,
  LogIn,
  User as UserIcon,
  Settings,
  ShoppingBag,
  LogOut,
  ChevronDown,
  GraduationCap,
  Trophy,
  DoorOpen,
  Smartphone,
  Tablet,
  Monitor,
  Mountain,
  Download,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  currentTab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students';
  onSelectTab: (tab: 'focus' | 'tasks' | 'stats' | 'rooms' | 'students') => void;
  profile: UserProfile;
  currentUser: any;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenMarket: () => void;
  onOpenAchievements: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  isAudioPlaying: boolean;
  onToggleAudioModal: () => void;
  isMobile?: boolean;
  activeDevice?: 'mobile' | 'tablet' | 'desktop';
  isInstallable?: boolean;
  onInstallPWA?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  profile,
  currentUser,
  onOpenProfile,
  onOpenSettings,
  onOpenMarket,
  onOpenAchievements,
  onOpenAuth,
  onSignOut,
  isAudioPlaying,
  onToggleAudioModal,
  isMobile = false,
  activeDevice = 'desktop',
  isInstallable = false,
  onInstallPWA,
}) => {
  const [activeTabOptimistic, setActiveTabOptimistic] = useState(currentTab);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTabOptimistic(currentTab);
  }, [currentTab]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'focus', label: 'Odaklan', icon: Clock },
    { id: 'tasks', label: 'Görevler', icon: ListTodo },
    { id: 'stats', label: 'İstatistikler', icon: BarChart3 },
    { id: 'rooms', label: 'Odalar', icon: DoorOpen },
    { id: 'students', label: 'Öğrenciler', icon: Users },
  ] as const;

  const rawDisplayName = profile.name && profile.name.trim() !== '' ? profile.name : (currentUser?.displayName || 'Öğrenci');
  const firstName = rawDisplayName.trim().split(' ')[0] || rawDisplayName;
  const isUserLoggedIn = Boolean(
    currentUser ||
    profile.userId ||
    (typeof window !== 'undefined' && (
      localStorage.getItem('fokus_user_authenticated') === 'true' ||
      localStorage.getItem('fokus_user_uid')
    ))
  );
  const effectiveAvatar = profile.avatarUrl || currentUser?.photoURL || '';
  const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('fokus_user_email') || '' : '';
  const displayEmail = currentUser?.email || profile.email || storedEmail || (isUserLoggedIn ? 'Kayıtlı Öğrenci' : 'Giriş yapılmadı');

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-black/60 border-b border-neutral-800/80 px-4 sm:px-6 py-3 flex items-center justify-between transition-colors">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setActiveTabOptimistic('focus');
            onSelectTab('focus');
          }}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff5500] to-[#ff7722] flex items-center justify-center shadow-lg shadow-[#ff5500]/25 group-hover:scale-105 transition-transform">
            <span className="text-white font-black text-sm tracking-wider">F</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-white tracking-tight group-hover:text-neutral-200 transition-colors">
                FOKUS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#ff5500]/15 text-[#ff5500] border border-[#ff5500]/30 hidden sm:inline">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-medium hidden md:block leading-none">
              Derin Odaklanma Alanı
            </p>
          </div>
        </button>
      </div>

      {/* Center Navigation Tabs - Hidden on mobile if bottom nav is active */}
      {!isMobile && (
        <nav className="flex items-center gap-0.5 sm:gap-1 bg-neutral-900/80 p-1 rounded-full border border-neutral-800 shadow-inner max-w-full overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTabOptimistic === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTabOptimistic(item.id);
                  onSelectTab(item.id);
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-75 active:scale-95 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff5500]' : 'text-neutral-400'}`} />
                <span className={activeDevice === 'tablet' ? 'inline text-[11px]' : 'hidden md:inline'}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Right Actions: Daily Focus Stopwatch, Sound Modal, PWA & Profile Dropdown */}
      <div className="flex items-center gap-2">
        {/* PWA Uygulama Olarak Yükle Butonu (Install button for Chrome/Edge/PWA) */}
        {isInstallable && onInstallPWA && (
          <button
            type="button"
            onClick={onInstallPWA}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff5500]/15 hover:bg-[#ff5500]/25 border border-[#ff5500]/40 text-xs font-bold text-white transition-all shadow-md cursor-pointer animate-in fade-in"
            title="Fokus'u Masaüstü/Mobil Uygulama Olarak Yükle"
          >
            <Download className="w-3.5 h-3.5 text-[#ff5500]" />
            <span>Uygulamayı Yükle</span>
          </button>
        )}

        {/* Daily Focus Counter (Sağ üstte sesin solunda - yeşil nokta kaldırıldı) */}
        <div
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs shadow-inner shrink-0"
          title="Bugün tamamlanan toplam odaklanma süresi"
        >
          <Clock className="w-3.5 h-3.5 text-[#ff5500]" />
          <span className="text-neutral-400 hidden sm:inline text-[11px] font-medium">Bugün:</span>
          <span className="font-mono font-bold text-white text-xs sm:text-sm">
            {(profile.todayTotalMinutes || 0) >= 60
              ? `${Math.floor((profile.todayTotalMinutes || 0) / 60)} sa ${(profile.todayTotalMinutes || 0) % 60} dk`
              : `${profile.todayTotalMinutes || 0} dk`}
          </span>
        </div>

        {/* Ambient Sound Trigger */}
        <button
          onClick={onToggleAudioModal}
          className={`p-2 rounded-full border transition-all cursor-pointer relative ${
            isAudioPlaying
              ? 'bg-[#ff5500]/20 border-[#ff5500]/60 text-[#ff5500]'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
          title={isAudioPlaying ? 'Arka plan sesi çalıyor' : 'Ortam sesleri'}
        >
          {isAudioPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          {isAudioPlaying && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5500] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff5500]"></span>
            </span>
          )}
        </button>

        {/* Profile Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer group"
          >
            {effectiveAvatar ? (
              <img
                src={effectiveAvatar}
                alt={firstName}
                className="w-7 h-7 rounded-full object-cover border border-[#ff5500]"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: profile.avatarColor || '#ff5500' }}
              >
                {firstName.charAt(0).toUpperCase() || 'Ö'}
              </div>
            )}
            {/* Student First Name beside PP */}
            <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white truncate max-w-[90px] sm:max-w-[130px]">
              {firstName}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          {/* DROPDOWN MENU */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-neutral-800 bg-[#12141a] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Dropdown Header: Name & Email & Target Uni */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 mb-2">
                <div className="flex items-center gap-3">
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt={firstName}
                      className="w-10 h-10 rounded-xl object-cover border border-[#ff5500] shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md"
                      style={{ backgroundColor: profile.avatarColor || '#ff5500' }}
                    >
                      {firstName.charAt(0).toUpperCase() || 'Ö'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate leading-tight">
                      {firstName}
                    </p>
                    {/* E-POSTA ADRESİ */}
                    <p className="text-xs text-neutral-400 truncate font-mono mt-0.5" title={displayEmail}>
                      {displayEmail}
                    </p>
                  </div>
                </div>

                {profile.targetUniversity && (
                  <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center gap-1.5 text-[11px] text-[#ff5500]">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{profile.targetUniversity}</span>
                  </div>
                )}
              </div>

              {/* Menu Actions */}
              <div className="space-y-1">
                {/* 1. Profil */}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <UserIcon className="w-4 h-4 text-sky-400" />
                  <div className="flex-1">
                    <span className="block font-bold">Profil</span>
                    <span className="text-[10px] text-neutral-500">Hedefler ve kişisel bilgiler</span>
                  </div>
                </button>

                {/* 2. Başarılar (Achievements) */}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenAchievements();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <span className="block font-bold">Başarılar & Rozetler</span>
                    <span className="text-[10px] text-neutral-500">Kazanılan unvanlar ve seri kupaları</span>
                  </div>
                </button>

                {/* 3. Ayarlar */}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <span className="block font-bold">Ayarlar</span>
                    <span className="text-[10px] text-neutral-500">Bildirim, tema ve hesap güvenliği</span>
                  </div>
                </button>

                {/* 4. Market */}
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenMarket();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <ShoppingBag className="w-4 h-4 text-[#ff5500]" />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <span className="block font-bold">Market</span>
                      <span className="text-[10px] text-neutral-500">Özel avatarlar ve temalar</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Yakında
                    </span>
                  </div>
                </button>

                {/* 6. PWA Uygulamayı Cihaza Yükle */}
                {isInstallable && onInstallPWA && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onInstallPWA();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#ff5500]/20 to-amber-500/20 hover:from-[#ff5500]/30 hover:to-amber-500/30 border border-[#ff5500]/40 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-4 h-4 text-[#ff5500]" />
                    <div className="flex-1">
                      <span className="block font-bold">Uygulama Olarak Yükle</span>
                      <span className="text-[10px] text-neutral-300">Chrome / Masaüstü / Mobil tam ekran deneyimi</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Device Mode Status Bar */}
              <div className="pt-2 mt-1 border-t border-neutral-800/60 px-3 py-1.5 flex items-center justify-between text-[11px] text-neutral-400 bg-neutral-900/40 rounded-xl">
                <span className="flex items-center gap-1.5 font-medium">
                  {activeDevice === 'mobile' ? (
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  ) : activeDevice === 'tablet' ? (
                    <Tablet className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Monitor className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  <span>
                    Görünüm: <strong className="text-white font-semibold">{activeDevice === 'mobile' ? 'Telefon' : activeDevice === 'tablet' ? 'Tablet' : 'PC (Masaüstü)'}</strong>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSettings();
                  }}
                  className="text-[#ff5500] hover:text-[#ff7722] hover:underline cursor-pointer font-bold text-[10px]"
                >
                  Değiştir
                </button>
              </div>

              {/* Divider & Auth */}
              <div className="my-1.5 border-t border-neutral-800" />

              {isUserLoggedIn ? (
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Çıkış Yap</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm text-left"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Giriş Yap / Kayıt Ol</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
