import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';

// TWA code needs an authenticated HTTPS page origin, not a Capacitor WebView.
const handlers = new Map<string, (event: any) => void>();
(globalThis as any).window = {
  location: { origin: 'https://fokus.example.test', search: '?nevofocus_twa=1' },
  addEventListener(type: string, listener: (event: any) => void) {
    handlers.set(type, listener);
  },
  dispatchEvent(event: Event) {
    handlers.get(event.type)?.(event);
    return true;
  },
};
const { isTwaFocusPage, hasTwaFocusChannel, twaFocus } = await import('../src/services/twaFocusBridge');

test('real Chrome empty port transfer followed by HELLO on the port enables native requests', async () => {
  assert.equal(isTwaFocusPage, true);
  // A URL marker alone cannot authorize Android commands.
  assert.equal(hasTwaFocusChannel(), false);
  const messageHandler = handlers.get('message');
  assert.ok(messageHandler);

  const evil = new MessageChannel();
  messageHandler!({
    origin: 'android-app://unexpected.invalid',
    ports: [evil.port1],
    data: JSON.stringify({ type: 'NEVOFOCUS_TWA_HELLO', version: 1 }),
  });

  assert.equal(hasTwaFocusChannel(), false, 'Foreign origin must not activate native focus');
  const channel = new MessageChannel();
  const received: string[] = [];
  let nativeHandshake = false;
  channel.port2.on('message', (raw: string) => {
    const request = JSON.parse(raw);
    if (request.type === 'NEVOFOCUS_TWA_WEB_READY') {
      nativeHandshake = true;
      return;
    }
    received.push(request.type);
    const state = {
      active: request.type !== 'NEVOFOCUS_NATIVE_STOP',
      sessionKey: request.sessionKey || '1712345678',
      isPaused: request.isPaused || false,
      isBreakActive: request.isBreakActive || false,
      elapsedFocusSeconds: 125,
      elapsedBreakSeconds: 34,
      notificationPermissionGranted: true,
    };
    channel.port2.postMessage(JSON.stringify({
      type: 'NEVOFOCUS_NATIVE_STATE',
      requestId: request.requestId,
      state,
    }));
  });

  messageHandler!({
    origin: 'android-app://fokus.example.test',
    ports: [channel.port1],
    data: '',
  });
  assert.equal(hasTwaFocusChannel(), false, 'An empty port transfer waits for the host HELLO');
  const connected = new Promise<void>(resolve => handlers.set('nevofocus:twa-connected', () => resolve()));
  channel.port2.postMessage(JSON.stringify({ type: 'NEVOFOCUS_TWA_HELLO', version: 1 }));
  await connected;
  assert.equal(hasTwaFocusChannel(), true, 'Native TWA available only after verified hello');
  const sync = await twaFocus.sync({
    sessionKey: '1712345678',
    isPaused: false,
    isBreakActive: true,
    elapsedFocusSeconds: 125,
    elapsedBreakSeconds: 34,
  });
  assert.equal(nativeHandshake, true);
  assert.deepEqual(sync, { notificationPermissionGranted: true });
  const state = await twaFocus.getState();
  assert.equal(state.elapsedFocusSeconds, 125);
  assert.equal(state.notificationPermissionGranted, true);
  await twaFocus.stop();
  assert.deepEqual(received, [
    'NEVOFOCUS_NATIVE_SYNC',
    'NEVOFOCUS_NATIVE_QUERY',
    'NEVOFOCUS_NATIVE_STOP',
  ]);

  channel.port1.close();
  channel.port2.close();
  evil.port1.close();
  evil.port2.close();
});

