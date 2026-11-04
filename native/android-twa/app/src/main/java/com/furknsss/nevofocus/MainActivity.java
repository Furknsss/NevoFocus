package com.furknsss.nevofocus;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import org.json.JSONObject;

/**
 * Chrome-backed Trusted Web Activity.
 *
 * This Activity never loads Firebase in an Android WebView. The site runs in
 * Chrome under its real HTTPS origin and keeps its existing web/PWA identity.
 * Native timers are controlled only after verified Digital Asset Links +
 * successful postMessage channel establishment with this exact HTTPS origin.
 */
public final class MainActivity extends Activity {
    private static final String TAG = "NevoFocusTwa";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 306;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Uri siteOrigin = Uri.parse(TwaWebConfig.ORIGIN);
    private CustomTabsSession session;
    private CustomTabsServiceConnection connection;
    private String browserPackage;
    private boolean connected;
    private boolean verified;
    private boolean navigated;
    private boolean channelReady;
    private boolean webReady;
    private boolean channelRequested;
    private boolean launched;

    private final CustomTabsCallback callback = new CustomTabsCallback() {
        @Override
        public void onRelationshipValidationResult(int relation, @NonNull Uri origin,
                boolean result, @Nullable Bundle extras) {
            if (relation != CustomTabsService.RELATION_USE_AS_ORIGIN || !siteOrigin.equals(origin)) return;
            verified = result;
            Log.i(TAG, "Digital Asset Links postMessage origin validated: " + result);
            maybeRequestChannel();
        }

        @Override
        public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
            if (navigationEvent == NAVIGATION_FINISHED) {
                navigated = true;
                maybeRequestChannel();
            }
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle extras) {
            if (!verified) return;
            channelReady = true;
            sendHello();
            for (int attempt = 1; attempt <= 3; attempt++) {
                final int delay = attempt * 1100;
                handler.postDelayed(() -> {
                    if (channelReady && !webReady) sendHello();
                }, delay);
            }
        }

