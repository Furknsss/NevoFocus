# NevoFocus Android TWA — Chrome Google Login + Native Premium Stopwatch

**Status: implementation branch, not yet shipped to the live PWA.**

The existing NevoFocus PWA already signs in through Google and Firebase. The
Android WebView from our first Capacitor test app cannot share the Chrome/PWA
OAuth/browser session. The AI Studio-created Firebase project also doesn't let
us create an Android Google OAuth client or enable Email/Password. Instead,
this variant launches the **same production HTTPS PWA in a Trusted Web Activity**.

TWA runs in Chrome and uses the real site's storage, Firebase UID and Firestore.
It does NOT run Firebase in a second WebView, copy any auth tokens or migrate data.

The Android shell includes a real foreground service displaying a system-driven
chronometer with Pause/Resume and Mola. A Chrome **verified-origin postMessage
channel** connects website commands to this service. The browser UI has exactly
the same HTML/CSS as the website.

## Required to complete this integration

1. **The actual production PWA HTTPS URL** (which isn't stored in this GitHub
   repository). Never guess the URL from Firebase's `authDomain` or a project ID.
2. Deploy `src/services/twaFocusBridge.ts` and `src/services/nativeFocus.ts`
   integration to **that very same live HTTPS site**. The site must still have
   its original Firebase Google login and UI.
3. Build and sign the Android app for that real PWA origin. Do not share APKs
   compiled with `--ci-smoke` / `https://nevofocus.invalid/` (those deliberately
   cannot launch the right PWA).
4. Serve the generated `android-twa-assetlinks.json` at
   `https://<live-pwa-origin>/.well-known/assetlinks.json` with header
   `Content-Type: application/json`, **HTTP 200**, **no redirect**, and the
   correct SHA-256 for the APK. Keep any existing valid asset-links statements.
   Relations required:
   - `delegate_permission/common.handle_all_urls`
   - `delegate_permission/common.use_as_origin`
5. Install on a real Android phone and confirm both Firebase login and native
   stopwatch control.

Official Chrome guide:
https://developer.chrome.com/docs/android/post-message-twa
Official Android custom-notification limitations:
https://developer.android.com/develop/ui/views/notifications/custom-notification

## Debug APK CI

Run GitHub Actions > **Android TWA and Live Timer Capsule** > Run workflow
with `pwa_url` set to the **full working HTTPS PWA URL**. The workflow:

- Runs TypeScript lint
- Builds the existing React app (doesn't replace its UI)
- Creates the Capacitor-generated Android skeleton
- Replaces its launcher with Chrome TWA and adds AndroidX Browser 1.10.0
- Adds the native foreground stopwatch + verified Chrome MessagePort receiver
- Builds a debug APK
- Prints the exact signing certificate
- Generates `android-twa-assetlinks.json` for upload on the PWA host
- Uploads APK + certificate + asset-links as an artifact

On ordinary pull requests the workflow does **compile-only smoke tests** with
`https://nevofocus.invalid/`; no nonfunctional APK artifact is published.
The TWA workflow is separate from the legacy WebView APK workflow.

The test signing key is cached across GitHub builds for convenience. It is
a **debug key only**, not an appropriate production Google Play signing key.

## Native bridge protocol

The browser establishes `CustomTabsSession` and validates the HTTPS source
via Digital Asset Links before requesting a postMessage channel. The first
Android message exposes the `MessagePort`; the page responds with
`NEVOFOCUS_TWA_WEB_READY`. Thereafter only exact versioned commands are used:

- `NEVOFOCUS_NATIVE_QUERY` -> live clock/pause/break state
- `NEVOFOCUS_NATIVE_SYNC` -> start or synchronize stopwatch, paused, break
  flags and elapsed seconds
- `NEVOFOCUS_NATIVE_STOP` -> stop native foreground service

No passwords, cookies, Firebase tokens or device identifiers are transferred.
Native code checks message length, allowed commands, session key and time
bounds. The web checks the first `message` event origin.

React's existing `ActiveFocusSession.tsx` works with the same `nativeFocus`
interface for both Capacitor (legacy) and Chrome TWA: when the user brings
the app back, it reads authoritative Android clock values and resumes.

**Known limitation:** Only Clock / Stopwatch mode is connected to the native
timer in this first variant, matching the existing implementation. Other modes
stay unchanged and use the site's own current behavior.

## Notification appearance

Inside Android's available notification content region, the capsule is **full
width, black (#000), rounded and minimal**, with a white Android Chronometer
on the left and Pause/Resume + Mola controls on the right. Compact and expanded
variants are supplied. Android, Samsung One UI and other manufacturers control
the final card/header/background: **on Android 12+, applications are not allowed
to force a fully custom edge-to-edge notification.** It is not possible to
promise an exact screenshot match or cover the entire notification drawer.

## Real-device QA (blocking)

- Existing Google/PWA session opens successfully under the exact same Chrome
  account. No Firebase OAuth redirect or new Firebase project is needed.
- Verify Google login both with fresh and existing browser sessions.
- Verify DAL `handle_all_urls` and `use_as_origin` validation both succeed.
- Timer started on site becomes native notification; clock ticks when TWA is
  backgrounded and phone is locked.
- Pause / resume from notification; elapsed focus excludes pause time.
- Mola / Devam from notification; elapsed focus excludes break time.
- Return to website; time/flags reconcile, single active notification remains.
- Finish/abandon session removes notification and stops foreground service.
- Android 13+ notification permission, battery optimizations, force-stop,
  screen orientation and Samsung/Pixel notification rendering.
- Test account data on web/PWA/Android; no new Firebase UID is created.

**Do not merge/ship as working Android app until this checklist is satisfied.**
