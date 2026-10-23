import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Music,
  Disc3,
  Settings,
  Radio,
} from 'lucide-react';
import {
  spotifyService,
  SpotifyTrack,
  PLATFORM_METADATA,
} from '../../services/spotifyService';
import { MusicPlatform } from '../../types';
import { soundEngine } from '../../utils/audio';

export const SpotifyIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const YouTubeMusicIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="0" y="0" width="24" height="24" rx="5" fill="#FF0000" />
    <circle cx="12" cy="12" r="7.4" fill="none" stroke="#FFFFFF" strokeWidth="1.65" />
    <polygon points="9.6,8.3 16.0,12 9.6,15.7" fill="#FFFFFF" />
  </svg>
);

export const AppleMusicIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="appleMusicOfficialGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FB5C74" />
        <stop offset="100%" stopColor="#FA233B" />
      </linearGradient>
    </defs>
    {/* Official Apple Music Pink-to-Coral Gradient App Squircle */}
    <rect x="0" y="0" width="24" height="24" rx="5" fill="url(#appleMusicOfficialGrad)" />
    {/* Official White Beamed Eighth Notes + Apple Leaf Emblem */}
    <path
      fill="#FFFFFF"
      d="M17.35 5.15c-.22-.16-.51-.22-.79-.16l-6.75 1.38c-.47.1-.81.51-.81.99v7.78c-.44-.29-.99-.45-1.58-.45-1.49 0-2.7 1.04-2.7 2.33s1.21 2.33 2.7 2.33 2.7-1.04 2.7-2.33V9.97l5.8-1.19v5.14c-.44-.29-.99-.45-1.58-.45-1.49 0-2.7 1.04-2.7 2.33s1.21 2.33 2.7 2.33 2.7-1.04 2.7-2.33V5.95c0-.32-.15-.61-.39-.8z"
    />
  </svg>
);

export const PlatformIcon: React.FC<{ platform: MusicPlatform; className?: string }> = ({
  platform,
  className = 'w-6 h-6',
}) => {
  if (platform === 'youtube_music') return <YouTubeMusicIcon className={className} />;
  if (platform === 'apple_music') return <AppleMusicIcon className={className} />;
  return <SpotifyIcon className={`${className} text-[#1DB954]`} />;
};

interface SpotifyFocusWidgetProps {
  onOpenSettingsConnections?: () => void;
}

