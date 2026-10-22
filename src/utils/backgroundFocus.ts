// Background Focus Persistence, Pure Black PiP Capsule, Live Notification & Lock-Screen MediaSession Engine

const DEVICE_ID_KEY = 'fokus_device_id_v1';
const TERMINATED_STARTS_KEY = 'fokus_terminated_session_starts_v1';
const LAST_TERMINATED_AT_KEY = 'fokus_last_completed_at';

/**
 * Permanently marks a focus session as terminated (completed or abandoned)
 * and removes any running session state from localStorage so it can never reappear on refresh.
 */
export function markSessionTerminated(startTime?: number): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    localStorage.setItem(LAST_TERMINATED_AT_KEY, String(now));
    localStorage.removeItem('fokus_active_session_running');

    if (typeof startTime === 'number' && startTime > 0) {
      const raw = localStorage.getItem(TERMINATED_STARTS_KEY);
      const list: number[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(startTime)) {
        const next = [startTime, ...list].slice(0, 60);
        localStorage.setItem(TERMINATED_STARTS_KEY, JSON.stringify(next));
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Checks whether a focus session with the given startTime has already been completed or abandoned.
 */
export function isSessionTerminated(startTime?: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof startTime === 'number' && startTime > 0) {
      const raw = localStorage.getItem(TERMINATED_STARTS_KEY);
      if (raw) {
        const list: number[] = JSON.parse(raw);
        if (Array.isArray(list) && list.includes(startTime)) {
          return true;
        }
      }
      const lastTerm = Number(localStorage.getItem(LAST_TERMINATED_AT_KEY) || 0);
      if (lastTerm > 0 && startTime <= lastTerm) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_fallback';
  }
}

export function getDeviceName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Cihaz';
  const ua = navigator.userAgent.toLowerCase();
  const isIPad = /ipad/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIPad) return 'iPad / Tablet';
  if (/iphone|ipod/.test(ua)) return 'iPhone';
  if (/android/.test(ua)) {
    if (!/mobile/.test(ua)) return 'Android Tablet';
    return 'Android Telefon';
  }
  if (/tablet|playbook|silk/.test(ua)) return 'Tablet';
  if (/mobile/.test(ua)) return 'Telefon';
  return 'Bilgisayar (PC)';
}

export interface LiveNotificationPayload {
  mode: string;
  modeLabel: string;
  subjectName: string;
  taskTitle?: string;
  timerType: 'countdown' | 'stopwatch';
  plannedMinutes: number;
  anchorTimestamp: number;
  accumulatedFocusSeconds: number;
  breakAnchorTimestamp: number;
  accumulatedBreakSeconds: number;
  isPaused: boolean;
  isCampActive: boolean;
  forceShow?: boolean;
}

export function formatTimerDisplay(totalSecs: number): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildProgressBar(percent: number): string {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const totalBlocks = 10;
  const filled = Math.round((clamped / 100) * totalBlocks);
  return `${'▓'.repeat(filled)}${'░'.repeat(Math.max(0, totalBlocks - filled))} %${clamped}`;
}

export function computeDisplayTimeFromPayload(payload: LiveNotificationPayload): {
  timeFormatted: string;
  elapsedFocus: number;
  elapsedBreak: number;
  remainingSecs: number;
  progressPct: number;
} {
  const now = Date.now();
  const elapsedFocus =
    payload.isPaused || payload.isCampActive
      ? payload.accumulatedFocusSeconds
      : payload.accumulatedFocusSeconds +
        Math.max(0, Math.floor((now - payload.anchorTimestamp) / 1000));

  const elapsedBreak =
    !payload.isCampActive || payload.isPaused
      ? payload.accumulatedBreakSeconds
      : payload.accumulatedBreakSeconds +
        Math.max(0, Math.floor((now - payload.breakAnchorTimestamp) / 1000));

  const totalPlannedSecs = Math.max(60, payload.plannedMinutes * 60);
  const remainingSecs = Math.max(0, totalPlannedSecs - elapsedFocus);
  const progressPct = Math.min(100, Math.round((elapsedFocus / totalPlannedSecs) * 100));

  const activeSecs = payload.isCampActive
    ? elapsedBreak
    : payload.timerType === 'stopwatch'
    ? elapsedFocus
    : remainingSecs;

  return {
    timeFormatted: formatTimerDisplay(activeSecs),
    elapsedFocus,
    elapsedBreak,
    remainingSecs,
    progressPct,
  };
}

