import type { NativeFocusState, NativeFocusSync } from './nativeFocus';

export const isTwaFocusPage = (() => {
  if (typeof window === 'undefined') return false;
  const marked = new URLSearchParams(window.location.search).get('nevofocus_twa') === '1';
  try {
    if (marked) window.sessionStorage.setItem('nevofocus_twa_active', '1');
    return marked || window.sessionStorage.getItem('nevofocus_twa_active') === '1';
  } catch { return marked; }
})();

interface BootstrapChannel {
  port: MessagePort;
  messages: unknown[];
  initial: unknown;
  listener: (event: MessageEvent) => void;
}
interface TwaWindow extends Window {
  __nevoTwaBootstrap?: { channels: BootstrapChannel[] };
}
type RequestType = 'NEVOFOCUS_NATIVE_SYNC' | 'NEVOFOCUS_NATIVE_QUERY' | 'NEVOFOCUS_NATIVE_STOP';
interface NativeReply {
  type: string;
  version?: number;
  requestId?: string;
  state?: NativeFocusState;
  error?: string;
}

let port: MessagePort | null = null;
let candidate: MessagePort | null = null;
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

function parse(raw: unknown): NativeReply | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' ? value as NativeReply : null;
  } catch { return null; }
}

function receive(source: MessagePort, raw: unknown) {
  const reply = parse(raw);
  if (!reply) return;
  // Chromium transfers the port in an EMPTY window message. Android's HELLO
  // arrives later on that port, not in a window message with transferred ports.
  if (reply.type === 'NEVOFOCUS_TWA_HELLO' && reply.version === 1) {
    if (source !== candidate && source !== port) return;
    const changed = port !== source;
    if (changed && port) port.close();
    port = source;
    candidate = null;
    port.postMessage(JSON.stringify({ type: 'NEVOFOCUS_TWA_WEB_READY' }));
    if (changed) window.dispatchEvent(new Event('nevofocus:twa-connected'));
    for (const waiter of bridgeWaiters) {
      clearTimeout(waiter.timeout);
      waiter.resolve();
    }
    bridgeWaiters.clear();
    return;
  }
  if (source !== port || (reply.type !== 'NEVOFOCUS_NATIVE_STATE' &&
      reply.type !== 'NEVOFOCUS_NATIVE_ERROR') || !reply.requestId) return;
  const waiting = pending.get(reply.requestId);
  if (!waiting) return;
  pending.delete(reply.requestId);
  clearTimeout(waiting.timeout);
  if (reply.type === 'NEVOFOCUS_NATIVE_ERROR' || !reply.state) {
    waiting.reject(new Error(reply.error || 'Android native focus request failed'));
  } else waiting.resolve(reply.state);
}

function adopt(next: MessagePort, initial?: unknown, queued: unknown[] = []) {
  if (next === port || next === candidate) return;
  if (candidate) candidate.close();
  candidate = next;
  next.onmessage = event => receive(next, event.data);
  next.onmessageerror = () => {
    if (candidate === next) candidate = null;
    if (port !== next) return;
    port = null;
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Android message channel disconnected'));
    }
    pending.clear();
    window.dispatchEvent(new Event('nevofocus:twa-disconnected'));
  };
  next.start();
  // Accept the older combined initial HELLO too.
  receive(next, initial);
  for (const message of queued) receive(next, message);
}

if (isTwaFocusPage) {
  const bootstrap = (window as TwaWindow).__nevoTwaBootstrap;
  const drain = () => {
    while (bootstrap?.channels.length) {
      const channel = bootstrap.channels.shift()!;
      channel.port.removeEventListener('message', channel.listener);
      adopt(channel.port, channel.initial, channel.messages);
    }
  };
  if (bootstrap) {
    window.addEventListener('nevofocus:twa-port', drain);
    drain();
  } else {
    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin || !event.ports?.length) return;
      adopt(event.ports[0], event.data);
    });
  }
}

function awaitPort(): Promise<void> {
  if (port) return Promise.resolve();
  if (!isTwaFocusPage) return Promise.reject(new Error('Not running in a Trusted Web Activity.'));
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject, timeout: setTimeout(() => {
      bridgeWaiters.delete(waiter);
      reject(new Error('Android iletişim kanalı kurulamadı. NevoFocus uygulamasını yeniden aç.'));
    }, 20000) };
    bridgeWaiters.add(waiter);
  });
}

async function send(type: RequestType, payload: object = {}): Promise<NativeFocusState> {
  await awaitPort();
  if (!port) throw new Error('Android message channel disconnected');
  const activePort = port;
  const requestId = String(++nextRequestId);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Android did not acknowledge native focus request.'));
    }, 10000);
    pending.set(requestId, { resolve, reject, timeout });
    try { activePort.postMessage(JSON.stringify({ type, requestId, ...payload })); }
    catch (error) {
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
  async stop() { await send('NEVOFOCUS_NATIVE_STOP'); },
};

