import { MusicPlatform, MusicConnectionsConfig, PlatformConnectionInfo } from '../types';

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
};

/**
 * Universal safe redirect URI that avoids Google Cloud Run 404 Page Not Found error
 */
export const UNIVERSAL_SAFE_REDIRECT_URI = 'https://open.spotify.com/';

/**
 * Returns safe redirect URI for Spotify Developer Dashboard registration
 */
export function getAppRedirectUri(): string {
  if (typeof window === 'undefined') return UNIVERSAL_SAFE_REDIRECT_URI;
  if (
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('googleusercontent.com')
  ) {
    return UNIVERSAL_SAFE_REDIRECT_URI;
  }
  const origin = window.location.origin;
  const path = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return `${origin}${path}`;
}

// PKCE Helper Functions (Spotify Authorization Code Flow with PKCE)
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((x) => possible[x % possible.length]).join('');
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

export interface StreamTrackItem {
  id: string;
  name: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  durationMs: number;
  platform?: MusicPlatform;
}

// Built-in study background tracks (reliable Wikimedia Commons OGG streams)
export const STUDY_STREAMS: StreamTrackItem[] = [
  {
    id: 'stream-debussy',
    name: 'Clair de Lune (Deep Focus Mix)',
    artist: 'Claude Debussy',
    album: 'Suite bergamasque · Focus Edition',
    cover: '',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg',
    durationMs: 304000,
    platform: 'spotify',
  },
  {
    id: 'stream-beethoven',
    name: 'Moonlight Sonata (Lo-Fi Study Session)',
    artist: 'Ludwig van Beethoven',
    album: 'Sonata No. 14 · Night Study',
    cover: '',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Beethoven_Moonlight_1st_movement.ogg',
    durationMs: 320000,
    platform: 'youtube_music',
  },
  {
    id: 'stream-spring',
    name: 'The Four Seasons: Spring (Allegro)',
    artist: 'Antonio Vivaldi · John Harrison',
    album: 'Classical Focus Essentials',
    cover: '',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Vivaldi_-_Four_Seasons_1_Spring_mvt_1_Allegro_-_John_Harrison_violin.oga',
    durationMs: 215000,
    platform: 'apple_music',
  },
  {
    id: 'stream-guitar',
    name: 'Solo Acoustic Guitar (Ambient Study)',
    artist: 'Jason Shaw',
    album: 'Acoustic Deep Work Sessions',
    cover: '',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Jason_Shaw_-_SOLO_ACOUSTIC_GUITAR.ogg',
    durationMs: 191000,
    platform: 'youtube_music',
  },
  {
    id: 'stream-winter',
    name: 'The Four Seasons: Winter (Concentration)',
    artist: 'Antonio Vivaldi · John Harrison',
    album: 'Pure Instrumental Focus',
    cover: '',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/21/12_-_Vivaldi_Winter_mvt_3_Allegro_-_John_Harrison_violin.ogg',
    durationMs: 193000,
    platform: 'apple_music',
  },
];

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
  }
> = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    shortName: 'Spotify',
    accentHex: '#1DB954',
    hoverHex: '#1ed760',
    textOnAccent: 'black',
    defaultPlaylistName: 'Spotify Deep Focus Playlist',
    externalAppUrl: 'https://open.spotify.com',
  },
  youtube_music: {
    id: 'youtube_music',
    name: 'YouTube Music',
    shortName: 'YT Music',
    accentHex: '#FF0033',
    hoverHex: '#ff1f4b',
    textOnAccent: 'white',
    defaultPlaylistName: 'YouTube Music Odak & Lo-Fi Mix',
    externalAppUrl: 'https://music.youtube.com',
  },
  apple_music: {
    id: 'apple_music',
    name: 'Apple Music',
    shortName: 'Apple Music',
    accentHex: '#FA243C',
    hoverHex: '#ff3b52',
    textOnAccent: 'white',
    defaultPlaylistName: 'Apple Music Pure Focus Essentials',
    externalAppUrl: 'https://music.apple.com',
  },
};