// Pure Black 96x96 Circle Icon Generator (eliminates the orange "F" app icon in notifications)
let cachedBlackIconDataUrl: string | null = null;
function getPureBlackIconDataUrl(): string {
  if (cachedBlackIconDataUrl) return cachedBlackIconDataUrl;
  if (typeof document === 'undefined') return '';
  try {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(48, 48, 46, 0, Math.PI * 2);
      ctx.fill();
    }
    cachedBlackIconDataUrl = c.toDataURL('image/png');
    return cachedBlackIconDataUrl;
  } catch {
    return '';
  }
}

/**
 * Draws the Pure Black Focus Capsule (#000000 pill, bold white timer on left,
 * Orange Break + Red/Green Pause-Play + White Maximize circular icon buttons on right)
 * onto a 2D canvas context.
 */
function renderPureBlackCapsuleToContext(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeFormatted: string,
  isPaused: boolean,
  isCampActive: boolean
) {
  ctx.clearRect(0, 0, w, h);

  // Pure black stadium capsule pill (#000000)
  const radius = h / 2;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Subtle dark border so capsule edges look crisp on dark notification shade
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left: Bold White Timer (no left icon/logo)
  ctx.fillStyle = '#ffffff';
  const fontSize = timeFormatted.length > 5 ? 46 : 56;
  ctx.font = `900 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(timeFormatted, 34, h / 2 + 2);

  // Right: 3 Equal-Sized Circular Icon Buttons (Orange Break, Red Pause / Green Play, White Maximize)
  const r = 34;
  const cy = h / 2;
  const cx3 = w - 58;
  const cx2 = cx3 - 82;
  const cx1 = cx2 - 82;

  // 1. Orange Break Button (Coffee Cup Icon)
  ctx.beginPath();
  ctx.arc(cx1, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isCampActive ? '#f59e0b' : '#ff5500';
  ctx.fill();

  // Draw crisp vector coffee cup in white (black if active amber)
  ctx.strokeStyle = isCampActive ? '#000000' : '#ffffff';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Cup body
  ctx.beginPath();
  ctx.moveTo(cx1 - 11, cy - 4);
  ctx.lineTo(cx1 + 7, cy - 4);
  ctx.lineTo(cx1 + 5, cy + 9);
  ctx.quadraticCurveTo(cx1 - 2, cy + 12, cx1 - 9, cy + 9);
  ctx.closePath();
  ctx.stroke();
  // Cup handle
  ctx.beginPath();
  ctx.arc(cx1 + 8, cy + 2, 4.5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // Steam lines
  ctx.beginPath();
  ctx.moveTo(cx1 - 5, cy - 11);
  ctx.lineTo(cx1 - 5, cy - 8);
  ctx.moveTo(cx1 + 1, cy - 11);
  ctx.lineTo(cx1 + 1, cy - 8);
  ctx.stroke();

  // 2. Red Pause / Green Play Button
  ctx.beginPath();
  ctx.arc(cx2, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isPaused ? '#10b981' : '#dc2626';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  if (isPaused) {
    // Play triangle
    ctx.beginPath();
    ctx.moveTo(cx2 - 7, cy - 12);
    ctx.lineTo(cx2 + 12, cy);
    ctx.lineTo(cx2 - 7, cy + 12);
    ctx.closePath();
    ctx.fill();
  } else {
    // Pause bars
    ctx.beginPath();
    ctx.roundRect(cx2 - 9, cy - 11, 6, 22, 2);
    ctx.roundRect(cx2 + 3, cy - 11, 6, 22, 2);
    ctx.fill();
  }

  // 3. White Maximize Button
  ctx.beginPath();
  ctx.arc(cx3, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Top-right expand arrow
  ctx.beginPath();
  ctx.moveTo(cx3 + 2, cy - 10);
  ctx.lineTo(cx3 + 10, cy - 10);
  ctx.lineTo(cx3 + 10, cy - 2);
  ctx.moveTo(cx3 + 10, cy - 10);
  ctx.lineTo(cx3 + 2, cy - 2);
  // Bottom-left expand arrow
  ctx.moveTo(cx3 - 2, cy + 10);
  ctx.lineTo(cx3 - 10, cy + 10);
  ctx.lineTo(cx3 - 10, cy + 2);
  ctx.moveTo(cx3 - 10, cy + 10);
  ctx.lineTo(cx3 - 2, cy + 2);
  ctx.stroke();
}

class BackgroundFocusManager {
  private onTogglePauseCallback: (() => void) | null = null;
  private onToggleBreakCallback: (() => void) | null = null;
  private onMaximizeCallback: (() => void) | null = null;
  private webLockAbortController: AbortController | null = null;

  // Document Picture-in-Picture & Canvas Video PiP state
  private docPipWindow: Window | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private notificationBannerCanvas: HTMLCanvasElement | null = null;
  private pipVideo: HTMLVideoElement | null = null;
  private lastPayload: LiveNotificationPayload | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FOKUS_NOTIFICATION_ACTION') {
          if (event.data.action === 'toggle_pause' && this.onTogglePauseCallback) {
            this.onTogglePauseCallback();
          } else if (event.data.action === 'toggle_break' && this.onToggleBreakCallback) {
            this.onToggleBreakCallback();
          } else if (event.data.action === 'open_app' && this.onMaximizeCallback) {
            this.onMaximizeCallback();
          }
        }
      });
    }
  }

  public setPauseHandler(handler: (() => void) | null) {
    this.onTogglePauseCallback = handler;
  }

  public setBreakHandler(handler: (() => void) | null) {
    this.onToggleBreakCallback = handler;
  }

  public setMaximizeHandler(handler: (() => void) | null) {
    this.onMaximizeCallback = handler;
  }

  /**
   * Uses silent Web Locks API (NO <audio> element and NO MediaSession)
   * so Android / One UI NEVER displays the "Medya çıkışı" (Media Output) player card!
   */
  public startKeepAlive() {
    if (typeof window === 'undefined') return;
    this.clearMediaSession();

    try {
      const anyNav = navigator as any;
      if (anyNav.locks && typeof anyNav.locks.request === 'function' && !this.webLockAbortController) {
        this.webLockAbortController = new AbortController();
        anyNav.locks
          .request(
            'fokus_background_focus_lock',
            { signal: this.webLockAbortController.signal },
            () =>
              new Promise<void>((resolve) => {
                this.webLockAbortController?.signal.addEventListener('abort', () => resolve(), {
                  once: true,
                });
              })
          )
          .catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  public stopKeepAlive() {
    this.clearMediaSession();
    try {
      if (this.webLockAbortController) {
        this.webLockAbortController.abort();
        this.webLockAbortController = null;
      }
    } catch {
      // ignore
    }
  }

  // --- PURE BLACK PICTURE-IN-PICTURE (PiP) FLOATING CAPSULE ---

  public isPipActive(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (this.docPipWindow && !this.docPipWindow.closed) ||
        (typeof document !== 'undefined' && document.pictureInPictureElement)
    );
  }

  public async openPipCapsule(payload?: LiveNotificationPayload): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const currentPayload = payload || this.lastPayload;
    if (currentPayload) {
      this.lastPayload = currentPayload;
    }

    // Ensure MediaSession is cleared so PiP never spawns "Medya çıkışı"
    this.clearMediaSession();

    // 1. Try Document Picture-in-Picture API (Interactive Pure Black Capsule Window)
    const anyWin = window as any;
    if (anyWin.documentPictureInPicture && typeof anyWin.documentPictureInPicture.requestWindow === 'function') {
      try {
        if (this.docPipWindow && !this.docPipWindow.closed) {
          this.renderDocPipWindow();
          return true;
        }
        const pipWin: Window = await anyWin.documentPictureInPicture.requestWindow({
          width: 310,
          height: 84,
        });
        this.docPipWindow = pipWin;
        this.setupDocPipDOM(pipWin);
        this.renderDocPipWindow();
        pipWin.addEventListener('pagehide', () => {
          this.docPipWindow = null;
        });
        return true;
      } catch {
        // Fallback to Canvas Video PiP below
      }
    }

    // 2. Fallback: Canvas Stream Video Picture-in-Picture (Pure Black Capsule rendered on Canvas, 0 audio tracks)
    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 560;
        this.pipCanvas.height = 140;
      }
      this.drawCanvasPipFrame();

      if (!this.pipVideo) {
        this.pipVideo = document.createElement('video');
        this.pipVideo.muted = true;
        this.pipVideo.playsInline = true;
        (this.pipVideo as any).disableRemotePlayback = true;
        this.pipVideo.style.position = 'fixed';
        this.pipVideo.style.opacity = '0';
        this.pipVideo.style.pointerEvents = 'none';
        this.pipVideo.style.width = '1px';
        this.pipVideo.style.height = '1px';
        document.body.appendChild(this.pipVideo);
      }

      if (!this.pipVideo.srcObject && (this.pipCanvas as any).captureStream) {
        const stream = (this.pipCanvas as any).captureStream(15);
        this.pipVideo.srcObject = stream;
      }

      await this.pipVideo.play();
      this.clearMediaSession();
      if ((this.pipVideo as any).requestPictureInPicture) {
        await (this.pipVideo as any).requestPictureInPicture();
        this.clearMediaSession();
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  }

  public closePipCapsule() {
    try {
      if (this.docPipWindow && !this.docPipWindow.closed) {
        this.docPipWindow.close();
      }
      this.docPipWindow = null;
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        document.exitPictureInPicture?.().catch(() => {});
      }
      if (this.pipVideo) {
        this.pipVideo.pause();
        this.pipVideo.srcObject = null;
      }
    } catch {
      // ignore
    }
  }

  private setupDocPipDOM(pipWin: Window) {
    const doc = pipWin.document;
    doc.head.innerHTML = `
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        html, body {
          width: 100%;
          height: 100%;
          background: #000000;
          color: #ffffff;
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .capsule {
          width: 100%;
          height: 100%;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          gap: 12px;
        }
        .timer {
          font-size: 32px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn {
          width: 42px;
          height: 42px;
          border-radius: 9999px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
          flex-shrink: 0;
        }
        .btn:hover { transform: scale(1.06); filter: brightness(1.08); }
        .btn:active { transform: scale(0.94); }
        .btn-break {
          background: #ff5500;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(255, 85, 0, 0.4);
        }
        .btn-break.active {
          background: #f59e0b;
          color: #000000;
          box-shadow: 0 0 18px rgba(245, 158, 11, 0.7);
        }
        .btn-pause {
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.45);
        }
        .btn-play {
          background: #10b981;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.45);
        }
        .btn-max {
          background: #ffffff;
          color: #000000;
          box-shadow: 0 4px 14px rgba(255, 255, 255, 0.25);
        }
        svg { width: 20px; height: 20px; }
      </style>
    `;

    doc.body.innerHTML = `
      <div class="capsule">
        <div id="pip-timer" class="timer">00:00</div>
        <div class="actions">
          <button id="pip-btn-break" class="btn btn-break" title="Mola">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>
            </svg>
          </button>
          <button id="pip-btn-toggle" class="btn btn-pause" title="Durdur / Başlat"></button>
          <button id="pip-btn-max" class="btn btn-max" title="Büyüt (Focus Ekranına Dön)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const breakBtn = doc.getElementById('pip-btn-break');
    const toggleBtn = doc.getElementById('pip-btn-toggle');
    const maxBtn = doc.getElementById('pip-btn-max');

    breakBtn?.addEventListener('click', () => {
      if (this.onToggleBreakCallback) this.onToggleBreakCallback();
    });
    toggleBtn?.addEventListener('click', () => {
      if (this.onTogglePauseCallback) this.onTogglePauseCallback();
    });
    maxBtn?.addEventListener('click', () => {
      try {
        window.focus();
      } catch {}
      if (this.onMaximizeCallback) this.onMaximizeCallback();
      this.closePipCapsule();
    });
  }

  private renderDocPipWindow() {
    if (!this.docPipWindow || this.docPipWindow.closed || !this.lastPayload) return;
    const doc = this.docPipWindow.document;
    const timerEl = doc.getElementById('pip-timer');
    const breakBtn = doc.getElementById('pip-btn-break');
    const toggleBtn = doc.getElementById('pip-btn-toggle');

    const { timeFormatted } = computeDisplayTimeFromPayload(this.lastPayload);
    if (timerEl) {
      timerEl.textContent = timeFormatted;
    }

    if (breakBtn) {
      if (this.lastPayload.isCampActive) {
        breakBtn.classList.add('active');
      } else {
        breakBtn.classList.remove('active');
      }
    }

    if (toggleBtn) {
      if (this.lastPayload.isPaused) {
        toggleBtn.className = 'btn btn-play';
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px;">
            <polygon points="6 3 20 12 6 21 6 3"/>
          </svg>
        `;
      } else {
        toggleBtn.className = 'btn btn-pause';
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        `;
      }
    }
  }

  private drawCanvasPipFrame() {
    if (!this.pipCanvas || !this.lastPayload) return;
    const ctx = this.pipCanvas.getContext('2d');
    if (!ctx) return;

    const { timeFormatted } = computeDisplayTimeFromPayload(this.lastPayload);
    renderPureBlackCapsuleToContext(
      ctx,
      this.pipCanvas.width,
      this.pipCanvas.height,
      timeFormatted,
      this.lastPayload.isPaused,
      this.lastPayload.isCampActive
    );
  }

  private generateCapsuleImageDataUrl(payload: LiveNotificationPayload): string {
    if (typeof document === 'undefined') return '';
    try {
      if (!this.notificationBannerCanvas) {
        this.notificationBannerCanvas = document.createElement('canvas');
        this.notificationBannerCanvas.width = 560;
        this.notificationBannerCanvas.height = 140;
      }
      const ctx = this.notificationBannerCanvas.getContext('2d');
      if (!ctx) return '';
      const { timeFormatted } = computeDisplayTimeFromPayload(payload);
      renderPureBlackCapsuleToContext(
        ctx,
        this.notificationBannerCanvas.width,
        this.notificationBannerCanvas.height,
        timeFormatted,
        payload.isPaused,
        payload.isCampActive
      );
      return this.notificationBannerCanvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  /**
   * Explicitly clears navigator.mediaSession so Android / One UI NEVER shows "Medya çıkışı".
   */
  public clearMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('stop', null);
    } catch {
      // ignore
    }
  }

  public async syncLiveNotification(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined') return;
    this.lastPayload = payload;

    // Ensure MediaSession is NEVER active so "Medya çıkışı" never appears
    this.clearMediaSession();

    // Update live PiP capsule if active
    this.renderDocPipWindow();
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      this.drawCanvasPipFrame();
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Forward state to Service Worker so it can maintain the sticky Pure Black Capsule notification in background
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.active) {
          reg.active.postMessage({
            type: 'SYNC_FOCUS_TIMER',
            payload: {
              ...payload,
              isHidden: document.hidden || Boolean(payload.forceShow),
            },
          });
        }
      } catch {
        // ignore
      }
    }

    // If tab is currently in background (or forceShow requested), also trigger showNotification directly
    if (document.hidden || payload.forceShow) {
      await this.showStickyNotificationNow(payload);
    }
  }

  public async showStickyNotificationNow(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const { timeFormatted } = computeDisplayTimeFromPayload(payload);
    const title = timeFormatted;
    const body = payload.isCampActive
      ? 'Mola Süresi'
      : payload.isPaused
      ? 'Duraklatıldı'
      : 'Odak Süresi';

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          const notifOptions: any = {
            body,
            tag: 'fokus-active-timer',
            renotify: false,
            silent: true,
            requireInteraction: true,
            data: { url: '/' },
            actions: [
              {
                action: 'toggle_break',
                title: payload.isCampActive ? 'Mola Bitti' : 'Mola',
              },
              {
                action: 'toggle_pause',
                title: payload.isPaused ? 'Başlat' : 'Durdur',
              },
              {
                action: 'open_app',
                title: 'Büyüt',
              },
            ],
          };
          await reg.showNotification(title, notifOptions);
          return;
        }
      }

      new Notification(title, {
        body,
        tag: 'fokus-active-timer',
        silent: true,
      });
    } catch {
      // ignore
    }
  }

  public async stopAll() {
    this.stopKeepAlive();
    this.clearMediaSession();
    this.closePipCapsule();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.active) {
          reg.active.postMessage({ type: 'STOP_FOCUS_TIMER' });
        }
        const notifications = await reg.getNotifications({ tag: 'fokus-active-timer' });
        notifications.forEach((n) => n.close());
      } catch {
        // ignore
      }
    }
  }
}

export const backgroundFocus = new BackgroundFocusManager();

