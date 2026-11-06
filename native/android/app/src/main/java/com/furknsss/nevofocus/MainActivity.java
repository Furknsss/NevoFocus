package com.furknsss.nevofocus;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Capacitor has a separate MainActivity from the Chrome-backed TWA.
 * Both must honour the Android focus notification PendingIntent.
 */
public class MainActivity extends BridgeActivity {
    private final Handler focusHandler = new Handler(Looper.getMainLooper());
    private boolean focusOpenRequested;
    private int focusDeliveryAttempts;
    private static final int MAX_FOCUS_DELIVERY_ATTEMPTS = 50;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeFocusPlugin.class);
        registerPlugin(NativeOAuthDiagnosticsPlugin.class);
        focusOpenRequested = isFocusNotificationIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    private boolean isFocusNotificationIntent(Intent intent) {
        return intent != null && FocusTimerService.ACTION_OPEN_FOCUS.equals(intent.getAction());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isFocusNotificationIntent(intent)) {
            focusOpenRequested = true;
            focusDeliveryAttempts = 0;
            scheduleFocusDelivery(0L);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (isFocusNotificationIntent(getIntent())) {
            focusOpenRequested = true;
        }
        if (focusOpenRequested) scheduleFocusDelivery(0L);
    }

    private void scheduleFocusDelivery(long delayMs) {
        focusHandler.removeCallbacksAndMessages(null);
        focusHandler.postDelayed(this::deliverFocusWhenWebReady, delayMs);
    }

    private void deliverFocusWhenWebReady() {
        if (!focusOpenRequested || isFinishing() || isDestroyed()) return;
        if (focusDeliveryAttempts++ >= MAX_FOCUS_DELIVERY_ATTEMPTS) {
            android.util.Log.e("NevoFocusNotification",
                    "Focus notification could not reach the web app after WebView startup");
            return;
        }

        final WebView view = getBridge() != null ? getBridge().getWebView() : null;
        if (view == null) {
            scheduleFocusDelivery(650L);
            return;
        }

        // Only deliver after the React component registered its listener.
        // A cold app start may load a splash WebView first; firing too early
        // loses the event, leaving the user on the ordinary landing screen.
        view.evaluateJavascript(
                "(function(){if(!window.__nevofocusFocusListenerReady)return false;" +
                "window.dispatchEvent(new Event('nevofocus:notification-open'));" +
                "return true;})()",
                result -> {
                    if (!focusOpenRequested || isFinishing()) return;
                    if ("true".equals(result)) {
                        focusOpenRequested = false;
                        // Consume this action so subsequent regular resumes do
                        // not navigate away from the user's chosen tab.
                        if (getIntent() != null) getIntent().setAction(Intent.ACTION_MAIN);
                    } else {
                        scheduleFocusDelivery(650L);
                    }
                });
    }

    @Override
    protected void onDestroy() {
        focusHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
