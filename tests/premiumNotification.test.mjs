import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'native/android/app/src/main');
const read = relative => fs.readFileSync(path.join(base, relative), 'utf8');

test('compact and expanded notification preserve premium PWA dot-clock-coffee-pause order', () => {
  for (const suffix of ['nevofocus_live_notification.xml', 'nevofocus_live_notification_expanded.xml']) {
    const text = read('res/layout/' + suffix);
    const ids = ['focus_status_dot', 'focus_chronometer', 'focus_break', 'focus_pause'];
    let previous = -1;
    for (const id of ids) {
      const next = text.indexOf('android:id="@+id/' + id + '"');
      assert.ok(next > previous, suffix + ' must keep ' + id + ' after previous control');
      previous = next;
    }
    assert.ok(text.includes('@drawable/nevofocus_black_capsule'));
    assert.ok(text.includes('android:textColor="#FFFFFFFF"'));
    assert.ok(text.includes('android:fontFamily="monospace"'));
  }
});

test('native notification uses system Chronometer, button resource states, and click actions', () => {
  const service = read('java/com/furknsss/nevofocus/FocusTimerService.java');
  for (const token of [
    'setChronometer(R.id.focus_chronometer',
    'R.drawable.nevofocus_status_white',
    'R.drawable.nevofocus_status_red',
    'R.drawable.nevofocus_status_amber',
    'R.drawable.nevofocus_action_break_active',
    'R.drawable.nevofocus_action_play',
    'setOnClickPendingIntent(R.id.focus_break',
    'setOnClickPendingIntent(R.id.focus_pause',
  ]) assert.ok(service.includes(token), 'Missing native notification behavior: ' + token);
  assert.ok(service.indexOf('setOnClickPendingIntent(R.id.focus_break') <
    service.indexOf('setOnClickPendingIntent(R.id.focus_pause'));
});