const DEFAULT_CONNECTIONS: MusicConnectionsConfig = {
  activePlatform: 'spotify',
  spotify: {
    connected: false,
    accountName: '',
  },
  youtube_music: {
    connected: false,
    accountName: '',
  },
  apple_music: {
    connected: false,
    accountName: '',
  },
};

class SpotifyService {
  private currentStreamIndex = 0;
  private audioEl: HTMLAudioElement | null = null;
  private isStreamPlaying = false;
  private streamProgressMs = 0;
  private listeners: ((track: SpotifyTrack | null) => void)[] = [];
  private connectionListeners: ((config: MusicConnectionsConfig) => void)[] = [];
  private lastLiveTrack: SpotifyTrack | null = null;
  private connections: MusicConnectionsConfig = { ...DEFAULT_CONNECTIONS };

  constructor() {
    this.loadConnectionsFromStorage();

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        this.audioEl = new Audio();
        this.audioEl.crossOrigin = 'anonymous';
        this.audioEl.preload = 'metadata';
        this.audioEl.src = STUDY_STREAMS[0].audioUrl;

        this.audioEl.addEventListener('timeupdate', () => {
          if (this.audioEl && !isNaN(this.audioEl.currentTime)) {
            this.streamProgressMs = Math.floor(this.audioEl.currentTime * 1000);
            if (this.connections.activePlatform !== 'spotify' || !this.lastLiveTrack) {
              this.notifyListeners();
            }
          }
        });

        this.audioEl.addEventListener('ended', () => {
          this.nextStream();
        });
      } catch {}

