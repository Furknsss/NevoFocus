import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

test('focus tab opens the selected mode directly, never a mode card hub', () => {
  const app = read('src/App.tsx');
  assert.match(app, /useState<FocusModeType>\(\(\) => getStoredProfile\(\)\.preferredFocusMode \|\| 'clock'\)/);
  assert.doesNotMatch(app, /<ModeHubSelection/);
  assert.doesNotMatch(app, /<CinematicTransitionCurtain/, 'Settings mode switches must not cover the focus screen');
  assert.doesNotMatch(app, /setCurrentActiveMode\(null\)/);
  assert.match(app, /\{currentTab === 'focus' && \(\s*<DedicatedModeScreen/);
  assert.match(app, /onSelectFocusMode=\{\(mode\) =>/);
});

test('clock is the persisted default and only settings can change the preferred mode', () => {
  const storage = read('src/utils/storage.ts');
  const settings = read('src/components/SettingsModal.tsx');
  const selector = read('src/components/FocusModeSettings.tsx');
  const sync = read('src/services/syncService.ts');
  assert.match(storage, /preferredFocusMode: 'clock'/);
  assert.match(storage, /FOCUS_MODES\.some\(\(mode\) => mode\.id === parsed\.preferredFocusMode\)/);
  assert.match(settings, /activeTab === 'modes'/);
  assert.match(settings, /onSelectMode=\{onSelectFocusMode\}/);
  assert.match(selector, /role="radiogroup"/);
  assert.match(selector, /selectionDisabled/);
  assert.match(sync, /preferredFocusMode: currentProfile\.preferredFocusMode \|\| 'clock'/);
  assert.match(sync, /patch\.preferredFocusMode = cloudProfile\.preferredFocusMode/);
});

test('mola günü preferences remain reachable without taking a main settings tab', () => {
  const settings = read('src/components/SettingsModal.tsx');
  const selector = read('src/components/FocusModeSettings.tsx');
  assert.match(settings, /onOpenRestDays=\{\(\) => setActiveTab\('breaks'\)\}/);
  assert.match(settings, /activeTab === 'breaks'/);
  assert.match(selector, /Mola günü ayarları/);
  assert.doesNotMatch(settings, /<span>Mola Günleri<\/span>/);
});

test('focus setup keeps countdown and stopwatch while offering a single clean clock hero', () => {
  const view = read('src/components/DedicatedModeScreen.tsx');
  assert.doesNotMatch(view, /onBackToHub/);
  assert.match(view, /Odaklanmaya Başla/);
  assert.match(view, /timerType === 'stopwatch'/);
  assert.match(view, /renderUnifiedTaskTimerBar/);
});