export const SpotifyFocusWidget: React.FC<SpotifyFocusWidgetProps> = ({
  onOpenSettingsConnections,
}) => {
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
      spotifyService.pollYouTubeMusicAccountNowPlaying();
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
        currentTrack.durationMs || 30000,
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

  const trackDuration = currentTrack?.durationMs || 30000;
  const currentProgress = isSeeking
    ? seekValue
    : currentTrack?.isPlaying
    ? seekValue
    : currentTrack?.progressMs || seekValue || 0;
  const progressPercent = Math.min(100, Math.max(0, (currentProgress / trackDuration) * 100));

  const isPlayingNow = Boolean(currentTrack?.isPlaying);
  // Only show platform identity logo if a song is actively playing right now!
  // If nothing is playing on device, it remains the neutral Music logo as requested.
  const activePlayingPlatform: MusicPlatform | null = isPlayingNow
    ? (currentTrack?.source === 'youtube_music' || currentTrack?.source === 'apple_music' || currentTrack?.source === 'spotify'
        ? currentTrack.source
        : detectedPlatform)
    : null;

  const showPlatformIdentity = Boolean(isPlayingNow && activePlayingPlatform);
  const activeMeta = activePlayingPlatform
    ? PLATFORM_METADATA[activePlayingPlatform]
    : detectedPlatform
    ? PLATFORM_METADATA[detectedPlatform]
    : PLATFORM_METADATA.spotify;

  const getLeftButtonClasses = () => {
    if (showPlatformIdentity && activePlayingPlatform) {
      if (isOpen) {
        if (activePlayingPlatform === 'youtube_music') {
          return 'p-0 overflow-hidden border-[#FF0000] shadow-[#FF0000]/50 ring-2 ring-[#FF0000] scale-105';
        }
        if (activePlayingPlatform === 'apple_music') {
          return 'p-0 overflow-hidden border-[#FA2D48] shadow-[#FA2D48]/50 ring-2 ring-[#FA2D48] scale-105';
        }
        return 'bg-[#1DB954] text-black border-[#1DB954] shadow-[#1DB954]/50 scale-105';
      }

      if (activePlayingPlatform === 'youtube_music') {
        return 'p-0 overflow-hidden border-[#FF0000]/80 hover:scale-105 ring-2 ring-[#FF0000]/40 shadow-[#FF0000]/30';
      }
      if (activePlayingPlatform === 'apple_music') {
        return 'p-0 overflow-hidden border-[#FA2D48]/80 hover:scale-105 ring-2 ring-[#FA2D48]/40 shadow-[#FA2D48]/30';
      }
      return 'bg-black/85 text-[#1DB954] border-[#1DB954]/60 hover:bg-[#1DB954]/15 hover:scale-105 ring-2 ring-[#1DB954]/30 shadow-[#1DB954]/20';
    }

    if (isOpen) {
      return 'bg-white text-black border-white shadow-white/30 scale-105';
    }

    return 'bg-black/80 text-neutral-300 border-neutral-700/80 hover:text-white hover:border-white/40 hover:scale-105';
  };

  return (
    <>
      {/* 1. Sol Müzik Butonu:
          Bağlanılmadıysa veya o an çalan bir şey yoksa: Müzik Logosu (<Music />).
          Spotify çalıyorsa: Klasik Spotify buton ve logo stili.
          YouTube Music veya Apple Music çalıyorsa: İlgili platformun logosu butonu tam kapsar (full-bleed). */}
      <button
        type="button"
        onClick={() => {
          soundEngine.playClick();
          setIsOpen(!isOpen);
        }}
        className={`fixed left-3 sm:left-6 top-[38%] -translate-y-1/2 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl backdrop-blur-xl border transition-all duration-300 cursor-pointer shadow-2xl flex items-center justify-center group ${getLeftButtonClasses()}`}
        title={showPlatformIdentity && activePlayingPlatform ? `${activeMeta.name} (Çalıyor)` : 'Müzik Çalar'}
        aria-label="Müzik Çalar"
      >
        {showPlatformIdentity && activePlayingPlatform ? (
          activePlayingPlatform === 'spotify' ? (
            <SpotifyIcon className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110" />
          ) : (
            <PlatformIcon
              platform={activePlayingPlatform}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : (
          <Music className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110" />
        )}
      </button>

      {/* 2. Alttan Açılan Şarkı Çalar Paneli */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 p-3 sm:p-6 md:p-8 flex justify-center transition-all duration-300 ease-out transform ${
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full max-w-3xl sm:max-w-4xl bg-neutral-950/98 border border-neutral-800/90 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 shadow-2xl shadow-black pointer-events-auto text-white flex flex-col gap-4 relative ring-1 ring-white/10">
          {/* Top Bar: Auto-detected Platform (Logo + Name) + Settings & Close */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            {/* Auto-detected platform display (Logo + Name) */}
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border bg-neutral-900/90 border-neutral-800/90 shadow-sm"
                style={{
                  borderColor: isPlayingNow ? `${activeMeta.accentHex}66` : undefined,
                }}
              >
                {activePlayingPlatform ? (
                  <PlatformIcon platform={activePlayingPlatform} className="w-4 h-4" />
                ) : detectedPlatform ? (
                  <PlatformIcon platform={detectedPlatform} className="w-4 h-4" />
                ) : (
                  <Music className="w-4 h-4 text-neutral-400" />
                )}
                <span className="text-white font-extrabold tracking-wide">
                  {activePlayingPlatform
                    ? PLATFORM_METADATA[activePlayingPlatform].name
                    : detectedPlatform
                    ? PLATFORM_METADATA[detectedPlatform].name
                    : 'Müzik Çalar'}
                </span>
                {isPlayingNow && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenSettingsConnections && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setIsOpen(false);
                    onOpenSettingsConnections();
                  }}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                  title="Müzik Hesap Bağlantıları"
                  aria-label="Ayarlar"
                >
                  <Settings className="w-4 h-4 text-neutral-400 hover:text-white" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer flex items-center justify-center"
                title="Paneli Kapat"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
