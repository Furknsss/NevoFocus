import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.CALENDAR_TEST_URL || 'http://127.0.0.1:4173';
for (let n = 0; n < 60; n++) {
  try { if ((await fetch(base)).ok) break; } catch {}
  if (n === 59) throw new Error('Preview server did not start');
  await new Promise(resolve => setTimeout(resolve, 250));
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, timezoneId: 'Europe/Istanbul' });
// This is an isolated guest profile. No live Firebase requests or user-account writes.
await context.route('**/*', route =>
  new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
await context.addInitScript(() => {
  if (!localStorage.getItem('calendar_qa_initialized')) {
    localStorage.setItem('fokus_guest_mode', 'true');
    localStorage.setItem('fokus_profile_v4', JSON.stringify({
      name: 'Calendar QA', userId: '', email: '', hasCompletedOnboarding: true,
      weeklyRestDays: [0], customRestDates: [], excludedRestDates: [],
    }));
    localStorage.setItem('calendar_qa_initialized', 'true');
  }
});
const page = await context.newPage();
try {
  await page.goto(base);
  const openCalendar = async () => {
    await page.getByRole('button', { name: /İstatistik/i }).first().click();
    await page.getByRole('button', { name: 'Aylık Takvim', exact: true }).click();
    await page.locator('button[data-date]').first().waitFor();
  };
  await openCalendar();
  assert.equal(await page.getByRole('checkbox').count(), 0, 'Checkboxes must initially be hidden');
  assert.equal(await page.locator('button[data-date]').filter({ hasText: 'mola günü' }).count(), 0,
    'Legacy Sundays must not display rest labels');
  await page.getByRole('button', { name: 'Mola günü seç', exact: true }).click();
  const count = await page.getByRole('checkbox').count();
  assert.ok(count >= 28 && count <= 31, 'Every actual calendar date needs one checkbox');
  assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 0);
  const first = page.getByRole('checkbox').nth(7);
  const second = page.getByRole('checkbox').nth(13);
  const selectedDates = [await first.getAttribute('data-date'), await second.getAttribute('data-date')].sort();
  await first.click();
  await second.click();
  assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 2);
  await first.focus(); await page.keyboard.press('Space');
  assert.equal(await first.getAttribute('aria-checked'), 'false', 'Keyboard must uncheck the date');
  await page.keyboard.press('Space');
  assert.equal(await first.getAttribute('aria-checked'), 'true');
  await page.getByTitle('Sonraki Ay', { exact: true }).click();
  assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 0,
    'Dates must not repeat in another month');
  await page.getByTitle('Önceki Ay', { exact: true }).click();
  assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 2);
  await page.screenshot({ path: 'calendar-selection-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Bitti', exact: true }).click();
  assert.equal(await page.getByRole('checkbox').count(), 0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fokus_profile_v4')));
  assert.equal(stored.restDaySelectionMode, 'dates');
  assert.deepEqual(stored.weeklyRestDays, []);
  assert.deepEqual(stored.customRestDates, selectedDates);
  await page.reload();
  await openCalendar();
  assert.equal(await page.locator('button[data-date]').filter({ hasText: 'mola günü' }).count(), 2,
    'Chosen dates must survive reload');
  await page.getByRole('button', { name: 'Mola günü seç', exact: true }).click();
  assert.equal(await page.locator('[role="checkbox"][aria-checked="true"]').count(), 2);
  console.log('Calendar UI passed: no default Sundays, selection, keyboard, month isolation and reload persistence');
} catch (error) {
  await page.screenshot({ path: 'calendar-failure.png', fullPage: true });
  console.error((await page.locator('body').innerText()).slice(0, 1800));
  throw error;
} finally {
  await browser.close();
}
