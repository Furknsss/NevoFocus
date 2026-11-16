import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
test('Chrome-backed Android TWA launches in real immersive fullscreen', () => {
  const twa = read('native/android-twa/app/src/main/java/com/furknsss/nevofocus/MainActivity.java');
  assert.match(twa, /new TrustedWebActivityDisplayMode\.ImmersiveMode\(/);
  assert.match(twa, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES/);
  assert.match(twa, /setDisplayMode\(new TrustedWebActivityDisplayMode\.ImmersiveMode/);
  assert.match(twa, /setStatusBarColor\(android\.graphics\.Color\.BLACK\)/);
  assert.match(twa, /setNavigationBarColor\(android\.graphics\.Color\.BLACK\)/);
});
test('Capacitor Android shell hides both bars and supports transient gesture reveal', () => {
  const native = read('native/android/app/src/main/java/com/furknsss/nevofocus/MainActivity.java');
  assert.match(native, /controller\.hide\(android\.view\.WindowInsets\.Type\.statusBars\(\) \|/);
  assert.match(native, /android\.view\.WindowInsets\.Type\.navigationBars\(\)\)/);
  assert.match(native, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  assert.match(native, /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/);
});
test('OLED black is used across focus, header, splash and PWA manifest', () => {
  const app = read('src/App.tsx');
  const web = read('index.html');
  const css = read('src/index.css');
  const focus = read('src/components/DedicatedModeScreen.tsx');
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.match(app, /: 'bg-black';/);
  assert.match(web, /class="dark nevo-oled"/);
  assert.match(web, /<body class="bg-black/);
  assert.match(css, /html\.nevo-oled body,\s*html\.nevo-oled #root/);
  assert.match(css, /background: #000000/);
  assert.match(focus, /bg-\[#030303\]/);
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.background_color, '#000000');
});
test('version increments for in-place signed upgrade', () => {
  const script = read('scripts/setup-twa-android.mjs');
  assert.match(script, /versionCode 12/);
  assert.match(script, /1\.2\.7-premium-oled/);
});
