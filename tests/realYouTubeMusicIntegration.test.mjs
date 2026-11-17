import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('YouTube Music uses actual Android media sessions and explicit user permission', () => {
  const media = read('native/android/app/src/main/java/com/furknsss/nevofocus/NevoYouTubeMusic.java');
  const listener = read('native/android/app/src/main/java/com/furknsss/nevofocus/NevoMusicNotificationListener.java');
  const setup = read('scripts/setup-android.mjs');
  assert.match(media, /com\.google\.android\.apps\.youtube\.music/);
  assert.match(media, /getActiveSessions\(listener\(ctx\)\)/);
  assert.match(media, /if \(!hasPermission\(ctx\)\) return null;/);
  assert.match(media, /transport\.(play|pause|skipToNext|skipToPrevious|seekTo)/);
  assert.match(listener, /extends NotificationListenerService/);
  assert.match(setup, /android\.permission\.BIND_NOTIFICATION_LISTENER_SERVICE/);
});
test('the verified TWA browser channel handles real music query, actions and permission settings', () => {
  const main = read('native/android-twa/app/src/main/java/com/furknsss/nevofocus/MainActivity.java');
  const bridge = read('src/services/twaFocusBridge.ts');
  assert.match(main, /"NEVOFOCUS_MUSIC_QUERY"\.equals\(type\)/);
  assert.match(main, /"NEVOFOCUS_MUSIC_CONTROL"\.equals\(type\)/);
  assert.match(main, /"NEVOFOCUS_MUSIC_OPEN_SETTINGS"\.equals\(type\)/);
  assert.match(bridge, /export const twaYouTubeMusic/);
  assert.match(bridge, /NEVOFOCUS_MUSIC_STATE/);
  assert.match(bridge, /NEVOFOCUS_MUSIC_ERROR/);
});
test('Focus player shows the real on-device track and sends controls to Android', () => {
  const service = read('src/services/spotifyService.ts');
  assert.match(service, /nativeYouTubeState/);
  assert.match(service, /twaYouTubeMusic\.getState\(\)/);
  assert.match(service, /twaYouTubeMusic\.control\(command, positionMs\)/);
  assert.match(service, /this\.lastYouTubeLiveTrack = live/);
  assert.match(service, /source: 'youtube_music'/);
  const settings = read('src/components/SettingsModal.tsx');
  assert.match(settings, /Cihaz Erişimini Aç/);
  assert.match(settings, /Bildirim erişimi/);
  assert.match(settings, /requestNativeYouTubePermission\(\)/);
  assert.doesNotMatch(settings, /YouTube Music \([^)]*\) doğrudan bağlandı!/);
});

// Direct-install builds should not request unused sensitive notification access.
test('direct-install Capacitor APK excludes notification listener; trusted TWA opts in', () => {
  const directSetup = read('scripts/setup-android.mjs');
  const twaSetup = read('scripts/setup-twa-android.mjs');
  assert.match(directSetup, /NEVOFOCUS_ENABLE_NOTIFICATION_LISTENER === '1'/);
  assert.match(directSetup, /if \(!enableMusicListener\)/);
  assert.match(twaSetup, /NEVOFOCUS_ENABLE_NOTIFICATION_LISTENER: '1'/);
});
