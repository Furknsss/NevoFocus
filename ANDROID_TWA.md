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
- Runs unit regressions for timing, notification UI contract and Digital Asset Links
- Uploads the **signature and assetlinks.json only** as deployment preparation
- Verifies the live website responds with **HTTP 200, no redirects**, with both
  TWA and postMessage relations for the exact APK SHA-256
- Uploads the installable debug APK **only after this live association passes**.
  A build with no live website verification cannot be marked production-ready.

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

The Android **foreground service**, not Chrome, owns the focus notification.
Within the system-allowed content region it renders a single black rounded
capsule: **large white HH:MM**, immediately followed by **smaller :SS**, then
**Pause / Resume** and **Mola** on the far right. The app does not provide an
extra expanded RemoteViews layout. The service refreshes the separate time
labels each second when running, freezes the time on pause, shows break time
while resting and shows remaining time for countdown sessions. Android can
throttle background notification refreshes depending on device policy.

For TWA launches the web code must never call `Notification` or
`ServiceWorkerRegistration.showNotification`: it requests native service
synchronization through Chrome's DAL-verified MessagePort, cancels existing
`fokus-active-timer` Chrome notifications and displays a visible diagnostic
if the native bridge never connects. The ordinary website/PWA still has its
web-notification fallback.

**Important Android limitation:** Android 12 and later reserve the outer
notification template, app name, header and expansion affordance for SystemUI.
Samsung One UI may still draw a chevron even when the application supplies
only one compact view. There is no supported API that removes the OS chevron
or guarantees a single all-black edge-to-edge system notification card.
The mockup is therefore a design target for the *content area*, not a claim
of an unrestricted full-card custom view.

## Android emulator CI and platform constraints

The separate **NevoFocus Android Emulator Integration Tests** GitHub Action
compiles Android instrumentation tests and boots an Android 14 emulator.
It checks native foreground notification creation, live stopwatch arithmetic,
pause/freeze behavior, break/resume behavior and the one-tap notification
fallback when Android 12+ background foreground-service restrictions apply.
It also attempts to capture the actual system notification shade. These
tests do **not** authenticate to production Firebase or exercise Google login.

Android 12+ may reject starting our app's foreground service while Chrome
hosts the TWA, even if the user pressed Start in the web page. If rejected,
the app offers the Android-compliant "Kronometreyi Başlat" notification action,
which the user can tap once. This is a documented platform limitation, not
permission to bypass background restrictions.

Live verification and release are separate from green build/test CI. Without
a known, controllable live HTTPS website with updated web bridge and valid
`/.well-known/assetlinks.json`, a TWA with trustworthy native timer control
cannot be verified, regardless of the APK compile status.

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
