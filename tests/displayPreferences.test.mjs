import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applySavedDisplayPreferences,
  readDisplayPreferences,
  saveDisplayPreferences,
  enterImmersiveFocusDisplay,
} from '../src/services/displayPreferences.ts';

const cache = new Map();
const style = {
  zoom: '',
  fontSize: '',
  properties: {},
  setProperty(name, value) { this.properties[name] = value; },
};
globalThis.window = { localStorage: {
  getItem: name => cache.get(name) ?? null,
  setItem: (name, value) => cache.set(name, value),
} };
globalThis.document = { documentElement: { style } };

test('new device defaults to normal zoom and text size', () => {
  const prefs = applySavedDisplayPreferences();
  assert.deepEqual(prefs, { uiScale: 100, textScale: 100 });
  assert.equal(style.zoom, '100%');
  assert.equal(style.fontSize, '16px');
});

test('zoom and text sizes update independently and survive re-entry', () => {
  saveDisplayPreferences({ uiScale: 85 });
  assert.equal(style.zoom, '85%');
  assert.equal(style.fontSize, '16px');
  saveDisplayPreferences({ textScale: 125 });
  assert.deepEqual(readDisplayPreferences(), { uiScale: 85, textScale: 125 });
  assert.equal(style.fontSize, '20px');
  assert.equal(style.properties['--nevo-text-scale'], '1.25');
  applySavedDisplayPreferences();
  assert.equal(style.zoom, '85%');
});

test('invalid data is clamped to accessible slider range', () => {
  const p = saveDisplayPreferences({ uiScale: 1000, textScale: -50 });
  assert.deepEqual(p, { uiScale: 140, textScale: 80 });
  saveDisplayPreferences({ uiScale: 100, textScale: 100 });
  cache.set('nevofocus_display_preferences_v1', '{not valid');
  assert.deepEqual(readDisplayPreferences(), { uiScale: 100, textScale: 100 });
});

test('tablet settings include live sliders and honest music permission state', () => {
  const settings = readFileSync('src/components/SettingsModal.tsx', 'utf8');
  const entry = readFileSync('src/main.tsx', 'utf8');
  assert.match(settings, /Arayüz yakınlaştırma/);
  assert.match(settings, /Yazı boyutu/);
  assert.match(settings, /saveDisplayPreferences\(update\)/);
  assert.match(entry, /applySavedDisplayPreferences\(\)/);
  assert.match(settings, /Bildirim erişimi listesinde NevoFocus görünmez/);
  assert.match(settings, /setYoutubeAccessNotice\(message\)/);
  assert.match(settings, /twaYouTubeMusic\.isAvailable\(\)/);
});

test('immersive focus always occupies the real viewport, then restores saved zoom', () => {
  saveDisplayPreferences({ uiScale: 70, textScale: 145 });
  assert.equal(style.zoom, '70%');
  assert.equal(style.fontSize, '23.2px');
  const leave = enterImmersiveFocusDisplay();
  assert.equal(style.zoom, '100%');
  assert.equal(style.fontSize, '16px');
  // A slider event or preference save must not disturb an active focus screen.
  saveDisplayPreferences({ uiScale: 140, textScale: 80 });
  assert.equal(style.zoom, '100%');
  assert.equal(style.fontSize, '16px');
  // User preference is still saved for other screens.
  assert.deepEqual(readDisplayPreferences(), { uiScale: 140, textScale: 80 });
  leave();
  assert.equal(style.zoom, '140%');
  assert.equal(style.fontSize, '12.8px');
  leave(); // StrictMode-safe cleanup is idempotent.
  assert.equal(style.zoom, '140%');
  saveDisplayPreferences({ uiScale: 100, textScale: 100 });
});

test('portrait and landscape clock use one real-height layout and footer', () => {
  const clock = readFileSync('src/components/visuals/ActiveClockCanvas.tsx', 'utf8');
  const wrapper = readFileSync('src/components/ActiveFocusSession.tsx', 'utf8');
  const css = readFileSync('src/index.css', 'utf8');
  assert.doesNotMatch(clock, /min-h-screen/);
  assert.match(clock, /nevo-clock-stage[^"]*flex-1 min-h-0/);
  assert.match(clock, /nevo-clock-actions/);
  assert.match(clock, /nevo-clock-has-hours/);
  assert.match(wrapper, /useLayoutEffect\(\(\) => enterImmersiveFocusDisplay\(\), \[\]\)/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 580px\)/);
  assert.match(css, /nevo-clock-actions \{/);
  assert.match(css, /padding-bottom: max\(1\.5rem, env\(safe-area-inset-bottom, 0px\)\)/);
});
