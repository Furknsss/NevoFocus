import test from 'node:test';
import assert from 'node:assert/strict';

// Simulates the real NevoFocus Android TWA URL with existing site notification
// permission enabled. Neither direct nor service-worker notification may fire.
const messages: unknown[] = [];
let closeCount = 0;
let showCount = 0;
const registration = {
  active: { postMessage(message: unknown) { messages.push(message); } },
  async getNotifications() {
    return [{ close() { closeCount++; } }];
  },
  async showNotification() {
    showCount++;
  },
};
(globalThis as any).window = {
  location: { search: '?nevofocus_twa=1' },
  sessionStorage: {
    getItem: () => '1',
    setItem: () => {},
  },
};
(globalThis as any).navigator = {
  serviceWorker: {
    ready: Promise.resolve(registration),
    addEventListener() {},
  },
};
(globalThis as any).Notification = Object.assign(function FakeNotification() {
  showCount++;
}, { permission: 'granted' });

const { backgroundFocus, isNevoFocusTwaLaunch } = await import('../src/utils/backgroundFocus');

test('TWA page disables all Chrome notification and stops previous site timer', async () => {
  assert.equal(isNevoFocusTwaLaunch(), true);
  const payload = {
    mode: 'clock',
    modeLabel: 'Serbest Çalışma',
    subjectName: 'Serbest Çalışma',
    timerType: 'stopwatch' as const,
    plannedMinutes: 60,
    anchorTimestamp: Date.now() - 92000,
    accumulatedFocusSeconds: 0,
    breakAnchorTimestamp: Date.now(),
    accumulatedBreakSeconds: 0,
    isPaused: false,
    isCampActive: false,
    forceShow: true,
  };
  await backgroundFocus.stopWebTimerNotification();
  await backgroundFocus.syncLiveNotification(payload);
  await backgroundFocus.showStickyNotificationNow(payload);

  assert.equal(showCount, 0, 'The website must never issue a second notification in TWA');
  assert.ok(closeCount >= 1, 'Any old Chrome timer notification must be closed');
  assert.ok(messages.some((msg: any) => msg.type === 'STOP_FOCUS_TIMER'));
});
