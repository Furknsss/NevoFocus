// Fokus PWA Service Worker with Smooth Synchronized Non-Expanding Black Capsule Notification Engine
const CACHE_NAME = 'fokus-pwa-v10';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

let activeSessionState = null;
let bgTimerInterval = null;
let lastRenderedSecondKey = '';

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

async function generateBlackCapsuleClockIcon(timeFormatted) {
  if (typeof OffscreenCanvas === 'undefined') return undefined;
  try {
    const canvas = new OffscreenCanvas(192, 192);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 192, 192);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(8, 36, 176, 120, 60);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      const fontSize = timeFormatted.length > 5 ? 36 : 48;
      ctx.font = `900 ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeFormatted, 96, 98);

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return await blobToDataUrl(blob);
    }
  } catch {
    // ignore
  }
  return undefined;
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

  const timeFormatted = formatTimerDisplay(activeSecs);
  const currentKey = `${timeFormatted}_${p.isPaused}_${p.isCampActive}`;
  if (currentKey === lastRenderedSecondKey) return;
  lastRenderedSecondKey = currentKey;

  const title = `⏱ ${timeFormatted}`;
  const subj = p.subjectName || 'Odaklanma';
  const body = p.isCampActive
    ? `Mola · ${subj}`
    : p.isPaused
    ? `Duraklatıldı · ${subj}`
    : `${subj}`;

  try {
    const iconUrl = await generateBlackCapsuleClockIcon(timeFormatted);
    // Compact, non-expanding notification (no actions array, no large banner)
    await self.registration.showNotification(title, {
      body,
      icon: iconUrl,
      tag: 'fokus-active-timer',
      renotify: false,
      silent: true,
      requireInteraction: true,
      data: { url: '/' },
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
  lastRenderedSecondKey = '';
  self.registration
    .getNotifications({ tag: 'fokus-active-timer' })
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {});
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_FOCUS_TIMER') {
    // Trusted Web Activity sessions belong to our Android foreground service.
    // Never allow an old Chrome/PWA service-worker notification to race it.
    const senderUrl = event.source && 'url' in event.source ? event.source.url : '';
    if (senderUrl && new URL(senderUrl).searchParams.get('nevofocus_twa') === '1') {
      stopBackgroundLoop();
      return;
    }
    activeSessionState = event.data.payload;
    if (activeSessionState && activeSessionState.isHidden) {
      renderActiveNotification();
      startBackgroundLoop();
    } else if (activeSessionState && !activeSessionState.isHidden) {
      lastRenderedSecondKey = '';
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
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Use the same direct-Focus command as the native Android capsule;
        // restoring the existing window preserves the live timer and media.
        if (new URL(client.url).origin !== self.location.origin) continue;
        client.postMessage({
          type: 'FOKUS_NOTIFICATION_ACTION',
          action: 'open_focus',
        });
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/?nevofocus_focus=1');
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

