# NevoFocus — user-owned Firebase migration (staged)

**Do not merge or deploy until the new login, restrictive rules and data import are tested.**
The former project `plated-arbor-mxtlg` and its website are unchanged.

## Confirmed from the user's Firebase Console and google-services.json
- New project: `nevofocus`
- Project number: `94701708130`
- Web app: `1:94701708130:web:2479251c46442d2b0dc23b`
- Android app: `1:94701708130:android:399b84d7056b8e7e0dc23b`
- Package name: `com.furknsss.nevofocus`
- Web OAuth ID has been extracted from the new Android config, and set in `firebase-applet-config.json`.
- Firestore: `(default)`, created by the user
- Google sign-in: reported enabled by the user
- Registered SHA-1 for the **previous installed debug APK**: `70:4C:A3:D3:6C:54:BD:C8:10:42:9F:DD:3C:E2:B0:71:D4:54:69:EE`

### Blockers before using the new APK
1. In **new** Firebase Firestore > Rules, paste and publish this branch's `firestore.rules`. The repository change does **not** automatically update Firebase rules.
2. Verify **Google Cloud Console > Google Auth Platform > Clients** has an **Android** OAuth client for `com.furknsss.nevofocus` and the exact SHA-1 of the APK being installed. The uploaded `google-services.json` lists a Web client (client_type 3) but no Android client (client_type 1); check whether the Android OAuth client has actually been created in Google Cloud.
3. The same Android app signing key must be reused. On build, compare `android-debug-signing-fingerprints.txt` with registered SHA-1 and, if different, add the new fingerprint in Firebase and re-download config if needed.
4. App UI and cross-user communities should be tested: owner-only Firestore rules intentionally deny reads of others' private user documents and block shared study room writes until a secure membership model is built.
5. When the APK supports the new Firebase project, sign in as the **same Google account**. Then use **Settings > Bulut & Yedek > Yedekten İçe Aktar** with the sanitized offline backup. The import keeps session IDs/times, maps old user IDs to the current signed-in Firebase UID, does not import music account credentials, and writes backups under `users/{uid}/backups/latest`.
6. Reopen the app and confirm the **39 sessions**, **23 tasks**, total time and individual dates. Verify new sessions remain saved after app restart and across devices. Do not overwrite or delete the old account data until checks pass.

### Security fixes staged in this branch
- Replaces shared `test/backup_latest_shared` and email-keyed public backups with owner-only private backup documents.
- Removes cross-user restore/search, preventing one student's data from being restored into another's account.
- Sanitizes music connections before upload/export/import; no OAuth access or refresh token is included.
- Updates `firestore.rules` to restrict profile, tasks, sessions, active focus and backups to the authenticated owner.
- Blocks shared room writes temporarily rather than exposing personal data during migration.

### Important
The original exported JSON contains music OAuth credentials. Keep it private and revoke existing tokens using the relevant providers; keep the separately sanitized backup for migration. Never commit the JSON backup or service account private keys into GitHub.

The site currently deployed from `main` still uses the old Firebase project. This feature branch has not been merged.
