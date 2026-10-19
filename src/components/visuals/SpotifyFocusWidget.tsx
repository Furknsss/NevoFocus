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
  ExternalLink,
  Key,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { spotifyService, SpotifyTrack, getAppRedirectUri } from '../../services/spotifyService';
import { soundEngine } from '../../utils/audio';

const SpotifyIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.517 17.307c-.217.355-.678.468-1.033.251-2.827-1.728-6.386-2.119-10.578-1.162-.403.092-.806-.157-.898-.56-.093-.404.156-.807.56-.899 4.587-1.047 8.528-.598 11.698 1.337.355.217.468.678.251 1.033zm1.472-3.272c-.273.444-.856.587-1.3.314-3.236-1.99-8.169-2.565-11.997-1.401-.497.151-1.026-.134-1.177-.631-.151-.497.134-1.026.631-1.177 4.38-1.331 9.815-.688 13.53 1.595.444.273.587.856.314 1.3zm.127-3.408C15.244 8.324 8.877 8.113 5.168 9.24c-.604.183-1.246-.167-1.429-.771-.183-.604.167-1.246.771-1.429 4.265-1.295 11.302-1.054 15.74 1.581.543.322.722 1.026.4 1.569-.322.543-1.026.722-1.569.4z" />
  </svg>
);

