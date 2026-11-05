import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserProfile } from '../src/types';
import { isDateRestDay, toggleRestDate } from '../src/utils/stats';

test('old weekly defaults do not automatically mark Sundays', () => {
  const profile = { weeklyRestDays: [0], customRestDates: [] } as UserProfile;
  for (const date of ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']) {
    assert.equal(isDateRestDay(date, profile), false);
  }
});

test('calendar checkboxes select a date without repeating its weekday or changing other dates', () => {
  const original = { weeklyRestDays: [0], customRestDates: ['2026-12-02'], excludedRestDates: [] } as UserProfile;
  const checked = { ...original, ...toggleRestDate('2026-11-08', original) };
  assert.equal(checked.restDaySelectionMode, 'dates');
  assert.deepEqual(checked.weeklyRestDays, []);
  assert.equal(isDateRestDay('2026-11-08', checked), true);
  assert.equal(isDateRestDay(new Date(2026, 10, 8), checked), true);
  assert.equal(isDateRestDay('2026-11-15', checked), false);
  assert.equal(isDateRestDay('2026-12-02', checked), true);
  const unchecked = { ...checked, ...toggleRestDate('2026-11-08', checked) };
  assert.equal(isDateRestDay('2026-11-08', unchecked), false);
  assert.deepEqual(unchecked.customRestDates, ['2026-12-02']);
  assert.deepEqual(original.weeklyRestDays, [0]);
  assert.deepEqual(original.customRestDates, ['2026-12-02']);
});

test('selecting an excluded date removes its old exception and survives persistence', () => {
  const profile = { customRestDates: ['2026-11-08'], excludedRestDates: ['2026-11-08', '2026-11-15'] } as UserProfile;
  const updated = JSON.parse(JSON.stringify({ ...profile, ...toggleRestDate('2026-11-08', profile) }));
  assert.equal(isDateRestDay('2026-11-08', updated), true);
  assert.deepEqual(updated.excludedRestDates, ['2026-11-15']);
});

test('recurring settings require a new explicit opt-in', () => {
  const profile = { restDaySelectionMode: 'weekly', weeklyRestDays: [0] } as UserProfile;
  assert.equal(isDateRestDay('2026-11-08', profile), true);
  assert.equal(isDateRestDay('2026-11-15', profile), true);
});
