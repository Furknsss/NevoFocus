import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Music,
  Disc3,
} from 'lucide-react';
import {
  spotifyService,
  SpotifyTrack,
  PLATFORM_METADATA,
} from '../../services/spotifyService';
import { MusicPlatform } from '../../types';
import { soundEngine } from '../../utils/audio';

export const SpotifyIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.517 17.307c-.217.355-.678.468-1.033.251-2.827-1.728-6.386-2.119-10.578-1.162-.403.092-.806-.157-.898-.56-.093-.404.156-.807.56-.899 4.587-1.047 8.528-.598 11.698 1.337.355.217.468.678.251 1.033zm1.472-3.272c-.273.444-.856.587-1.3.314-3.236-1.99-8.169-2.565-11.997-1.401-.497.151-1.026-.134-1.177-.631-.151-.497.134-1.026.631-1.177 4.38-1.331 9.815-.688 13.53 1.595.444.273.587.856.314 1.3zm.127-3.408C15.244 8.324 8.877 8.113 5.168 9.24c-.604.183-1.246-.167-1.429-.771-.183-.604.167-1.246.771-1.429 4.265-1.295 11.302-1.054 15.74 1.581.543.322.722 1.026.4 1.569-.322.543-1.026.722-1.569.4z" />
  </svg>
);

export const YouTubeMusicIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
  </svg>
);

export const AppleMusicIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M19.467 1.482a2.38 2.38 0 0 0-1.92-.437l-8.64 1.805A2.405 2.405 0 0 0 7 5.203v10.016a3.73 3.73 0 0 0-1.75-.439C3.179 14.78 1.5 16.32 1.5 18.22s1.679 3.44 3.75 3.44 3.75-1.54 3.75-3.44V8.98l9.5-1.985v6.444a3.73 3.73 0 0 0-1.75-.439c-2.071 0-3.75 1.54-3.75 3.44s1.679 3.44 3.75 3.44 3.75-1.54 3.75-3.44V3.402a2.38 2.38 0 0 0-1.033-1.92z" />
  </svg>
);

export const PlatformIcon: React.FC<{ platform: MusicPlatform; className?: string }> = ({
  platform,
  className = 'w-6 h-6',
}) => {
  if (platform === 'youtube_music') return <YouTubeMusicIcon className={className} />;
  if (platform === 'apple_music') return <AppleMusicIcon className={className} />;
  return <SpotifyIcon className={className} />;
};

interface SpotifyFocusWidgetProps {
  onOpenSettingsConnections?: () => void;
}

