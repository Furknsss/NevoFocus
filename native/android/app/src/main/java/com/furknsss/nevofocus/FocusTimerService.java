package com.furknsss.nevofocus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.provider.Settings;
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
    // Matches the TWA controller action without depending on its class:
    // Capacitor and Chrome-backed builds supply different MainActivity types.
    static final String ACTION_OPEN_FOCUS = "com.furknsss.nevofocus.OPEN_FOCUS";

    private static final String CHANNEL_ID = "nevofocus_live_timer";
    private static final String START_CHANNEL_ID = "nevofocus_timer_start_action";
    private static final String PREFS = "nevofocus_native_focus_v1";
    private static final int NOTIFICATION_ID = 31415;
    private static final int START_NOTIFICATION_ID = 31416;
    private boolean destroyed;
    private final Handler clockHandler = new Handler(Looper.getMainLooper());
    private final Runnable updateClock = new Runnable() {
        @Override public void run() {
            if (destroyed) return;
            State current = read(FocusTimerService.this);
            if (!current.active || current.paused) return;
            try {
                NotificationManager manager = (NotificationManager)
                        getSystemService(Context.NOTIFICATION_SERVICE);
                manager.notify(NOTIFICATION_ID, buildNotification(current));
            } catch (SecurityException ignored) {
                // Notification permission might have been revoked after the session started.
            }
            // Repaint at the timer's next second boundary, rather than at an unrelated uptime phase.
            clockHandler.postDelayed(this, current.nextDisplayDelayMs());
        }
    };

    private void refreshClockUpdates(State state) {
        clockHandler.removeCallbacks(updateClock);
        if (state.active && !state.paused) {
            clockHandler.postDelayed(updateClock, state.nextDisplayDelayMs());
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
        long anchorElapsedMs = -1L;
        int anchorBootCount = -1;
        int currentBootCount = -1;

        long elapsedFocusMs() {
            return FocusTimerMath.elapsedFromClocks(focusMs, anchorMs, anchorElapsedMs, anchorBootCount,
                    System.currentTimeMillis(), SystemClock.elapsedRealtime(), currentBootCount,
                    active && !paused && !onBreak);
        }

        long elapsedBreakMs() {
            return FocusTimerMath.elapsedFromClocks(breakMs, anchorMs, anchorElapsedMs, anchorBootCount,
                    System.currentTimeMillis(), SystemClock.elapsedRealtime(), currentBootCount,
                    active && !paused && onBreak);
        }

        void freeze() {
            focusMs = elapsedFocusMs();
            breakMs = elapsedBreakMs();
            resetAnchor();
        }

        void resetAnchor() {
            anchorMs = System.currentTimeMillis();
            anchorElapsedMs = SystemClock.elapsedRealtime();
            anchorBootCount = currentBootCount;
        }

        long displayedMs() {
            return onBreak ? elapsedBreakMs() : (countdown
                    ? FocusTimerMath.countdownDisplayMillis(plannedMs, elapsedFocusMs())
                    : elapsedFocusMs());
        }

        long nextDisplayDelayMs() {
            long focus = elapsedFocusMs();
            long remaining = Math.max(0L, plannedMs - focus);
            if (countdown && !onBreak && remaining > 0L) return 1L + (remaining - 1L) % 1000L;
            long running = onBreak ? elapsedBreakMs() : focus;
            return 1000L - running % 1000L;
        }
    }

    private static int readBootCount(Context context) {
        try {
            return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Settings.SettingNotFoundException | SecurityException unavailable) {
            return -1;
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
        s.anchorElapsedMs = pref.getLong("anchorElapsedMs", -1L);
        s.anchorBootCount = pref.getInt("anchorBootCount", -1);
        s.currentBootCount = readBootCount(context);
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
                .putLong("anchorElapsedMs", s.anchorElapsedMs)
                .putInt("anchorBootCount", s.anchorBootCount)
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
        manager.cancel(NOTIFICATION_ID);
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
            state.resetAnchor();
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

        if (state.active && state.anchorElapsedMs < 0L) {
            state.freeze();
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
        state.resetAnchor();
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
        // A notification tap is a user-initiated foreground-service action.
        // getService() can be blocked when the app's Chrome TWA is backgrounded.
        // Keep pause/break executable while Android owns the notification shade.
        if (Build.VERSION.SDK_INT >= 26) {
            return PendingIntent.getForegroundService(this, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        return PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification(State state) {
        RemoteViews compact = new RemoteViews(getPackageName(), R.layout.nevofocus_live_notification);
        prepareViews(compact, state);

        Intent focusIntent = new Intent(this, MainActivity.class)
                .setAction(ACTION_OPEN_FOCUS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openApp = PendingIntent.getActivity(this, 3, focusIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // With a custom RemoteViews capsule the clock surface must be tappable,
        // not just the system notification chrome. Action controls keep their
        // separate PendingIntents in prepareViews().
        // Do not attach a competing click target to the whole layout:
        // Android SystemUI may make the parent an accessibility focus target
        // and swallow taps on the pause/break child ImageViews. The native
        // notification's setContentIntent still opens Focus from its body.
        compact.setOnClickPendingIntent(R.id.focus_main_time, openApp);
        compact.setOnClickPendingIntent(R.id.focus_seconds, openApp);

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
                .setCustomContentView(compact);
        if (getApplicationInfo().targetSdkVersion >= 31) {
            builder.setCustomBigContentView(compact).setCustomHeadsUpContentView(compact);
        }
        // The separately built API-30 compatibility APK uses the legacy undecorated
        // content surface and deliberately has no expanded view or platform action row.
        // Android 12+ may defer foreground notifications for ten seconds.
        // A user-started stopwatch needs its controls visible immediately.
        if (Build.VERSION.SDK_INT >= 31) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return builder.build();
    }

    private void prepareViews(RemoteViews views, State state) {
        long shownMs = state.displayedMs();
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

    private boolean screenReceiverRegistered;
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            // Handler callbacks pause during deep sleep. Show the actual elapsed time as soon as
            // the screen wakes, without keeping a wake lock or depending on Chrome's JS timers.
            clockHandler.removeCallbacks(updateClock);
            updateClock.run();
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(screenReceiver, filter);
        screenReceiverRegistered = true;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        // A queued screen-wake callback must not publish again after this instance is stopped.
        destroyed = true;
        clockHandler.removeCallbacksAndMessages(null);
        if (screenReceiverRegistered) unregisterReceiver(screenReceiver);
        stopForeground(STOP_FOREGROUND_REMOVE);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(NOTIFICATION_ID);
        super.onDestroy();
    }
}