export const SpotifyFocusWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectTab, setConnectTab] = useState<'token' | 'oauth'>('token');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Direct Token Form state
  const [directTokenInput, setDirectTokenInput] = useState('');
  const [isTokenValidating, setIsTokenValidating] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // OAuth Form state
  const [customClientId, setCustomClientId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fokus_spotify_client_id') || '' : ''
  );
  const [clientIdError, setClientIdError] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isManualExchanging, setIsManualExchanging] = useState(false);
  const [manualError, setManualError] = useState('');

  const appRedirectUrl = typeof window !== 'undefined' ? getAppRedirectUri() : '';

  // Direct Token validation handler
  const handleDirectTokenSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    soundEngine.playClick();
    if (!directTokenInput.trim()) {
      setTokenError('Lütfen Spotify Access Token değerini yapıştırın.');
      return;
    }
    setTokenError('');
    setIsTokenValidating(true);
    const result = await spotifyService.setDirectAccessToken(directTokenInput.trim());
    setIsTokenValidating(false);

    if (result.success) {
      setIsSpotifyConnected(true);
      setShowConnectModal(false);
      setDirectTokenInput('');
    } else {
      setTokenError(result.error || 'Token doğrulanamadı. Lütfen geçerli bir token girdiğinizden emin olun.');
    }
  };

  // Manual OAuth code or URL exchange
  const handleManualCodeSubmit = async () => {
    soundEngine.playClick();
    if (!manualCodeInput.trim()) {
      setManualError('Lütfen adres çubuğundaki linki veya code değerini yapıştırın.');
      return;
    }
    setManualError('');
    setIsManualExchanging(true);
    const res = await spotifyService.exchangeCodeOrUrl(manualCodeInput.trim());
    setIsManualExchanging(false);
    if (res.success) {
      setIsSpotifyConnected(true);
      setShowConnectModal(false);
      setManualCodeInput('');
    } else {
      setManualError(res.error || 'Kod doğrulanamadı. Lütfen tekrar deneyin.');
    }
  };

  // High-frequency sync ref for zero-latency progress interpolation
  const lastSyncRef = useRef<{
    baseProgressMs: number;
    timestamp: number;
    isPlaying: boolean;
  }>({
    baseProgressMs: 0,
    timestamp: Date.now(),
    isPlaying: false,
  });

  // Subscribe to track updates & check OAuth redirect code
  useEffect(() => {
    spotifyService.checkRedirectCode().then((connected) => {
      if (connected) {
        setIsSpotifyConnected(true);
        setShowConnectModal(false);
      }
    });

    setIsSpotifyConnected(spotifyService.isConnectedToSpotify());

    const unsubscribe = spotifyService.subscribe((track) => {
      setCurrentTrack(track);
      if (!isSeeking && track) {
        lastSyncRef.current = {
          baseProgressMs: track.progressMs,
          timestamp: Date.now(),
          isPlaying: track.isPlaying,
        };
        setSeekValue(track.progressMs);
      }
    });

    // 1200ms background polling when connected
    const interval = setInterval(() => {
      const connected = spotifyService.isConnectedToSpotify();
      setIsSpotifyConnected(connected);
      if (connected) {
        spotifyService.pollSpotifyNowPlaying();
      }
    }, 1200);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isSeeking]);

  // High-frequency smooth tick for progress bar (runs every 100ms for 0 latency / 0 jitter)
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSeeking) return;
      if (!currentTrack || !currentTrack.isPlaying) return;

      const sync = lastSyncRef.current;
      const elapsed = Date.now() - sync.timestamp;
      const nextProgress = Math.min(
        currentTrack.durationMs || 180000,
        sync.baseProgressMs + elapsed
      );
      setSeekValue(nextProgress);
    }, 100);

    return () => clearInterval(timer);
  }, [isSeeking, currentTrack]);

  // Automatically close connect modal if Spotify is connected
  useEffect(() => {
    if (isSpotifyConnected && showConnectModal) {
      setShowConnectModal(false);
    }
  }, [isSpotifyConnected, showConnectModal]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad(m)}:${pad(s)}`;
  };

  // Zero-latency instant Play/Pause
  const handlePlayPause = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      const willPlay = !currentTrack.isPlaying;
      // 0ms instant optimistic UI
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: willPlay } : null));
      lastSyncRef.current = {
        baseProgressMs: seekValue,
        timestamp: Date.now(),
        isPlaying: willPlay,
      };

      if (willPlay) {
        spotifyService.spotifyPlay();
      } else {
        spotifyService.spotifyPause();
      }
    } else {
      spotifyService.toggleStreamPlay();
    }
  };

  // Zero-latency instant Next Track
  const handleNext = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      setSeekValue(0);
      lastSyncRef.current = {
        baseProgressMs: 0,
        timestamp: Date.now(),
        isPlaying: true,
      };
      spotifyService.spotifyNext();
    } else {
      spotifyService.nextStream();
    }
  };

  // Zero-latency instant Previous Track
  const handlePrevious = () => {
    soundEngine.playClick();
    if (currentTrack?.source === 'spotify') {
      setSeekValue(0);
      lastSyncRef.current = {
        baseProgressMs: 0,
        timestamp: Date.now(),
        isPlaying: true,
      };
      spotifyService.spotifyPrevious();
    } else {
      spotifyService.previousStream();
    }
  };

  // Instant Seek commit
  const handleSeekCommit = (ms: number) => {
    setIsSeeking(false);
    setSeekValue(ms);
    lastSyncRef.current = {
      baseProgressMs: ms,
      timestamp: Date.now(),
      isPlaying: currentTrack?.isPlaying ?? true,
    };
    if (currentTrack?.source === 'spotify') {
      spotifyService.spotifySeek(ms);
    } else {
      spotifyService.seekStream(ms);
    }
  };

  const handleConnectSpotifyOAuth = async () => {
    soundEngine.playClick();
    const cid = customClientId.trim();
    if (!cid) {
      setClientIdError(true);
      return;
    }
    setClientIdError(false);
    await spotifyService.startSpotifyLogin(cid, appRedirectUrl);
  };

  const handleDisconnect = () => {
    soundEngine.playClick();
    spotifyService.disconnectSpotify();
    setIsSpotifyConnected(false);
  };

  const handleCopyRedirect = () => {
    if (typeof window !== 'undefined' && appRedirectUrl) {
      navigator.clipboard.writeText(appRedirectUrl);
      setCopiedRedirect(true);
      setTimeout(() => setCopiedRedirect(false), 2000);
    }
  };

  const trackDuration = currentTrack?.durationMs || 180000;
  const currentProgress = isSeeking ? seekValue : currentTrack?.progressMs || 0;
  const progressPercent = Math.min(100, Math.max(0, (currentProgress / trackDuration) * 100));

  return (
    <>
      {/* 1. Spotify Butonu: Sol kenarda, ortanın biraz üstünde (Çalarken yeşile döner, yanıp sönen nokta kaldırıldı) */}
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
      </button>

      {/* 2. Açılan Spotify Çalar Paneli */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 p-3 sm:p-6 md:p-8 flex justify-center transition-all duration-300 ease-out transform ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl bg-neutral-950/98 border border-neutral-800/90 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 shadow-2xl shadow-black pointer-events-auto text-white flex flex-col gap-4 relative ring-1 ring-white/10">
          {/* Top Bar: Başlık SADECE "Spotify", Hesap bağlandığında durum ve Bağlantıyı Kes butonu */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <SpotifyIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#1DB954]" />
              <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                Spotify
              </span>

              {isSpotifyConnected && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-[11px] font-mono flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse" />
                  <span>{spotifyService.getConnectedUserName() || 'Spotify Bağlı'}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSpotifyConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-neutral-400 hover:text-rose-400 px-3 py-1.5 rounded-xl hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer"
                >
                  Bağlantıyı Kes
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConnectModal(true)}
                  className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/15 hover:bg-[#1ed760] hover:text-black border border-[#1DB954]/40 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Hesabını Bağla</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                title="Paneli Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Music Info & Album Cover */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center relative shadow-lg">
              {currentTrack?.albumArt ? (
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.albumName || currentTrack.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3
                  className={`w-8 h-8 text-neutral-600 ${
                    currentTrack?.isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '4s' }}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-base sm:text-lg font-bold text-white truncate">
                {currentTrack?.name || 'Müzik Başlatılmadı'}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-400 truncate mt-0.5">
                {currentTrack?.artists?.join(', ') || 'Spotify ile çalışma müziğinizi dinleyin'}
              </p>
              {currentTrack?.albumName && (
                <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                  {currentTrack.albumName}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar & Seek Slider */}
          <div className="space-y-1.5">
            <div className="relative w-full h-2 rounded-full bg-neutral-800/80 overflow-hidden cursor-pointer group">
              <div
                className="h-full bg-gradient-to-r from-[#1DB954] to-[#1ed760] transition-all duration-150 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={trackDuration}
                value={currentProgress}
                onChange={(e) => {
                  setIsSeeking(true);
                  setSeekValue(Number(e.target.value));
                }}
                onMouseUp={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>{formatTime(currentProgress)}</span>
              <span>{formatTime(trackDuration)}</span>
            </div>
          </div>

          {/* Controls: Previous, Play/Pause, Next */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 pt-1">
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
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-[#1DB954]/30 hover:scale-105 active:scale-95"
              title={currentTrack?.isPlaying ? 'Durdur' : 'Oynat'}
            >
              {currentTrack?.isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-2.5 sm:p-3 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-all cursor-pointer active:scale-90"
              title="Sonraki Parça"
            >
              <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Spotify Kolay Hesap Bağlama Modalı (Token & PKCE Seçenekli, Garantili ve Hatasız) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center">
                  <SpotifyIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Spotify Hesabını Bağla</h3>
                  <p className="text-xs text-neutral-400">Canlı müzik senkronizasyonu ve anlık kontrol</p>
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

            {/* Tab Selector: Token vs Client ID OAuth */}
            <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-800 mb-4">
              <button
                type="button"
                onClick={() => setConnectTab('token')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  connectTab === 'token'
                    ? 'bg-[#1DB954] text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Hızlı Token ile Bağlan</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectTab('oauth')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  connectTab === 'oauth'
                    ? 'bg-[#1DB954] text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Client ID (PKCE) ile Bağlan</span>
              </button>
            </div>

            {/* TAB 1: DIRECT SPOTIFY TOKEN (EN KOLAY, ANINDA VE KESİN ÇÖZÜM) */}
            {connectTab === 'token' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#1DB954]" />
                      Doğrudan Spotify Token Bağlantısı
                    </span>
                    <a
                      href="https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#1ed760] hover:underline flex items-center gap-1 font-semibold"
                    >
                      Token Al ↗
                    </a>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Spotify Developer Console'dan veya Spotify hesabınızdan aldığınız Access Token'ı (BQ...) yapıştırın. Şarkı anında uygulamada çalmaya başlar!
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-300 block">
                    Spotify Access Token:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Token yapıştırın (BQ... veya Bearer BQ...)"
                      value={directTokenInput}
                      onChange={(e) => {
                        setDirectTokenInput(e.target.value);
                        setTokenError('');
                      }}
                      className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-neutral-950 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                    />
                    <button
                      type="button"
                      onClick={handleDirectTokenSubmit}
                      disabled={isTokenValidating}
                      className="px-5 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-black text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50 active:scale-95 shadow-md shadow-[#1DB954]/20"
                    >
                      {isTokenValidating ? 'Doğrulanıyor...' : 'Doğrula ve Bağla'}
                    </button>
                  </div>
                  {tokenError && (
                    <p className="text-[11px] text-rose-400 font-medium">{tokenError}</p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                  <p className="font-semibold text-neutral-300">💡 Token Nasıl Alınır?</p>
                  <p>1. Yukarıdaki <strong>Token Al ↗</strong> bağlantısına tıklayın.</p>
                  <p>2. "Get Token" butonuna basıp Spotify hesabınıza izin verin.</p>
                  <p>3. Çıkan tokenı buraya yapıştırıp <strong>Doğrula ve Bağla</strong>'ya basın.</p>
                </div>
              </div>
            )}

            {/* TAB 2: CLIENT ID OAUTH PKCE FLOW (RESMİ OAUTH BAĞLANTISI) */}
            {connectTab === 'oauth' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Spotify Client ID:</span>
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#1DB954] hover:underline"
                    >
                      Spotify Dashboard Aç ↗
                    </a>
                  </div>
                  <input
                    type="text"
                    placeholder="Spotify Client ID girin..."
                    value={customClientId}
                    onChange={(e) => {
                      setCustomClientId(e.target.value);
                      setClientIdError(false);
                      localStorage.setItem('fokus_spotify_client_id', e.target.value.trim());
                    }}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-900 border text-white placeholder-neutral-500 focus:outline-none transition-colors ${
                      clientIdError
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-neutral-700 focus:border-[#1DB954]'
                    }`}
                  />
                  {clientIdError && (
                    <p className="text-[11px] text-rose-400">
                      Lütfen Spotify Developer Dashboard'dan aldığınız Client ID'yi girin.
                    </p>
                  )}
                </div>

                {/* Redirect URI Info for Spotify Dashboard */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800">
                  <span className="text-xs font-bold text-neutral-300 block">
                    Spotify Dashboard Redirect URI:
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-neutral-300 bg-neutral-900 p-2.5 rounded-xl border border-neutral-700">
                    <span className="truncate pr-2 font-mono text-[10.5px] text-[#1DB954] font-bold">
                      {appRedirectUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRedirect}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-[#1DB954] hover:text-black text-neutral-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {copiedRedirect ? <Check className="w-3 h-3 text-[#1DB954]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedRedirect ? 'Kopyalandı' : 'Kopyala'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-medium">
                    Spotify Dashboard &gt; Uygulamanız &gt; Settings &gt; Redirect URIs kısmına yukarıdaki adresi yapıştırıp kaydedin.
                  </p>
                </div>

                {/* 1. Oturum Aç Butonu */}
                <button
                  type="button"
                  onClick={handleConnectSpotifyOAuth}
                  className="w-full py-3 px-4 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#1DB954]/25 active:scale-95"
                >
                  <SpotifyIcon className="w-4 h-4 fill-current" />
                  <span>1. Spotify ile Giriş Yap &amp; İzin Ver</span>
                </button>

                {/* 2. Link veya Kod Yapıştırma (Garantili Alternatif) */}
                <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <p className="text-[10.5px] text-neutral-400">
                    İzin verdikten sonra açılan sekmedeki linki veya kodu buraya yapıştırıp doğrudan bağlayabilirsiniz:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Link veya kod (https://... veya code=...)"
                      value={manualCodeInput}
                      onChange={(e) => {
                        setManualCodeInput(e.target.value);
                        setManualError('');
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
                    />
                    <button
                      type="button"
                      onClick={handleManualCodeSubmit}
                      disabled={isManualExchanging}
                      className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-black transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isManualExchanging ? 'Bağlanıyor...' : 'Hemen Bağla'}
                    </button>
                  </div>
                  {manualError && (
                    <p className="text-[11px] text-rose-400 font-medium">{manualError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
