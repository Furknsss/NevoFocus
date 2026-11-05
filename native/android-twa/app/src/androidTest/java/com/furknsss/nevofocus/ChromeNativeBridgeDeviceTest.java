package com.furknsss.nevofocus;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import static org.junit.Assert.*;

/** Real Chrome + DAL + production JavaScript + native notification. No Firebase account. */
@RunWith(AndroidJUnit4.class)
public class ChromeNativeBridgeDeviceTest {
    private Context context;
    private UiDevice device;
    @Before public void setup() {
        Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("chromeE2e")));
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        FocusTimerService.stop(context);
    }
    @After public void cleanup() throws Exception {
        if (context == null) return;
        device.dumpWindowHierarchy(new File(context.getFilesDir(), "chrome-ui.xml"));
        capture("chrome-failure.png");
        FocusTimerService.stop(context);
    }
    private void capture(String name) throws Exception {
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("Real emulator screenshot must be available", bitmap);
        try (FileOutputStream out = new FileOutputStream(new File(context.getFilesDir(), name))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out));
        }
        bitmap.recycle();
    }
    private void chromeWelcome() throws Exception {
        Intent browser = context.getPackageManager().getLaunchIntentForPackage("com.android.chrome");
        assertNotNull("The test must use real Chrome, never an ATD browser stub", browser);
        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(browser);
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            boolean clicked = false;
            for (String label : new String[]{"Use without an account", "Accept & continue", "No thanks", "Got it", "Continue without an account"}) {
                UiObject2 button = device.findObject(By.text(label));
                if (button != null) { button.click(); clicked = true; SystemClock.sleep(400); break; }
            }
            if (!clicked) SystemClock.sleep(500);
        }
    }
    private void clickText(String text) {
        UiObject2 item = device.wait(Until.findObject(By.text(text)), 15000);
        assertNotNull("Missing web control: " + text, item);
        item.click();
    }
    private void openShade() {
        device.openNotification();
        // Accessibility nodes arrive before the shade finishes its surface transition.
        SystemClock.sleep(900);
        device.waitForIdle();
    }
    private void returnToChrome() {
        // Android may close the shade after dispatching a notification PendingIntent.
        // Back in Chrome itself would close the TWA rather than dismiss SystemUI.
        if ("com.android.systemui".equals(device.getCurrentPackageName())) {
            device.pressBack();
            SystemClock.sleep(500);
        }
    }
    private void clickDescription(String text) {
        openShade();
        UiObject2 item = device.wait(Until.findObject(By.desc(text)), 10000);
        assertNotNull("Missing native notification control: " + text, item);
        item.click();
    }
    private boolean nativeNotification() {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        for (StatusBarNotification item : manager.getActiveNotifications()) {
            if (item.getNotification().contentView != null) {
                assertEquals(context.getPackageName(), item.getPackageName());
                if (context.getApplicationInfo().targetSdkVersion >= 31) {
                    assertNotNull(item.getNotification().bigContentView);
                    assertEquals(item.getNotification().contentView.getLayoutId(),
                            item.getNotification().bigContentView.getLayoutId());
                } else {
                    assertNull("Compatibility capsule must not provide an expanded view",
                            item.getNotification().bigContentView);
                }
                return true;
            }
        }
        return false;
    }
    private void awaitState(boolean active, boolean paused, boolean rest) {
        long deadline = SystemClock.uptimeMillis() + 12000;
        while (SystemClock.uptimeMillis() < deadline) {
            FocusTimerService.State state = FocusTimerService.read(context);
            if (state.active == active && state.paused == paused && state.onBreak == rest) return;
            SystemClock.sleep(80);
        }
        FocusTimerService.State state = FocusTimerService.read(context);
        fail("Expected active=" + active + " paused=" + paused + " break=" + rest
                + " but actual active=" + state.active + " paused=" + state.paused
                + " break=" + state.onBreak + " foreground=" + device.getCurrentPackageName());
    }
    @Test public void websiteStartCreatesNativeCapsuleAndItsButtonsReconcileBackToChrome() throws Exception {
        chromeWelcome();
        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra("nevofocus.bridgeCheck", true);
        context.startActivity(launch);
        assertTrue("Real Chrome must establish the production web-to-Android bridge",
                device.wait(Until.hasObject(By.text("ANDROID_BAGLI")), 60000));
        clickText("BILDIRIMI_BASLAT");
        long deadline = SystemClock.uptimeMillis() + 15000;
        boolean tappedStart = false;
        while (!nativeNotification() && SystemClock.uptimeMillis() < deadline) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            for (StatusBarNotification item : manager.getActiveNotifications()) {
                String title = item.getNotification().extras.getString(android.app.Notification.EXTRA_TITLE);
                if (!tappedStart && "NevoFocus kronometreyi başlat".equals(title)) {
                    // Exercise the actual SystemUI PendingIntent exception if Android requires it.
                    device.openNotification();
                    UiObject2 start = device.wait(Until.findObject(By.text(title)), 5000);
                    assertNotNull(start); start.click(); tappedStart = true;
                }
            }
            SystemClock.sleep(100);
        }
        assertTrue("Start from the website must produce an app-owned RemoteViews notification", nativeNotification());
        awaitState(true, false, false);
        android.util.Log.i("NevoFocusChromeTest", "Explicit FGS notification tap required: " + tappedStart);
        openShade();
        assertTrue(device.wait(Until.hasObject(By.desc("Durdur")), 10000));
        if (context.getApplicationInfo().targetSdkVersion < 31) {
            UiObject2 capsule = device.findObject(By.res(context.getPackageName(), "focus_capsule"));
            UiObject2 clock = device.findObject(By.res(context.getPackageName(), "focus_main_time"));
            UiObject2 pause = device.findObject(By.res(context.getPackageName(), "focus_pause"));
            UiObject2 rest = device.findObject(By.res(context.getPackageName(), "focus_break"));
            assertNotNull("Actual capsule must be present in SystemUI", capsule);
            assertNotNull(clock);
            assertNotNull(pause);
            assertNotNull(rest);
            float density = context.getResources().getDisplayMetrics().density;
            android.graphics.Rect bounds = capsule.getVisibleBounds();
            assertTrue("Capsule must use the full compact height", bounds.height() / density >= 63f);
            assertTrue("Clock needs breathing room at the leading edge",
                    (clock.getVisibleBounds().left - bounds.left) / density >= 19f);
            assertTrue("Pause touch target must be large", pause.getVisibleBounds().height() / density >= 43f);
            assertTrue("Break touch target must be large", rest.getVisibleBounds().height() / density >= 43f);
            assertTrue("Both controls must fit inside the capsule",
                    rest.getVisibleBounds().right <= bounds.right &&
                    pause.getVisibleBounds().left > clock.getVisibleBounds().right);
            UiObject2 row = capsule;
            while (row.getParent() != null &&
                    !"com.android.systemui:id/expandableNotificationRow".equals(row.getResourceName())) {
                row = row.getParent();
            }
            assertNull("No app logo may return to the capsule", row.findObject(By.res("android", "icon")));
            assertNull("No expand arrow may return to the capsule", row.findObject(By.res("android", "expand_button")));
            android.util.Log.i("NevoFocusChromeTest", "NEVO_CAPSULE heightDp=" + bounds.height() / density
                    + " clockInsetDp=" + (clock.getVisibleBounds().left - bounds.left) / density
                    + " buttonDp=" + pause.getVisibleBounds().height() / density);
        }
        device.dumpWindowHierarchy(new File(context.getFilesDir(), "nevofocus-compat-ui.xml"));
        capture("nevofocus-chrome-notification.png");
        clickDescription("Durdur");
        awaitState(true, true, false);
        long frozen = FocusTimerService.read(context).elapsedFocusMs();
        SystemClock.sleep(1200);
        assertEquals(frozen, FocusTimerService.read(context).elapsedFocusMs());
        returnToChrome();
        clickText("DURUMU_YENILE");
        assertTrue("Notification pause must reach the website via the real Chrome port",
                device.wait(Until.hasObject(By.textContains("\"isPaused\":true")), 10000));
        device.openNotification();
        clickDescription("Devam et");
        awaitState(true, false, false);
        clickDescription("Mola ver");
        awaitState(true, false, true);
        long focus = FocusTimerService.read(context).elapsedFocusMs();
        SystemClock.sleep(1200);
        assertEquals(focus, FocusTimerService.read(context).elapsedFocusMs());
        assertTrue(FocusTimerService.read(context).elapsedBreakMs() > 0);
        clickDescription("Molayı bitir");
        awaitState(true, false, false);
        returnToChrome();
        clickText("BILDIRIMI_KAPAT");
        awaitState(false, false, false);
        deadline = SystemClock.uptimeMillis() + 8000;
        while (nativeNotification() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
        assertFalse("Finishing on the website must remove the native notification", nativeNotification());
    }
}
