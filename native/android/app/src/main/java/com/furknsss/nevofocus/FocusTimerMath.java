package com.furknsss.nevofocus;

/** Pure, deterministic arithmetic shared by Android stopwatch states and unit tests. */
final class FocusTimerMath {
    private FocusTimerMath() {}

    static long elapsedMillis(long accumulatedMs, long anchorMs, long nowMs, boolean running) {
        long base = Math.max(0L, accumulatedMs);
        if (!running || nowMs <= anchorMs) return base;
        long additional = nowMs - anchorMs;
        if (additional < 0L || Long.MAX_VALUE - base < additional) return Long.MAX_VALUE;
        return base + additional;
    }
    /** Same-boot intervals use a monotonic clock which includes deep sleep. */
    static long elapsedFromClocks(long accumulatedMs, long wallAnchorMs, long elapsedAnchorMs,
            int anchorBoot, long wallNowMs, long elapsedNowMs, int currentBoot, boolean running) {
        if (elapsedAnchorMs >= 0 && anchorBoot >= 0 && anchorBoot == currentBoot) {
            return elapsedMillis(accumulatedMs, elapsedAnchorMs, elapsedNowMs, running);
        }
        // Old saved sessions and a different boot retain their existing wall-time recovery.
        return elapsedMillis(accumulatedMs, wallAnchorMs, wallNowMs, running);
    }

    /** Countdown shows a full second until that second has actually elapsed. */
    static long countdownDisplayMillis(long plannedMs, long focusMs) {
        long remaining = Math.max(0L, Math.max(0L, plannedMs) - Math.max(0L, focusMs));
        long rounding = (1000L - remaining % 1000L) % 1000L;
        return Long.MAX_VALUE - remaining < rounding ? Long.MAX_VALUE : remaining + rounding;
    }
}

