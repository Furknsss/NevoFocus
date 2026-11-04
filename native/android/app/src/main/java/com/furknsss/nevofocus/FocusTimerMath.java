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
}
