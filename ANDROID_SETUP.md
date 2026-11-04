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


## Android Google and email sign-in (required OAuth setup)

The Android app now calls the **native Google account picker** and passes a Google
ID token to the **same Firebase JS Auth instance** that the website uses. This
avoids the browser/WebView `missing initial state` error. Existing Firebase
accounts, UID, user documents, sessions and tasks remain unchanged.

**One-time Google Cloud setup for the test APK:**

1. Build the APK with the GitHub Actions workflow. Its artifact ZIP includes
   `android-debug-signing-fingerprints.txt` containing the exact build SHA1.
2. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   and select the project backing NevoFocus Firebase project
   `plated-arbor-mxtlg` (project number `494971257901`).
3. Under **Credentials > Create credentials > OAuth client ID > Android**,
   set package name `com.furknsss.nevofocus`, and paste the APK SHA1 from the
   fingerprint file. Save the new Android OAuth client. Do **not** replace the
   existing Web OAuth client; the native plugin uses its Web client ID.
4. Ensure Google sign-in is enabled in
   [Firebase Authentication](https://console.firebase.google.com/) and that the
   Web OAuth client belongs to the same Google Cloud project.
5. Close and reopen NevoFocus, then try **Google ile Giriş Yap**.

**Important:** Each GitHub-hosted debug APK can have a different temporary
signing key and fingerprint. When that happens, add the new SHA1 as another
Android OAuth client and uninstall the prior debug app before installing
the new one (package signatures can differ). Uninstalling removes **local**
app data, so export/backup unsynced data first. For routine updates we should
use a dedicated, securely stored signing key (GitHub Actions secret).

Email/password authentication uses the same Firebase JS user database and
**does not** require an Android OAuth SHA1 client. Verify **Authentication >
Sign-in method > Email/Password** is enabled. Email logins need the correct
email/password for an account with that provider. Existing Google-only accounts
do not automatically gain a password; use Google's sign-in or explicitly link
an email/password provider in account settings.

If the native picker returns `UNREGISTERED_ON_API_CONSOLE`, check the SHA1,
package ID and Google Cloud project. If email/password returns
`auth/operation-not-allowed`, enable its provider. If `auth/network-request-failed`
occurs, check Android WebView/Chrome updates and Internet connection.

**Validation required on an Android phone:** new Google login, returning
Google login, email login, email registration, wrong password, password reset,
sign-out/re-sign-in, app relaunch, and Firestore data restoration. Successful
APK compilation alone does not prove live OAuth sign-in.
