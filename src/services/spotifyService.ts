export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  albumName: string;
  albumArt: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  source: 'spotify' | 'focus_stream';
}

const SPOTIFY_STORAGE_KEYS = {
  ACCESS_TOKEN: 'fokus_spotify_access_token',
  REFRESH_TOKEN: 'fokus_spotify_refresh_token',
  EXPIRES_AT: 'fokus_spotify_expires_at',
  CLIENT_ID: 'fokus_spotify_client_id',
  CONNECTED_USER: 'fokus_spotify_connected_user',
  CODE_VERIFIER: 'fokus_spotify_code_verifier',
  REDIRECT_URI: 'fokus_spotify_redirect_uri',
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
  // In Google Cloud Run environments (*.run.app), external redirects in new tabs hit a 404 wall
  // Returning https://open.spotify.com/ guarantees the user never gets a 404 page!
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

// Built-in study background tracks
export const STUDY_STREAMS: {
  id: string;
  name: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  durationMs: number;
}[] = [
  {
    id: 'stream-debussy',
    name: 'Clair de Lune',
    artist: 'Claude Debussy',
    album: 'Suite bergamasque',
    cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=80',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg',
    durationMs: 304000,
  },
  {
    id: 'stream-beethoven',
    name: 'Moonlight Sonata (1st Movement)',
    artist: 'Ludwig van Beethoven',
    album: 'Sonata No. 14 in C-sharp minor',
    cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Beethoven_Moonlight_1st_movement.ogg',
    durationMs: 320000,
  },
  {
    id: 'stream-spring',
    name: 'The Four Seasons: Spring (Allegro)',
    artist: 'Antonio Vivaldi · John Harrison',
    album: 'Le quattro stagioni Op. 8',
    cover: 'https://images.unsplash.com/photo-1511295742362-92c96b124e52?w=500&auto=format&fit=crop&q=80',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Vivaldi_-_Four_Seasons_1_Spring_mvt_1_Allegro_-_John_Harrison_violin.oga',
    durationMs: 215000,
  },
  {
    id: 'stream-guitar',
    name: 'Solo Acoustic Guitar (Deep Focus)',
    artist: 'Jason Shaw',
    album: 'Audionautix Acoustic Series',
    cover: 'https://images.unsplash.com/photo-1520523839898-50712825e617?w=500&auto=format&fit=crop&q=80',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Jason_Shaw_-_SOLO_ACOUSTIC_GUITAR.ogg',
    durationMs: 191000,
  },
  {
    id: 'stream-winter',
    name: 'The Four Seasons: Winter (Allegro)',
    artist: 'Antonio Vivaldi · John Harrison',
    album: 'Le quattro stagioni Op. 8',
    cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/21/12_-_Vivaldi_Winter_mvt_3_Allegro_-_John_Harrison_violin.ogg',
    durationMs: 193000,
  },
];

class SpotifyService {
  private currentStreamIndex = 0;
  private audioEl: HTMLAudioElement | null = null;
  private isStreamPlaying = false;
  private streamProgressMs = 0;
  private listeners: ((track: SpotifyTrack | null) => void)[] = [];
  private lastLiveTrack: SpotifyTrack | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        this.audioEl = new Audio();
        this.audioEl.crossOrigin = 'anonymous';
        this.audioEl.preload = 'metadata';
        this.audioEl.src = STUDY_STREAMS[0].audioUrl;

        this.audioEl.addEventListener('timeupdate', () => {
          if (this.audioEl && !isNaN(this.audioEl.currentTime)) {
            this.streamProgressMs = Math.floor(this.audioEl.currentTime * 1000);
            if (!this.isConnectedToSpotify() || !this.lastLiveTrack) {
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
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN));
  }

  public getConnectedUserName(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    return localStorage.getItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER) || 'Spotify Hesabı';
  }

  public disconnectSpotify() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.CONNECTED_USER);
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER);
    }
    this.lastLiveTrack = null;
    this.notifyListeners();
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
  }

  /**
   * Sets and validates Spotify Access Token with maximum scope tolerance.
   * Handles raw tokens, JSON strings, URLs, Bearer prefixes, and quotes.
   */
  public async setDirectAccessToken(
    rawInput: string
  ): Promise<{ success: boolean; error?: string; userName?: string }> {
    if (!rawInput || typeof rawInput !== 'string') {
      return { success: false, error: 'Lütfen bir Access Token veya bağlantı linki girin.' };
    }

    let cleanToken = rawInput.trim();

    // If user pasted a URL with code=, automatically forward to code exchanger
    if (cleanToken.includes('code=')) {
      return this.exchangeCodeOrUrl(cleanToken);
    }

    // If user pasted a JSON string e.g. {"access_token": "..."}
    if (cleanToken.startsWith('{') && cleanToken.includes('access_token')) {
      try {
        const parsed = JSON.parse(cleanToken);
        if (parsed.access_token) {
          cleanToken = parsed.access_token;
        }
      } catch {}
    }

    // Strip quotes and Bearer
    cleanToken = cleanToken.replace(/^["']|["']$/g, '');
    cleanToken = cleanToken.replace(/^Bearer\s+/i, '');

    // Extract access_token parameter if a URL was pasted
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
      // Test 1: /v1/me (Profile endpoint)
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

      // Test 2: If /v1/me fails with 403 (due to lacking user-read-private scope),
      // test player endpoints directly!
      const playerRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      // 200 = track playing, 204 = connected but idle/paused. BOTH MEAN 100% VALID TOKEN!
      if (playerRes.status === 200 || playerRes.status === 204) {
        this.saveSuccessfulToken(cleanToken, 'Spotify Kullanıcısı');
        await this.pollSpotifyNowPlaying();
        this.notifyListeners();
        return { success: true, userName: 'Spotify Kullanıcısı' };
      }

      // Test 3: /v1/me/player
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
          error: 'Spotify Tokeninizin süresi dolmuş (401). Lütfen "Token Al" butonuna basarak yeni bir token alın.',
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

  /**
   * Starts Spotify Authorization Code Flow with PKCE.
   * Uses safe redirect URI to eliminate Google Cloud Run 404 error completely.
   */
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

    // response_type=code (strictly required by Spotify PKCE)
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

  /**
   * Checks if current URL has code parameter (?code=...) and exchanges it
   */
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

  /**
   * Exchanges code from direct string, token, or pasted redirected URL
   */
  public async exchangeCodeOrUrl(
    input: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Lütfen geçerli bir kod, token veya link girin.' };
    }
    const raw = input.trim();

    // If it's directly an access token
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

    // First try with stored redirect_uri
    const success = await this.exchangeCodeForToken(code);
    if (success) return { success: true };

    // Fallback attempts with all common redirect URIs
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
      error: 'Kod doğrulanamadı. Kodun süresi dolmuş olabilir (Spotify kodları 10 dakikada süresi biter). Lütfen Spotify ile tekrar izin verin.',
    };
  }

  /**
   * Exchanges authorization code for Access & Refresh tokens via Spotify Token API with PKCE
   */
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

  /**
   * Refreshes access token automatically using refresh_token
   */
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
      }
    } catch {}
  }

  // --- SPOTIFY LIVE PLAYBACK API (REAL USER SPOTIFY ACTIVITY) ---

  public async getSpotifyNowPlaying(): Promise<SpotifyTrack | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 204 No Content: user has Spotify open or connected, but nothing is currently playing
      if (res.status === 204 || res.status === 404) {
        const awaitingTrack: SpotifyTrack = {
          id: 'spotify-idle',
          name: 'Spotify Bağlı (Müzik Bekleniyor)',
          artists: ['Telefonunuzda veya bilgisayarınızda müzik açın'],
          albumName: 'Canlı Spotify Senkronizasyonu Aktif',
          albumArt: '',
          durationMs: 180000,
          progressMs: 0,
          isPlaying: false,
          source: 'spotify',
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
        const awaitingTrack: SpotifyTrack = {
          id: 'spotify-idle',
          name: 'Spotify Bağlı (Müzik Bekleniyor)',
          artists: ['Telefonunuzda veya bilgisayarınızda müzik açın'],
          albumName: 'Canlı Spotify Senkronizasyonu Aktif',
          albumArt: '',
          durationMs: 180000,
          progressMs: 0,
          isPlaying: false,
          source: 'spotify',
        };
        this.lastLiveTrack = awaitingTrack;
        return awaitingTrack;
      }

      const item = data.item;
      const track: SpotifyTrack = {
        id: item.id,
        name: item.name,
        artists: item.artists ? item.artists.map((a: any) => a.name) : ['Spotify Sanatçısı'],
        albumName: item.album ? item.album.name : '',
        albumArt: item.album?.images?.[0]?.url || '',
        durationMs: item.duration_ms || 180000,
        progressMs: data.progress_ms || 0,
        isPlaying: Boolean(data.is_playing),
        source: 'spotify',
      };
      this.lastLiveTrack = track;
      return track;
    } catch {
      return null;
    }
  }

  // --- LIVE CONTROLS ON USER'S SPOTIFY DEVICE ---

  public async spotifyPlay() {
    if (this.lastLiveTrack) {
      this.lastLiveTrack = { ...this.lastLiveTrack, isPlaying: true };
      this.notifyListeners(this.lastLiveTrack);
    }
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        setTimeout(() => this.pollSpotifyNowPlaying(), 150);
        setTimeout(() => this.pollSpotifyNowPlaying(), 500);
      } catch {}
    } else {
      this.playStream();
    }
  }

  public async spotifyPause() {
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
    } else {
      this.pauseStream();
    }
  }

  public async spotifyNext() {
    if (this.lastLiveTrack) {
      this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: 0, isPlaying: true };
      this.notifyListeners(this.lastLiveTrack);
    }
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch('https://api.spotify.com/v1/me/player/next', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        setTimeout(() => this.pollSpotifyNowPlaying(), 150);
        setTimeout(() => this.pollSpotifyNowPlaying(), 450);
        setTimeout(() => this.pollSpotifyNowPlaying(), 900);
      } catch {
        this.nextStream();
      }
    } else {
      this.nextStream();
    }
  }

  public async spotifyPrevious() {
    if (this.lastLiveTrack) {
      this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: 0, isPlaying: true };
      this.notifyListeners(this.lastLiveTrack);
    }
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch('https://api.spotify.com/v1/me/player/previous', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        setTimeout(() => this.pollSpotifyNowPlaying(), 150);
        setTimeout(() => this.pollSpotifyNowPlaying(), 450);
        setTimeout(() => this.pollSpotifyNowPlaying(), 900);
      } catch {
        this.previousStream();
      }
    } else {
      this.previousStream();
    }
  }

  public async spotifySeek(positionMs: number) {
    if (this.lastLiveTrack) {
      this.lastLiveTrack = { ...this.lastLiveTrack, progressMs: Math.floor(positionMs) };
      this.notifyListeners(this.lastLiveTrack);
    }
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        setTimeout(() => this.pollSpotifyNowPlaying(), 150);
        setTimeout(() => this.pollSpotifyNowPlaying(), 500);
      } catch {
        this.seekStream(positionMs);
      }
    } else {
      this.seekStream(positionMs);
    }
  }

  // --- AUDIO STREAM (FALLBACK WHEN SPOTIFY IS NOT CONNECTED) ---

  public getCurrentTrack(): SpotifyTrack {
    if (this.isConnectedToSpotify() && this.lastLiveTrack) {
      return this.lastLiveTrack;
    }
    const stream = STUDY_STREAMS[this.currentStreamIndex] || STUDY_STREAMS[0];
    return {
      id: stream.id,
      name: stream.name,
      artists: [stream.artist],
      albumName: stream.album,
      albumArt: stream.cover,
      durationMs: stream.durationMs,
      progressMs: this.streamProgressMs,
      isPlaying: this.isStreamPlaying,
      source: 'focus_stream',
    };
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
    if (this.isConnectedToSpotify()) {
      const spotifyTrack = await this.getSpotifyNowPlaying();
      if (spotifyTrack) {
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
