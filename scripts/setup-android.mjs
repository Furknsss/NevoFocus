// Run after npm install + npm run build.
// Creates the Capacitor Android project on the first run and installs the
// checked-in native foreground timer overlay on every subsequent run.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nativeMain = path.join(root, 'native', 'android', 'app', 'src', 'main');
const android = path.join(root, 'android');
const destinationMain = path.join(android, 'app', 'src', 'main');
const manifestPath = path.join(destinationMain, 'AndroidManifest.xml');
const overlayOnly = process.argv.includes('--overlay-only');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (...args) => execFileSync(npx, args, { cwd: root, stdio: 'inherit' });

if (!fs.existsSync(manifestPath)) {
  if (overlayOnly) {
    throw new Error('Android project missing. First run: npm run android:setup');
  }
  run('cap', 'add', 'android');
}

if (!fs.existsSync(manifestPath)) {
  throw new Error('Capacitor could not create android/app/src/main/AndroidManifest.xml');
}

// Intentionally copy only our handwritten sources, not the generated Gradle files.
fs.cpSync(nativeMain, destinationMain, { recursive: true, force: true });

let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('xmlns:android=')) {
  throw new Error('Unrecognized AndroidManifest.xml: android namespace missing');
}

const permissions = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];
for (const permission of permissions) {
  if (!manifest.includes('android:name="' + permission + '"')) {
    manifest = manifest.replace(/<manifest\\b[^>]*>/, match =>
      match + '\\n    <uses-permission android:name="' + permission + '" />'
    );
  }
}

if (!manifest.includes('android:name=".FocusTimerService"')) {
  const service = `
        <!-- User-initiated, persistent study stopwatch with pause / break controls. -->
        <service
            android:name=".FocusTimerService"
            android:exported="false"
            android:stopWithTask="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="User-initiated, long-running study stopwatch with an ongoing interactive timer notification" />
        </service>
`;
  if (!manifest.includes('</application>')) {
    throw new Error('Unrecognized AndroidManifest.xml: application tag missing');
  }
  manifest = manifest.replace('</application>', service + '    </application>');
}
fs.writeFileSync(manifestPath, manifest);

if (!overlayOnly) {
  run('cap', 'sync', 'android');
}

console.log('NevoFocus Android native live timer sources installed.');
console.log('Open Android Studio: npm run android:open');
