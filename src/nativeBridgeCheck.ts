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
document.getElementById('start')!.onclick = async () => {
  try {
    await twaFocus.sync({ sessionKey: 'chrome-end-to-end', isPaused: false, isBreakActive: false,
      elapsedFocusSeconds: 92, elapsedBreakSeconds: 0, timerType: 'stopwatch', plannedMinutes: 0 });
    status.textContent = 'BILDIRIM_BASLADI';
  } catch (error) { status.textContent = String(error); }
};
document.getElementById('refresh')!.onclick = () => void report();
document.getElementById('stop')!.onclick = async () => {
  try { await twaFocus.stop(); status.textContent = 'BILDIRIM_KAPANDI'; }
  catch (error) { status.textContent = String(error); }
};
