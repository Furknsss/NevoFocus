package com.furknsss.nevofocus;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "NativeFocus", permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class NativeFocusPlugin extends Plugin {
    @PluginMethod
    public void sync(PluginCall call) {
        if (call.getString("sessionKey") == null || call.getString("sessionKey").isEmpty()) {
            call.reject("sessionKey is required");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 &&
                getPermissionState("notifications") != PermissionState.GRANTED &&
                !getContext().getSharedPreferences("nevofocus_permission_prompt", 0)
                        .getBoolean("notificationRequested", false)) {
            getContext().getSharedPreferences("nevofocus_permission_prompt", 0).edit()
                    .putBoolean("notificationRequested", true).apply();
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        // The timer still works if notification permission is denied, but its
        // notification may not appear in the notification drawer on Android 13+.
        startService(call);
    }

    private void startService(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FocusTimerService.class)
                    .setAction(FocusTimerService.ACTION_SYNC);
            intent.putExtra("sessionKey", call.getString("sessionKey"));
            intent.putExtra("paused", Boolean.TRUE.equals(call.getBoolean("isPaused", false)));
            intent.putExtra("onBreak", Boolean.TRUE.equals(call.getBoolean("isBreakActive", false)));
            Number focus = call.getDouble("elapsedFocusSeconds", 0.0);
            Number rest = call.getDouble("elapsedBreakSeconds", 0.0);
            intent.putExtra("focusMs", Math.max(0L, Math.round(focus.doubleValue() * 1000.0)));
            intent.putExtra("breakMs", Math.max(0L, Math.round(rest.doubleValue() * 1000.0)));
            if (Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            JSObject result = new JSObject();
            result.put("notificationPermissionGranted", hasNotificationPermission());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to start Android live timer", e);
        }
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33 ||
                getPermissionState("notifications") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        FocusTimerService.State state = FocusTimerService.read(getContext());
        JSObject result = new JSObject();
        result.put("active", state.active);
        result.put("sessionKey", state.sessionKey);
        result.put("isPaused", state.paused);
        result.put("isBreakActive", state.onBreak);
        result.put("elapsedFocusSeconds", state.elapsedFocusMs() / 1000.0);
        result.put("elapsedBreakSeconds", state.elapsedBreakMs() / 1000.0);
        result.put("notificationPermissionGranted", hasNotificationPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        FocusTimerService.stop(getContext());
        call.resolve();
    }
}
