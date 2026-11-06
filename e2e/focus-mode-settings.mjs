import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.FOCUS_TEST_URL || 'http://127.0.0.1:4173';
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(base)).ok) break; } catch {}
  if (i === 59) throw new Error('Focus preview server did not start');
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  timezoneId: 'Europe/Istanbul',
});
await context.route('**/*', (route) =>
  new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort()
);
await context.addInitScript(() => {
  if (localStorage.getItem('focus_mode_qa_initialized')) return;
  localStorage.setItem('fokus_guest_mode', 'true');
  localStorage.setItem('fokus_profile_v4', JSON.stringify({
    name: 'Focus QA', userId: '', email: '', hasCompletedOnboarding: true,
    preferredFocusMode: 'clock', weeklyRestDays: [],
    customRestDates: [], excludedRestDates: [],
  }));
  localStorage.setItem('focus_mode_qa_initialized', 'true');
});
const page = await context.newPage();

try {
  await page.goto(base);
  const clockTitle = page.getByRole('heading', { name: 'Odaklan.', exact: true });
  await clockTitle.waitFor();
  assert.equal(await page.getByText('Dikkatini tek bir şeye ver. Sayacını ayarla, çalışmaya başla.').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Odaklanmaya Başla' }).count(), 1);
  assert.equal(await page.getByText('Mod Seçimine Dön').count(), 0, 'Old mode-picker back button must be absent');

  const openSettings = async () => {
    await page.getByRole('button', { name: 'Ayarlar', exact: true }).last().click();
    await page.getByRole('button', { name: 'Modlar', exact: true }).waitFor();
  };
  await openSettings();
  const selectedClock = page.getByRole('radio', { name: /Dijital Saat/ });
  assert.equal(await selectedClock.getAttribute('aria-checked'), 'true', 'Clock must be default');
  assert.equal(await page.getByRole('radio').count(), 5);

  await page.getByRole('radio', { name: /Orman/ }).click();
  await page.getByRole('heading', { name: /Forest Kadim Orman Alanı/ }).waitFor();
  const storedAfterSwitch = await page.evaluate(() => JSON.parse(localStorage.getItem('fokus_profile_v4')));
  assert.equal(storedAfterSwitch.preferredFocusMode, 'forest', 'Selected mode must persist locally');
  await page.reload();
  await page.getByRole('heading', { name: /Forest Kadim Orman Alanı/ }).waitFor();

  await openSettings();
  await page.getByRole('button', { name: 'Mola günü ayarları' }).click();
  await page.getByText('Haftalık Mola & Dinlenme Sistemi').waitFor();
  await page.getByRole('button', { name: /Modlara dön/ }).click();
  assert.equal(await page.getByRole('radio', { name: /Orman/ }).getAttribute('aria-checked'), 'true');
  await page.getByRole('radio', { name: /Dijital Saat/ }).click();
  await clockTitle.waitFor();
  await page.screenshot({ path: 'focus-settings-mobile.png', fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await clockTitle.waitFor();
  await page.screenshot({ path: 'focus-settings-desktop.png', fullPage: true });
  assert.equal(await page.getByRole('button', { name: 'Odaklanmaya Başla' }).count(), 1);
  console.log('Focus UI passed: direct clock, settings-only modes, rest-day access, mobile/desktop and persistence.');
} catch (error) {
  await page.screenshot({ path: 'focus-settings-failure.png', fullPage: true });
  console.error((await page.locator('body').innerText()).slice(0, 2400));
  throw error;
} finally {
  await browser.close();
}
