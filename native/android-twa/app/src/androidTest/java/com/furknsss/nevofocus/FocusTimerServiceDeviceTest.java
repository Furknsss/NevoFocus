package com.furknsss.nevofocus;

import android.Manifest;
import android.app.NotificationManager;
import android.app.UiAutomation;
import android.content.Context;
import android.graphics.Bitmap;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;
import android.os.ParcelFileDescriptor;
import android.service.notification.StatusBarNotification;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;

import static org.junit.Assert.*;

/**
 * Runs inside a real Android emulator, not on the JVM.
 * No Firebase login or production PWA is needed to exercise the foreground service.
 */
@RunWith(AndroidJUnit4.class)
public class FocusTimerServiceDeviceTest {
    private Context context;

    @Before
    public void before() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        FocusTimerService.stop(context);
    }

    @After
    public void after() throws Exception {
        FocusTimerService.stop(context);
        androidx.test.uiautomator.UiDevice device = androidx.test.uiautomator.UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.wakeUp();
        device.executeShellCommand("wm dismiss-keyguard");
    }

    private void awaitState(boolean active, boolean paused, boolean onBreak) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 12_000L;
        while (SystemClock.uptimeMillis() < deadline) {
            FocusTimerService.State s = FocusTimerService.read(context);
            if (s.active == active && s.paused == paused && s.onBreak == onBreak) return;
            Thread.sleep(40);
        }
        FocusTimerService.State s = FocusTimerService.read(context);
        fail("Expected active=" + active + ", paused=" + paused + ", break=" + onBreak +
            " but got active=" + s.active + ", paused=" + s.paused + ", break=" + s.onBreak);
    }

    private void send(String action) {
        Intent intent = new Intent(context, FocusTimerService.class).setAction(action);
        if (FocusTimerService.ACTION_SYNC.equals(action)) {
            intent.putExtra("sessionKey", "emulator-verified");
            intent.putExtra("paused", false);
            intent.putExtra("onBreak", false);
            intent.putExtra("focusMs", 92_000L);
            intent.putExtra("breakMs", 0L);
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
            else context.startService(intent);
        } else {
            context.startService(intent);
        }
    }

    private void captureNotificationScreenshotIfPossible() {
        UiAutomation automation = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        try {
            try (ParcelFileDescriptor unused =
                    automation.executeShellCommand("cmd statusbar expand-notifications")) {
                // Give the notification shade time to finish expanding.
            }
            Thread.sleep(1100L);
            Bitmap image = automation.takeScreenshot();
            if (image != null) {
                try (FileOutputStream output = new FileOutputStream(
                        new File(context.getFilesDir(), "nevofocus-emulator-notification.png"))) {
                    image.compress(Bitmap.CompressFormat.PNG, 100, output);
                }
                image.recycle();
            }
        } catch (Exception ignored) {
            // Explicitly optional visual evidence. Behavior assertions must
            // pass on their own; a screenshot is not a pass/fail proxy.
        } finally {
            try (ParcelFileDescriptor unused =
                    automation.executeShellCommand("cmd statusbar collapse")) {
            } catch (Exception ignored) {}
        }
    }

    @Test
    public void backgroundServiceRestrictionOffersAnExplicitStartAction() throws Exception {
        Intent start = new Intent(context, FocusTimerService.class)
                .setAction(FocusTimerService.ACTION_SYNC)
                .putExtra("sessionKey", "manual-start-device-test")
                .putExtra("paused", false)
                .putExtra("onBreak", false)
                .putExtra("focusMs", 11_000L)
                .putExtra("breakMs", 0L);
        FocusTimerService.queueStartAfterBackgroundRestriction(context, start);
        FocusTimerService.State state = FocusTimerService.read(context);
        assertTrue(state.active);
        assertEquals("manual-start-device-test", state.sessionKey);
        assertTrue("Clock must keep its wall time while awaiting Android notification tap",
                state.elapsedFocusMs() >= 11_000L);

        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean found = false;
        long fallbackDeadline = SystemClock.uptimeMillis() + 8_000L;
        // NotificationManager may enqueue notify() asynchronously. Observe
        // the actual posted notification rather than asserting in the same tick.
        while (!found && SystemClock.uptimeMillis() < fallbackDeadline) {
            for (StatusBarNotification item : manager.getActiveNotifications()) {
                if ("NevoFocus kronometreyi başlat".equals(
                        item.getNotification().extras.getString(android.app.Notification.EXTRA_TITLE))) {
                    assertNotNull("Start action must be a real PendingIntent", item.getNotification().contentIntent);
                    assertTrue("Start notification must include an action button",
                            item.getNotification().actions != null &&
                            item.getNotification().actions.length > 0);
                    found = true;
                    break;
                }
            }
            if (!found) Thread.sleep(80L);
        }
        assertTrue("Android must publish a user-tappable service-start fallback", found);
    }

    @Test
    public void foregroundNotificationPauseBreakResumeAndStop() throws Exception {
        if (Build.VERSION.SDK_INT >= 33) {
            assertEquals("CI must grant POST_NOTIFICATIONS before running Android instrumentation",
                    PackageManager.PERMISSION_GRANTED,
                    context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS));
        }

        send(FocusTimerService.ACTION_SYNC);
        awaitState(true, false, false);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        long notificationDeadline = SystemClock.uptimeMillis() + 8_000L;
        boolean visible = false;
        while (SystemClock.uptimeMillis() < notificationDeadline && !visible) {
            for (StatusBarNotification item : manager.getActiveNotifications()) {
                if (item.getNotification().contentView != null) {
                    // SystemUI may auto-expand the row. Keep the same clock and controls.
                    if (context.getApplicationInfo().targetSdkVersion >= 31) {
                        assertNotNull(item.getNotification().bigContentView);
                        assertEquals(item.getNotification().contentView.getLayoutId(),
                                item.getNotification().bigContentView.getLayoutId());
                    } else {
                        assertNull("Compatibility capsule must not provide an expanded view",
                                item.getNotification().bigContentView);
                    }
                    visible = true;
                    assertEquals("Focus notification must be ongoing",
                            (item.getNotification().flags & android.app.Notification.FLAG_ONGOING_EVENT) != 0,
                            true);
                    break;
                }
            }
            if (!visible) Thread.sleep(60);
        }
        assertTrue("The premium Android chronometer notification must exist", visible);
        // Capture the REAL Android emulator notification shade so the capsule
        // can be visually inspected; screenshot failure cannot hide a timing bug.
        captureNotificationScreenshotIfPossible();

        send(FocusTimerService.ACTION_PAUSE);
        awaitState(true, true, false);
        FocusTimerService.State paused = FocusTimerService.read(context);
        long pausedFocus = paused.elapsedFocusMs();
        Thread.sleep(180);
        assertEquals("Paused study time cannot advance", pausedFocus,
                FocusTimerService.read(context).elapsedFocusMs());

        send(FocusTimerService.ACTION_BREAK);
        awaitState(true, false, true);
        FocusTimerService.State onBreak = FocusTimerService.read(context);
        long frozenFocus = onBreak.elapsedFocusMs();
        Thread.sleep(180);
        assertEquals("Focus time cannot advance during break", frozenFocus,
                FocusTimerService.read(context).elapsedFocusMs());
        assertTrue("Break timer must advance", FocusTimerService.read(context).elapsedBreakMs() > 0);

        send(FocusTimerService.ACTION_BREAK);
        awaitState(true, false, false);
        assertTrue("Focus timer must resume after break",
                FocusTimerService.read(context).elapsedFocusMs() >= frozenFocus);

        FocusTimerService.stop(context);
        awaitState(false, false, false);
    }
    private void tapActualSystemUiAction(
            androidx.test.uiautomator.UiDevice device, String label) throws Exception {
        device.openNotification();
        SystemClock.sleep(650L);
        // RemoteViews ids are sometimes exposed in SystemUI without the
        // dynamic spoken label, particularly with Android's collapsed shade.
        final String resource = label.equals("Durdur") || label.equals("Devam et")
                ? "focus_pause" : "focus_break";
        androidx.test.uiautomator.UiObject2 action = device.wait(
                androidx.test.uiautomator.Until.findObject(
                        androidx.test.uiautomator.By.res(context.getPackageName(), resource)), 4000L);
        if (action == null) {
            action = device.wait(androidx.test.uiautomator.Until.findObject(
                    androidx.test.uiautomator.By.desc(label)), 4500L);
        }
        assertNotNull("Android SystemUI must expose an actual, tappable Focus " +
                "notification control (" + resource + "): " + label, action);
        action.click();
    }

    @Test
    public void actualSystemUiButtonsPauseResumeAndStartEndBreak() throws Exception {
        // Unlike RemoteViews.apply(), this test dispatches physical UIAutomator
        // taps through Android SystemUI, with the app in the background.
        startTimingSession(false, 92_000L, 0L);
        androidx.test.uiautomator.UiDevice device =
                androidx.test.uiautomator.UiDevice.getInstance(
                        InstrumentationRegistry.getInstrumentation());
        device.pressHome();

        tapActualSystemUiAction(device, "Durdur");
        awaitState(true, true, false);
        final long paused = FocusTimerService.read(context).elapsedFocusMs();
        Thread.sleep(200L);
        assertEquals("Focus time must freeze from a genuine SystemUI tap",
                paused, FocusTimerService.read(context).elapsedFocusMs());

        tapActualSystemUiAction(device, "Devam et");
        awaitState(true, false, false);

        tapActualSystemUiAction(device, "Mola ver");
        awaitState(true, false, true);
        final long pausedForBreak = FocusTimerService.read(context).elapsedFocusMs();
        Thread.sleep(240L);
        assertEquals("Focus time must freeze during a genuine SystemUI break",
                pausedForBreak, FocusTimerService.read(context).elapsedFocusMs());

        tapActualSystemUiAction(device, "Molayı bitir");
        awaitState(true, false, false);
        android.util.Log.i("NevoFocusTimingTest",
                "Verified actual Android SystemUI pause/resume/break/end-break taps");
    }

    private void tapNativeCapsuleControl(int controlId) throws Exception {
        final StatusBarNotification notification = clockNotification();
        assertNotNull("A genuine posted native focus notification must exist", notification);
        final java.util.concurrent.atomic.AtomicBoolean clicked =
                new java.util.concurrent.atomic.AtomicBoolean(false);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            // Inflate the actual posted RemoteViews, including its PendingIntent
            // click listeners, using Android's notification view implementation.
            android.widget.FrameLayout parent = new android.widget.FrameLayout(context);
            android.view.View capsule = notification.getNotification().contentView.apply(context, parent);
            android.view.View control = capsule.findViewById(controlId);
            if (control != null) clicked.set(control.performClick());
        });
        assertTrue("Native notification button must have a clickable PendingIntent listener", clicked.get());
    }

    @Test
    public void actualPostedCapsuleButtonsPauseAndToggleBreak() throws Exception {
        send(FocusTimerService.ACTION_SYNC);
        awaitState(true, false, false);
        awaitNotification(true);

        tapNativeCapsuleControl(R.id.focus_pause);
        awaitState(true, true, false);
        long frozen = FocusTimerService.read(context).elapsedFocusMs();
        Thread.sleep(220L);
        assertEquals("Work must remain paused after the notification button click",
                frozen, FocusTimerService.read(context).elapsedFocusMs());

        tapNativeCapsuleControl(R.id.focus_pause);
        awaitState(true, false, false);
        tapNativeCapsuleControl(R.id.focus_break);
        awaitState(true, false, true);
        long frozenDuringBreak = FocusTimerService.read(context).elapsedFocusMs();
        Thread.sleep(260L);
        assertEquals("Work time must stay frozen while a break is active",
                frozenDuringBreak, FocusTimerService.read(context).elapsedFocusMs());
        assertTrue("Break duration must advance after the actual PendingIntent",
                FocusTimerService.read(context).elapsedBreakMs() > 0L);

        tapNativeCapsuleControl(R.id.focus_break);
        awaitState(true, false, false);
    }

    private StatusBarNotification clockNotification() {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        for (StatusBarNotification item : manager.getActiveNotifications()) {
            if (item.getNotification().contentView != null &&
                    item.getNotification().contentView.getLayoutId() == R.layout.nevofocus_live_notification) return item;
        }
        return null;
    }

    private void awaitNotification(boolean exists) throws Exception {
        long until = SystemClock.uptimeMillis() + 10000;
        while (SystemClock.uptimeMillis() < until) {
            if ((clockNotification() != null) == exists) return;
            Thread.sleep(80);
        }
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        StringBuilder remaining = new StringBuilder();
        for (StatusBarNotification item : manager.getActiveNotifications()) {
            remaining.append(" id=").append(item.getId()).append(" layout=")
                    .append(item.getNotification().contentView == null ? -1 : item.getNotification().contentView.getLayoutId());
        }
        fail("Native clock existence did not become " + exists + "; remaining:" + remaining);
    }

    private long renderedClockMillis(StatusBarNotification notification) {
        java.util.concurrent.atomic.AtomicLong rendered = new java.util.concurrent.atomic.AtomicLong();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            android.view.View view = notification.getNotification().contentView.apply(
                    context, new android.widget.FrameLayout(context));
            String main = ((android.widget.TextView) view.findViewById(R.id.focus_main_time)).getText().toString();
            String seconds = ((android.widget.TextView) view.findViewById(R.id.focus_seconds)).getText().toString();
            String[] hm = main.split(":");
            rendered.set((Long.parseLong(hm[0]) * 3600L + Long.parseLong(hm[1]) * 60L
                    + Long.parseLong(seconds.substring(1))) * 1000L);
        });
        return rendered.get();
    }

    private void awaitFreshClock(boolean requireZero) throws Exception {
        long until = SystemClock.uptimeMillis() + 10000;
        long actual = -1, expected = -1;
        while (SystemClock.uptimeMillis() < until) {
            StatusBarNotification notification = clockNotification();
            if (notification != null) {
                actual = renderedClockMillis(notification);
                expected = FocusTimerService.read(context).displayedMs() / 1000L * 1000L;
                if (requireZero ? actual == 0 && expected == 0 : Math.abs(actual - expected) <= 1000L) return;
            }
            Thread.sleep(100);
        }
        fail("Posted clock was stale: expected=" + expected + " actual=" + actual);
    }

    private void startTimingSession(boolean countdown, long focus, long planned) throws Exception {
        Intent intent = new Intent(context, FocusTimerService.class).setAction(FocusTimerService.ACTION_SYNC)
                .putExtra("sessionKey", countdown ? "timing-countdown" : "timing-stopwatch")
                .putExtra("focusMs", focus).putExtra("breakMs", 0L)
                .putExtra("countdown", countdown).putExtra("plannedMs", planned)
                .putExtra("paused", false).putExtra("onBreak", false);
        context.startForegroundService(intent);
        awaitState(true, false, false);
        awaitNotification(true);
        assertTrue("Android boot counter must be available for monotonic recovery",
                FocusTimerService.read(context).currentBootCount >= 0);
    }

    private void restorePersistedServiceByNotificationTap(
            androidx.test.uiautomator.UiDevice device) throws Exception {
        // Recreating a service from a test in the launcher is still subject to Android's
        // background-start policy. Use a real user-tapped foreground-service PendingIntent,
        // preserving the stored session and anchors instead of resynchronizing a fresh timer.
        final int restoreId = 63014;
        final String title = "NEVO_TEST_RESTORE";
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        android.app.NotificationChannel channel = new android.app.NotificationChannel(
                "nevofocus_test_restore", "Test restore", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
        android.app.PendingIntent restore = android.app.PendingIntent.getForegroundService(context, restoreId,
                new Intent(context, FocusTimerService.class).setAction(FocusTimerService.ACTION_RETRY),
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        manager.notify(restoreId, new android.app.Notification.Builder(context, channel.getId())
                .setSmallIcon(R.drawable.nevofocus_notification_icon).setContentTitle(title)
                .setContentIntent(restore).setAutoCancel(true).build());
        try {
            device.openNotification();
            android.os.SystemClock.sleep(900L);
            androidx.test.uiautomator.UiObject2 button = device.wait(
                    androidx.test.uiautomator.Until.findObject(androidx.test.uiautomator.By.text(title)), 4500);
            if (button == null) {
                button = device.findObject(androidx.test.uiautomator.By.descContains(title));
            }
            if (button != null) {
                button.click();
                android.util.Log.i("NevoFocusTimingTest",
                        "RESTORE_METHOD=SystemUI notification row tap");
            } else {
                // Android 14 emulator images sometimes hide the test channel's
                // row from the accessibility hierarchy while NotificationManager
                // still exposes the notification. Exercise its *posted*
                // PendingIntent, never invoke the service handler directly.
                StatusBarNotification posted = null;
                for (StatusBarNotification item : manager.getActiveNotifications()) {
                    if (item.getId() == restoreId && context.getPackageName().equals(item.getPackageName())) {
                        posted = item;
                        break;
                    }
                }
                assertNotNull("The restore notification must exist in Android", posted);
                assertNotNull("The posted notification must carry a restore PendingIntent",
                        posted.getNotification().contentIntent);
                posted.getNotification().contentIntent.send();
                android.util.Log.w("NevoFocusTimingTest",
                        "RESTORE_METHOD=posted PendingIntent delivery; SystemUI row inaccessible in emulator");
            }
            awaitNotification(true);
        } finally {
            manager.cancel(restoreId);
        }
    }

    private void assertTiming(String mode, long baselineElapsed, long baselineFocus) {
        long reference = SystemClock.elapsedRealtime() - baselineElapsed;
        long measured = FocusTimerService.read(context).elapsedFocusMs() - baselineFocus;
        long error = Math.abs(reference - measured);
        android.util.Log.i("NevoFocusTimingTest", "NEVO_TIMING mode=" + mode
                + " referenceMs=" + reference + " timerMs=" + measured + " errorMs=" + error);
        assertTrue("Clock drift over background/screen-off/recreation: " + error + "ms", error <= 500L);
    }

    @Test public void stopwatchRemainsAccurateInBackgroundScreenOffAndServiceRecreation() throws Exception {
        startTimingSession(false, 92000L, 0L);
        androidx.test.uiautomator.UiDevice device = androidx.test.uiautomator.UiDevice.getInstance(
                InstrumentationRegistry.getInstrumentation());
        long baselineElapsed = SystemClock.elapsedRealtime();
        long baselineFocus = FocusTimerService.read(context).elapsedFocusMs();
        device.pressHome();
        Thread.sleep(15000L);
        device.sleep();
        Thread.sleep(30000L);
        device.wakeUp();
        device.executeShellCommand("wm dismiss-keyguard");
        assertTiming("stopwatch-screen-off", baselineElapsed, baselineFocus);
        awaitFreshClock(false);

        // Recreate the actual Service instance without replacing its persisted session/anchor.
        assertTrue("The running service must accept stop", context.stopService(new Intent(context, FocusTimerService.class)));
        awaitNotification(false);
        Thread.sleep(2000L);
        restorePersistedServiceByNotificationTap(device);
        assertTiming("stopwatch-service-recreation", baselineElapsed, baselineFocus);
        awaitFreshClock(false);

        send(FocusTimerService.ACTION_PAUSE);
        awaitState(true, true, false);
        long frozen = FocusTimerService.read(context).elapsedFocusMs();
        Thread.sleep(1200L);
        assertEquals("Paused time must remain frozen after recreation", frozen,
                FocusTimerService.read(context).elapsedFocusMs());
    }

    @Test public void countdownRemainsAccurateWithScreenOffAndStopsDisplayingAtZero() throws Exception {
        startTimingSession(true, 10000L, 60000L);
        androidx.test.uiautomator.UiDevice device = androidx.test.uiautomator.UiDevice.getInstance(
                InstrumentationRegistry.getInstrumentation());
        long baselineElapsed = SystemClock.elapsedRealtime();
        long baselineFocus = FocusTimerService.read(context).elapsedFocusMs();
        device.pressHome();
        device.sleep();
        Thread.sleep(15000L);
        device.wakeUp();
        device.executeShellCommand("wm dismiss-keyguard");
        assertTiming("countdown-screen-off", baselineElapsed, baselineFocus);
        assertTrue(FocusTimerService.read(context).countdown);
        awaitFreshClock(false);

        startTimingSession(true, 59500L, 60000L);
        Thread.sleep(1500L);
        assertEquals("Countdown must clamp to zero", 0L, FocusTimerService.read(context).displayedMs());
        awaitFreshClock(true);
    }

}