      // Cross-window OAuth listener
      window.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'SPOTIFY_AUTH_CODE' && event.data.code) {
          await this.exchangeCodeForToken(event.data.code);
        }
      });
    }
  }

  // --- MULTI-PLATFORM PERSISTENT CONNECTION STORAGE ---

  private loadConnectionsFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SPOTIFY_STORAGE_KEYS.MUSIC_CONNECTIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.connections = {
          activePlatform: parsed.activePlatform || 'spotify',
          spotify: {
            connected: Boolean(parsed.spotify?.connected),
            accountName: parsed.spotify?.accountName || '',
            customPlaylistUrl: parsed.spotify?.customPlaylistUrl || '',
            customTrackTitle: parsed.spotify?.customTrackTitle || '',
            customArtistName: parsed.spotify?.customArtistName || '',
            connectedAt: parsed.spotify?.connectedAt,
          },
          youtube_music: {
            connected: Boolean(parsed.youtube_music?.connected),
            accountName: parsed.youtube_music?.accountName || '',
            customPlaylistUrl: parsed.youtube_music?.customPlaylistUrl || '',
            customTrackTitle: parsed.youtube_music?.customTrackTitle || '',
            customArtistName: parsed.youtube_music?.customArtistName || '',
            connectedAt: parsed.youtube_music?.connectedAt,
          },
          apple_music: {
            connected: Boolean(parsed.apple_music?.connected),
            accountName: parsed.apple_music?.accountName || '',
            customPlaylistUrl: parsed.apple_music?.customPlaylistUrl || '',
            customTrackTitle: parsed.apple_music?.customTrackTitle || '',
            customArtistName: parsed.apple_music?.customArtistName || '',
            connectedAt: parsed.apple_music?.connectedAt,
          },
        };
      }

      // Ensure backwards compatibility if user already had a Spotify token or connected user saved
      const legacySpotifyUser = localStorage.getItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER);
      const legacySpotifyToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
      if ((legacySpotifyUser || legacySpotifyToken) && !this.connections.spotify.connected) {
        this.connections.spotify = {
          ...this.connections.spotify,
          connected: true,
          accountName: legacySpotifyUser || 'Spotify Hesabı',
          connectedAt: Date.now(),
        };
        this.saveConnectionsToStorage();
      }
    } catch {}
  }

  private saveConnectionsToStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
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
    const merged: MusicConnectionsConfig = {
      activePlatform: profileConnections.activePlatform || this.connections.activePlatform || 'spotify',
      spotify: {
        connected: Boolean(profileConnections.spotify?.connected || this.connections.spotify.connected),
        accountName: profileConnections.spotify?.accountName || this.connections.spotify.accountName || '',
        customPlaylistUrl: profileConnections.spotify?.customPlaylistUrl || this.connections.spotify.customPlaylistUrl || '',
        customTrackTitle: profileConnections.spotify?.customTrackTitle || this.connections.spotify.customTrackTitle || '',
        customArtistName: profileConnections.spotify?.customArtistName || this.connections.spotify.customArtistName || '',
        connectedAt: profileConnections.spotify?.connectedAt || this.connections.spotify.connectedAt,
      },
      youtube_music: {
        connected: Boolean(profileConnections.youtube_music?.connected || this.connections.youtube_music.connected),
        accountName: profileConnections.youtube_music?.accountName || this.connections.youtube_music.accountName || '',
        customPlaylistUrl: profileConnections.youtube_music?.customPlaylistUrl || this.connections.youtube_music.customPlaylistUrl || '',
        customTrackTitle: profileConnections.youtube_music?.customTrackTitle || this.connections.youtube_music.customTrackTitle || '',
        customArtistName: profileConnections.youtube_music?.customArtistName || this.connections.youtube_music.customArtistName || '',
        connectedAt: profileConnections.youtube_music?.connectedAt || this.connections.youtube_music.connectedAt,
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
    this.connections = merged;
    this.saveConnectionsToStorage();
  }

  public getActivePlatform(): MusicPlatform {
    return this.connections.activePlatform;
  }

  public setActivePlatform(platform: MusicPlatform, autoPlay = false) {
    this.connections.activePlatform = platform;
    if (platform !== 'spotify') {
      // Pick a stream matching or suited for this platform
      const idx = STUDY_STREAMS.findIndex((s) => s.platform === platform);
      if (idx >= 0 && this.currentStreamIndex !== idx && !this.isStreamPlaying) {
        this.currentStreamIndex = idx;
        if (this.audioEl) {
          this.audioEl.src = STUDY_STREAMS[idx].audioUrl;
        }
      }
    }
    this.saveConnectionsToStorage();
    if (autoPlay) {
      if (platform === 'spotify' && this.getAccessToken()) {
        this.spotifyPlay();
      } else {
        this.playStream();
      }
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
    }
  ): MusicConnectionsConfig {
    const meta = PLATFORM_METADATA[platform];
    const current = this.connections[platform];
    const cleanUrl = options?.customPlaylistUrl?.trim() || current.customPlaylistUrl || '';
    let derivedTrackTitle = options?.customTrackTitle?.trim() || current.customTrackTitle || '';
    let derivedArtist = options?.customArtistName?.trim() || current.customArtistName || '';

    if (cleanUrl && !derivedTrackTitle) {
      if (platform === 'youtube_music') {
        derivedTrackTitle = 'YouTube Music Odak İstasyonu';
        derivedArtist = options?.accountName?.trim() || 'YouTube Music Mix';
      } else if (platform === 'apple_music') {
        derivedTrackTitle = 'Apple Music Odak Listesi';
        derivedArtist = options?.accountName?.trim() || 'Apple Music Pure Focus';
      } else {
        derivedTrackTitle = 'Spotify Çalışma Listesi';
        derivedArtist = options?.accountName?.trim() || 'Spotify Focus';
      }
    }

    this.connections[platform] = {
      connected: true,
      accountName: options?.accountName?.trim() || current.accountName || `${meta.name} Hesabı`,
      customPlaylistUrl: cleanUrl,
      customTrackTitle: derivedTrackTitle,
      customArtistName: derivedArtist,
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

    this.connections[platform] = {
      connected: false,
      accountName: '',
      customPlaylistUrl: '',
      customTrackTitle: '',
      customArtistName: '',
    };

    // If activePlatform was disconnected, switch to another connected platform if any
    if (this.connections.activePlatform === platform) {
      const order: MusicPlatform[] = ['spotify', 'youtube_music', 'apple_music'];
      const nextConnected = order.find((p) => this.connections[p].connected);
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
      return this.connections.spotify.connected || Boolean(this.getAccessToken());
    }
    return Boolean(this.connections[platform]?.connected);
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
    // 1. If Spotify live API is actively playing a track right now
    if (this.lastLiveTrack?.isPlaying && this.isPlatformConnected('spotify')) {
      return 'spotify';
    }

    // 2. If activePlatform is connected, use it
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

  public getAccessToken(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAt = Number(localStorage.getItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT) || '0');
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

  public saveSuccessfulToken(token: string, userName: string, expiresInSec: number = 3600, refreshToken?: string) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN, token);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER, userName);
    localStorage.setItem(
      SPOTIFY_STORAGE_KEYS.EXPIRES_AT,
      String(Date.now() + expiresInSec * 1000)
    );
    if (refreshToken) {
      localStorage.setItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
    this.connectPlatform('spotify', { accountName: userName, makeActive: true });
  }

  public async setDirectAccessToken(
    rawInput: string
  ): Promise<{ success: boolean; error?: string; userName?: string }> {
    if (!rawInput || typeof rawInput !== 'string') {
      return { success: false, error: 'Lütfen bir Access Token veya bağlantı linki girin.' };
    }

    let cleanToken = rawInput.trim();

    if (cleanToken.includes('code=')) {
      return this.exchangeCodeOrUrl(cleanToken);
    }

    // If user pasted an open.spotify.com playlist/track link or account name directly:
    if (cleanToken.includes('open.spotify.com/')) {
      this.connectPlatform('spotify', {
        accountName: 'Spotify Hesabı',
        customPlaylistUrl: cleanToken,
        makeActive: true,
      });
      return { success: true, userName: 'Spotify Hesabı' };
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

      const playerStateRes = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });
      if (playerStateRes.status === 200 || playerStateRes.status === 204) {
        this.saveSuccessfulToken(cleanToken, 'Spotify Kullanıcısı');
        await this.pollSpotifyNowPlaying();
        this.notifyListeners();
        return { success: true, userName: 'Spotify Kullanıcısı' };
      }

      if (meRes.status === 401 || playerRes.status === 401) {
        return {
          success: false,
          error: 'Spotify Tokeninizin süresi dolmuş (401). Lütfen yeni bir token alın veya Hızlı Bağlantı kullanın.',
        };
      }

      if (playerRes.status === 403) {
        return {
          success: false,
          error: 'Token yetkisi yetersiz. Token alırken "user-read-currently-playing" ve "user-read-playback-state" izinlerini işaretleyin.',
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
      error: 'Token doğrulanamadı. Lütfen geçerli bir Spotify Access Token girdiğinizden emin olun.',
    };
  }

  public async startSpotifyLogin(clientId?: string, targetRedirectUri?: string) {
    if (typeof window === 'undefined') return;
    const cid = (clientId || localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID) || '').trim();
    if (!cid) return;

    localStorage.setItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID, cid);

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

    const popup = window.open(authUrl, '_blank', 'width=520,height=720');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = authUrl;
    }
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

    const hash = window.location.hash;
    if (hash && hash.includes('code=')) {
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
      const hashCode = hashParams.get('code');
      if (hashCode) {
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_CODE', code: hashCode }, '*');
            window.close();
            return true;
          } catch {}
        }
        const success = await this.exchangeCodeForToken(hashCode);
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
        return success;
      }
    }

    return false;
  }

  public async exchangeCodeOrUrl(
    input: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Lütfen geçerli bir kod, token veya link girin.' };
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
      UNIVERSAL_SAFE_REDIRECT_URI,
      'https://open.spotify.com',
      getAppRedirectUri(),
      getAppRedirectUri().replace(/\/$/, ''),
      'http://localhost:3000/',
      'http://localhost:3000',
      'http://127.0.0.1:3000/',
      typeof window !== 'undefined' ? window.location.origin : '',
    ].filter(Boolean);

    for (const alt of altRedirects) {
      const altSuccess = await this.exchangeCodeForToken(code, alt);
      if (altSuccess) return { success: true };
    }

    return {
      success: false,
      error: 'Kod doğrulanamadı. Kodun süresi dolmuş olabilir (Spotify kodları 10 dakikada süresi biter).',
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
    const cid = (localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID) || '').trim();
    const redirectUri =
      overrideRedirectUri ||
      localStorage.getItem(SPOTIFY_STORAGE_KEYS.REDIRECT_URI) ||
      UNIVERSAL_SAFE_REDIRECT_URI;

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

      if (!res.ok) {
        return false;
      }

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
    const refreshToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN);
    const cid = (localStorage.getItem(SPOTIFY_STORAGE_KEYS.CLIENT_ID) || '').trim();
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
        this.connectPlatform('spotify', { accountName: name, makeActive: false });
      }
    } catch {}
  }

  // --- SPOTIFY LIVE PLAYBACK API ---

  public async getSpotifyNowPlaying(): Promise<SpotifyTrack | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 204 || res.status === 404) {
        if (this.isStreamPlaying && this.connections.activePlatform === 'spotify') {
          return this.buildStreamTrackForPlatform('spotify');
        }
        const awaitingTrack: SpotifyTrack = {
          id: 'spotify-idle',
          name: this.connections.spotify.customTrackTitle || 'Spotify Bağlı (Müzik Hazır)',
          artists: [this.connections.spotify.customArtistName || 'Oynat tuşuna basın veya Spotify uygulamasından başlatın'],
          albumName: 'Canlı Spotify Senkronizasyonu Aktif',
          albumArt: '',
          durationMs: 180000,
          progressMs: 0,
          isPlaying: false,
          source: 'spotify',
          externalUrl: this.connections.spotify.customPlaylistUrl,
        };
        this.lastLiveTrack = awaitingTrack;
        return awaitingTrack;
      }

      if (res.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.getSpotifyNowPlaying();
        }
        return null;
      }

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (!data || !data.item) {
        return null;
      }

      const item = data.item;
      const isPlayingNow = Boolean(data.is_playing);
      if (isPlayingNow && this.connections.activePlatform !== 'spotify') {
        // Automatically detect that Spotify started playing!
        this.connections.activePlatform = 'spotify';
        if (this.isStreamPlaying) {
          this.pauseStream();
        }
        this.saveConnectionsToStorage();
      }

      const track: SpotifyTrack = {
        id: item.id,
        name: item.name,
        artists: item.artists ? item.artists.map((a: any) => a.name) : ['Spotify Sanatçısı'],
        albumName: item.album ? item.album.name : '',
        albumArt: item.album?.images?.[0]?.url || '',
        durationMs: item.duration_ms || 180000,
        progressMs: data.progress_ms || 0,
        isPlaying: isPlayingNow,
        source: 'spotify',
        externalUrl: item.external_urls?.spotify,
      };
      this.lastLiveTrack = track;
      return track;
    } catch {
      return null;
    }
  }

  // --- LIVE CONTROLS ON USER'S ACTIVE MUSIC PLATFORM ---

  public async spotifyPlay() {
    const active = this.connections.activePlatform;
    if (active === 'spotify' && this.getAccessToken()) {
      if (this.lastLiveTrack && this.lastLiveTrack.id !== 'spotify-idle') {
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
          if (!res.ok) {
            this.playStream();
            return;
          }
          setTimeout(() => this.pollSpotifyNowPlaying(), 150);
          setTimeout(() => this.pollSpotifyNowPlaying(), 500);
          return;
        } catch {
          this.playStream();
          return;
        }
      }
    }
    this.playStream();
  }

  public async spotifyPause() {
    const active = this.connections.activePlatform;
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
          setTimeout(() => this.pollSpotifyNowPlaying(), 500);
        } catch {}
      }
    }
  }

  public async spotifyNext() {
    const active = this.connections.activePlatform;
    if (active === 'spotify' && this.getAccessToken() && !this.isStreamPlaying) {
      if (this.lastLiveTrack) {
        this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: 0, isPlaying: true };
        this.notifyListeners(this.lastLiveTrack);
      }
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            this.nextStream();
            return;
          }
          setTimeout(() => this.pollSpotifyNowPlaying(), 150);
          setTimeout(() => this.pollSpotifyNowPlaying(), 450);
          setTimeout(() => this.pollSpotifyNowPlaying(), 900);
          return;
        } catch {
          this.nextStream();
          return;
        }
      }
    }
    this.nextStream();
  }

  public async spotifyPrevious() {
    const active = this.connections.activePlatform;
    if (active === 'spotify' && this.getAccessToken() && !this.isStreamPlaying) {
      if (this.lastLiveTrack) {
        this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: 0, isPlaying: true };
        this.notifyListeners(this.lastLiveTrack);
      }
      const token = this.getAccessToken();
      if (token) {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            this.previousStream();
            return;
          }
          setTimeout(() => this.pollSpotifyNowPlaying(), 150);
          setTimeout(() => this.pollSpotifyNowPlaying(), 450);
          setTimeout(() => this.pollSpotifyNowPlaying(), 900);
          return;
        } catch {
          this.previousStream();
          return;
        }
      }
    }
    this.previousStream();
  }

  public async spotifySeek(positionMs: number) {
    const active = this.connections.activePlatform;
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
          if (!res.ok) {
            this.seekStream(positionMs);
            return;
          }
          setTimeout(() => this.pollSpotifyNowPlaying(), 150);
          setTimeout(() => this.pollSpotifyNowPlaying(), 500);
          return;
        } catch {
          this.seekStream(positionMs);
          return;
        }
      }
    }
    this.seekStream(positionMs);
  }

  // --- AUDIO STREAM & PLATFORM-AWARE TRACK RESOLUTION ---

  private buildStreamTrackForPlatform(platform: MusicPlatform): SpotifyTrack {
    const stream = STUDY_STREAMS[this.currentStreamIndex] || STUDY_STREAMS[0];
    const conn = this.connections[platform];
    const meta = PLATFORM_METADATA[platform];

    const customTitle = conn?.customTrackTitle;
    const customArtist = conn?.customArtistName;

    return {
      id: `${platform}-${stream.id}`,
      name: customTitle && this.currentStreamIndex === 0 ? customTitle : stream.name,
      artists: [customArtist && this.currentStreamIndex === 0 ? customArtist : stream.artist],
      albumName: conn?.connected ? `${meta.name} · ${stream.album}` : stream.album,
      albumArt: stream.cover,
      durationMs: stream.durationMs,
      progressMs: this.streamProgressMs,
      isPlaying: this.isStreamPlaying,
      source: platform,
      externalUrl: conn?.customPlaylistUrl || meta.externalAppUrl,
    };
  }

  public getCurrentTrack(): SpotifyTrack {
    const detected = this.getDetectedPlatform();
    const active = detected || this.connections.activePlatform || 'spotify';
    if (
      active === 'spotify' &&
      this.getAccessToken() &&
      this.lastLiveTrack &&
      (!this.isStreamPlaying || this.lastLiveTrack.isPlaying)
    ) {
      return this.lastLiveTrack;
    }
    return this.buildStreamTrackForPlatform(active);
  }

  public toggleStreamPlay(): boolean {
    if (!this.audioEl) return false;
    if (this.isStreamPlaying) {
      this.pauseStream();
      return false;
    } else {
      this.playStream();
      return true;
    }
  }

  public playStream() {
    if (!this.audioEl) return;
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
    if (!this.audioEl) return;
    this.audioEl.pause();
    this.isStreamPlaying = false;
    this.notifyListeners();
  }

  public nextStream() {
    this.currentStreamIndex = (this.currentStreamIndex + 1) % STUDY_STREAMS.length;
    this.loadStreamTrack();
  }

  public previousStream() {
    this.currentStreamIndex = (this.currentStreamIndex - 1 + STUDY_STREAMS.length) % STUDY_STREAMS.length;
    this.loadStreamTrack();
  }

  public seekStream(positionMs: number) {
    if (!this.audioEl) return;
    const sec = positionMs / 1000;
    this.audioEl.currentTime = sec;
    this.streamProgressMs = Math.floor(positionMs);
    this.notifyListeners();
  }

  private loadStreamTrack() {
    if (!this.audioEl) return;
    const stream = STUDY_STREAMS[this.currentStreamIndex];
    this.audioEl.src = stream.audioUrl;
    this.streamProgressMs = 0;
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
