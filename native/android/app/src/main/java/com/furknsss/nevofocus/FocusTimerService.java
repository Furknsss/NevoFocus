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
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.widget.RemoteViews;

public final class FocusTimerService extends Service {
    static final String ACTION_SYNC = "com.furknsss.nevofocus.SYNC";
    static final String ACTION_PAUSE = "com.furknsss.nevofocus.PAUSE";
    static final String ACTION_BREAK = "com.furknsss.nevofocus.BREAK";
    static final String ACTION_RETRY = "com.furknsss.nevofocus.RETRY";

    private static final String CHANNEL_ID = "nevofocus_live_timer";
    private static final String START_CHANNEL_ID = "nevofocus_timer_start_action";
    private static final String PREFS = "nevofocus_native_focus_v1";
    private static final int NOTIFICATION_ID = 31415;
    private static final int START_NOTIFICATION_ID = 31416;
    private final Handler clockHandler = new Handler(Looper.getMainLooper());
    private final Runnable updateClock = new Runnable() {
        @Override public void run() {
            State current = read(FocusTimerService.this);
            if (!current.active || current.paused) return;
            try {
                NotificationManager manager = (NotificationManager)
                        getSystemService(Context.NOTIFICATION_SERVICE);
                manager.notify(NOTIFICATION_ID, buildNotification(current));
            } catch (SecurityException ignored) {
                // Notification permission might have been revoked after the session started.
            }
            // Anchor updates to system uptime so the text advances once a second.
            long delay = 1000L - (SystemClock.uptimeMillis() % 1000L);
            clockHandler.postDelayed(this, delay);
        }
    };

    private void refreshClockUpdates(State state) {
        clockHandler.removeCallbacks(updateClock);
        if (state.active && !state.paused) {
            long delay = 1000L - (SystemClock.uptimeMillis() % 1000L);
            clockHandler.postDelayed(updateClock, delay);
        }
    }

    static final class State {
        boolean active;
        String sessionKey = "";
        boolean paused;
        boolean onBreak;
        boolean countdown;
        long plannedMs;
        long focusMs;
        long breakMs;
        long anchorMs;

        long elapsedFocusMs() {
            return FocusTimerMath.elapsedMillis(
                    focusMs, anchorMs, System.currentTimeMillis(), active && !paused && !onBreak);
        }

        long elapsedBreakMs() {
            return FocusTimerMath.elapsedMillis(
                    breakMs, anchorMs, System.currentTimeMillis(), active && !paused && onBreak);
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
        s.countdown = pref.getBoolean("countdown", false);
        s.plannedMs = pref.getLong("plannedMs", 0L);
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
                .putBoolean("countdown", s.countdown)
                .putLong("plannedMs", s.plannedMs)
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
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.cancel(START_NOTIFICATION_ID);
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
            state.countdown = intent.getBooleanExtra("countdown", false);
            state.plannedMs = Math.max(0L, intent.getLongExtra("plannedMs", 0L));
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
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(START_NOTIFICATION_ID);
            refreshClockUpdates(state);
            return START_STICKY;
        } catch (RuntimeException error) {
            // TWA runs inside Chrome: Android can regard our app as background.
            // Android 12+ then refuses the first FGS launch. A notification tap
            // is a documented user-initiated exception; never crash or fake a
            // live capsule when OS refused the background start.
            if (Build.VERSION.SDK_INT >= 31 &&
                    error instanceof android.app.ForegroundServiceStartNotAllowedException) {
                showStartActionNotification(this);
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            throw error;
        }
    }

    static void queueStartAfterBackgroundRestriction(Context context, Intent sync) {
        if (!ACTION_SYNC.equals(sync.getAction())) return;
        State state = read(context);
        state.active = true;
        state.sessionKey = sync.getStringExtra("sessionKey");
        state.paused = sync.getBooleanExtra("paused", false);
        state.onBreak = sync.getBooleanExtra("onBreak", false);
        state.countdown = sync.getBooleanExtra("countdown", false);
        state.plannedMs = Math.max(0L, sync.getLongExtra("plannedMs", 0L));
        state.focusMs = Math.max(0, sync.getLongExtra("focusMs", 0L));
        state.breakMs = Math.max(0, sync.getLongExtra("breakMs", 0L));
        state.anchorMs = System.currentTimeMillis();
        store(context, state);
        showStartActionNotification(context);
    }

    private static void showStartActionNotification(Context context) {
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 &&
                manager.getNotificationChannel(START_CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(START_CHANNEL_ID,
                    "Kronometre başlatma izni", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Android arka plan sınırlamasında kronometreyi bir kez dokunarak başlat");
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, FocusTimerService.class).setAction(ACTION_RETRY);
        PendingIntent start = Build.VERSION.SDK_INT >= 26
                ? PendingIntent.getForegroundService(context, START_NOTIFICATION_ID, intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)
                : PendingIntent.getService(context, START_NOTIFICATION_ID, intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(context, START_CHANNEL_ID)
                .setSmallIcon(R.drawable.nevofocus_notification_icon)
                .setContentTitle("NevoFocus kronometreyi başlat")
                .setContentText("Android arka plan kısıtlaması için bir kez dokun")
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(start)
                .addAction(new Notification.Action.Builder(
                        android.R.drawable.ic_media_play, "Kronometreyi Başlat", start).build())
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .build();
        manager.notify(START_NOTIFICATION_ID, notification);
    }

    private PendingIntent serviceAction(String action, int requestCode) {
        Intent intent = new Intent(this, FocusTimerService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification(State state) {
        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.nevofocus_live_notification);
        prepareViews(compact, state);

        PendingIntent openApp = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.nevofocus_notification_icon)
                .setColor(android.graphics.Color.BLACK)
                .setColorized(true)
                .setContentTitle("NevoFocus")
                .setContentText(state.onBreak ? "Mola sürüyor" : "Odaklanma sürüyor")
                .setCategory(Notification.CATEGORY_SERVICE)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(openApp)
                // Reuse the exact capsule when SystemUI auto-expands the row.
                // Android owns the system expansion affordance in both states.
                .setCustomContentView(compact)
                .setCustomBigContentView(compact)
                .setCustomHeadsUpContentView(compact);
        // Android 12+ may defer foreground notifications for ten seconds.
        // A user-started stopwatch needs its controls visible immediately.
        if (Build.VERSION.SDK_INT >= 31) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return builder.build();
    }

    private void prepareViews(RemoteViews views, State state) {
        long shownMs = state.onBreak
                ? state.elapsedBreakMs()
                : (state.countdown
                    ? Math.max(0L, state.plannedMs - state.elapsedFocusMs())
                    : state.elapsedFocusMs());
        FocusTimerClockText.Parts time = FocusTimerClockText.format(shownMs);
        // The native foreground service drives text sizes independently.
        views.setTextViewText(R.id.focus_main_time, time.hoursMinutes);
        views.setTextViewText(R.id.focus_seconds, time.seconds);
        views.setImageViewResource(R.id.focus_pause,
                state.paused ? R.drawable.nevofocus_action_play
                    : R.drawable.nevofocus_action_pause);
        views.setImageViewResource(R.id.focus_break,
                state.onBreak ? R.drawable.nevofocus_action_break_active
                    : R.drawable.nevofocus_action_break);
        views.setContentDescription(R.id.focus_pause, state.paused ? "Devam et" : "Durdur");
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
        clockHandler.removeCallbacks(updateClock);
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
}

