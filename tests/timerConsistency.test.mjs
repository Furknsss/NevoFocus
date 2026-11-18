import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitClockDisplaySeconds } from '../src/utils/clockDisplay.ts';
import { elapsedPreciseSecondsAtTransition } from '../src/utils/focusTimerTransitions.ts';

test('stopwatch digits never contain a decimal point from native milliseconds', () => {
  const t = splitClockDisplaySeconds(38.98742);
  assert.deepEqual(t, {
    hours: 0, minutes: 0, seconds: 38,
    hoursPadded: '00', minutesPadded: '00', secondsPadded: '38',
  });
  assert.equal(splitClockDisplaySeconds(59.999).secondsPadded, '59');
  assert.equal(splitClockDisplaySeconds(60.001).minutesPadded, '01');
  assert.equal(splitClockDisplaySeconds(60.001).secondsPadded, '00');
});

test('clock carries from 59:59 to 01:00:00 and beyond 24 hours', () => {
  assert.deepEqual(splitClockDisplaySeconds(3599.9), {
    hours: 0, minutes: 59, seconds: 59,
    hoursPadded: '00', minutesPadded: '59', secondsPadded: '59',
  });
  assert.deepEqual(splitClockDisplaySeconds(3600.001), {
    hours: 1, minutes: 0, seconds: 0,
    hoursPadded: '01', minutesPadded: '00', secondsPadded: '00',
  });
  assert.equal(splitClockDisplaySeconds(27 * 3600 + 2).hoursPadded, '27');
});

test('countdown does not drop seconds early', () => {
  assert.equal(splitClockDisplaySeconds(30.000, true).secondsPadded, '30');
  assert.equal(splitClockDisplaySeconds(29.999, true).secondsPadded, '30');
  assert.equal(splitClockDisplaySeconds(29.001, true).secondsPadded, '30');
  assert.equal(splitClockDisplaySeconds(29.000, true).secondsPadded, '29');
  assert.equal(splitClockDisplaySeconds(0.001, true).secondsPadded, '01');
  assert.equal(splitClockDisplaySeconds(0, true).secondsPadded, '00');
});

test('negative/invalid values always produce zero clock, not NaN/Infinity', () => {
  for(const v of [-999, Number.NaN, Infinity, -Infinity]) {
    const a=splitClockDisplaySeconds(v);
    assert.equal(a.hoursPadded, '00');
    assert.equal(a.minutesPadded, '00');
    assert.equal(a.secondsPadded, '00');
  }
});

test('pause/resume/break transitions retain every millisecond, except paused time', () => {
  const first = elapsedPreciseSecondsAtTransition(10_000, 10_345, false);
  const second = elapsedPreciseSecondsAtTransition(30_000, 30_655, false);
  assert.equal(first + second, 1);
  assert.equal(elapsedPreciseSecondsAtTransition(10_000, 999_999, true), 0);
  assert.equal(elapsedPreciseSecondsAtTransition(10_000, 9_999, false), 0);
  assert.equal(elapsedPreciseSecondsAtTransition(NaN, 20_000, false), 0);
});

test('only real native changes are reconciled, not every 650ms request', () => {
  const src=readFileSync('src/components/ActiveFocusSession.tsx','utf8');
  assert.match(src, /const clockDrifted =/);
  assert.match(src, /if \(!controlsChanged && !clockDrifted\) return;/);
  assert.match(src, /Math\.abs\(localFocus - state\.elapsedFocusSeconds\) > 1\.25/);
  assert.match(src, /Math\.max\(0, \(Date\.now\(\) - anchorTimestampRef\.current\) \/ 1000\)/);
  assert.match(src, /elapsedPreciseSecondsAtTransition/);
  assert.match(src, /Math\.ceil\(displayRawSecs\)/);
});

test('clock canvas has only one timer source and paused break cannot keep counting', () => {
  const src=readFileSync('src/components/visuals/ActiveClockCanvas.tsx','utf8');
  assert.match(src, /splitClockDisplaySeconds/);
  assert.match(src, /const isBreakRunning = parentBreakActive;/);
  assert.match(src, /onTogglePause\(\);/);
  assert.doesNotMatch(src, /setInterval/);
  assert.doesNotMatch(src, /String\(seconds % 60\)/);
});

test('Android notification time uses SystemUI chronometer, not jittery app notifications', () => {
  const src=readFileSync('native/android/app/src/main/java/com/furknsss/nevofocus/FocusTimerService.java','utf8');
  const xml=readFileSync('native/android/app/src/main/res/layout/nevofocus_live_notification.xml','utf8');
  assert.match(xml, /<Chronometer/);
  assert.match(src, /setChronometerCountDown\(R\.id\.focus_chronometer, countDown\)/);
  assert.match(src, /setChronometer\(R\.id\.focus_chronometer, base, null, state\.active && !state\.paused\)/);
  assert.match(src, /SystemClock\.elapsedRealtime\(\)/);
  assert.doesNotMatch(src, /clockHandler|updateClock/);
  assert.match(src, /state\.freeze\(\)/);
  assert.match(src, /state\.paused = !state\.paused/);
  assert.match(src, /state\.onBreak = !state\.onBreak/);
});
