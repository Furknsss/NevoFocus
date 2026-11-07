import React from 'react';
import {
  Plane,
  Mountain,
  Trees,
  Waves,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Flame,
  Calendar,
  Clock,
  Compass,
  Trophy,
  LogIn,
  UserPlus
} from 'lucide-react';
import { soundEngine } from '../utils/audio';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onContinueAsGuest?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  onContinueAsGuest,
}) => {
  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans selection:bg-[#ff5500]/30 selection:text-white">
      {/* 1. TOP NAVBAR (Sağ Üstte Giriş Yap ve Kaydol Butonları) */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-black/60 border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <img src="/icons/nevofocus-premium-192.png" alt="" className="w-9 h-9 rounded-xl bg-white object-contain shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-white tracking-tight">NevoFocus</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#ff5500]/20 text-[#ff5500] border border-[#ff5500]/40">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-medium hidden sm:block leading-none">
              Sinematik Odaklanma & Ders Takip Platformu
            </p>
          </div>
        </div>

        {/* Navigation Links for Desktop */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-300">
          <a href="#evrenler" className="hover:text-white transition-colors">4 Evren</a>
          <a href="#gorevler" className="hover:text-white transition-colors">Alan Müfredatı</a>
          <a href="#odalar" className="hover:text-white transition-colors">Canlı Odalar</a>
          <a href="#istatistikler" className="hover:text-white transition-colors">İstatistikler</a>
        </nav>

        {/* SAĞ ÜSTTE GİRİŞ YAP VE KAYDOL BUTONLARI */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenLogin();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-neutral-200 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 text-neutral-400" />
            <span>Giriş Yap</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenRegister();
            }}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#ff5500] to-[#ff7722] hover:brightness-110 shadow-lg shadow-[#ff5500]/30 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Kaydol</span>
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 px-4 sm:px-6 max-w-6xl mx-auto w-full text-center">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff5500]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-700/80 text-xs font-bold text-[#ff5500] shadow-lg">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>TÜRKİYE'NİN EN GELİŞMİŞ YKS & ODAKLANMA PLATFORMU</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
          Hedeflediğin Derece İçin{' '}
          <span className="bg-gradient-to-r from-[#ff5500] via-[#ff7722] to-amber-400 bg-clip-text text-transparent">
            Sinematik Odaklanma Dünyaları
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed">
          Google Earth 3D küresinde uçuş yap, karlı zirvelere tırman, kadim ağacını büyüt veya derin okyanusa dal.
          Sayısal, Eşit Ağırlık ve Dil alanına özel tam filtrelenmiş görev sistemi ve canlı çalışma odaları.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenRegister();
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff7722] hover:brightness-110 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-[#ff5500]/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Ücretsiz Kaydol & Başla</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenLogin();
            }}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4 text-neutral-400" />
            <span>Hesabına Giriş Yap</span>
          </button>
        </div>

        {onContinueAsGuest && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onContinueAsGuest();
              }}
              className="text-xs sm:text-sm text-neutral-400 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
            >
              Giriş yapmadan hızlıca dene (Misafir Modu) →
            </button>
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-neutral-400 pt-6 border-t border-neutral-800/80">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#ff5500]" />
            <span>Kesintisiz Seri & Alev Takibi</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Şifreli & Açık Canlı Çalışma Odaları</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>Pazartesi-Pazar Gerçek Aylık Takvim</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Sayısal, EA ve Dile Özel Müfredat</span>
          </div>
        </div>
      </section>

      {/* 3. DÖRT SİNEMATİK EVREN VİTRİNİ */}
      <section id="evrenler" className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#ff5500]">
            EŞSİZ MOTİVASYON ORTAMLARI
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-1">
            4 Farklı Evrende Derin Odaklanma
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">
            Her evren kendi benzersiz hikayesi, görsel canlandırması ve ses tasarımıyla ders çalışmayı sürükleyici bir deneyime dönüştürür.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Focus Flight */}
          <div className="p-5 rounded-3xl bg-neutral-900/60 border border-sky-900/40 hover:border-sky-500/60 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-950/80 border border-sky-800/50 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition-transform">
                <Plane className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider block mb-1">
                3D GOOGLE EARTH
              </span>
              <h3 className="text-lg font-bold text-white mb-2">Focus Flight İstasyonu</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                İstanbul, Tokyo, Londra gibi havalimanları arası rotanı belirle, uçak biletini al ve çalışma süren boyunca uçağını 3D kürede uçur.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-neutral-800 text-[11px] font-bold text-sky-400">
              Uçuş Kartı & İrtifa Takibi →
            </div>
          </div>

          {/* 2. Climb Focus */}
          <div className="p-5 rounded-3xl bg-neutral-900/60 border border-orange-900/40 hover:border-orange-500/60 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-950/80 border border-orange-800/50 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition-transform">
                <Mountain className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-wider block mb-1">
                ZİRVE TIRMANIŞI
              </span>
              <h3 className="text-lg font-bold text-white mb-2">Climb Focus Üssü</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kaçkar, Erciyes, Ağrı veya Everest zirvelerine tırman. Mola verdiğinde kamp ateşi yak, seans bittiğinde zirveye zafer bayrağını dik.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-neutral-800 text-[11px] font-bold text-orange-400">
              Kamp Ateşi & Rakım Kaydı →
            </div>
          </div>

          {/* 3. Kadim Orman */}
          <div className="p-5 rounded-3xl bg-neutral-900/60 border border-emerald-900/40 hover:border-emerald-500/60 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <Trees className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                SANAL EKOSİSTEM
              </span>
              <h3 className="text-lg font-bold text-white mb-2">Kadim Orman</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Zümrüt Bonsai veya Sakura tohumunu ek. Çalıştıkça kök salıp yaprak açsın ve tamamladığın her seans kalıcı Sanal Ormanına eklensin.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-neutral-800 text-[11px] font-bold text-emerald-400">
              Tohumdan Ağaca Orman Galerisi →
            </div>
          </div>

          {/* 4. Deep Dive */}
          <div className="p-5 rounded-3xl bg-neutral-900/60 border border-teal-900/40 hover:border-teal-500/60 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-950/80 border border-teal-800/50 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition-transform">
                <Waves className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wider block mb-1">
                OKYANUS MACERASI
              </span>
              <h3 className="text-lg font-bold text-white mb-2">Deep Dive İstasyonu</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Balıkçı teknesinden kaçan balıkla derin sulara atla. 1,000 metre derinlikteki ışıltılı Balık Şehri'ne ulaşarak odaklanma rekorunu kır.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-neutral-800 text-[11px] font-bold text-teal-400">
              Balık Şehri & Basınç Odası →
            </div>
          </div>
        </div>
      </section>

      {/* 4. ÖZELLİKLER & MÜFREDAT BÖLÜMÜ */}
      <section id="gorevler" className="py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full border-t border-neutral-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-1 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#ff5500]">
              ALANINA ÖZEL SİSTEM
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sadece İlgili Olduğun Dersler. Karışıklık Yok.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Kayıt olurken alanını seçtiğinde (Sayısal, Eşit Ağırlık, Sözel veya Dil) sistem sana yalnızca alanınla ilgili dersleri getirir.
              Sayısal öğrencisi YDT veya Edebiyat ile uğraşmaz; Geometri bağımsız bir ders olarak tam takip edilir.
            </p>
            <ul className="space-y-2.5 text-xs font-semibold text-neutral-300 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Geometri ayrı bağımsız ders olarak ayrıldı</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Soru, video, konu, rutin ve deneme tipleri</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Geri sayım veya serbest kronometre seçeneği</span>
              </li>
            </ul>
          </div>

          <div id="odalar" className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="p-3 rounded-2xl bg-[#ff5500]/10 text-[#ff5500] w-fit">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Canlı Çalışma Odaları</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kendi çalışma odanı kur. İster herkese açık ortak masa yap, ister şifreli özel oda oluşturarak sadece arkadaşlarını davet et.
              </p>
            </div>

            <div id="istatistikler" className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 w-fit">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Aylık & Haftalık Çalışma Takvimi</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Pazartesi'den Pazar'a gerçek takvim ızgarası, saatlik ısı haritası, en çok ve en az çalışılan dersler ve mola sürelerinin ayrıntılı analizi.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">1 Saat Alev Moral Sistemi</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kütüphanede çalışan arkadaşlarına moral alevi gönder. 1 saatlik bekleme süresiyle spam engellenir ve disiplin korunur.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Doğru & Senkronize Takip</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Çalışırken aktif yeşil sayaç ile adın, profil resmin ve dersin anında canlı görünür. Siteden çıksan dahi odaların ve verilerin silinmez.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BOTTOM CALL TO ACTION BANNER */}
      <section className="py-16 px-4 sm:px-6 max-w-4xl mx-auto w-full text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff5500]/15 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
            Hedefindeki Derece İçin İlk Seansını Başlat
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto mb-6">
            Ücretsiz hesap oluştur, çalışma alanını seç ve Türkiye'nin en disiplinli YKS odaklanma topluluğuna katıl.
          </p>

          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenRegister();
            }}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff7722] hover:brightness-110 text-white font-black text-base shadow-xl shadow-[#ff5500]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>Hemen Ücretsiz Kaydol</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="mt-auto border-t border-neutral-900 py-6 px-4 text-center text-xs text-neutral-500">
        <p>© 2026 Fokus Pro · Derin Odaklanma & YKS Takip Sistemi. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
};
