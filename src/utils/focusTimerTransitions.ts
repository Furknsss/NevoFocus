/**
 * Exact wall-clock accrual at a pause / break transition.
 *
 * A period that was paused must contribute zero focus/break seconds, even if
 * its anchor timestamp is older than the current wall clock. This prevents
 * a pause -> break action from counting paused time as study time.
 */
export function elapsedSecondsAtTransition(
  anchorMs: number,
  nowMs: number,
  wasPaused: boolean,
): number {
  if (wasPaused || !Number.isFinite(anchorMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - anchorMs) / 1000));
}
