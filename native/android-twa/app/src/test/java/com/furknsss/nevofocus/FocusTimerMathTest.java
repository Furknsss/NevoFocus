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
    @Test public void movingWallClockForwardCannotAddStudyTime() {
        assertEquals(42_000L, FocusTimerMath.elapsedFromClocks(
                10_000, 100_000, 20_000, 8, 100_000 + 8 * 3600_000, 52_000, 8, true));
    }

    @Test public void movingWallClockBackwardCannotLoseStudyTime() {
        assertEquals(42_000L, FocusTimerMath.elapsedFromClocks(
                10_000, 100_000, 20_000, 8, -100_000, 52_000, 8, true));
    }

    @Test public void pauseIgnoresBothClockChanges() {
        assertEquals(10_000L, FocusTimerMath.elapsedFromClocks(
                10_000, 100_000, 20_000, 8, 900_000, 52_000, 8, false));
    }

    @Test public void differentBootUsesExistingWallRecoveryInsteadOfUnrelatedUptime() {
        assertEquals(15_000L, FocusTimerMath.elapsedFromClocks(
                10_000, 100_000, 20_000, 8, 105_000, 900_000, 9, true));
    }

    @Test public void oldSavedSessionsStillRecover() {
        assertEquals(15_000L, FocusTimerMath.elapsedFromClocks(
                10_000, 100_000, -1, -1, 105_000, 900_000, 9, true));
    }

    @Test public void countdownDoesNotDropASecondEarlyOrGoNegative() {
        assertEquals(30_000L, FocusTimerMath.countdownDisplayMillis(30_000, 0));
        assertEquals(30_000L, FocusTimerMath.countdownDisplayMillis(30_000, 1));
        assertEquals(30_000L, FocusTimerMath.countdownDisplayMillis(30_000, 999));
        assertEquals(29_000L, FocusTimerMath.countdownDisplayMillis(30_000, 1_000));
        assertEquals(1_000L, FocusTimerMath.countdownDisplayMillis(30_000, 29_999));
        assertEquals(0L, FocusTimerMath.countdownDisplayMillis(30_000, 30_000));
        assertEquals(0L, FocusTimerMath.countdownDisplayMillis(30_000, 31_000));
    }
}
