import { MusicPlatform, MusicConnectionsConfig } from '../types';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumName: string;
  albumArt: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  source: 'spotify' | 'youtube_music' | 'apple_music' | 'focus_stream';
  externalUrl?: string;
  ytVideoId?: string;
}

const SPOTIFY_STORAGE_KEYS = {
  ACCESS_TOKEN: 'fokus_spotify_access_token',
  REFRESH_TOKEN: 'fokus_spotify_refresh_token',
  EXPIRES_AT: 'fokus_spotify_expires_at',
  CLIENT_ID: 'fokus_spotify_client_id',
  CONNECTED_USER: 'fokus_spotify_connected_user',
  CODE_VERIFIER: 'fokus_spotify_code_verifier',
  REDIRECT_URI: 'fokus_spotify_redirect_uri',
  MUSIC_CONNECTIONS: 'fokus_music_connections_v1',
  LAST_SYNCED_CLIPBOARD: 'fokus_last_synced_clipboard_v1',
};

export const UNIVERSAL_SAFE_REDIRECT_URI = 'https://open.spotify.com/';

export function getAppRedirectUri(): string {
  if (typeof window === 'undefined') return UNIVERSAL_SAFE_REDIRECT_URI;
  const savedRedirect = localStorage.getItem(SPOTIFY_STORAGE_KEYS.REDIRECT_URI);
  if (savedRedirect) return savedRedirect;
  return `${window.location.origin}/auth/callback`;
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => possible[x % possible.length])
    .join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

function parseIsoDurationToMs(iso: string): number {
  if (!iso) return 210000;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 210000;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 || 210000;
}

export interface StreamTrackItem {
  id: string;
  name: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  durationMs: number;
  platform: MusicPlatform;
  externalUrl?: string;
  ytVideoId?: string;
}

export const PLATFORM_METADATA: Record<
  MusicPlatform,
  {
    id: MusicPlatform;
    name: string;
    shortName: string;
    accentHex: string;
    hoverHex: string;
    textOnAccent: 'black' | 'white';
    defaultPlaylistName: string;
    externalAppUrl: string;
    authLoginUrl: string;
  }
> = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    shortName: 'Spotify',
    accentHex: '#1DB954',
    hoverHex: '#1ed760',
    textOnAccent: 'black',
    defaultPlaylistName: 'Spotify Canlı Senkronizasyon',
    externalAppUrl: 'https://open.spotify.com',
    authLoginUrl: 'https://accounts.spotify.com/tr/login?continue=https%3A%2F%2Fopen.spotify.com',
  },
  youtube_music: {
    id: 'youtube_music',
    name: 'YouTube Music',
    shortName: 'YT Music',
    accentHex: '#FF0000',
    hoverHex: '#ff2626',
    textOnAccent: 'white',
    defaultPlaylistName: 'YouTube Music Kütüphanem',
    externalAppUrl: 'https://music.youtube.com',
    authLoginUrl: 'https://music.youtube.com',
  },
  apple_music: {
    id: 'apple_music',
    name: 'Apple Music',
    shortName: 'Apple Music',
    accentHex: '#FA2D48',
    hoverHex: '#FB5C74',
    textOnAccent: 'white',
    defaultPlaylistName: 'Apple Music Kütüphanem',
    externalAppUrl: 'https://music.apple.com',
    authLoginUrl: 'https://music.apple.com/tr/login',
  },
};

const DEFAULT_CONNECTIONS: MusicConnectionsConfig = {
  activePlatform: 'spotify',
  spotify: {
    connected: false,
    accountName: '',
    customPlaylistUrl: '',
    customTrackTitle: '',
    customArtistName: '',
  },
  youtube_music: {
    connected: false,
    accountName: '',
    customPlaylistUrl: '',
    customTrackTitle: '',
    customArtistName: '',
  },
  apple_music: {
    connected: false,
    accountName: '',
    customPlaylistUrl: '',
    customTrackTitle: '',
    customArtistName: '',
  },
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    MusicKit?: any;
  }
}

class SpotifyService {
  private platformQueues: Record<MusicPlatform, StreamTrackItem[]> = {
    spotify: [],
    youtube_music: [],
    apple_music: [],
  };
  private platformIndices: Record<MusicPlatform, number> = {
    spotify: 0,
    youtube_music: 0,
    apple_music: 0,
  };

  private audioEl: HTMLAudioElement | null = null;
  private ytPlayer: any = null;
  private ytPlayerReady = false;
  private ytCurrentVideoId: string | null = null;
  private isStreamPlaying = false;
  private streamProgressMs = 0;
  private listeners: ((track: SpotifyTrack | null) => void)[] = [];
  private connectionListeners: ((config: MusicConnectionsConfig) => void)[] = [];
  private lastLiveTrack: SpotifyTrack | null = null;
  private connections: MusicConnectionsConfig = { ...DEFAULT_CONNECTIONS };

  constructor() {
    this.loadConnectionsFromStorage();
    if (typeof window !== 'undefined') {
      try {
        this.audioEl = new Audio();
        this.audioEl.crossOrigin = 'anonymous';
        this.audioEl.preload = 'auto';

        this.audioEl.addEventListener('timeupdate', () => {
          if (this.audioEl && !isNaN(this.audioEl.currentTime)) {
            this.streamProgressMs = Math.floor(this.audioEl.currentTime * 1000);
            const active = this.getDetectedPlatform() || this.connections.activePlatform;
            if (active !== 'spotify' || !this.lastLiveTrack?.isPlaying) {
              this.notifyListeners();
            }
          }
        });

        this.audioEl.addEventListener('ended', () => {
          this.nextStream();
        });

        this.audioEl.addEventListener('play', () => {
          this.isStreamPlaying = true;
          this.notifyListeners();
        });

        this.audioEl.addEventListener('pause', () => {
          this.isStreamPlaying = false;
          this.notifyListeners();
        });
      } catch {}

      // Listen for OAuth popup messages
      window.addEventListener('message', async (event) => {
        if (!event.data) return;
        if (event.data.type === 'SPOTIFY_AUTH_CODE' && event.data.code) {
          const ok = await this.exchangeCodeForToken(
            event.data.code,
            event.data.redirectUri
          );
          if (ok) {
            await this.pollSpotifyNowPlaying();
          }
        } else if (event.data.type === 'SPOTIFY_ACCESS_TOKEN' && event.data.accessToken) {
          await this.setDirectAccessToken(event.data.accessToken);
        }
      });

      // When user switches back to our app from Spotify / YT Music / Apple Music, sync immediately
      window.addEventListener('focus', () => {
        this.pollSpotifyNowPlaying();
        this.tryAutoSyncFromClipboardOnFocus();
      });

      // If YouTube Music is connected with an access token, fetch user's liked songs
      if (this.connections.youtube_music.connected && this.connections.youtube_music.accessToken) {
        this.fetchYouTubeMusicUserTracks(this.connections.youtube_music.accessToken);
      }

      // If Spotify has a token, immediately poll live playback
      if (this.getAccessToken()) {
        this.pollSpotifyNowPlaying();
      }
    }
  }