export const SpotifyFocusWidget: React.FC<SpotifyFocusWidgetProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<MusicPlatform | null>(() =>
    spotifyService.getDetectedPlatform()
  );
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

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

  // Subscribe to track & connection updates for automatic platform detection
  useEffect(() => {
    spotifyService.checkRedirectCode().then((connected) => {
      if (connected) {
        setDetectedPlatform(spotifyService.getDetectedPlatform());
      }
    });

    const unsubConnections = spotifyService.subscribeConnections(() => {
      setDetectedPlatform(spotifyService.getDetectedPlatform());
    });

    const unsubscribe = spotifyService.subscribe((track) => {
      setCurrentTrack(track);
      setDetectedPlatform(spotifyService.getDetectedPlatform());
      if (!isSeeking && track) {
        lastSyncRef.current = {
          baseProgressMs: track.progressMs,
          timestamp: Date.now(),
          isPlaying: track.isPlaying,
        };
        setSeekValue(track.progressMs);
      }
    });

    const interval = setInterval(() => {
      spotifyService.pollSpotifyNowPlaying();
    }, 1500);

    return () => {
      unsubConnections();
      unsubscribe();
      clearInterval(interval);
    };
  }, [isSeeking]);

  // High-frequency smooth tick for progress bar (runs every 50ms for 0 latency / 0 jitter)
  useEffect(() => {
    if (!currentTrack || !currentTrack.isPlaying) return;

    const timer = setInterval(() => {
      if (isSeeking) return;

      const sync = lastSyncRef.current;
      if (!sync.isPlaying) return;

      const elapsed = Date.now() - sync.timestamp;
      const nextProgress = Math.min(
        currentTrack.durationMs || 180000,
        sync.baseProgressMs + elapsed
      );
      setSeekValue(nextProgress);
    }, 50);

    return () => clearInterval(timer);
  }, [isSeeking, currentTrack]);

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
    const willPlay = !currentTrack?.isPlaying;
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
  };

  // Zero-latency instant Next Track
  const handleNext = () => {
    soundEngine.playClick();
    setSeekValue(0);
    lastSyncRef.current = {
      baseProgressMs: 0,
      timestamp: Date.now(),
      isPlaying: true,
    };
    spotifyService.spotifyNext();
  };

  // Zero-latency instant Previous Track
  const handlePrevious = () => {
    soundEngine.playClick();
    setSeekValue(0);
    lastSyncRef.current = {
      baseProgressMs: 0,
      timestamp: Date.now(),
      isPlaying: true,
    };
    spotifyService.spotifyPrevious();
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
    spotifyService.spotifySeek(ms);
  };

  const trackDuration = currentTrack?.durationMs || 180000;
  const currentProgress = isSeeking
    ? seekValue
    : currentTrack?.isPlaying
    ? seekValue
    : currentTrack?.progressMs || seekValue || 0;
  const progressPercent = Math.min(100, Math.max(0, (currentProgress / trackDuration) * 100));

  const isPlayingNow = Boolean(currentTrack?.isPlaying);
  const showPlatformIdentity = Boolean(isPlayingNow && detectedPlatform);
  const activeMeta = detectedPlatform ? PLATFORM_METADATA[detectedPlatform] : PLATFORM_METADATA.spotify;

  // Sol buton sınıfları:
  // - Çalınan bir şey yoksa veya bağlanılmadıysa: Müzik logosu ve nötr karanlık stil
  // - Spotify'dan dinleniyorsa: Önceki Spotify butonu (Yeşil #1DB954)
  // - YouTube Music'ten dinleniyorsa: YouTube Music logosu (Kırmızı #FF0033)
  // - Apple Music'ten dinleniyorsa: Apple Music logosu (Mercan Kırmızısı #FA243C)
  const getLeftButtonClasses = () => {
    if (showPlatformIdentity && detectedPlatform) {
      if (isOpen) {
        if (detectedPlatform === 'youtube_music') {
          return 'bg-[#FF0033] text-white border-[#FF0033] shadow-[#FF0033]/50 scale-105';
        }
        if (detectedPlatform === 'apple_music') {
          return 'bg-[#FA243C] text-white border-[#FA243C] shadow-[#FA243C]/50 scale-105';
        }
        return 'bg-[#1DB954] text-black border-[#1DB954] shadow-[#1DB954]/50 scale-105';
      }

      if (detectedPlatform === 'youtube_music') {
        return 'bg-black/90 text-[#FF0033] border-[#FF0033]/70 opacity-95 hover:opacity-100 hover:scale-105 ring-2 ring-[#FF0033]/40';
      }
      if (detectedPlatform === 'apple_music') {
        return 'bg-black/90 text-[#FA243C] border-[#FA243C]/70 opacity-95 hover:opacity-100 hover:scale-105 ring-2 ring-[#FA243C]/40';
      }
      return 'bg-black/90 text-[#1DB954] border-[#1DB954]/70 opacity-95 hover:opacity-100 hover:scale-105 ring-2 ring-[#1DB954]/40';
    }

    if (isOpen) {
      return 'bg-white text-black border-white shadow-white/30 scale-105';
    }

    return 'bg-black/80 text-neutral-300 border-neutral-700/80 hover:text-white hover:border-white/40 hover:scale-105';
  };

  return (
    <>
      {/* 1. Sol Müzik Butonu:
          Çalınan bir şey yoksa veya hesap bağlı değilse: Müzik Logosu (<Music />).
          Spotify çalıyorsa: Spotify butonu.
          YT Music çalıyorsa: YouTube Music logosu.
          Apple Music çalıyorsa: Apple Music logosu. */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          setIsOpen(!isOpen);
        }}
        className={`fixed left-3 sm:left-6 top-[38%] -translate-y-1/2 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-2xl flex items-center justify-center group ${getLeftButtonClasses()}`}
        title={showPlatformIdentity ? `${activeMeta.name} Çalıyor` : 'Müzik Çalar'}
        aria-label="Müzik Çalar"
      >
        {showPlatformIdentity && detectedPlatform ? (
          <PlatformIcon
            platform={detectedPlatform}
            className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110 fill-current"
          />
        ) : (
          <Music className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110" />
        )}
      </button>

      {/* 2. Alttan Açılan Şarkı Çalar Paneli (Sade: Bağlantılar / Hesabını Bağla / Platform Butonları YOK) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 p-3 sm:p-6 md:p-8 flex justify-center transition-all duration-300 ease-out transform ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl bg-neutral-950/98 border border-neutral-800/90 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 shadow-2xl shadow-black pointer-events-auto text-white flex flex-col gap-4 relative ring-1 ring-white/10">
          {/* Top Bar: Sadece otomatik algılanan platform logosu + adı ve sağda Kapat (X) tuşu */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              {detectedPlatform ? (
                <>
                  <span style={{ color: activeMeta.accentHex }}>
                    <PlatformIcon platform={detectedPlatform} className="w-5 h-5 sm:w-6 sm:h-6" />
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                    {activeMeta.name}
                  </span>
                </>
              ) : (
                <>
                  <Music className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-300" />
                  <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                    Müzik Çalar
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
              title="Paneli Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Music Info & Album Cover */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900 border overflow-hidden shrink-0 flex items-center justify-center relative shadow-lg"
              style={{ borderColor: isPlayingNow ? `${activeMeta.accentHex}66` : '#262626' }}
            >
              {currentTrack?.albumArt ? (
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.albumName || currentTrack.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3
                  className={`w-8 h-8 ${isPlayingNow ? 'animate-spin' : ''}`}
                  style={{
                    animationDuration: '4s',
                    color: isPlayingNow ? activeMeta.accentHex : '#525252',
                  }}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-base sm:text-lg font-bold text-white truncate">
                {currentTrack?.name || 'Müzik Başlatılmadı'}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-400 truncate mt-0.5">
                {currentTrack?.artists?.join(', ') ||
                  (detectedPlatform
                    ? `${activeMeta.name} ile çalışma müziğinizi dinleyin`
                    : 'Ayarlar > Bağlantılar sekmesinden müzik hesabınızı bağlayabilirsiniz')}
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
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${activeMeta.accentHex}, ${activeMeta.hoverHex})`,
                }}
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
            <div className="flex justify-between text-[11px] text-neutral-400 font-mono tabular-nums">
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
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${
                activeMeta.textOnAccent === 'black' ? 'text-black' : 'text-white'
              }`}
              style={{
                backgroundColor: activeMeta.accentHex,
                boxShadow: `0 10px 25px -5px ${activeMeta.accentHex}55`,
              }}
              title={isPlayingNow ? 'Durdur' : 'Oynat'}
            >
              {isPlayingNow ? (
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
    </>
  );
};
