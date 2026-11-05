import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'native/android/app/src/main');
const read = relative => fs.readFileSync(path.join(base, relative), 'utf8');

test('one black row fills available content space: large hours/minutes, small seconds, pause and then break', () => {
  const xml = read('res/layout/nevofocus_live_notification.xml');
  const ids = ['focus_main_time', 'focus_seconds', 'focus_pause', 'focus_break'];
  let previous = -1;
  for (const id of ids) {
    const next = xml.indexOf('android:id="@+id/' + id + '"');
    assert.ok(next > previous, 'Controls must appear in correct order: ' + id);
    previous = next;
  }
  assert.ok(xml.includes('@drawable/nevofocus_black_capsule'));
  assert.ok(xml.includes('android:textColor="#FFFFFFFF"'));
  assert.ok(xml.includes('android:fontFamily="monospace"'));
  assert.ok(xml.includes('android:textSize="25sp"'));
  assert.ok(xml.includes('android:textSize="16sp"'));
  assert.ok(!xml.includes('focus_chronometer'), 'Uniform-size chronometer violates the separate seconds styling');
  assert.ok(!xml.includes('focus_status_dot'), 'No leading decoration before the large white time');
});

test('native foreground service owns each second and never requests an expanded custom panel', () => {
  const service = read('java/com/furknsss/nevofocus/FocusTimerService.java');
  for (const token of [
    'new Handler(Looper.getMainLooper())',
    'clockHandler.postDelayed(updateClock',
    'manager.notify(NOTIFICATION_ID, buildNotification(current))',
    'setTextViewText(R.id.focus_main_time',
    'setTextViewText(R.id.focus_seconds',
    'R.drawable.nevofocus_action_break_active',
    'R.drawable.nevofocus_action_play',
    'setOnClickPendingIntent(R.id.focus_pause',
    'setOnClickPendingIntent(R.id.focus_break',
    '.setCustomContentView(compact)',
    '.setOnlyAlertOnce(true)',
  ]) assert.ok(service.includes(token), 'Native notification must include ' + token);
  assert.ok(!service.includes('.setCustomBigContentView('), 'Do not declare a second expandable capsule');
  assert.ok(service.indexOf('setOnClickPendingIntent(R.id.focus_pause') <
            service.indexOf('setOnClickPendingIntent(R.id.focus_break'));
});

test('Android source formats hour, minute and seconds independently', () => {
  const fmt = read('java/com/furknsss/nevofocus/FocusTimerClockText.java');
  assert.ok(fmt.includes('"%02d:%02d"'));
  assert.ok(fmt.includes('":%02d"'));
});

test('Android 12+ system affordances are not misrepresented as removable', () => {
  const service = read('java/com/furknsss/nevofocus/FocusTimerService.java');
  assert.ok(service.includes('system expansion affordance'));
});
