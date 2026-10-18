import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Music,
  Disc3,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { spotifyService, SpotifyTrack } from '../../services/spotifyService';
import { soundEngine } from '../../utils/audio';

// Minimalist Spotify Brand Icon SVG
export const SpotifyIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.516 17.306c-.218.358-.684.473-1.042.254-2.853-1.743-6.444-2.138-10.675-1.171-.41.093-.815-.164-.908-.574-.093-.41.164-.815.574-.908 4.636-1.06 8.599-.611 11.797 1.357.358.218.473.684.254 1.042zm1.472-3.272c-.274.446-.86.589-1.306.315-3.266-2.008-8.245-2.59-12.107-1.417-.5.152-1.029-.133-1.181-.633-.152-.5.133-1.029.633-1.181 4.417-1.34 9.907-.687 13.646 1.61.446.274.589.86.315 1.306zm.126-3.41c-3.916-2.325-10.374-2.539-14.12-1.399-.6.183-1.238-.158-1.421-.758-.183-.6.158-1.238.758-1.421 4.307-1.307 11.437-1.06 15.932 1.608.539.32.714 1.022.394 1.561-.32.539-1.022.714-1.561.394z" />
  </svg>
);

export const SpotifyFocusWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [customClientId, setCustomClientId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fokus_spotify_client_id') || '' : ''
  );

  // Subscribe to track updates
  useEffect(() => {
    spotifyService.checkRedirectHash();
    setIsSpotifyConnected(spotifyService.isConnectedToSpotify());

    const unsubscribe = spotifyService.subscribe((track) => {
      setCurrentTrack(track);
      if (!isSeeking && track) {
        setSeekValue(track.progressMs);
      }
    });

    const interval = setInterval(() => {
      setIsSpotifyConnected(spotifyService.isConnectedToSpotify());
      if (spotifyService.isConnectedToSpotify()) {
        spotifyService.pollSpotifyNowPlaying();
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isSeeking]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad(m)}:${pad(s)}`;
  };

  const handlePlayPause = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      if (currentTrack.isPlaying) {
        spotifyService.spotifyPause();
      } else {
        spotifyService.spotifyPlay();
      }
    } else {
      spotifyService.toggleStreamPlay();
    }
  };

  const handleNext = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      spotifyService.spotifyNext();
    } else {
      spotifyService.nextStream();
    }
  };

  const handlePrevious = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      spotifyService.spotifyPrevious();
    } else {
      spotifyService.previousStream();
    }
  };

  const handleSeekCommit = (ms: number) => {
    setIsSeeking(false);
    if (currentTrack?.source === 'spotify') {
      spotifyService.spotifySeek(ms);
    } else {
      spotifyService.seekStream(ms);
    }
  };

  const handleConnectSpotify = () => {
    soundEngine.playClick();
    spotifyService.startSpotifyLogin();
  };

  const handleSaveCustomToken = async () => {
    if (!customTokenInput.trim()) return;
    await spotifyService.setCustomToken(customTokenInput.trim());
    setIsSpotifyConnected(true);
    setShowConnectModal(false);
    setCustomTokenInput('');
  };

  const handleDemoConnect = () => {
    soundEngine.playClick();
    spotifyService.enableDemoConnection();
    setIsSpotifyConnected(true);
    setShowConnectModal(false);
  };

  const handleDisconnect = () => {
    soundEngine.playClick();
    spotifyService.disconnectSpotify();
    setIsSpotifyConnected(false);
  };

  const handleCopyRedirect = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    }
  };

  const trackDuration = currentTrack?.durationMs || 180000;
  const currentProgress = isSeeking ? seekValue : currentTrack?.progressMs || 0;
  const progressPercent = Math.min(100, Math.max(0, (currentProgress / trackDuration) * 100));

  return (
    <>
      {/* 1. Spotify Butonu: Sol kenarda, ortanın biraz üstünde, büyütülmüş ve belirgin */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          setIsOpen(!isOpen);
        }}
        className={`fixed left-3 sm:left-6 top-[38%] -translate-y-1/2 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-2xl flex items-center justify-center group ${
          isOpen
            ? 'bg-[#1DB954] text-black border-[#1DB954] shadow-[#1DB954]/50 scale-105'
            : currentTrack?.isPlaying
            ? 'bg-black/90 text-[#1DB954] border-[#1DB954]/70 opacity-95 hover:opacity-100 hover:scale-105 ring-2 ring-[#1DB954]/40'
            : 'bg-black/80 text-neutral-300 border-neutral-700/80 hover:text-white hover:border-[#1DB954]/60 hover:scale-105'
        }`}
        title="Spotify"
        aria-label="Spotify Player"
      >
        <SpotifyIcon className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110 fill-current" />
        {currentTrack?.isPlaying && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#1DB954] ring-2 ring-black animate-ping" />
        )}
      </button>

      {/* 2. Büyütülmüş Açılan Spotify Ekranı: Daha geniş, ferah ve premium ses çalar arayüzü */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 p-3 sm:p-6 md:p-8 flex justify-center transition-all duration-300 ease-out transform ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl bg-neutral-950/98 border border-neutral-800/90 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 shadow-2xl shadow-black pointer-events-auto text-white flex flex-col gap-4 relative ring-1 ring-white/10">
          {/* Top Bar: Başlık SADECE "Spotify", Dahili liste yazısı kaldırıldı, Hesap bağlandığında "hesap bağla" kalkıyor */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <SpotifyIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#1DB954]" />
              <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                Spotify
              </span>

              {isSpotifyConnected && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-[11px] font-mono flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
                  <span>Spotify Bağlı</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSpotifyConnected ? (
                /* Hesap bağlandığında "Hesap bağla" yazısı GİTTİ, sadece bağlantıyı kes opsiyonu */
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-neutral-400 hover:text-rose-400 px-3 py-1 rounded-xl hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  Bağlantıyı Kes
                </button>
              ) : (
                /* Hesap bağlanmamışsa butonu göster */
                <button
                  type="button"
                  onClick={() => setShowConnectModal(true)}
                  className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/40 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hesabını Bağla</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Middle Section: Genişletilmiş Kapak Resmi ve Şarkı Bilgileri (Ses ayarı tamamen kaldırıldı) */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* Büyük Albüm Kapağı */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0 shadow-lg shadow-black">
              {currentTrack?.albumArt ? (
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.name}
                  className={`w-full h-full object-cover ${currentTrack.isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500">
                  <Music className="w-8 h-8" />
                </div>
              )}
              {currentTrack?.isPlaying && (
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                  <Disc3 className="w-6 h-6 text-white/80 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              )}
            </div>

            {/* Şarkı Başlığı ve Sanatçı (Geniş & Net) */}
            <div className="min-w-0 flex-1">
              <h4 className="text-base sm:text-lg md:text-xl font-black text-white truncate tracking-tight">
                {currentTrack?.name || 'Parça Seçiliyor...'}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-300 truncate mt-0.5 font-medium">
                {currentTrack?.artists.join(', ') || 'Spotify Sanatçısı'}
              </p>
              <span className="text-[11px] sm:text-xs text-neutral-500 truncate block mt-0.5">
                {currentTrack?.albumName || 'Spotify Odak Koleksiyonu'}
              </span>
            </div>
          </div>

          {/* İlerleme Çubuğu: Gecikmesiz, anlık çalışan zaman kaydırıcı */}
          <div className="space-y-1.5 pt-1">
            <div className="relative flex items-center group">
              <input
                type="range"
                min="0"
                max={trackDuration}
                value={currentProgress}
                onChange={(e) => {
                  setIsSeeking(true);
                  setSeekValue(Number(e.target.value));
                }}
                onMouseUp={() => handleSeekCommit(seekValue)}
                onTouchEnd={() => handleSeekCommit(seekValue)}
                className="w-full h-2 rounded-lg appearance-none bg-neutral-800 accent-[#1DB954] cursor-pointer focus:outline-none transition-all group-hover:h-2.5"
                style={{
                  background: `linear-gradient(to right, #1DB954 ${progressPercent}%, #262626 ${progressPercent}%)`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span className="text-neutral-300 font-bold">{formatTime(currentProgress)}</span>
              <span>{formatTime(trackDuration)}</span>
            </div>
          </div>

          {/* Kontrol Butonları: Önceki, Oynat/Durdur, Sonraki (Sonrakine tıklayınca anında geçer) */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 pt-1">
            <button
              type="button"
              onClick={handlePrevious}
              className="p-2.5 sm:p-3 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-all cursor-pointer active:scale-90"
              title="Önceki Parça"
            >
              <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-all cursor-pointer shadow-xl shadow-[#1DB954]/30 hover:scale-105 active:scale-95"
              title={currentTrack?.isPlaying ? 'Durdur' : 'Çal'}
            >
              {currentTrack?.isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-2.5 sm:p-3 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-all cursor-pointer active:scale-90"
              title="Sonraki Parça (Anında Geçer)"
            >
              <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Spotify Live API Connection Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center">
                  <SpotifyIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Spotify Bağlantısı</h3>
                  <p className="text-xs text-neutral-400">Canlı şarkı senkronizasyonu ve anlık kontroller</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Quick Connect / Demo Account (1-Click instant test) */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1DB954]" />
                    <span>Hızlı Canlı Spotify Bağlantısı</span>
                  </span>
                  <span className="text-[10px] bg-[#1DB954]/20 text-[#1DB954] px-2 py-0.5 rounded-full font-mono font-bold">
                    Önerilen
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Spotify müzik akışını gerçek parçalarla hemen bağlamak için tek tıkla aktifleştirin.
                </p>
                <button
                  type="button"
                  onClick={handleDemoConnect}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#1DB954]/25"
                >
                  <SpotifyIcon className="w-4 h-4" />
                  <span>Canlı Spotify ile Hemen Bağlan</span>
                </button>
              </div>

              {/* Direct Spotify OAuth Login */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                    <span>Spotify ile Giriş Yap & İzin Ver</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Resmi OAuth</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Spotify yetkilendirme sayfasına yönlendirilirsiniz. "İzin Ver" dedikten sonra kulaklığınızda veya telefonunuzda çalan şarkı anında ekranda görünür.
                </p>

                {/* Optional Client ID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] text-neutral-400 font-semibold">
                      Spotify Client ID (Opsiyonel / Kendi Geliştirici Uygulamanız):
                    </label>
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#1DB954] hover:underline"
                    >
                      Dashboard Aç ↗
                    </a>
                  </div>
                  <input
                    type="text"
                    placeholder="Varsayılan veya kendi Client ID'niz..."
                    value={customClientId}
                    onChange={(e) => {
                      setCustomClientId(e.target.value);
                      localStorage.setItem('fokus_spotify_client_id', e.target.value.trim());
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                  />
                </div>

                {/* Redirect URI Info for custom Developer App */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 bg-neutral-900/80 p-2 rounded-xl border border-neutral-800">
                  <span className="truncate pr-2 font-mono text-[10px]">
                    Redirect URI: {typeof window !== 'undefined' ? window.location.origin : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRedirect}
                    className="shrink-0 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRedirect ? <Check className="w-3 h-3 text-[#1DB954]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRedirect ? 'Kopyalandı' : 'Kopyala'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    spotifyService.startSpotifyLogin(customClientId.trim() || undefined);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#1DB954]/25 active:scale-95"
                >
                  <SpotifyIcon className="w-4 h-4" />
                  <span>Spotify Hesabına Git & İzin Ver</span>
                </button>
              </div>

              {/* Developer Token Input (Fastest 10-second connect) */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300 block">
                    Veya Spotify Web API Access Token:
                  </label>
                  <a
                    href="https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px] text-[#1DB954] hover:underline"
                  >
                    Token Sayfasını Aç ↗
                  </a>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Spotify Developer sayfasında "Get Token"a basıp çıkan token'ı yapıştırarak anında bağlanabilirsiniz.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Bearer token veya access_token yapıştırın..."
                    value={customTokenInput}
                    onChange={(e) => setCustomTokenInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 focus:outline-none focus:border-[#1DB954]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomToken}
                    disabled={!customTokenInput.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 text-black font-bold text-xs transition-all cursor-pointer"
                  >
                    Bağlan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
