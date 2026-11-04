import test from 'node:test';
import assert from 'node:assert/strict';
import { elapsedSecondsAtTransition } from '../src/utils/focusTimerTransitions';

test('running focus accrues only completed seconds when entering break', () => {
  assert.equal(elapsedSecondsAtTransition(1_000, 12_500, false), 11);
});
test('paused focus contributes NO seconds when entering a break', () => {
  assert.equal(elapsedSecondsAtTransition(1_000, 12_500, true), 0);
});
test('paused break contributes NO seconds when returning to focus', () => {
  assert.equal(elapsedSecondsAtTransition(50_000, 120_000, true), 0);
});
test('running break accrues exact completed seconds', () => {
  assert.equal(elapsedSecondsAtTransition(10_000, 73_900, false), 63);
});
test('clock rollback and invalid anchors never create negative time', () => {
  assert.equal(elapsedSecondsAtTransition(10_000, 9_000, false), 0);
  assert.equal(elapsedSecondsAtTransition(Number.NaN, 12_000, false), 0);
  assert.equal(elapsedSecondsAtTransition(10_000, Infinity, false), 0);
});
