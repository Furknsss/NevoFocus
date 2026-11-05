import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { MessageChannel } from 'node:worker_threads';

test('the head listener preserves an empty Chrome port and early HELLO before the application loads', async () => {
  const listeners = new Map<string, Set<(event: any) => void>>();
  const win: any = {
    location: { origin: 'https://fokus.example.test', search: '?nevofocus_twa=1' },
    sessionStorage: { getItem: () => '1', setItem() {} },
    addEventListener(type: string, fn: any) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    dispatchEvent(event: any) {
      for (const fn of listeners.get(event.type) || []) fn(event);
      return true;
    },
  };
  (globalThis as any).window = win;
  vm.runInNewContext(fs.readFileSync(new URL('../public/twa-bootstrap.js', import.meta.url), 'utf8'), {
    window: win, location: win.location, sessionStorage: win.sessionStorage, URLSearchParams, Event,
  });
  const channel = new MessageChannel();
  const foreign = new MessageChannel();
  win.dispatchEvent({ type: 'message', origin: 'https://wrong.invalid', data: '', ports: [foreign.port1] });
  assert.equal(win.__nevoTwaBootstrap.channels.length, 0);
  win.dispatchEvent({ type: 'message', origin: win.location.origin, data: '', ports: [channel.port1] });
  channel.port2.postMessage(JSON.stringify({ type: 'NEVOFOCUS_TWA_HELLO', version: 1 }));
  const deadline = Date.now() + 1500;
  while (!win.__nevoTwaBootstrap.channels[0].messages.length && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(win.__nevoTwaBootstrap.channels[0].messages.length, 1);
  let ready = false;
  const acknowledged = new Promise<void>(resolve => {
    channel.port2.on('message', raw => {
      const message = JSON.parse(raw);
      if (message.type === 'NEVOFOCUS_TWA_WEB_READY') { ready = true; resolve(); }
      else channel.port2.postMessage(JSON.stringify({ type: 'NEVOFOCUS_NATIVE_STATE',
        requestId: message.requestId, state: { active: false, notificationPermissionGranted: true } }));
    });
  });
  const bridge = await import('../src/services/twaFocusBridge');
  await acknowledged;
  assert.equal(ready, true);
  assert.equal(bridge.hasTwaFocusChannel(), true);
  assert.equal((await bridge.twaFocus.getState()).notificationPermissionGranted, true);
  channel.port1.close(); channel.port2.close();
  foreign.port1.close(); foreign.port2.close();
});