  // --- YOUTUBE IFRAME PLAYER ENGINE (REAL FULL-LENGTH YT MUSIC STREAMING) ---

  private ensureYouTubePlayer(): Promise<any> {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (this.ytPlayer && this.ytPlayerReady) return Promise.resolve(this.ytPlayer);

    return new Promise((resolve) => {
      const initPlayer = () => {
        if (!window.YT || !window.YT.Player) {
          resolve(null);
          return;
        }
        let container = document.getElementById('fokus-yt-music-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'fokus-yt-music-container';
          container.style.position = 'fixed';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          container.style.width = '1px';
          container.style.height = '1px';
          container.style.opacity = '0';
          container.style.pointerEvents = 'none';
          const inner = document.createElement('div');
          inner.id = 'fokus-yt-music-player';
          container.appendChild(inner);
          document.body.appendChild(container);
        }

        if (this.ytPlayer) {
          resolve(this.ytPlayer);
          return;
        }

        this.ytPlayer = new window.YT.Player('fokus-yt-music-player', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              this.ytPlayerReady = true;
              resolve(this.ytPlayer);
            },
            onStateChange: (e: any) => {
              // YT.PlayerState.PLAYING === 1, PAUSED === 2, ENDED === 0
              if (e.data === 1) {
                this.isStreamPlaying = true;
                this.notifyListeners();
              } else if (e.data === 2) {
                this.isStreamPlaying = false;
                this.notifyListeners();
              } else if (e.data === 0) {
                this.nextStream();
              }
            },
          },
        });
      };

      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        const existingScript = document.getElementById('fokus-yt-iframe-api');
        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          initPlayer();
        };
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.id = 'fokus-yt-iframe-api';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
      }
    });
  }

  // --- AUTOMATIC CLIPBOARD / LINK / CODE DETECTION ON FOCUS ---

  private async tryAutoSyncFromClipboardOnFocus() {
    if (typeof window === 'undefined' || !navigator.clipboard?.readText) return;
    try {
      const text = (await navigator.clipboard.readText())?.trim();
      if (!text || text.length < 10 || text.length > 1000) return;

      const lastSynced = localStorage.getItem(SPOTIFY_STORAGE_KEYS.LAST_SYNCED_CLIPBOARD);
      if (lastSynced === text) return;

      // 1. Check if clipboard contains a Spotify OAuth redirect URL (?code=...)
      if (
        (text.includes('open.spotify.com') || text.includes('/auth/callback')) &&
        text.includes('code=')
      ) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.LAST_SYNCED_CLIPBOARD, text);
        const res = await this.exchangeCodeOrUrl(text);
        if (res.success) {
          await this.pollSpotifyNowPlaying();
        }
        return;
      }

      // 2. Check if clipboard contains a direct song URL from Spotify, YouTube Music, or Apple Music
      if (
        text.includes('open.spotify.com/track/') ||
        text.includes('music.youtube.com/watch') ||
        text.includes('youtube.com/watch?v=') ||
        text.includes('youtu.be/') ||
        text.includes('music.apple.com/')
      ) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.LAST_SYNCED_CLIPBOARD, text);
        await this.syncTrackFromUrlOrQuery(text);
      }
    } catch {
      // Clipboard permission not granted or unavailable — ignore silently
    }
  }

  // --- SYNC ANY SONG OR PLAYLIST FROM SPOTIFY, YOUTUBE MUSIC, OR APPLE MUSIC ---

  public async syncTrackFromUrlOrQuery(
    rawInput: string,
    preferredPlatform?: MusicPlatform
  ): Promise<{ success: boolean; track?: SpotifyTrack; platform?: MusicPlatform; error?: string }> {
    const input = rawInput.trim();
    if (!input) {
      return { success: false, error: 'Lütfen bir şarkı adı veya bağlantı girin.' };
    }

    // 1. Spotify OAuth Code or Access Token
    if (input.includes('code=') || input.startsWith('BQ')) {
      const res = await this.exchangeCodeOrUrl(input);
      if (res.success) {
        const track = await this.pollSpotifyNowPlaying();
        return { success: true, track: track || undefined, platform: 'spotify' };
      }
    }

    // 2. YouTube Music / YouTube URL (e.g. https://music.youtube.com/watch?v=...)
    if (
      input.includes('music.youtube.com') ||
      input.includes('youtube.com/watch') ||
      input.includes('youtu.be/')
    ) {
      const videoIdMatch =
        input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
        input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${videoId}`
            )}&format=json`
          );
          if (oembedRes.ok) {
            const meta = await oembedRes.json();
            const newItem: StreamTrackItem = {
              id: `yt-${videoId}`,
              name: meta.title || 'YouTube Music Parçası',
              artist: (meta.author_name || 'YouTube Music').replace(/ - Topic$/i, ''),
              album: 'YouTube Music',
              cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              audioUrl: '',
              durationMs: 210000,
              platform: 'youtube_music',
              externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
              ytVideoId: videoId,
            };
            this.platformQueues.youtube_music = [
              newItem,
              ...this.platformQueues.youtube_music.filter((t) => t.id !== newItem.id),
            ];
            this.platformIndices.youtube_music = 0;
            this.connectPlatform('youtube_music', {
              accountName: this.connections.youtube_music.accountName || 'YouTube Music',
              customTrackTitle: newItem.name,
              customArtistName: newItem.artist,
              customPlaylistUrl: newItem.externalUrl,
              makeActive: true,
            });
            const built = this.buildStreamTrackForPlatform('youtube_music');
            this.notifyListeners(built);
            return { success: true, track: built, platform: 'youtube_music' };
          }
        } catch {}
      }
    }

    // 3. Apple Music URL (e.g. https://music.apple.com/tr/album/...?i=123456789)
    if (input.includes('music.apple.com')) {
      const songIdMatch =
        input.match(/[?&]i=(\d+)/) ||
        input.match(/\/song\/[^/]+\/(\d+)/) ||
        input.match(/\/album\/[^/]+\/(\d+)/);
      if (songIdMatch && songIdMatch[1]) {
        const lookupId = songIdMatch[1];
        try {
          const res = await fetch(
            `https://itunes.apple.com/lookup?id=${lookupId}&entity=song&country=TR`
          );
          if (res.ok) {
            const data = await res.json();
            const songs = (data.results || []).filter(
              (r: any) => r.wrapperType === 'track' && r.trackName
            );
            if (songs.length > 0) {
              const mapped: StreamTrackItem[] = songs.map((item: any) => ({
                id: `am-${item.trackId}`,
                name: item.trackName,
                artist: item.artistName,
                album: item.collectionName || 'Apple Music',
                cover: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
                audioUrl: item.previewUrl || '',
                durationMs: item.trackTimeMillis || 210000,
                platform: 'apple_music',
                externalUrl: item.trackViewUrl || input,
              }));
              this.platformQueues.apple_music = [
                ...mapped,
                ...this.platformQueues.apple_music.filter(
                  (existing) => !mapped.some((m) => m.id === existing.id)
                ),
              ];
              this.platformIndices.apple_music = 0;
              if (mapped[0].audioUrl && this.audioEl) {
                this.audioEl.src = mapped[0].audioUrl;
              }
              this.connectPlatform('apple_music', {
                accountName: this.connections.apple_music.accountName || 'Apple Music',
                customTrackTitle: mapped[0].name,
                customArtistName: mapped[0].artist,
                customPlaylistUrl: input,
                makeActive: true,
              });
              const built = this.buildStreamTrackForPlatform('apple_music');
              this.notifyListeners(built);
              return { success: true, track: built, platform: 'apple_music' };
            }
          }
        } catch {}
      }
    }

    // 4. Spotify Track URL (e.g. https://open.spotify.com/track/...)
    if (input.includes('open.spotify.com/track/')) {
      try {
        const oembedRes = await fetch(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(input)}`
        );
        if (oembedRes.ok) {
          const meta = await oembedRes.json();
          const title = meta.title || 'Spotify Parçası';
          // Search iTunes for matching audio stream & artist info
          const searchRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              title
            )}&media=music&entity=song&limit=1&country=TR`
          );
          let artist = 'Spotify';
          let album = 'Spotify';
          let cover = meta.thumbnail_url || '';
          let audioUrl = '';
          let durationMs = 210000;
          if (searchRes.ok) {
            const sData = await searchRes.json();
            const match = sData.results?.[0];
            if (match) {
              artist = match.artistName || artist;
              album = match.collectionName || album;
              cover =
                cover || (match.artworkUrl100 || '').replace('100x100bb', '600x600bb');
              audioUrl = match.previewUrl || '';
              durationMs = match.trackTimeMillis || durationMs;
            }
          }
          const spItem: StreamTrackItem = {
            id: `sp-url-${Date.now()}`,
            name: title,
            artist,
            album,
            cover,
            audioUrl,
            durationMs,
            platform: 'spotify',
            externalUrl: input,
          };
          this.platformQueues.spotify = [spItem, ...this.platformQueues.spotify];
          this.platformIndices.spotify = 0;
          if (audioUrl && this.audioEl) {
            this.audioEl.src = audioUrl;
          }
          this.connectPlatform('spotify', {
            accountName: this.connections.spotify.accountName || 'Spotify',
            customTrackTitle: title,
            customArtistName: artist,
            customPlaylistUrl: input,
            makeActive: true,
          });
          const built = this.buildStreamTrackForPlatform('spotify');
          this.notifyListeners(built);
          return { success: true, track: built, platform: 'spotify' };
        }
      } catch {}
    }

    // 5. General Song / Artist Search Query for the target platform
    const targetPlatform =
      preferredPlatform || this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          input
        )}&media=music&entity=song&limit=10&country=TR`
      );
      if (res.ok) {
        const data = await res.json();
        const items: StreamTrackItem[] = (data.results || [])
          .filter((r: any) => r.trackName && r.artistName)
          .map((item: any) => ({
            id: `${targetPlatform}-${item.trackId}`,
            name: item.trackName,
            artist: item.artistName,
            album: item.collectionName || PLATFORM_METADATA[targetPlatform].name,
            cover: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
            audioUrl: item.previewUrl || '',
            durationMs: item.trackTimeMillis || 30000,
            platform: targetPlatform,
            externalUrl: item.trackViewUrl || PLATFORM_METADATA[targetPlatform].externalAppUrl,
          }));
        if (items.length > 0) {
          this.platformQueues[targetPlatform] = items;
          this.platformIndices[targetPlatform] = 0;
          if (items[0].audioUrl && this.audioEl) {
            this.audioEl.src = items[0].audioUrl;
          }
          this.connectPlatform(targetPlatform, {
            accountName:
              this.connections[targetPlatform].accountName ||
              PLATFORM_METADATA[targetPlatform].name,
            customTrackTitle: items[0].name,
            customArtistName: items[0].artist,
            makeActive: true,
          });
          const built = this.buildStreamTrackForPlatform(targetPlatform);
          this.notifyListeners(built);
          return { success: true, track: built, platform: targetPlatform };
        }
      }
    } catch {}

    return { success: false, error: 'Şarkı bulunamadı.' };
  }

  // --- YOUTUBE MUSIC REAL GOOGLE OAUTH & USER LIBRARY FETCH ---

  public async connectYouTubeMusicWithGooglePopup(): Promise<{
    success: boolean;
    accountName?: string;
    trackCount?: number;
    error?: string;
  }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Tarayıcı ortamı bulunamadı.' };
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || '';
      const displayName =
        result.user?.displayName || result.user?.email || 'YouTube Music Hesabım';

      let loadedCount = 0;
      if (accessToken) {
        loadedCount = await this.fetchYouTubeMusicUserTracks(accessToken);
      }

      this.connections.youtube_music = {
        ...this.connections.youtube_music,
        connected: true,
        accountName: displayName,
        accessToken,
        connectedAt: Date.now(),
      };
      this.connections.activePlatform = 'youtube_music';
      this.saveConnectionsToStorage();
      this.notifyListeners();

      return {
        success: true,
        accountName: displayName,
        trackCount: loadedCount,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Google / YouTube Music girişi tamamlanamadı.',
      };
    }
  }

  public async fetchYouTubeMusicUserTracks(accessToken: string): Promise<number> {
    if (!accessToken) return 0;
    try {
      // 1. Fetch user's Liked Music Videos (videoCategoryId=10 is Music)
      const likedMusicRes = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&videoCategoryId=10&maxResults=25',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      let items: any[] = [];
      if (likedMusicRes.ok) {
        const data = await likedMusicRes.json();
        items = data.items || [];
      }

      // 2. If user has no category-10 liked videos, fallback to all liked videos
      if (items.length === 0) {
        const allLikedRes = await fetch(
          'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=20',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (allLikedRes.ok) {
          const data = await allLikedRes.json();
          items = data.items || [];
        }
      }

      if (items.length > 0) {
        const tracks: StreamTrackItem[] = items.map((item: any) => {
          const snippet = item.snippet || {};
          const rawTitle = snippet.title || 'YouTube Music Parçası';
          const channelTitle = (snippet.channelTitle || 'YouTube Music').replace(
            / - Topic$/i,
            ''
          );
          const thumb =
            snippet.thumbnails?.maxres?.url ||
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
          const durationMs = parseIsoDurationToMs(item.contentDetails?.duration);

          return {
            id: `yt-${item.id}`,
            name: rawTitle,
            artist: channelTitle,
            album: 'YouTube Music · Beğenilen Şarkılarım',
            cover: thumb,
            audioUrl: '',
            durationMs,
            platform: 'youtube_music',
            externalUrl: `https://music.youtube.com/watch?v=${item.id}`,
            ytVideoId: item.id,
          };
        });

        this.platformQueues.youtube_music = tracks;
        this.platformIndices.youtube_music = 0;
        this.ensureYouTubePlayer();
        this.notifyListeners();
        return tracks.length;
      }
    } catch {}
    return 0;
  }

  // --- APPLE MUSIC CONNECTION & CATALOG SYNC ---

  public async connectAppleMusicWithPopup(
    userDisplayName?: string
  ): Promise<{ success: boolean; accountName: string }> {
    if (typeof window !== 'undefined') {
      const width = 520;
      const height = 680;
      const left = Math.max(0, Math.round((window.screen.width - width) / 2));
      const top = Math.max(0, Math.round((window.screen.height - height) / 2));
      window.open(
        'https://music.apple.com/tr/login',
        'apple_music_auth_popup',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
      );
    }

    const accountLabel = userDisplayName?.trim() || 'Apple Music Hesabım';
    this.connectPlatform('apple_music', {
      accountName: accountLabel,
      makeActive: true,
    });
    this.notifyListeners();
    return { success: true, accountName: accountLabel };
  }

  // --- MULTI-PLATFORM PERSISTENT CONNECTION STORAGE ---

  private loadConnectionsFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SPOTIFY_STORAGE_KEYS.MUSIC_CONNECTIONS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MusicConnectionsConfig>;
        this.connections = {
          activePlatform: parsed.activePlatform || 'spotify',
          spotify: { ...DEFAULT_CONNECTIONS.spotify, ...(parsed.spotify || {}) },
          youtube_music: { ...DEFAULT_CONNECTIONS.youtube_music, ...(parsed.youtube_music || {}) },
          apple_music: { ...DEFAULT_CONNECTIONS.apple_music, ...(parsed.apple_music || {}) },
        };
      }

      // Restore Spotify tokens if stored in connections config
      if (this.connections.spotify.accessToken && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN, this.connections.spotify.accessToken);
      }
      if (this.connections.spotify.refreshToken && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN, this.connections.spotify.refreshToken);
      }
      if (this.connections.spotify.clientId && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID, this.connections.spotify.clientId);
      }

      const legacySpotifyToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
      const legacySpotifyUser = localStorage.getItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER);
      if (legacySpotifyToken) {
        this.connections.spotify = {
          ...this.connections.spotify,
          connected: true,
          accountName: this.connections.spotify.accountName || legacySpotifyUser || 'Spotify Hesabım',
          accessToken: legacySpotifyToken,
          refreshToken: localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN) || this.connections.spotify.refreshToken,
          clientId: localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID) || this.connections.spotify.clientId,
          connectedAt: this.connections.spotify.connectedAt || Date.now(),
        };
      }
    } catch {
      this.connections = { ...DEFAULT_CONNECTIONS };
    }
  }

  private saveConnectionsToStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      // Keep Spotify token fields synced inside connections.spotify for Firestore backup
      const spToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
      const spRefresh = localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN);
      const spClientId = localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID);
      const spExpires = Number(localStorage.getItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT) || '0');
      if (spToken) {
        this.connections.spotify.accessToken = spToken;
      }
      if (spRefresh) {
        this.connections.spotify.refreshToken = spRefresh;
      }
      if (spClientId) {
        this.connections.spotify.clientId = spClientId;
      }
      if (spExpires) {
        this.connections.spotify.expiresAt = spExpires;
      }

      localStorage.setItem(SPOTIFY_STORAGE_KEYS.MUSIC_CONNECTIONS, JSON.stringify(this.connections));
      if (this.connections.spotify.connected && this.connections.spotify.accountName) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER, this.connections.spotify.accountName);
      }
    } catch {}
    this.notifyConnectionListeners();
    this.notifyListeners();
  }

  public getConnectionsConfig(): MusicConnectionsConfig {
    return {
      activePlatform: this.connections.activePlatform,
      spotify: { ...this.connections.spotify },
      youtube_music: { ...this.connections.youtube_music },
      apple_music: { ...this.connections.apple_music },
    };
  }

  public syncFromProfile(profileConnections?: MusicConnectionsConfig) {
    if (!profileConnections) return;

    // Restore Spotify tokens from Firestore profile if missing locally
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (profileConnections.spotify?.accessToken && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN, profileConnections.spotify.accessToken);
      }
      if (profileConnections.spotify?.refreshToken && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN, profileConnections.spotify.refreshToken);
      }
      if (profileConnections.spotify?.clientId && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID, profileConnections.spotify.clientId);
      }
      if (profileConnections.spotify?.expiresAt && !localStorage.getItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT)) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT, String(profileConnections.spotify.expiresAt));
      }
    }

    this.connections = {
      activePlatform: profileConnections.activePlatform || this.connections.activePlatform || 'spotify',
      spotify: {
        connected: Boolean(profileConnections.spotify?.connected || this.connections.spotify.connected || this.getAccessToken()),
        accountName: profileConnections.spotify?.accountName || this.connections.spotify.accountName || '',
        customPlaylistUrl: profileConnections.spotify?.customPlaylistUrl || this.connections.spotify.customPlaylistUrl || '',
        customTrackTitle: profileConnections.spotify?.customTrackTitle || this.connections.spotify.customTrackTitle || '',
        customArtistName: profileConnections.spotify?.customArtistName || this.connections.spotify.customArtistName || '',
        connectedAt: profileConnections.spotify?.connectedAt || this.connections.spotify.connectedAt,
        accessToken: profileConnections.spotify?.accessToken || this.connections.spotify.accessToken,
        refreshToken: profileConnections.spotify?.refreshToken || this.connections.spotify.refreshToken,
        expiresAt: profileConnections.spotify?.expiresAt || this.connections.spotify.expiresAt,
        clientId: profileConnections.spotify?.clientId || this.connections.spotify.clientId,
      },
      youtube_music: {
        connected: Boolean(profileConnections.youtube_music?.connected || this.connections.youtube_music.connected),
        accountName: profileConnections.youtube_music?.accountName || this.connections.youtube_music.accountName || '',
        customPlaylistUrl: profileConnections.youtube_music?.customPlaylistUrl || this.connections.youtube_music.customPlaylistUrl || '',
        customTrackTitle: profileConnections.youtube_music?.customTrackTitle || this.connections.youtube_music.customTrackTitle || '',
        customArtistName: profileConnections.youtube_music?.customArtistName || this.connections.youtube_music.customArtistName || '',
        connectedAt: profileConnections.youtube_music?.connectedAt || this.connections.youtube_music.connectedAt,
        accessToken: profileConnections.youtube_music?.accessToken || this.connections.youtube_music.accessToken,
      },
      apple_music: {
        connected: Boolean(profileConnections.apple_music?.connected || this.connections.apple_music.connected),
        accountName: profileConnections.apple_music?.accountName || this.connections.apple_music.accountName || '',
        customPlaylistUrl: profileConnections.apple_music?.customPlaylistUrl || this.connections.apple_music.customPlaylistUrl || '',
        customTrackTitle: profileConnections.apple_music?.customTrackTitle || this.connections.apple_music.customTrackTitle || '',
        customArtistName: profileConnections.apple_music?.customArtistName || this.connections.apple_music.customArtistName || '',
        connectedAt: profileConnections.apple_music?.connectedAt || this.connections.apple_music.connectedAt,
      },
    };

    if (this.connections.youtube_music.accessToken && this.platformQueues.youtube_music.length === 0) {
      this.fetchYouTubeMusicUserTracks(this.connections.youtube_music.accessToken);
    }
    if (this.getAccessToken()) {
      this.pollSpotifyNowPlaying();
    }

    this.saveConnectionsToStorage();
  }

  public getActivePlatform(): MusicPlatform {
    return this.connections.activePlatform || 'spotify';
  }

  public setActivePlatform(platform: MusicPlatform, autoPlay = false) {
    this.connections.activePlatform = platform;
    this.saveConnectionsToStorage();
    if (autoPlay) {
      if (platform === 'spotify' && this.getAccessToken()) {
        this.spotifyPlay();
      } else {
        this.playStream();
      }
    } else {
      this.notifyListeners();
    }
  }

  public connectPlatform(
    platform: MusicPlatform,
    options?: {
      accountName?: string;
      customPlaylistUrl?: string;
      customTrackTitle?: string;
      customArtistName?: string;
      makeActive?: boolean;
      accessToken?: string;
    }
  ): MusicConnectionsConfig {
    const meta = PLATFORM_METADATA[platform];
    const current = this.connections[platform];

    this.connections[platform] = {
      ...current,
      connected: true,
      accountName: options?.accountName?.trim() || current.accountName || `${meta.name} Hesabı`,
      customPlaylistUrl:
        options?.customPlaylistUrl?.trim() || current.customPlaylistUrl || meta.externalAppUrl,
      customTrackTitle:
        options?.customTrackTitle !== undefined
          ? options.customTrackTitle.trim()
          : current.customTrackTitle || '',
      customArtistName:
        options?.customArtistName !== undefined
          ? options.customArtistName.trim()
          : current.customArtistName || '',
      accessToken: options?.accessToken || current.accessToken,
      connectedAt: Date.now(),
    };

    if (options?.makeActive !== false) {
      this.connections.activePlatform = platform;
    }

    this.saveConnectionsToStorage();
    return this.getConnectionsConfig();
  }

  public disconnectPlatform(platform: MusicPlatform): MusicConnectionsConfig {
    if (platform === 'spotify') {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT);
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER);
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER);
      }
      this.lastLiveTrack = null;
    }

    if (platform === 'youtube_music' && this.ytPlayer && this.ytPlayerReady) {
      try {
        this.ytPlayer.stopVideo();
      } catch {}
    }

    this.connections[platform] = {
      connected: false,
      accountName: '',
      customPlaylistUrl: '',
      customTrackTitle: '',
      customArtistName: '',
      accessToken: undefined,
      refreshToken: undefined,
    };

    if (this.connections.activePlatform === platform) {
      const order: MusicPlatform[] = ['spotify', 'youtube_music', 'apple_music'];
      const nextConnected = order.find((p) => this.isPlatformConnected(p));
      if (nextConnected) {
        this.connections.activePlatform = nextConnected;
      }
      if (this.isStreamPlaying) {
        this.pauseStream();
      }
    }

    this.saveConnectionsToStorage();
    return this.getConnectionsConfig();
  }

  public isPlatformConnected(platform: MusicPlatform): boolean {
    if (platform === 'spotify') {
      return Boolean(this.getAccessToken()) || Boolean(this.connections.spotify.connected);
    }
    return Boolean(this.connections[platform]?.connected);
  }

  public hasSpotifyLiveToken(): boolean {
    return Boolean(this.getAccessToken() || localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN));
  }

  public isAnyPlatformConnected(): boolean {
    return (
      this.isPlatformConnected('spotify') ||
      this.isPlatformConnected('youtube_music') ||
      this.isPlatformConnected('apple_music')
    );
  }

  /**
   * Automatically detects which music platform is actively playing or connected.
   */
  public getDetectedPlatform(): MusicPlatform | null {
    // 1. If Spotify live Web API is actively playing a track right now, prioritize Spotify immediately
    if (this.lastLiveTrack?.isPlaying && this.isPlatformConnected('spotify')) {
      return 'spotify';
    }

    // 2. If activePlatform is connected, return it
    const active = this.connections.activePlatform;
    if (active && this.isPlatformConnected(active)) {
      return active;
    }

    // 3. Otherwise pick the most recently connected platform
    const platforms: MusicPlatform[] = ['spotify', 'youtube_music', 'apple_music'];
    const connectedList = platforms
      .filter((p) => this.isPlatformConnected(p))
      .sort((a, b) => (this.connections[b]?.connectedAt || 0) - (this.connections[a]?.connectedAt || 0));

    return connectedList.length > 0 ? connectedList[0] : null;
  }

  public getPlatformUserName(platform: MusicPlatform): string {
    const info = this.connections[platform];
    if (info?.accountName) return info.accountName;
    if (platform === 'spotify') {
      return (
        (typeof window !== 'undefined' ? localStorage.getItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER) : null) ||
        'Spotify Bağlı'
      );
    }
    return `${PLATFORM_METADATA[platform].name} Bağlı`;
  }

  public subscribeConnections(cb: (config: MusicConnectionsConfig) => void): () => void {
    this.connectionListeners.push(cb);
    cb(this.getConnectionsConfig());
    return () => {
      this.connectionListeners = this.connectionListeners.filter((x) => x !== cb);
    };
  }

  private notifyConnectionListeners() {
    const snapshot = this.getConnectionsConfig();
    this.connectionListeners.forEach((cb) => cb(snapshot));
  }

  // --- SPOTIFY AUTHENTICATION & TOKEN STORAGE ---

  public getSavedClientId(): string {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
    return (
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID) ||
      this.connections.spotify.clientId ||
      ''
    ).trim();
  }

  public setSavedClientId(clientId: string) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const clean = clientId.trim();
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID, clean);
    this.connections.spotify.clientId = clean;
  }

  public getAccessToken(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    const token =
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN) ||
      this.connections.spotify.accessToken ||
      null;
    const expiresAt = Number(
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT) ||
        this.connections.spotify.expiresAt ||
        '0'
    );
    if (token && (expiresAt === 0 || Date.now() < expiresAt)) {
      return token;
    }
    if (token && expiresAt > 0 && Date.now() >= expiresAt) {
      this.refreshAccessToken();
    }
    return token;
  }

  public isConnectedToSpotify(): boolean {
    return this.isPlatformConnected('spotify');
  }

  public getConnectedUserName(): string | null {
    return this.getPlatformUserName('spotify');
  }

  public disconnectSpotify() {
    this.disconnectPlatform('spotify');
  }

  public saveSuccessfulToken(
    token: string,
    userName: string,
    expiresInSec: number = 3600,
    refreshToken?: string
  ) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const expiresAt = Date.now() + expiresInSec * 1000;
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN, token);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER, userName);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
    if (refreshToken) {
      localStorage.setItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      this.connections.spotify.refreshToken = refreshToken;
    }
    this.connections.spotify.accessToken = token;
    this.connections.spotify.expiresAt = expiresAt;
    this.connectPlatform('spotify', {
      accountName: userName,
      accessToken: token,
      makeActive: true,
    });
  }

  public async setDirectAccessToken(
    rawInput: string
  ): Promise<{ success: boolean; error?: string; userName?: string }> {
    if (!rawInput || typeof rawInput !== 'string') {
      return { success: false, error: 'Lütfen geçerli bir kod veya token girin.' };
    }

    let cleanToken = rawInput.trim();
    if (cleanToken.includes('code=')) {
      return this.exchangeCodeOrUrl(cleanToken);
    }

    if (cleanToken.startsWith('{') && cleanToken.includes('access_token')) {
      try {
        const parsed = JSON.parse(cleanToken);
        if (parsed.access_token) {
          cleanToken = parsed.access_token;
        }
      } catch {}
    }

    cleanToken = cleanToken.replace(/^["']|["']$/g, '');
    cleanToken = cleanToken.replace(/^Bearer\s+/i, '');

    if (cleanToken.includes('access_token=')) {
      const match = cleanToken.match(/access_token=([^&/#\s]+)/);
      if (match && match[1]) {
        cleanToken = decodeURIComponent(match[1]);
      }
    }

    if (!cleanToken || cleanToken.length < 15) {
      return { success: false, error: 'Token çok kısa veya geçersiz formatta.' };
    }

    try {
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      if (meRes.ok) {
        const user = await meRes.json();
        const userName = user.display_name || user.id || 'Spotify Hesabı';
        this.saveSuccessfulToken(cleanToken, userName);
        await this.pollSpotifyNowPlaying();
        this.notifyListeners();
        return { success: true, userName };
      }

      const playerRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      if (playerRes.status === 200 || playerRes.status === 204) {
        this.saveSuccessfulToken(cleanToken, 'Spotify Kullanıcısı');
        await this.pollSpotifyNowPlaying();
        this.notifyListeners();
        return { success: true, userName: 'Spotify Kullanıcısı' };
      }

      if (meRes.status === 401 || playerRes.status === 401) {
        return {
          success: false,
          error: 'Spotify Token süresi dolmuş (401). Lütfen yeniden giriş yapın.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Spotify sunucusuna erişilemedi: ${err?.message || 'Ağ hatası'}`,
      };
    }

    return {
      success: false,
      error: 'Token doğrulanamadı.',
    };
  }

  public async startSpotifyLogin(clientId?: string, targetRedirectUri?: string) {
    if (typeof window === 'undefined') return;
    const cid = (clientId || this.getSavedClientId()).trim();
    if (!cid) return;

    this.setSavedClientId(cid);

    const codeVerifier = generateRandomString(64);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    }

    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = targetRedirectUri || getAppRedirectUri();
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.REDIRECT_URI, redirectUri);

    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-recently-played',
      'user-read-private',
      'user-read-email',
    ];
    const scope = encodeURIComponent(scopes.join(' '));

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(
      cid
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scope}&code_challenge_method=S256&code_challenge=${encodeURIComponent(
      codeChallenge
    )}&show_dialog=true`;

    const width = 520;
    const height = 720;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    window.open(
      authUrl,
      'spotify_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  }

  public async checkRedirectCode(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'SPOTIFY_AUTH_CODE', code }, '*');
          window.close();
          return true;
        } catch {}
      }

      const success = await this.exchangeCodeForToken(code);
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {}
      return success;
    }

    return false;
  }

  public async exchangeCodeOrUrl(
    input: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Lütfen geçerli bir kod veya token girin.' };
    }
    const raw = input.trim();

    if (
      raw.startsWith('BQ') ||
      raw.includes('access_token=') ||
      (!raw.includes('code=') && raw.length > 50 && !raw.includes('http') && !raw.includes(' '))
    ) {
      const directRes = await this.setDirectAccessToken(raw);
      if (directRes.success) return { success: true };
      if (directRes.error) return { success: false, error: directRes.error };
    }

    let code = raw;
    try {
      if (raw.includes('code=')) {
        const decoded = decodeURIComponent(raw);
        const match = decoded.match(/code=([^&/#\s]+)/) || raw.match(/code=([^&/#\s]+)/);
        if (match && match[1]) {
          code = match[1];
        }
      }
    } catch {}

    const success = await this.exchangeCodeForToken(code);
    if (success) return { success: true };

    const altRedirects = [
      `${window.location.origin}/auth/callback`,
      UNIVERSAL_SAFE_REDIRECT_URI,
      'https://open.spotify.com',
      window.location.origin,
      `${window.location.origin}/`,
    ];

    for (const alt of altRedirects) {
      const altSuccess = await this.exchangeCodeForToken(code, alt);
      if (altSuccess) return { success: true };
    }

    return {
      success: false,
      error: 'Kod doğrulanamadı. Lütfen yeniden giriş yapın veya doğrudan Token yapıştırın.',
    };
  }

  public async exchangeCodeForToken(code: string, overrideRedirectUri?: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const verifier =
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER) ||
      (typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER)
        : null) ||
      '';
    const cid = this.getSavedClientId();
    const redirectUri =
      overrideRedirectUri ||
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.REDIRECT_URI) ||
      `${window.location.origin}/auth/callback`;

    if (!cid || !code) return false;

    const body = new URLSearchParams();
    body.append('client_id', cid);
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', redirectUri);
    body.append('code_verifier', verifier);

    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.access_token) {
        this.saveSuccessfulToken(
          data.access_token,
          'Spotify Hesabı',
          data.expires_in || 3600,
          data.refresh_token
        );

        await this.fetchUserProfile(data.access_token);
        await this.pollSpotifyNowPlaying();
        this.notifyListeners();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  public async refreshAccessToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const refreshToken =
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN) ||
      this.connections.spotify.refreshToken;
    const cid = this.getSavedClientId();
    if (!refreshToken || !cid) return false;

    const body = new URLSearchParams();
    body.append('client_id', cid);
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refreshToken);

    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          this.saveSuccessfulToken(
            data.access_token,
            this.getConnectedUserName() || 'Spotify Hesabı',
            data.expires_in || 3600,
            data.refresh_token || refreshToken
          );
          return true;
        }
      }
    } catch {}
    return false;
  }

  private async fetchUserProfile(token?: string) {
    const t = token || this.getAccessToken();
    if (!t) return;
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const user = await res.json();
        const name = user.display_name || user.id || 'Spotify Hesabı';
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER, name);
        this.connectPlatform('spotify', { accountName: name, accessToken: t, makeActive: true });
      }
    } catch {}
  }

  // --- SPOTIFY LIVE PLAYBACK API (POLLS REAL CURRENTLY PLAYING & RECENTLY PLAYED) ---

  public async getSpotifyNowPlaying(): Promise<SpotifyTrack | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (res.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.getSpotifyNowPlaying();
        }
        return null;
      }

      if (res.status === 200) {
        const data = await res.json();
        if (data && data.item) {
          const item = data.item;
          const isPlayingNow = Boolean(data.is_playing);
          if (isPlayingNow && this.connections.activePlatform !== 'spotify') {
            this.connections.activePlatform = 'spotify';
            if (this.isStreamPlaying) {
              this.pauseStream();
            }
            this.saveConnectionsToStorage();
          }

          const track: SpotifyTrack = {
            id: item.id || 'spotify-live',
            name: item.name,
            artists: item.artists ? item.artists.map((a: any) => a.name) : ['Spotify Sanatçısı'],
            albumName: item.album ? item.album.name : 'Spotify',
            albumArt: item.album?.images?.[0]?.url || '',
            durationMs: item.duration_ms || 180000,
            progressMs: data.progress_ms || 0,
            isPlaying: isPlayingNow,
            source: 'spotify',
            externalUrl: item.external_urls?.spotify,
          };
          this.lastLiveTrack = track;
          return track;
        }
      }

      // If 204 No Content (paused or recently opened), check /v1/me/player or /v1/me/player/recently-played
      if (res.status === 204 || res.status === 404) {
        if (this.lastLiveTrack && this.lastLiveTrack.id !== 'spotify-idle') {
          this.lastLiveTrack = { ...this.lastLiveTrack, isPlaying: false };
          return this.lastLiveTrack;
        }

        // Fetch user's actual last played track from Spotify so it shows their real song
        try {
          const recentRes = await fetch(
            'https://api.spotify.com/v1/me/player/recently-played?limit=1',
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            }
          );
          if (recentRes.ok) {
            const recentData = await recentRes.json();
            const recentItem = recentData?.items?.[0]?.track;
            if (recentItem) {
              const recentTrack: SpotifyTrack = {
                id: recentItem.id || 'spotify-recent',
                name: recentItem.name,
                artists: recentItem.artists
                  ? recentItem.artists.map((a: any) => a.name)
                  : ['Spotify'],
                albumName: recentItem.album?.name || 'Spotify · Son Çalınan',
                albumArt: recentItem.album?.images?.[0]?.url || '',
                durationMs: recentItem.duration_ms || 180000,
                progressMs: 0,
                isPlaying: false,
                source: 'spotify',
                externalUrl: recentItem.external_urls?.spotify,
              };
              this.lastLiveTrack = recentTrack;
              return recentTrack;
            }
          }
        } catch {}

        const idleTrack: SpotifyTrack = {
          id: 'spotify-idle',
          name: 'Spotify Bağlı (Şarkı Bekleniyor)',
          artists: ['Spotify uygulamasından bir şarkı başlattığınızda anında buraya yansır'],
          albumName: 'Canlı Spotify Senkronizasyonu Aktif',
          albumArt: '',
          durationMs: 180000,
          progressMs: 0,
          isPlaying: false,
          source: 'spotify',
          externalUrl: 'https://open.spotify.com',
        };
        this.lastLiveTrack = idleTrack;
        return idleTrack;
      }

      return this.lastLiveTrack;
    } catch {
      return this.lastLiveTrack;
    }
  }

  // --- LIVE CONTROLS ON USER'S ACTIVE MUSIC PLATFORM ---

  public async spotifyPlay() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    if (active === 'spotify' && this.getAccessToken()) {
      if (this.lastLiveTrack) {
        this.lastLiveTrack = { ...this.lastLiveTrack, isPlaying: true };
        this.notifyListeners(this.lastLiveTrack);
      }
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyNowPlaying(), 150);
            setTimeout(() => this.pollSpotifyNowPlaying(), 500);
            return;
          }
        } catch {}
      }
    }
    this.playStream();
  }

  public async spotifyPause() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    if (this.isStreamPlaying) {
      this.pauseStream();
    }
    if (active === 'spotify' && this.getAccessToken()) {
      if (this.lastLiveTrack) {
        this.lastLiveTrack = { ...this.lastLiveTrack, isPlaying: false };
        this.notifyListeners(this.lastLiveTrack);
      }
      const token = this.getAccessToken();
      if (token) {
        try {
          await fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          });
          setTimeout(() => this.pollSpotifyNowPlaying(), 150);
        } catch {}
      }
    }
  }

  public async spotifyNext() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    if (active === 'spotify' && this.getAccessToken() && !this.isStreamPlaying) {
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyNowPlaying(), 150);
            setTimeout(() => this.pollSpotifyNowPlaying(), 500);
            return;
          }
        } catch {}
      }
    }
    this.nextStream();
  }

  public async spotifyPrevious() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    if (active === 'spotify' && this.getAccessToken() && !this.isStreamPlaying) {
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyNowPlaying(), 150);
            setTimeout(() => this.pollSpotifyNowPlaying(), 500);
            return;
          }
        } catch {}
      }
    }
    this.previousStream();
  }

  public async spotifySeek(positionMs: number) {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    if (active === 'spotify' && this.getAccessToken() && !this.isStreamPlaying) {
      if (this.lastLiveTrack) {
        this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: Math.floor(positionMs) };
        this.notifyListeners(this.lastLiveTrack);
      }
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch(
            `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok || res.status === 204) {
            setTimeout(() => this.pollSpotifyNowPlaying(), 150);
            return;
          }
        } catch {}
      }
    }
    this.seekStream(positionMs);
  }

  // --- AUDIO STREAM & PLATFORM-AWARE LIVE TRACK RESOLUTION ---

  public buildStreamTrackForPlatform(platform: MusicPlatform): SpotifyTrack {
    const queue = this.platformQueues[platform] || [];
    const idx = queue.length > 0 ? (this.platformIndices[platform] || 0) % queue.length : 0;
    const stream = queue[idx];
    const conn = this.connections[platform];
    const meta = PLATFORM_METADATA[platform];

    if (stream) {
      let progress = this.streamProgressMs;
      let duration = stream.durationMs || 180000;
      if (
        platform === 'youtube_music' &&
        stream.ytVideoId &&
        this.ytPlayer &&
        this.ytPlayerReady &&
        this.ytCurrentVideoId === stream.ytVideoId
      ) {
        try {
          const curSec = this.ytPlayer.getCurrentTime?.() || 0;
          const durSec = this.ytPlayer.getDuration?.() || 0;
          progress = Math.floor(curSec * 1000);
          if (durSec > 0) duration = Math.floor(durSec * 1000);
        } catch {}
      }

      return {
        id: stream.id,
        name: stream.name,
        artists: [stream.artist],
        albumName: stream.album,
        albumArt: stream.cover,
        durationMs: duration,
        progressMs: progress,
        isPlaying: this.isStreamPlaying,
        source: platform,
        externalUrl: stream.externalUrl || meta.externalAppUrl,
        ytVideoId: stream.ytVideoId,
      };
    }

    // If no track is queued yet for this connected platform, show real connected status (NEVER fake songs!)
    if (conn?.customTrackTitle) {
      return {
        id: `${platform}-custom`,
        name: conn.customTrackTitle,
        artists: [conn.customArtistName || meta.name],
        albumName: `${meta.name} Canlı Senkronizasyon`,
        albumArt: '',
        durationMs: 180000,
        progressMs: 0,
        isPlaying: false,
        source: platform,
        externalUrl: conn.customPlaylistUrl || meta.externalAppUrl,
      };
    }

    return {
      id: `${platform}-awaiting`,
      name: conn?.connected
        ? `${meta.name} Bağlı (Şarkı Bekleniyor)`
        : 'Müzik Başlatılmadı',
      artists: [
        conn?.connected
          ? `${meta.name} üzerinden bir şarkı açın veya aşağıdan senkronize edin`
          : 'Ayarlar > Bağlantılar sekmesinden müzik hesabınızı bağlayabilirsiniz',
      ],
      albumName: conn?.connected ? `${meta.name} · ${conn.accountName}` : '',
      albumArt: '',
      durationMs: 180000,
      progressMs: 0,
      isPlaying: false,
      source: platform,
      externalUrl: meta.externalAppUrl,
    };
  }

  public getCurrentTrack(): SpotifyTrack {
    const detected = this.getDetectedPlatform();
    const active = detected || this.connections.activePlatform || 'spotify';
    if (active === 'spotify' && this.lastLiveTrack) {
      return this.lastLiveTrack;
    }
    return this.buildStreamTrackForPlatform(active);
  }

  public toggleStreamPlay(): boolean {
    if (this.isStreamPlaying) {
      this.pauseStream();
      return false;
    } else {
      this.playStream();
      return true;
    }
  }

  public async playStream() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    const queue = this.platformQueues[active] || [];
    const idx = queue.length > 0 ? (this.platformIndices[active] || 0) % queue.length : 0;
    const targetTrack = queue[idx];

    if (!targetTrack) return;

    // If track has a YouTube Video ID, play full track via official YouTube IFrame Player
    if (targetTrack.ytVideoId) {
      if (this.audioEl && !this.audioEl.paused) {
        this.audioEl.pause();
      }
      const player = await this.ensureYouTubePlayer();
      if (player) {
        try {
          if (this.ytCurrentVideoId !== targetTrack.ytVideoId) {
            this.ytCurrentVideoId = targetTrack.ytVideoId;
            player.loadVideoById(targetTrack.ytVideoId);
          } else {
            player.playVideo();
          }
          this.isStreamPlaying = true;
          this.notifyListeners();
          return;
        } catch {}
      }
    }

    if (!this.audioEl || !targetTrack.audioUrl) return;
    if (!this.audioEl.src || !this.audioEl.src.includes(targetTrack.audioUrl)) {
      this.audioEl.src = targetTrack.audioUrl;
    }

    this.audioEl
      .play()
      .then(() => {
        this.isStreamPlaying = true;
        this.notifyListeners();
      })
      .catch(() => {
        this.isStreamPlaying = false;
        this.notifyListeners();
      });
  }

  public pauseStream() {
    if (this.ytPlayer && this.ytPlayerReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.isStreamPlaying = false;
    this.notifyListeners();
  }

  public nextStream() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    const queue = this.platformQueues[active] || [];
    if (queue.length === 0) return;
    this.platformIndices[active] = ((this.platformIndices[active] || 0) + 1) % queue.length;
    this.loadStreamTrack(active);
  }

  public previousStream() {
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    const queue = this.platformQueues[active] || [];
    if (queue.length === 0) return;
    this.platformIndices[active] =
      ((this.platformIndices[active] || 0) - 1 + queue.length) % queue.length;
    this.loadStreamTrack(active);
  }

  public seekStream(positionMs: number) {
    const sec = positionMs / 1000;
    const active = this.getDetectedPlatform() || this.connections.activePlatform || 'spotify';
    const queue = this.platformQueues[active] || [];
    const idx = queue.length > 0 ? (this.platformIndices[active] || 0) % queue.length : 0;
    const targetTrack = queue[idx];

    if (targetTrack?.ytVideoId && this.ytPlayer && this.ytPlayerReady) {
      try {
        this.ytPlayer.seekTo(sec, true);
      } catch {}
    } else if (this.audioEl) {
      try {
        this.audioEl.currentTime = sec;
      } catch {}
    }
    this.streamProgressMs = Math.floor(positionMs);
    this.notifyListeners();
  }

  private async loadStreamTrack(platform: MusicPlatform) {
    const queue = this.platformQueues[platform] || [];
    if (queue.length === 0) return;
    const idx = (this.platformIndices[platform] || 0) % queue.length;
    const stream = queue[idx];
    if (!stream) return;

    this.streamProgressMs = 0;
    if (stream.ytVideoId) {
      const player = await this.ensureYouTubePlayer();
      if (player) {
        this.ytCurrentVideoId = stream.ytVideoId;
        if (this.isStreamPlaying) {
          player.loadVideoById(stream.ytVideoId);
        } else {
          player.cueVideoById(stream.ytVideoId);
        }
      }
      this.notifyListeners();
      return;
    }

    if (!this.audioEl || !stream.audioUrl) return;
    this.audioEl.src = stream.audioUrl;
    if (this.isStreamPlaying) {
      this.audioEl.play().catch(() => {});
    }
    this.notifyListeners();
  }

  // --- ACTIVE LISTENER SUBSCRIPTION ---

  public subscribe(callback: (track: SpotifyTrack | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.getCurrentTrack());
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(customTrack?: SpotifyTrack) {
    const track = customTrack || this.getCurrentTrack();
    this.listeners.forEach((cb) => cb(track));
  }

  public async pollSpotifyNowPlaying(): Promise<SpotifyTrack | null> {
    if (this.getAccessToken()) {
      const spotifyTrack = await this.getSpotifyNowPlaying();
      if (spotifyTrack && (this.connections.activePlatform === 'spotify' || spotifyTrack.isPlaying)) {
        this.notifyListeners(spotifyTrack);
        return spotifyTrack;
      }
    }
    const current = this.getCurrentTrack();
    this.notifyListeners(current);
    return current;
  }
}

export const spotifyService = new SpotifyService();
