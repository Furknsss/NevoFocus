# NevoFocus: migration to owned Firebase project `nevofocus`

This is a **staged, non-production change**. Do not merge or publish an APK before the checks below.

## New Firebase project
- Project ID: `nevofocus`
- Web app ID: `1:94701708130:web:2479251c46442d2b0dc23b`
- Firestore database ID: `(default)` (must be created in Firebase Console)
- Android app package name: `com.furknsss.nevofocus`

## Actions required in the user's Firebase Console
1. Authentication > Sign-in method > enable **Google**; add a support email. Enable Email/Password only if desired.
2. Firebase Project Settings > Your apps > **Add Android app**, package `com.furknsss.nevofocus`. Add the installed APK's SHA-1 `70:4C:A3:D3:6C:54:BD:C8:10:42:9F:DD:3C:E2:B0:71:D4:54:69:EE`. SHA-256, if requested, must match the actual installed build. New signing keys require new fingerprints.
3. Open Google Cloud > Google Auth Platform > Clients in the **new** project, identify the **Web client ID** used by Firebase Google Auth. Copy it into `firebase-applet-config.json` > `oAuthClientId`. This value is deliberately blank until verified; do NOT reuse the old project's Web client ID or put an Android client ID in this field.
4. Build > Firestore Database > create **default** database; use the appropriate location; publish restrictive Security Rules before exposing user data. Review `firestore.rules` carefully: its current blanket `allow read, write: if true` rules are NOT safe for user sessions.
5. Authentication > Settings > Authorized domains: ensure relevant NevoFocus web domain is listed.

## Data migration warning
The prior project's Firebase Auth users, UIDs and Firestore data are **not** automatically transferred. Switching the config creates a separate sign-in and database. Preserve the old app/project, export user data first when possible, and do not uninstall until unsynced data is backed up. Never copy tokens or private service-account keys into GitHub.

## Validation
Check web login, Android native Google login, account persistence across app restarts, private study sessions, cloud backup and restore, and the live timer notification before merging. Existing Android debug builds are still bound to the old Firebase configuration until rebuilt.
