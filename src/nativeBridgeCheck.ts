// An explicit diagnostic page uses the production transport, with no Firebase/login.
import { twaFocus, hasTwaFocusChannel } from './services/twaFocusBridge';
const status = document.getElementById('status')!;
const state = document.getElementById('state')!;
const report = async () => {
  try {
    const result = await twaFocus.getState();
    status.textContent = 'ANDROID_BAGLI';
    state.textContent = JSON.stringify(result);
  } catch (error) { status.textContent = String(error); }
};
window.addEventListener('nevofocus:twa-connected', () => void report());
if (hasTwaFocusChannel()) void report();
// An explicit instrumented-device fixture. No account credentials, network
// writes or production user data are created by the diagnostic page.
let preparedSessionKey = '';
document.getElementById('prepare')!.onclick = () => {
  const startedAt = Date.now() - 92_000;
  preparedSessionKey = String(startedAt);
  localStorage.setItem('fokus_guest_mode', 'true');
  localStorage.setItem('fokus_profile_v4', JSON.stringify({
    name: 'NevoFocus Chrome E2E', userId: '', email: '',
    hasCompletedOnboarding: true, preferredFocusMode: 'clock',
    weeklyRestDays: [], customRestDates: [], excludedRestDates: [],
  }));
  localStorage.setItem('fokus_active_session_running', JSON.stringify({
    isActive: true, isFinished: false,
    startTime: startedAt, anchorTimestamp: Date.now(),
    accumulatedFocusSeconds: 92, accumulatedBreakSeconds: 0,
    breakAnchorTimestamp: null,
    elapsedCountUp: 92, breakSeconds: 0,
    isPaused: false, isCampActive: false, mode: 'clock',
    subject: { id: 'sub-serbest-calisma', name: 'Serbest Çalışma', color: '#6366f1' },
    plannedMinutes: 45, timerType: 'stopwatch',
  }));
  status.textContent = 'FOCUS_TEST_HAZIR';
};
document.getElementById('start')!.onclick = async () => {
  try {
    await twaFocus.sync({ sessionKey: preparedSessionKey || 'chrome-end-to-end', isPaused: false, isBreakActive: false,
      elapsedFocusSeconds: 92, elapsedBreakSeconds: 0, timerType: 'stopwatch', plannedMinutes: 0 });
    status.textContent = 'BILDIRIM_BASLADI';
  } catch (error) { status.textContent = String(error); }
};
document.getElementById('refresh')!.onclick = () => void report();
document.getElementById('stop')!.onclick = async () => {
  try { await twaFocus.stop(); status.textContent = 'BILDIRIM_KAPANDI'; }
  catch (error) { status.textContent = String(error); }
};
