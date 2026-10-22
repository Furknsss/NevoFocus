// Fokus PWA Service Worker with Background Focus Timer & Live Notification Engine
const CACHE_NAME = 'fokus-pwa-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

let activeSessionState = null;
let bgTimerInterval = null;

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

function buildProgressBar(percent) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const totalBlocks = 10;
  const filled = Math.round((clamped / 100) * totalBlocks);
  return `${'▓'.repeat(filled)}${'░'.repeat(Math.max(0, totalBlocks - filled))} %${clamped}`;
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
    ? '☕ Mola Aktif'
    : p.isPaused
    ? '⏸ Duraklatıldı'
    : '● Odak Devam Ediyor';

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
          title: '☕',
        },
        {
          action: 'toggle_pause',
          title: p.isPaused ? '▶' : '⏸',
        },
        {
          action: 'open_app',
          title: '⤢',
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

  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit')
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

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
