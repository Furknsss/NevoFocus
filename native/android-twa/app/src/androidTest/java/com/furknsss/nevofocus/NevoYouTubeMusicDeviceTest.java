package com.furknsss.nevofocus;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Device tests without a Google sign-in or external YouTube Music installation. */
@RunWith(AndroidJUnit4.class)
public class NevoYouTubeMusicDeviceTest {
    @Test public void statusNeverFakesAConnectedAccountOrLiveTrack() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        JSONObject state = NevoYouTubeMusic.status(context);
        assertEquals("youtube_music", state.getString("source"));
        assertEquals(NevoYouTubeMusic.hasPermission(context),
                state.getBoolean("permissionGranted"));
        if (!state.getBoolean("permissionGranted")) {
            assertFalse(state.getBoolean("sessionAvailable"));
            assertFalse(state.has("title"));
        }
    }

    @Test public void commandsCannotBypassExplicitAndroidPermission() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        if (NevoYouTubeMusic.hasPermission(context)) return;
        try {
            NevoYouTubeMusic.control(context, "pause", 0);
            fail("Playback must require notification access and a real YouTube Music media session.");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("YouTube Music"));
        }
    }
}
