package com.furknsss.nevofocus;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public final class FocusTimerMathTest {
    @Test public void runningFocusAdvances() {
        assertEquals(12_300L, FocusTimerMath.elapsedMillis(10_000, 100_000, 102_300, true));
    }

    @Test public void pausedTimerDoesNotAdvance() {
        assertEquals(10_000L, FocusTimerMath.elapsedMillis(10_000, 100_000, 203_000, false));
    }

    @Test public void frozenBreakDoesNotCountPauseTime() {
        assertEquals(5_000L, FocusTimerMath.elapsedMillis(5_000, 90_000, 290_000, false));
    }

    @Test public void stoppedTimerNeverAdvances() {
        assertEquals(5_000L, FocusTimerMath.elapsedMillis(5_000, 90_000, 290_000, false));
    }

    @Test public void wallClockRollbackDoesNotSubtractTime() {
        assertEquals(10_000L, FocusTimerMath.elapsedMillis(10_000, 100_000, 98_000, true));
    }

    @Test public void hugeDurationsSaturateInsteadOfOverflow() {
        assertEquals(Long.MAX_VALUE,
                FocusTimerMath.elapsedMillis(Long.MAX_VALUE - 10, 1000, 2000, true));
    }
}
