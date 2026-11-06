import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('tapping the full custom notification opens a Focus-specific TWA route', () => {
  const service = read('native/android/app/src/main/java/com/furknsss/nevofocus/FocusTimerService.java');
  const activity = read('native/android-twa/app/src/main/java/com/furknsss/nevofocus/MainActivity.java');
  assert.match(service, /setAction\(ACTION_OPEN_FOCUS\)/);
  assert.ok(service.includes('ACTION_OPEN_FOCUS = "com.furknsss.nevofocus.OPEN_FOCUS"'));
  assert.match(service, /Intent\.FLAG_ACTIVITY_CLEAR_TOP \| Intent\.FLAG_ACTIVITY_SINGLE_TOP/);
  assert.match(service, /setContentIntent\(openApp\)/);
  assert.match(service, /setOnClickPendingIntent\(R\.id\.focus_main_time, openApp\)/);
  assert.match(activity, /protected void onNewIntent\(Intent intent\)/);
  assert.match(activity, /urlBuilder\.appendQueryParameter\("nevofocus_focus", "1"\)/);
  assert.match(activity, /ACTION_OPEN_FOCUS\.equals\(getIntent\(\)\.getAction\(\)\)/);
});

test('Android notification action buttons remain foreground-service invocations', () => {
  const service = read('native/android/app/src/main/java/com/furknsss/nevofocus/FocusTimerService.java');
  assert.match(service, /PendingIntent\.getForegroundService\(this, requestCode, intent/);
  assert.match(service, /setOnClickPendingIntent\(R\.id\.focus_pause, serviceAction\(ACTION_PAUSE, 1\)\)/);
  assert.match(service, /setOnClickPendingIntent\(R\.id\.focus_break, serviceAction\(ACTION_BREAK, 2\)\)/);
  assert.match(service, /ACTION_PAUSE\.equals\(action\) && state\.active/);
  assert.match(service, /ACTION_BREAK\.equals\(action\) && state\.active/);
});

test('notification route resumes persisted session without wiping clock, mode or break state', () => {
  const app = read('src/App.tsx');
  assert.match(app, /url\.searchParams\.get\('nevofocus_focus'\) !== '1'/);
  assert.match(app, /window\.history\.replaceState\(window\.history\.state/);
  assert.match(app, /localStorage\.getItem\('fokus_active_session_running'\)/);
  assert.match(app, /setCurrentTab\('focus'\)/);
  assert.match(app, /setIsSessionActive\(true\)/);
  const active = read('src/components/ActiveFocusSession.tsx');
  assert.match(active, /nativeFocus\.getState\(\)/);
  assert.match(active, /setIsPaused\(state\.isPaused\)/);
  assert.match(active, /setIsCampActive\(state\.isBreakActive\)/);
});
