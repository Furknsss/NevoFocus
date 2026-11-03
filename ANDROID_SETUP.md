# NevoFocus Android: live stopwatch notification

The web/PWA version is unchanged. The Android edition wraps the same Vite/React
site in Capacitor 8 and adds a native Android foreground service for clock-mode
stopwatch sessions.

## Build locally

Prerequisites: Node 22+, Android Studio with Android SDK and Java 21, and Git.

```bash
npm install
npm run android:setup
npm run android:open
```

In Android Studio, run the app on a connected Android device or emulator.
To assemble a test APK from a terminal (macOS/Linux):

```bash
npm run android:apk
```

The debug APK appears at `android/app/build/outputs/apk/debug/app-debug.apk`.
After editing React code, run `npm run android:sync` and re-build.
`scripts/setup-android.mjs` installs the native sources into the generated
Android project and idempotently adds the service + required permissions to
its manifest. Never delete `native/android/` — those are the authoritative
handwritten Java/XML sources. The `android/` directory itself is generated
by Capacitor and can be reconstructed.

## GitHub Actions APK

The `Android NevoFocus Debug APK` workflow attempts to compile the same APK
on pull requests. When it succeeds, open that workflow run and download the
`nevofocus-android-debug-apk` artifact. The output is a **test APK**, not a
signed Google Play release. The workflow requires GitHub Actions access.

## Live capsule behavior

- A true-black inner capsule with large, white, **system-animated Chronometer**
  on the left, and pause/resume + break controls to the right.
- Android counts in its notification view even when the WebView is suspended.
  No one-second JavaScript or service wakeup loop is needed.
- Tapping the controls is processed by Android's native foreground service.
- Opening NevoFocus reads the Android state and reconciles the focus/break
  timers. Finishing/abandoning the session ends the foreground service.
- Only **Clock/Stopwatch** mode uses the native capsule in this version.

### Android limits

Android 12+ may wrap the capsule content inside its own system notification
template. Exact height, shape, header, and colors are partly controlled by
Android and phone manufacturers — the notification cannot be made pixel-perfect
on every device. Android 13+ may ask for permission to display notifications.
On some phones, battery restrictions can limit long-lived background services.
Force-stopping the app stops the service. Reboot persistence is not implemented.

The service uses foreground service type `specialUse` with a written subtype
explaining that the feature is a user-started ongoing stopwatch. Google Play
reviews this declaration separately when publishing. The implementation is
not pretending to be a media player or data synchronization task.

### Validation checklist

- Start Clock/Stopwatch; check one notification, no duplicate browser capsule.
- Send to background and lock for 3+ minutes: time continues and stays visible.
- Tap Durdur, wait, tap Devam: elapsed focus must not include pause.
- Tap Mola for a minute, then Devam: focus time must exclude break time.
- Return to app and check exact continuity; finish and ensure capsule vanishes.
- Repeat with screen rotations, Android 13+ permission granted/denied, and
  Android 14–16 on actual devices.
- Test Firebase sign-in in the Android WebView, especially Google OAuth.
  Browser-centric OAuth flows may require a dedicated native auth integration.

The native Java and Android projects have **not** been verified on a physical
device until the workflow builds and the real-device checklist passes.
