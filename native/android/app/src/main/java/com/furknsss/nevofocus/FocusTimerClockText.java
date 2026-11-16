package com.furknsss.nevofocus;

import java.util.Locale;

/**
 * Pure presentation logic for the single-row native notification.
 * Large: hours:minutes. Small: :seconds. Both freeze automatically on pause.
 */
final class FocusTimerClockText {
    private FocusTimerClockText() {}

    static final class Parts {
        final String hoursMinutes;
        final String seconds;
        Parts(String hoursMinutes, String seconds) {
            this.hoursMinutes = hoursMinutes;
            this.seconds = seconds;
        }
    }

    static Parts format(long elapsedMs) {
        long totalSeconds = Math.max(0L, elapsedMs / 1000L);
        long hours = totalSeconds / 3600L;
        long minutes = (totalSeconds % 3600L) / 60L;
        long seconds = totalSeconds % 60L;
        return new Parts(
                String.format(Locale.ROOT, "%02d:%02d", hours, minutes),
                String.format(Locale.ROOT, ":%02d", seconds)
        );
    }
}
