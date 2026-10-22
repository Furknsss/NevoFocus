// Fokus PWA Service Worker with Background Focus Timer & Pure Black Capsule Notification Engine
const CACHE_NAME = 'fokus-pwa-v7';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

let activeSessionState = null;
let bgTimerInterval = null;
let cachedBlackIconUrl = null;

function formatTimerDisplay(totalSecs) {
  const safe = Math.max(0, Math.floor(totalSecs));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function blobToDataUrl(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:image/png;base64,' + btoa(binary);
}

async function getPureBlackIconUrl() {
  if (cachedBlackIconUrl) return cachedBlackIconUrl;
  if (typeof OffscreenCanvas === 'undefined') return undefined;
  try {
    const canvas = new OffscreenCanvas(96, 96);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(48, 48, 46, 0, Math.PI * 2);
      ctx.fill();
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      cachedBlackIconUrl = await blobToDataUrl(blob);
      return cachedBlackIconUrl;
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function generatePureBlackCapsuleImageUrl(timeFormatted, isPaused, isCampActive) {
  if (typeof OffscreenCanvas === 'undefined') return undefined;
  try {
    const w = 560;
    const h = 140;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.clearRect(0, 0, w, h);

    // Pure black stadium capsule (#000000)
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

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left: Bold White Timer
    ctx.fillStyle = '#ffffff';
    const fontSize = timeFormatted.length > 5 ? 46 : 56;
    ctx.font = `900 ${fontSize}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(timeFormatted, 34, h / 2 + 2);

    // Right: 3 Circular Icon Buttons (Orange Break, Red/Green Pause-Play, White Maximize)
    const r = 34;
    const cy = h / 2;
    const cx3 = w - 58;
    const cx2 = cx3 - 82;
    const cx1 = cx2 - 82;

    // 1. Orange Break Circle
    ctx.beginPath();
    ctx.arc(cx1, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isCampActive ? '#f59e0b' : '#ff5500';
    ctx.fill();
    ctx.strokeStyle = isCampActive ? '#000000' : '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx1 - 11, cy - 4);
    ctx.lineTo(cx1 + 7, cy - 4);
    ctx.lineTo(cx1 + 5, cy + 9);
    ctx.quadraticCurveTo(cx1 - 2, cy + 12, cx1 - 9, cy + 9);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx1 + 8, cy + 2, 4.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx1 - 5, cy - 11);
    ctx.lineTo(cx1 - 5, cy - 8);
    ctx.moveTo(cx1 + 1, cy - 11);
    ctx.lineTo(cx1 + 1, cy - 8);
    ctx.stroke();

    // 2. Red Pause / Green Play Circle
    ctx.beginPath();
    ctx.arc(cx2, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isPaused ? '#10b981' : '#dc2626';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (isPaused) {
      ctx.beginPath();
      ctx.moveTo(cx2 - 7, cy - 12);
      ctx.lineTo(cx2 + 12, cy);
      ctx.lineTo(cx2 - 7, cy + 12);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(cx2 - 9, cy - 11, 6, 22);
      ctx.fillRect(cx2 + 3, cy - 11, 6, 22);
    }

    // 3. White Maximize Circle
    ctx.beginPath();
    ctx.arc(cx3, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx3 + 2, cy - 10);
    ctx.lineTo(cx3 + 10, cy - 10);
    ctx.lineTo(cx3 + 10, cy - 2);
    ctx.moveTo(cx3 + 10, cy - 10);
    ctx.lineTo(cx3 + 2, cy - 2);
    ctx.moveTo(cx3 - 2, cy + 10);
    ctx.lineTo(cx3 - 10, cy + 10);
    ctx.lineTo(cx3 - 10, cy + 2);
    ctx.moveTo(cx3 - 10, cy + 10);
    ctx.lineTo(cx3 - 2, cy + 2);
    ctx.stroke();

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
}

async function renderActiveNotification() {
  if (!activeSessionState || !activeSessionState.isHidden) return;

  const p = activeSessionState;
  const now = Date.now();
  const elapsedFocus =
    p.isPaused || p.isCampActive
      ? p.accumulatedFocusSeconds || 0
      : (p.accumulatedFocusSeconds || 0) + Math.max(0, Math.floor((now - (p.anchorTimestamp || now)) / 1000));

  const elapsedBreak =
    !p.isCampActive || p.isPaused
      ? p.accumulatedBreakSeconds || 0
      : (p.accumulatedBreakSeconds || 0) + Math.max(0, Math.floor((now - (p.breakAnchorTimestamp || now)) / 1000));

  const totalPlannedSecs = Math.max(60, (p.plannedMinutes || 45) * 60);
  const remainingSecs = Math.max(0, totalPlannedSecs - elapsedFocus);

  const activeSecs = p.isCampActive
    ? elapsedBreak
    : p.timerType === 'stopwatch'
    ? elapsedFocus
    : remainingSecs;

  const title = formatTimerDisplay(activeSecs);
  const body = p.isCampActive
    ? 'Mola Süresi'
    : p.isPaused
    ? 'Duraklatıldı'
    : 'Odak Süresi';

  try {
    await self.registration.showNotification(title, {
      body,
      tag: 'fokus-active-timer',
      renotify: false,
      silent: true,
      requireInteraction: true,
      data: { url: '/' },
      actions: [
        {
          action: 'toggle_break',
          title: p.isCampActive ? 'Mola Bitti' : 'Mola',
        },
        {
          action: 'toggle_pause',
          title: p.isPaused ? 'Başlat' : 'Durdur',
        },
        {
          action: 'open_app',
          title: 'Büyüt',
        },
      ],
    });
  } catch {
    // ignore
  }
}

function startBackgroundLoop() {
  if (bgTimerInterval) clearInterval(bgTimerInterval);
  bgTimerInterval = setInterval(() => {
    if (!activeSessionState || !activeSessionState.isHidden) {
      return;
    }
    renderActiveNotification();
  }, 1000);
}

function stopBackgroundLoop() {
  if (bgTimerInterval) {
    clearInterval(bgTimerInterval);
    bgTimerInterval = null;
  }
  activeSessionState = null;
  self.registration
    .getNotifications({ tag: 'fokus-active-timer' })
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {});
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_FOCUS_TIMER') {
    activeSessionState = event.data.payload;
    if (activeSessionState && activeSessionState.isHidden) {
      renderActiveNotification();
      startBackgroundLoop();
    } else if (activeSessionState && !activeSessionState.isHidden) {
      // App is visible on screen: close notification so it doesn't clutter while user is looking at the app
      self.registration
        .getNotifications({ tag: 'fokus-active-timer' })
        .then((list) => list.forEach((n) => n.close()))
        .catch(() => {});
    }
  } else if (event.data.type === 'STOP_FOCUS_TIMER') {
    stopBackgroundLoop();
  }
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;

  if (action === 'toggle_break') {
    if (activeSessionState) {
      const now = Date.now();
      if (!activeSessionState.isCampActive) {
        if (!activeSessionState.isPaused) {
          const delta = Math.max(0, Math.floor((now - (activeSessionState.anchorTimestamp || now)) / 1000));
          activeSessionState.accumulatedFocusSeconds = (activeSessionState.accumulatedFocusSeconds || 0) + delta;
        }
        activeSessionState.breakAnchorTimestamp = now;
        activeSessionState.isCampActive = true;
      } else {
        if (!activeSessionState.isPaused) {
          const bDelta = Math.max(0, Math.floor((now - (activeSessionState.breakAnchorTimestamp || now)) / 1000));
          activeSessionState.accumulatedBreakSeconds = (activeSessionState.accumulatedBreakSeconds || 0) + bDelta;
        }
        activeSessionState.anchorTimestamp = now;
        activeSessionState.isCampActive = false;
      }
      renderActiveNotification();
    }
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'FOKUS_NOTIFICATION_ACTION',
            action: 'toggle_break',
          });
        });
      })
    );
    return;
  }

  if (action === 'toggle_pause') {
    if (activeSessionState) {
      const now = Date.now();
      if (!activeSessionState.isPaused) {
        const delta = Math.max(0, Math.floor((now - (activeSessionState.anchorTimestamp || now)) / 1000));
        activeSessionState.accumulatedFocusSeconds = (activeSessionState.accumulatedFocusSeconds || 0) + delta;
        activeSessionState.isPaused = true;
      } else {
        activeSessionState.anchorTimestamp = now;
        activeSessionState.isPaused = false;
      }
      renderActiveNotification();
    }
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'FOKUS_NOTIFICATION_ACTION',
            action: 'toggle_pause',
          });
        });
      })
    );
    return;
  }

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'FOKUS_NOTIFICATION_ACTION',
          action: 'open_app',
        });
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never intercept Firebase, Google APIs, Vite dev endpoints, or source modules
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('vite')
  ) {
    return;
  }

  if (url.pathname.startsWith('/icons/') || url.pathname.includes('manifest')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
        );
      })
    );
    return;
  }

  // Network-first for HTML & app assets so refresh always serves latest state
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

