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
    public void after() {
        FocusTimerService.stop(context);
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
                if (item.getNotification().contentView != null &&
                    item.getNotification().bigContentView != null) {
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
}
