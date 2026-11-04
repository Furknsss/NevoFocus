/**
 * Produce the Digital Asset Links declaration for the exact built APK.
 * Publish output at HTTPS_ORIGIN/.well-known/assetlinks.json on the same
 * live PWA host. This is not a Firebase IAM/OAuth setting.
 *
 * Usage:
 *   apksigner verify --print-certs app-debug.apk > android-twa-apk-signature.txt
 *   node scripts/generate-twa-assetlinks.mjs android-twa-apk-signature.txt
 */
import fs from 'node:fs';
import path from 'node:path';

const signaturePath = process.argv[2];
if (!signaturePath || !fs.existsSync(signaturePath)) {
  throw new Error('Pass the path to apksigner --print-certs output.');
}
const output = process.argv[3] || 'android-twa-assetlinks.json';
const raw = fs.readFileSync(signaturePath, 'utf8');
const match = raw.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]{64,95})/i);
if (!match) throw new Error('Could not parse the APK signer certificate SHA-256 fingerprint.');
const digits = match[1].replaceAll(':', '').toUpperCase();
if (digits.length !== 64 || !/^[0-9A-F]{64}$/.test(digits)) {
  throw new Error('Invalid APK signing fingerprint; cannot generate Digital Asset Links.');
}
const fingerprint = digits.match(/../g).join(':');
const assetlinks = [{
  relation: [
    'delegate_permission/common.handle_all_urls',
    'delegate_permission/common.use_as_origin',
  ],
  target: {
    namespace: 'android_app',
    package_name: 'com.furknsss.nevofocus',
    sha256_cert_fingerprints: [fingerprint],
  },
}];
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(assetlinks, null, 2) + '\n');
console.log('Wrote ' + output + ' for signed package com.furknsss.nevofocus');
console.log('SHA-256: ' + fingerprint);
