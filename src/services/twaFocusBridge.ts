import type { NativeFocusState, NativeFocusSync } from './nativeFocus';

/**
 * HTTPS page -> Android Trusted Web Activity using the Chrome Custom Tabs
 * origin-verified MessagePort. This never copies any Firebase auth credentials
 * into Android; authentication remains inside Chrome on the existing PWA origin.
 */
export const isTwaFocusPage = (() => {
  if (typeof window === 'undefined') return false;
  const marked = new URLSearchParams(window.location.search).get('nevofocus_twa') === '1';
  // Some PWA in-app navigation replaces query parameters. Keep the mode only
  // in this browser tab rather than silently returning to Chrome notifications.
  try {
    if (marked) window.sessionStorage.setItem('nevofocus_twa_active', '1');
    return marked || window.sessionStorage.getItem('nevofocus_twa_active') === '1';
  } catch {
    return marked;
  }
})();

type RequestType = 'NEVOFOCUS_NATIVE_SYNC' | 'NEVOFOCUS_NATIVE_QUERY' | 'NEVOFOCUS_NATIVE_STOP';

interface NativeReply {
  type: 'NEVOFOCUS_NATIVE_STATE' | 'NEVOFOCUS_NATIVE_ERROR';
  requestId?: string;
  state?: NativeFocusState;
  error?: string;
}

let port: MessagePort | null = null;
// A ?nevofocus_twa=1 URL marker is NOT proof of a native bridge.
// Native commands are enabled ONLY after Chrome's verified MessagePort exists.
// The Chrome/PWA notification fallback is independently disabled for TWA UI.
export const hasTwaFocusChannel = (): boolean => Boolean(port);
let nextRequestId = 0;
const pending = new Map<string, {
  resolve: (state: NativeFocusState) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();
const bridgeWaiters = new Set<{
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

function onPortMessage(event: MessageEvent) {
  let reply: NativeReply;
  try {
    reply = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }
  if (!reply || (reply.type !== 'NEVOFOCUS_NATIVE_STATE' &&
                 reply.type !== 'NEVOFOCUS_NATIVE_ERROR')) return;
  if (!reply.requestId) return;
  const waiting = pending.get(reply.requestId);
  if (!waiting) return;
  pending.delete(reply.requestId);
  clearTimeout(waiting.timeout);
  if (reply.type === 'NEVOFOCUS_NATIVE_ERROR' || !reply.state) {
    waiting.reject(new Error(reply.error || 'Android native focus request failed'));
  } else {
    waiting.resolve(reply.state);
  }
}

if (isTwaFocusPage) {
  window.addEventListener('message', event => {
    // Chrome only grants this origin via a successful Digital Asset Links
    // relationship. Never accept a port from another site/iframe.
    if (event.origin !== window.location.origin || !event.ports?.length) return;
    let hello: { type?: string; version?: number };
    try {
      hello = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (hello?.type !== 'NEVOFOCUS_TWA_HELLO' || hello.version !== 1) return;
    if (port && port !== event.ports[0]) {
      try { port.close(); } catch {}
    }
    port = event.ports[0];
    port.onmessage = onPortMessage;
    port.start();
    port.postMessage(JSON.stringify({ type: 'NEVOFOCUS_TWA_WEB_READY' }));
    // A FocusSession may mount before Chrome finishes its DAL handshake.
    // Notify it once to start native time without requiring the user to tap Pause.
    window.dispatchEvent(new Event('nevofocus:twa-connected'));
    for (const waiter of bridgeWaiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve();
    }
    bridgeWaiters.clear();
  });
}

function awaitPort(): Promise<void> {
  if (port) return Promise.resolve();
  if (!isTwaFocusPage) return Promise.reject(new Error('Not running in a Trusted Web Activity.'));
  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        bridgeWaiters.delete(waiter);
        reject(new Error('No validated Android TWA message channel; check assetlinks.json and URL.'));
      }, 10000),
    };
    bridgeWaiters.add(waiter);
  });
}

async function send(type: RequestType, payload: object = {}): Promise<NativeFocusState> {
  await awaitPort();
  if (!port) throw new Error('Android message channel disconnected');
  const requestId = String(++nextRequestId);
  const message = { type, requestId, ...payload };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Android did not acknowledge native focus request.'));
    }, 10000);
    pending.set(requestId, { resolve, reject, timeout });
    try {
      port!.postMessage(JSON.stringify(message));
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(requestId);
      reject(error instanceof Error ? error : new Error('Android postMessage failed'));
    }
  });
}

export const twaFocus = {
  async sync(state: NativeFocusSync) {
    const updated = await send('NEVOFOCUS_NATIVE_SYNC', state);
    return { notificationPermissionGranted: updated.notificationPermissionGranted };
  },
  getState: () => send('NEVOFOCUS_NATIVE_QUERY'),
  async stop() {
    await send('NEVOFOCUS_NATIVE_STOP');
  },
};
