package com.furknsss.nevofocus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.widget.RemoteViews;

public final class FocusTimerService extends Service {
    static final String ACTION_SYNC = "com.furknsss.nevofocus.SYNC";
    static final String ACTION_PAUSE = "com.furknsss.nevofocus.PAUSE";
    static final String ACTION_BREAK = "com.furknsss.nevofocus.BREAK";

    private static final String CHANNEL_ID = "nevofocus_live_timer";
    private static final String PREFS = "nevofocus_native_focus_v1";
    private static final int NOTIFICATION_ID = 31415;

    static final class State {
        boolean active;
        String sessionKey = "";
        boolean paused;
        boolean onBreak;
        long focusMs;
        long breakMs;
        long anchorMs;

        long elapsedFocusMs() {
            return Math.max(0L, focusMs + (active && !paused && !onBreak
                    ? Math.max(0L, System.currentTimeMillis() - anchorMs) : 0L));
        }

        long elapsedBreakMs() {
            return Math.max(0L, breakMs + (active && !paused && onBreak
                    ? Math.max(0L, System.currentTimeMillis() - anchorMs) : 0L));
        }

        void freeze() {
            focusMs = elapsedFocusMs();
            breakMs = elapsedBreakMs();
            anchorMs = System.currentTimeMillis();
        }
    }

    static State read(Context context) {
        SharedPreferences pref = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        State s = new State();
        s.active = pref.getBoolean("active", false);
        s.sessionKey = pref.getString("sessionKey", "");
        s.paused = pref.getBoolean("paused", false);
        s.onBreak = pref.getBoolean("onBreak", false);
        s.focusMs = pref.getLong("focusMs", 0L);
        s.breakMs = pref.getLong("breakMs", 0L);
        s.anchorMs = pref.getLong("anchorMs", System.currentTimeMillis());
        return s;
    }

    private static void store(Context context, State s) {
        context.getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean("active", s.active)
                .putString("sessionKey", s.sessionKey)
                .putBoolean("paused", s.paused)
                .putBoolean("onBreak", s.onBreak)
                .putLong("focusMs", s.focusMs)
                .putLong("breakMs", s.breakMs)
                .putLong("anchorMs", s.anchorMs)
                .apply();
    }

    static void stop(Context context) {
        State s = read(context);
        s.active = false;
        store(context, s);
        context.stopService(new Intent(context, FocusTimerService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        State state = read(this);
        String action = intent == null ? null : intent.getAction();

        if (ACTION_SYNC.equals(action)) {
            state.active = true;
            state.sessionKey = intent.getStringExtra("sessionKey");
            state.paused = intent.getBooleanExtra("paused", false);
            state.onBreak = intent.getBooleanExtra("onBreak", false);
            state.focusMs = Math.max(0L, intent.getLongExtra("focusMs", 0L));
            state.breakMs = Math.max(0L, intent.getLongExtra("breakMs", 0L));
            state.anchorMs = System.currentTimeMillis();
            store(this, state);
        } else if (ACTION_PAUSE.equals(action) && state.active) {
            state.freeze();
            state.paused = !state.paused;
            store(this, state);
        } else if (ACTION_BREAK.equals(action) && state.active) {
            state.freeze();
            state.onBreak = !state.onBreak;
            // Selecting "Mola" starts the break counter; selecting "Devam" resumes focus.
            state.paused = false;
            store(this, state);
        }

        if (!state.active) {
            stopSelf();
            return START_NOT_STICKY;
        }

        ensureChannel();
        Notification notification = buildNotification(state);
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_STICKY;
    }

    private PendingIntent serviceAction(String action, int requestCode) {
        Intent intent = new Intent(this, FocusTimerService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification(State state) {
        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.nevofocus_live_notification);
        RemoteViews expanded = new RemoteViews(getPackageName(), R.layout.nevofocus_live_notification);
        prepareViews(compact, state);
        prepareViews(expanded, state);

        PendingIntent openApp = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("NevoFocus")
                .setContentText(state.onBreak ? "Mola sürüyor" : "Odaklanma sürüyor")
                .setCategory(Notification.CATEGORY_SERVICE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(openApp)
                .setCustomContentView(compact)
                .setCustomBigContentView(expanded)
                .build();
    }

    private void prepareViews(RemoteViews views, State state) {
        long shownMs = state.onBreak ? state.elapsedBreakMs() : state.elapsedFocusMs();
        long base = SystemClock.elapsedRealtime() - shownMs;

        // Android renders and increments this timer itself, without a JavaScript interval.
        views.setChronometer(R.id.focus_chronometer, base, null, !state.paused);
        views.setTextViewText(R.id.focus_pause, state.paused ? "▶" : "Ⅱ");
        views.setContentDescription(R.id.focus_pause, state.paused ? "Devam et" : "Durdur");
        views.setTextViewText(R.id.focus_break, state.onBreak ? "Devam" : "Mola");
        views.setContentDescription(R.id.focus_break, state.onBreak ? "Molayı bitir" : "Mola ver");
        views.setOnClickPendingIntent(R.id.focus_pause, serviceAction(ACTION_PAUSE, 1));
        views.setOnClickPendingIntent(R.id.focus_break, serviceAction(ACTION_BREAK, 2));
    }

    private void ensureChannel() {
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    "Canlı kronometre", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("NevoFocus odaklanma süresi ve mola kontrolleri");
            channel.setSound(null, null);
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
}
