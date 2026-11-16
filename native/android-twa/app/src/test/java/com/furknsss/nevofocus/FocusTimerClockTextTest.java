package com.furknsss.nevofocus;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public final class FocusTimerClockTextTest {
    @Test public void zeroShowsLargeHoursMinutesAndSmallSeconds() {
        FocusTimerClockText.Parts parts = FocusTimerClockText.format(0L);
        assertEquals("00:00", parts.hoursMinutes);
        assertEquals(":00", parts.seconds);
    }

    @Test public void minuteSecondBoundaryIsExact() {
        FocusTimerClockText.Parts parts = FocusTimerClockText.format(92_999L);
        assertEquals("00:01", parts.hoursMinutes);
        assertEquals(":32", parts.seconds);
    }

    @Test public void hourlyClockFormatting() {
        FocusTimerClockText.Parts parts = FocusTimerClockText.format(3_661_900L);
        assertEquals("01:01", parts.hoursMinutes);
        assertEquals(":01", parts.seconds);
    }

    @Test public void zeroFloorForInvalidNegativeTime() {
        FocusTimerClockText.Parts parts = FocusTimerClockText.format(-1_000L);
        assertEquals("00:00", parts.hoursMinutes);
        assertEquals(":00", parts.seconds);
    }

    @Test public void longStudySessionsDoNotWrapAt24Hours() {
        FocusTimerClockText.Parts parts = FocusTimerClockText.format(97_200_000L);
        assertEquals("27:00", parts.hoursMinutes);
        assertEquals(":00", parts.seconds);
    }
}
