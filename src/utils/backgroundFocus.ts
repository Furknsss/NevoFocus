// Background Focus Persistence, Pure Black PiP Capsule, Live Notification & Lock-Screen MediaSession Engine

const DEVICE_ID_KEY = 'fokus_device_id_v1';

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

// 1-second silent WAV (8kHz mono PCM) data URI to keep mobile browser & MediaSession alive in background
const SILENT_WAV_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class BackgroundFocusManager {
  private silentAudio: HTMLAudioElement | null = null;
  private isKeepAliveRunning = false;
  private onTogglePauseCallback: (() => void) | null = null;
  private onToggleBreakCallback: (() => void) | null = null;
  private onMaximizeCallback: (() => void) | null = null;

  // Document Picture-in-Picture & Canvas Video PiP state
  private docPipWindow: Window | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
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

  public startKeepAlive() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.silentAudio) {
        this.silentAudio = new Audio(SILENT_WAV_URI);
        this.silentAudio.loop = true;
        this.silentAudio.volume = 0.01;
      }
      if (!this.isKeepAliveRunning) {
        this.silentAudio
          .play()
          .then(() => {
            this.isKeepAliveRunning = true;
          })
          .catch(() => {
            // Will retry on next user gesture
          });
      }
    } catch {
      // ignore
    }
  }

  public stopKeepAlive() {
    try {
      if (this.silentAudio) {
        this.silentAudio.pause();
        this.silentAudio.currentTime = 0;
      }
      this.isKeepAliveRunning = false;
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

    // 2. Fallback: Canvas Stream Video Picture-in-Picture ( Pure Black Capsule rendered on Canvas )
    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 520;
        this.pipCanvas.height = 140;
      }
      this.drawCanvasPipFrame();

      if (!this.pipVideo) {
        this.pipVideo = document.createElement('video');
        this.pipVideo.muted = true;
        this.pipVideo.playsInline = true;
        this.pipVideo.style.position = 'fixed';
        this.pipVideo.style.opacity = '0';
        this.pipVideo.style.pointerEvents = 'none';
        this.pipVideo.style.width = '1px';
        this.pipVideo.style.height = '1px';
        document.body.appendChild(this.pipVideo);
      }

      if (!this.pipVideo.srcObject && (this.pipCanvas as any).captureStream) {
        const stream = (this.pipCanvas as any).captureStream(30);
        this.pipVideo.srcObject = stream;
      }

      await this.pipVideo.play();
      if ((this.pipVideo as any).requestPictureInPicture) {
        await (this.pipVideo as any).requestPictureInPicture();
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

    const w = this.pipCanvas.width;
    const h = this.pipCanvas.height;
    const { timeFormatted } = computeDisplayTimeFromPayload(this.lastPayload);

    // Pure black capsule background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Left bold white timer
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeFormatted, 32, h / 2 + 2);

    // Right 3 circular icon badges (Orange Break, Red Pause / Green Play, White Maximize)
    const r = 32;
    const cy = h / 2;
    const cx3 = w - 54;
    const cx2 = cx3 - 78;
    const cx1 = cx2 - 78;

    // 1. Orange Break Circle
    ctx.beginPath();
    ctx.arc(cx1, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.lastPayload.isCampActive ? '#f59e0b' : '#ff5500';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☕', cx1, cy + 2);

    // 2. Red Pause / Green Play Circle
    ctx.beginPath();
    ctx.arc(cx2, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.lastPayload.isPaused ? '#10b981' : '#dc2626';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (this.lastPayload.isPaused) {
      // Play triangle
      ctx.beginPath();
      ctx.moveTo(cx2 - 7, cy - 11);
      ctx.lineTo(cx2 + 11, cy);
      ctx.lineTo(cx2 - 7, cy + 11);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pause bars
      ctx.fillRect(cx2 - 9, cy - 11, 6, 22);
      ctx.fillRect(cx2 + 3, cy - 11, 6, 22);
    }

    // 3. White Maximize Circle
    ctx.beginPath();
    ctx.arc(cx3, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx3 - 9, cy + 9);
    ctx.lineTo(cx3 + 9, cy - 9);
    ctx.moveTo(cx3 + 1, cy - 9);
    ctx.lineTo(cx3 + 9, cy - 9);
    ctx.lineTo(cx3 + 9, cy - 1);
    ctx.stroke();

    ctx.textAlign = 'left';
  }

  public updateMediaSession(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const { timeFormatted } = computeDisplayTimeFromPayload(payload);

      navigator.mediaSession.metadata = new MediaMetadata({
        title: timeFormatted,
        artist: payload.isCampActive ? 'Molada' : payload.isPaused ? 'Duraklatıldı' : 'Fokus',
        album: '',
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = payload.isPaused ? 'paused' : 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        if (payload.isPaused && this.onTogglePauseCallback) {
          this.onTogglePauseCallback();
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!payload.isPaused && this.onTogglePauseCallback) {
          this.onTogglePauseCallback();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.onToggleBreakCallback) {
          this.onToggleBreakCallback();
        }
      });
    } catch {
      // ignore
    }
  }

  public clearMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // ignore
    }
  }

  public async syncLiveNotification(payload: LiveNotificationPayload) {
    if (typeof window === 'undefined') return;
    this.lastPayload = payload;

    // Update live PiP capsule if active
    this.renderDocPipWindow();
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      this.drawCanvasPipFrame();
    }

    // Always update MediaSession for lock screen / control center
    this.updateMediaSession(payload);

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Forward state to Service Worker so it can maintain the sticky notification in background
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
      ? '☕ Mola Aktif'
      : payload.isPaused
      ? '⏸ Duraklatıldı'
      : '● Odak Devam Ediyor';

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            tag: 'fokus-active-timer',
            renotify: false,
            silent: true,
            requireInteraction: true,
            data: { url: '/' },
            actions: [
              {
                action: 'toggle_break',
                title: '☕',
              },
              {
                action: 'toggle_pause',
                title: payload.isPaused ? '▶' : '⏸',
              },
              {
                action: 'open_app',
                title: '⤢',
              },
            ],
          } as NotificationOptions);
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
