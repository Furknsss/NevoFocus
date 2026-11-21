import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');

test('ÖSYM mode exists in types, settings, setup and saved preferred mode validation', () => {
  const types = read('src/types.ts');
  const storage = read('src/utils/storage.ts');
  const settings = read('src/components/FocusModeSettings.tsx');
  const setup = read('src/components/FocusSetup.tsx');
  const app = read('src/App.tsx');
  assert.match(types, /\| 'exam'/);
  assert.match(storage, /id: 'exam',\s*title: 'ÖSYM Saat'/);
  assert.match(settings, /exam: \{ icon: Clock3/);
  assert.match(settings, /selectedMode === 'exam' && <ExamMediaSettings/);
  assert.match(setup, /case 'exam':/);
  assert.match(app, /\['clock', 'exam', 'forest'/);
});

test('clock is a moving real analog clock, not a frozen imported photo', () => {
  const clock = read('src/components/ExamClockCanvas.tsx');
  assert.match(clock, /now\.getHours\(\)/);
  assert.match(clock, /now\.getMinutes\(\)/);
  assert.match(clock, /now\.getSeconds\(\)/);
  assert.match(clock, /rotate\(\$\{h\} 160 160\)/);
  assert.match(clock, /rotate\(\$\{m\} 160 160\)/);
  assert.match(clock, /rotate\(\$\{s\} 160 160\)/);
  assert.match(clock, /getExamAsset\('classroomImage'\)/);
  assert.match(clock, /isPaused \? 'SINAV DURDURULDU'/);
});

test('exam audio lives locally in IndexedDB and is never sent to the server', () => {
  const service = read('src/services/examExperience.ts');
  assert.match(service, /indexedDB\.open\(DB_NAME, 1\)/);
  assert.match(service, /store\.put\(file, kind\)/);
  assert.match(service, /new Audio\(ownedUrl\)/);
  assert.match(service, /audioElement\.loop = true/);
  assert.match(service, /audioElement\.volume = readExamPreferences\(\)\.volume/);
  assert.doesNotMatch(service, /fetch\(|uploadBytes\(|setDoc\(|addDoc\(/);
});

test('personal audio can be toggled, paused for breaks and stopped on finish', () => {
  const clock=read('src/components/ExamClockCanvas.tsx');
  const settings=read('src/components/ExamMediaSettings.tsx');
  const active=read('src/components/ActiveFocusSession.tsx');
  assert.match(clock, /shouldPauseAudio = prefs\.pauseOnBreak && \(isBreakActive \|\| isPaused\)/);
  assert.match(clock, /audioRequested \? 'Sınav sesini kapat' : 'Sınav sesini aç'/);
  assert.match(clock, /onTogglePause/);
  assert.match(clock, /onTakeBreak/);
  assert.match(settings, /storeExamAsset\(kind, file\)/);
  assert.match(settings, /updateExamPreferences\(update\)/);
  assert.match(active, /mode === 'exam'\) stopExamAudio\(\)/);
  assert.match(active, /<ExamClockCanvas/);
});

test('existing focus modes still render with no exam controls leaking into them', () => {
  const active=read('src/components/ActiveFocusSession.tsx');
  assert.match(active, /mode === 'clock' && \(\s*<ActiveClockCanvas/);
  assert.match(active, /mode !== 'clock' && mode !== 'exam'/);
  assert.match(active, /mode !== 'exam' && <SpotifyFocusWidget/);
});
