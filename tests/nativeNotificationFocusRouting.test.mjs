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

test('Capacitor Android Activity delivers focus notification after the React listener mounts', () => {
  const activity = read('native/android/app/src/main/java/com/furknsss/nevofocus/MainActivity.java');
  const plugin = read('native/android/app/src/main/java/com/furknsss/nevofocus/NativeFocusPlugin.java');
  const app = read('src/App.tsx');
  assert.match(activity, /protected void onNewIntent\(Intent intent\)/);
  assert.match(activity, /FocusTimerService\.ACTION_OPEN_FOCUS/);
  assert.match(activity, /window\.__nevofocusFocusListenerReady/);
  assert.match(activity, /nevofocus:notification-open/);
  assert.match(activity, /focusOpenRequested = false/);
  assert.match(app, /focusWindow\.__nevofocusFocusListenerReady = true/);
  assert.match(plugin, /intent\.putExtra\("countdown", "countdown"\.equals\(timerType\)\)/);
  assert.match(plugin, /intent\.putExtra\("plannedMs", Math\.round\(plannedMinutes \* 60_000\)\)/);
});

test('Android notification action buttons remain foreground-service invocations', () => {
  const service = read('native/android/app/src/main/java/com/furknsss/nevofocus/FocusTimerService.java');
  assert.match(service, /PendingIntent\.getForegroundService\(this, requestCode, intent/);
  assert.match(service, /setOnClickPendingIntent\(R\.id\.focus_pause, serviceAction\(ACTION_PAUSE, 1\)\)/);
  assert.match(service, /setOnClickPendingIntent\(R\.id\.focus_break, serviceAction\(ACTION_BREAK, 2\)\)/);
  assert.match(service, /ACTION_PAUSE\.equals\(action\) && state\.active/);
  assert.match(service, /ACTION_BREAK\.equals\(action\) && state\.active/);
  assert.match(service, /builder\.addAction\(state\.paused \?/);
  assert.match(service, /builder\.addAction\(state\.onBreak \?/);
  assert.doesNotMatch(service, /compact\.setOnClickPendingIntent\(R\.id\.focus_capsule/);
  const layout = read('native/android/app/src/main/res/layout/nevofocus_live_notification.xml');
  assert.match(layout, /android:id="@\+id\/focus_pause"[\s\S]*?importantForAccessibility="yes"/);
  assert.match(layout, /android:id="@\+id\/focus_break"[\s\S]*?importantForAccessibility="yes"/);
});

test('notification route resumes persisted session without wiping clock, mode or break state', () => {
  const app = read('src/App.tsx');
  assert.match(app, /const hasDeepLink = url\.searchParams\.get\('nevofocus_focus'\) === '1'/);
  assert.match(app, /nevofocus:notification-open/);
  assert.match(app, /window\.history\.replaceState\(window\.history\.state/);
  assert.match(app, /localStorage\.getItem\('fokus_active_session_running'\)/);
  assert.match(app, /setCurrentTab\('focus'\)/);
  assert.match(app, /setIsSessionActive\(true\)/);
  const active = read('src/components/ActiveFocusSession.tsx');
  assert.match(active, /nativeFocus\.getState\(\)/);
  assert.match(active, /setIsPaused\(state\.isPaused\)/);
  assert.match(active, /setIsCampActive\(state\.isBreakActive\)/);
});

test('foreground capsule reuses stable PendingIntents and cached clock state', () => {
  const service = read('native/android/app/src/main/java/com/furknsss/nevofocus/FocusTimerService.java');
  assert.match(service, /private State clockState;/);
  assert.match(service, /State current = clockState != null \? clockState : read\(FocusTimerService\.this\)/);
  assert.match(service, /clockState = state;/);
  assert.match(service, /if \(ACTION_PAUSE\.equals\(action\) && pauseActionIntent != null\) return pauseActionIntent;/);
  assert.match(service, /if \(ACTION_BREAK\.equals\(action\) && breakActionIntent != null\) return breakActionIntent;/);
  assert.match(service, /if \(openFocusIntent != null\) return openFocusIntent;/);
  assert.match(service, /clockState = null;/);
});

test('Focus page checks notification controls promptly without polling in background', () => {
  const active = read('src/components/ActiveFocusSession.tsx');
  assert.match(active, /if \(busy \|\| !mounted \|\| isSessionEndedRef\.current\) return;/);
  assert.match(active, /if \(!document\.hidden && isNativeFocusAvailable\) void reconcile\(\);\s*\}, 650\);/);
  assert.match(active, /window\.clearInterval\(foregroundPoll\)/);
});
