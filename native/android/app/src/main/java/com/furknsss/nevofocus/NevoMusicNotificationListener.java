package com.furknsss.nevofocus;

import android.service.notification.NotificationListenerService;

/**
 * User-granted Android notification access for local media session controls.
 * This service does not read, store, or upload notification messages.
 * The app requests only YouTube Music's active MediaSession through
 * MediaSessionManager after the user explicitly enables notification access.
 */
public final class NevoMusicNotificationListener extends NotificationListenerService {
}