        @Override
        public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
            if (!verified || !channelReady || message.length() > 3000) return;
            handleWebMessage(message);
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        browserPackage = CustomTabsClient.getPackageName(this, null);
        if (browserPackage == null) {
            Log.e(TAG, "No browser with Android Custom Tabs is installed.");
            Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(TwaWebConfig.START_URL));
            startActivity(fallback);
            finish();
            return;
        }
        connection = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName name,
                    @NonNull CustomTabsClient client) {
                connected = true;
                client.warmup(0L);
                session = client.newSession(callback);
                if (session == null) {
                    Log.e(TAG, "Could not start a Custom Tabs session.");
                    return;
                }
                session.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, siteOrigin, null);
                launchTwa();
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {
                connected = false;
                channelReady = false;
                verified = false;
                session = null;
            }
        };
        if (!CustomTabsClient.bindCustomTabsService(this, browserPackage, connection)) {
            Log.e(TAG, "Couldn't bind to Custom Tabs provider.");
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(TwaWebConfig.START_URL)));
            finish();
        }
    }

    private void launchTwa() {
        if (launched || session == null) return;
        launched = true;
        // Explicit marker only gates the JavaScript bridge path; it is not an
        // authentication token or a replacement for Chrome origin validation.
        Uri url = Uri.parse(TwaWebConfig.START_URL).buildUpon()
                .appendQueryParameter("nevofocus_twa", "1").build();
        new TrustedWebActivityIntentBuilder(url)
                .setToolbarColor(android.graphics.Color.BLACK)
                .setNavigationBarColor(android.graphics.Color.BLACK)
                .build(session).launchTrustedWebActivity(this);
    }

    private void maybeRequestChannel() {
        if (!verified || !navigated || channelRequested || session == null) return;
        channelRequested = true;
        // Source and target must both be our own validated HTTPS origin.
        if (!session.requestPostMessageChannel(siteOrigin, siteOrigin, new Bundle())) {
            channelRequested = false;
            Log.e(TAG, "Could not request a TWA postMessage channel.");
        }
    }

    private void sendHello() {
        if (session == null || !channelReady || !verified) return;
        session.postMessage("{\"type\":\"NEVOFOCUS_TWA_HELLO\",\"version\":1}", null);
    }

    private void sendResponse(String type, String requestId, JSONObject state, String error) {
        if (!channelReady || session == null) return;
        try {
            JSONObject response = new JSONObject();
            response.put("type", type);
            response.put("requestId", requestId);
            if (state != null) response.put("state", state);
            if (error != null) response.put("error", error);
            session.postMessage(response.toString(), null);
        } catch (Exception e) {
            Log.e(TAG, "postMessage response failed", e);
        }
    }

    private JSONObject readState() throws Exception {
        FocusTimerService.State s = FocusTimerService.read(this);
        JSONObject result = new JSONObject();
        result.put("active", s.active);
        result.put("sessionKey", s.sessionKey);
        result.put("isPaused", s.paused);
        result.put("isBreakActive", s.onBreak);
        result.put("elapsedFocusSeconds", s.elapsedFocusMs() / 1000.0);
        result.put("elapsedBreakSeconds", s.elapsedBreakMs() / 1000.0);
        result.put("notificationPermissionGranted", hasNotificationPermission());
        return result;
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33 ||
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void handleWebMessage(String raw) {
        try {
            JSONObject message = new JSONObject(raw);
            String type = message.optString("type", "");
            if ("NEVOFOCUS_TWA_WEB_READY".equals(type)) {
                webReady = true;
                sendResponse("NEVOFOCUS_NATIVE_STATE", "", readState(), null);
                return;
            }
            if (!webReady) return;
            String requestId = message.optString("requestId", "");
            if (requestId.length() > 100) return;

            if ("NEVOFOCUS_NATIVE_QUERY".equals(type)) {
                sendResponse("NEVOFOCUS_NATIVE_STATE", requestId, readState(), null);
                return;
            }
            if ("NEVOFOCUS_NATIVE_STOP".equals(type)) {
                FocusTimerService.stop(this);
                sendResponse("NEVOFOCUS_NATIVE_STATE", requestId, readState(), null);
                return;
            }
            if (!"NEVOFOCUS_NATIVE_SYNC".equals(type)) return;

            String sessionKey = message.optString("sessionKey", "");
            if (!sessionKey.matches("[A-Za-z0-9_:-]{1,80}")) {
                sendResponse("NEVOFOCUS_NATIVE_ERROR", requestId, null, "invalid session key");
                return;
            }
            double focus = message.optDouble("elapsedFocusSeconds", Double.NaN);
            double rest = message.optDouble("elapsedBreakSeconds", Double.NaN);
            if (!Double.isFinite(focus) || !Double.isFinite(rest) ||
                    focus < 0 || rest < 0 || focus > 30 * 86400 || rest > 30 * 86400) {
                sendResponse("NEVOFOCUS_NATIVE_ERROR", requestId, null, "invalid elapsed time");
                return;
            }
            Intent start = new Intent(this, FocusTimerService.class);
            start.setAction(FocusTimerService.ACTION_SYNC);
            start.putExtra("sessionKey", sessionKey);
            start.putExtra("paused", message.optBoolean("isPaused", false));
            start.putExtra("onBreak", message.optBoolean("isBreakActive", false));
            start.putExtra("focusMs", Math.round(focus * 1000));
            start.putExtra("breakMs", Math.round(rest * 1000));
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(start);
            else startService(start);
            if (!hasNotificationPermission() && Build.VERSION.SDK_INT >= 33) {
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_REQUEST);
            }
            sendResponse("NEVOFOCUS_NATIVE_STATE", requestId, readState(), null);
        } catch (Exception error) {
            Log.e(TAG, "native command failed", error);
            sendResponse("NEVOFOCUS_NATIVE_ERROR", "", null, error.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (connected && connection != null) {
            try { unbindService(connection); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
