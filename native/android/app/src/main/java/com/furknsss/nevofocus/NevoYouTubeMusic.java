package com.furknsss.nevofocus;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * Same-device YouTube Music now-playing integration. No Google password,
 * Google OAuth impersonation, remote account token, background scraping,
 * notification text recording or cloud transfer. The user explicitly enables
 * Android Notification access; only com.google.android.apps.youtube.music
 * MediaSession metadata and transport controls are requested.
 */
public final class NevoYouTubeMusic {
    private static final String YT_MUSIC_PACKAGE = "com.google.android.apps.youtube.music";

    private NevoYouTubeMusic() {}

    private static ComponentName listener(Context ctx) {
        return new ComponentName(ctx, NevoMusicNotificationListener.class);
    }

    public static boolean hasPermission(Context ctx) {
        String enabled = Settings.Secure.getString(ctx.getContentResolver(),
                "enabled_notification_listeners");
        if (enabled == null || enabled.isEmpty()) return false;
        ComponentName own = listener(ctx);
        for (String item : enabled.split(":")) {
            // Android builds may persist either flattened full or short names.
            ComponentName granted = ComponentName.unflattenFromString(item);
            if (own.equals(granted)) return true;
        }
        return false;
    }

    public static Intent permissionSettings() {
        return new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    private static MediaController controller(Context ctx) {
        if (!hasPermission(ctx)) return null;
        try {
            MediaSessionManager manager =
                    (MediaSessionManager) ctx.getSystemService(Context.MEDIA_SESSION_SERVICE);
            if (manager == null) return null;
            List<MediaController> sessions = manager.getActiveSessions(listener(ctx));
            for (MediaController session : sessions) {
                if (YT_MUSIC_PACKAGE.equals(session.getPackageName())) return session;
            }
        } catch (SecurityException ignored) {
            // Notification access may have been revoked between calls.
        }
        return null;
    }

    public static JSONObject status(Context ctx) throws Exception {
        JSONObject json = new JSONObject();
        json.put("permissionGranted", hasPermission(ctx));
        MediaController session = controller(ctx);
        json.put("sessionAvailable", session != null);
        json.put("source", "youtube_music");
        if (session == null) return json;

        PlaybackState state = session.getPlaybackState();
        MediaMetadata meta = session.getMetadata();
        boolean playing = state != null && state.getState() == PlaybackState.STATE_PLAYING;
        json.put("isPlaying", playing);
        json.put("title", meta == null ? "" : safe(meta.getString(MediaMetadata.METADATA_KEY_TITLE)));
        json.put("artist", meta == null ? "" : safe(meta.getString(MediaMetadata.METADATA_KEY_ARTIST)));
        json.put("album", meta == null ? "" : safe(meta.getString(MediaMetadata.METADATA_KEY_ALBUM)));
        long duration = meta == null ? 0 : meta.getLong(MediaMetadata.METADATA_KEY_DURATION);
        json.put("durationMs", Math.max(0, duration));
        long position = state == null ? 0 : Math.max(0, state.getPosition());
        if (playing && state.getLastPositionUpdateTime() > 0) {
            position += (long) ((android.os.SystemClock.elapsedRealtime() -
                    state.getLastPositionUpdateTime()) * Math.max(0, state.getPlaybackSpeed()));
        }
        json.put("positionMs", Math.min(Math.max(0, position),
                duration > 0 ? duration : Long.MAX_VALUE));
        json.put("actions", state == null ? 0 : state.getActions());

        // Preserve album art without a browser-inaccessible content:// URI.
        // Small compressed local bitmap only; the image never reaches our server.
        if (meta != null) {
            Bitmap art = meta.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
            if (art == null) art = meta.getBitmap(MediaMetadata.METADATA_KEY_ART);
            if (art != null) {
                int longest = Math.max(art.getWidth(), art.getHeight());
                if (longest > 0) {
                    float scale = Math.min(1f, 96f / longest);
                    Bitmap thumb = Bitmap.createScaledBitmap(art,
                            Math.max(1, Math.round(art.getWidth() * scale)),
                            Math.max(1, Math.round(art.getHeight() * scale)), true);
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    if (thumb.compress(Bitmap.CompressFormat.JPEG, 62, out)
                            && out.size() < 36_000) {
                        json.put("art", "data:image/jpeg;base64," +
                                Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                    }
                    if (thumb != art) thumb.recycle();
                }
            }
        }
        return json;
    }

    public static JSONObject control(Context ctx, String command, long position) throws Exception {
        MediaController session = controller(ctx);
        if (session == null) throw new IllegalStateException(
                "YouTube Music etkin değil veya Bildirim erişimi verilmemiş.");
        MediaController.TransportControls transport = session.getTransportControls();
        PlaybackState playback = session.getPlaybackState();
        long actions = playback == null ? 0 : playback.getActions();
        switch (command) {
            case "play":
                if ((actions & PlaybackState.ACTION_PLAY) == 0 &&
                    (actions & PlaybackState.ACTION_PLAY_PAUSE) == 0) throw new IllegalStateException("Çalma kontrolü desteklenmiyor.");
                transport.play();
                break;
            case "pause":
                if ((actions & PlaybackState.ACTION_PAUSE) == 0 &&
                    (actions & PlaybackState.ACTION_PLAY_PAUSE) == 0) throw new IllegalStateException("Duraklatma kontrolü desteklenmiyor.");
                transport.pause();
                break;
            case "next":
                if ((actions & PlaybackState.ACTION_SKIP_TO_NEXT) == 0) throw new IllegalStateException("Sonraki şarkı desteklenmiyor.");
                transport.skipToNext();
                break;
            case "previous":
                if ((actions & PlaybackState.ACTION_SKIP_TO_PREVIOUS) == 0) throw new IllegalStateException("Önceki şarkı desteklenmiyor.");
                transport.skipToPrevious();
                break;
            case "seek":
                if ((actions & PlaybackState.ACTION_SEEK_TO) == 0 || position < 0)
                    throw new IllegalStateException("Şarkıda konum değiştirme desteklenmiyor.");
                transport.seekTo(position);
                break;
            default: throw new IllegalArgumentException("Invalid media control");
        }
        return status(ctx);
    }

    private static String safe(String text) {
        return text == null ? "" : text.substring(0, Math.min(text.length(), 500));
    }
}
