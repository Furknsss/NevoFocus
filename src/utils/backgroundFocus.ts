// Background Focus Persistence, Non-Expanding Pure Black PiP Capsule & Live Synchronized Notification Engine

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

// Pure Black Capsule Clock Icon Generator for Notifications
let cachedBlackClockIconUrl: string | null = null;
let cachedLastTimeRendered = '';

function getPureBlackClockIconDataUrl(timeFormatted: string): string {
  if (typeof document === 'undefined') return '';
  if (cachedBlackClockIconUrl && cachedLastTimeRendered === timeFormatted) {
    return cachedBlackClockIconUrl;
  }
  try {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 192;
    const ctx = c.getContext('2d');
    if (ctx) {
      // Pure black rounded capsule square
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(8, 36, 176, 120, 60);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // White premium clock digits inside the black capsule
      ctx.fillStyle = '#ffffff';
      const fontSize = timeFormatted.length > 5 ? 36 : 48;
      ctx.font = `900 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeFormatted, 96, 98);
    }
    cachedLastTimeRendered = timeFormatted;
    cachedBlackClockIconUrl = c.toDataURL('image/png');
    return cachedBlackClockIconUrl;
  } catch {
    return '';
  }
}

/**
 * Draws the Non-Expanding Pure Black Focus Capsule (#000000 pill + bold white premium clock)
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

  // Subtle dark border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Status indicator dot
  const dotX = 44;
  const dotY = h / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = isCampActive ? '#fbbf24' : isPaused ? '#ef4444' : '#ffffff';
  ctx.fill();

  // Centered/Left White Premium Clock (no expand button)
  ctx.fillStyle = '#ffffff';
  const fontSize = timeFormatted.length > 5 ? 54 : 66;
  ctx.font = `900 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(timeFormatted, w / 2 + 10, h / 2 + 2);
}

class BackgroundFocusManager {
  private onTogglePauseCallback: (() => void) | null = null;
  private onToggleBreakCallback: (() => void) | null = null;
  private onMaximizeCallback: (() => void) | null = null;
  private webLockAbortController: AbortController | null = null;

  // Document Picture-in-Picture & Canvas Video PiP state
  private docPipWindow: Window | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipVideo: HTMLVideoElement | null = null;
  private lastPayload: LiveNotificationPayload | null = null;
  private lastNotifiedSecond: string = '';

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

    this.clearMediaSession();

    // 1. Document Picture-in-Picture API (Non-expanding Pure Black Capsule + White Premium Clock)
    const anyWin = window as any;
    if (anyWin.documentPictureInPicture && typeof anyWin.documentPictureInPicture.requestWindow === 'function') {
      try {
        if (this.docPipWindow && !this.docPipWindow.closed) {
          this.renderDocPipWindow();
          return true;
        }
        const pipWin: Window = await anyWin.documentPictureInPicture.requestWindow({
          width: 240,
          height: 72,
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

    // 2. Fallback: Canvas Stream Video Picture-in-Picture
    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 420;
        this.pipCanvas.height = 130;
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
          gap: 10px;
        }
        .clock-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 0 8px rgba(255,255,255,0.9);
          flex-shrink: 0;
        }
        .dot.break { background: #fbbf24; box-shadow: 0 0 8px rgba(251,191,36,0.8); }
        .dot.paused { background: #ef4444; box-shadow: none; }
        .timer {
          font-size: 30px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn {
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
          flex-shrink: 0;
        }
        .btn:hover { background: rgba(255,255,255,0.18); }
        .btn:active { transform: scale(0.92); }
        .btn.active-amber { background: #fbbf24; color: #000000; border-color: #fbbf24; }
        .btn.active-white { background: #ffffff; color: #000000; border-color: #ffffff; }
        svg { width: 16px; height: 16px; }
      </style>
    `;

    doc.body.innerHTML = `
      <div class="capsule">
        <div id="pip-clock-wrap" class="clock-wrap" title="Focus Ekranına Dön">
          <span id="pip-dot" class="dot"></span>
          <div id="pip-timer" class="timer">00:00</div>
        </div>
        <div class="actions">
          <button id="pip-btn-break" class="btn" title="Mola">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>
            </svg>
          </button>
          <button id="pip-btn-toggle" class="btn" title="Duraklat / Başlat"></button>
        </div>
      </div>
    `;

    const clockWrap = doc.getElementById('pip-clock-wrap');
    const breakBtn = doc.getElementById('pip-btn-break');
    const toggleBtn = doc.getElementById('pip-btn-toggle');

    clockWrap?.addEventListener('click', () => {
      try {
        window.focus();
      } catch {}
      if (this.onMaximizeCallback) this.onMaximizeCallback();
      this.closePipCapsule();
    });
    breakBtn?.addEventListener('click', () => {
      if (this.onToggleBreakCallback) this.onToggleBreakCallback();
    });
    toggleBtn?.addEventListener('click', () => {
      if (this.onTogglePauseCallback) this.onTogglePauseCallback();
    });
  }

  private renderDocPipWindow() {
    if (!this.docPipWindow || this.docPipWindow.closed || !this.lastPayload) return;
    const doc = this.docPipWindow.document;
    const timerEl = doc.getElementById('pip-timer');
    const dotEl = doc.getElementById('pip-dot');
    const breakBtn = doc.getElementById('pip-btn-break');
    const toggleBtn = doc.getElementById('pip-btn-toggle');

    const { timeFormatted } = computeDisplayTimeFromPayload(this.lastPayload);
    if (timerEl) {
      timerEl.textContent = timeFormatted;
    }

    if (dotEl) {
      dotEl.className = this.lastPayload.isCampActive
        ? 'dot break'
        : this.lastPayload.isPaused
        ? 'dot paused'
        : 'dot';
    }

    if (breakBtn) {
      breakBtn.className = this.lastPayload.isCampActive ? 'btn active-amber' : 'btn';
    }

    if (toggleBtn) {
      if (this.lastPayload.isPaused) {
        toggleBtn.className = 'btn active-white';
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:1px;">
            <polygon points="6 3 20 12 6 21 6 3"/>
          </svg>
        `;
      } else {
        toggleBtn.className = 'btn';
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

    this.clearMediaSession();

    // Update live PiP capsule if active
    this.renderDocPipWindow();
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      this.drawCanvasPipFrame();
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const { timeFormatted } = computeDisplayTimeFromPayload(payload);
    const stateSignature = `${timeFormatted}_${payload.isPaused}_${payload.isCampActive}_${document.hidden}`;

    // Forward state to Service Worker so it maintains the non-expanding Pure Black Capsule notification
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

    // Throttle direct notification updates to once per second change
    if ((document.hidden || payload.forceShow) && this.lastNotifiedSecond !== stateSignature) {
      this.lastNotifiedSecond = stateSignature;
      await this.showStickyNotificationNow(payload);
    }
  }

  public async showStickyNotificationNow(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const { timeFormatted } = computeDisplayTimeFromPayload(payload);
    const title = `⏱ ${timeFormatted}`;
    const body = payload.isCampActive
      ? `Mola · ${payload.subjectName}`
      : payload.isPaused
      ? `Duraklatıldı · ${payload.subjectName}`
      : `${payload.subjectName}`;
    const iconUrl = getPureBlackClockIconDataUrl(timeFormatted);

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          // Non-expanding compact notification (no actions array, no large image banner)
          const notifOptions: any = {
            body,
            icon: iconUrl || undefined,
            tag: 'fokus-active-timer',
            renotify: false,
            silent: true,
            requireInteraction: true,
            data: { url: '/' },
          };
          await reg.showNotification(title, notifOptions);
          return;
        }
      }

      new Notification(title, {
        body,
        icon: iconUrl || undefined,
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
    this.lastNotifiedSecond = '';

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
