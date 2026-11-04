/**
 * Production release gate for the exact Android debug APK and its real site.
 *
 * Usage: node scripts/verify-twa-assetlinks.mjs https://LIVE-PWA-ORIGIN/ android-twa-assetlinks.json
 * Fails unless origin is HTTPS, DAL responds with HTTP 200 (no redirect),
 * and the published JSON proves the exact package, current APK fingerprint,
 * and both TWA browser/JS-bridge relationships.
 */
import fs from 'node:fs';
import { isValidTwaAssetLinks } from './twaAssetLinksValidation.mjs';

const [siteRaw, expectedPath] = process.argv.slice(2);
if (!siteRaw || !expectedPath || !fs.existsSync(expectedPath)) {
  throw new Error('Provide live PWA HTTPS URL and generated local android-twa-assetlinks.json.');
}


const site = new URL(siteRaw);
if (site.protocol !== 'https:' || site.username || site.password ||
    site.hostname.endsWith('.invalid') || site.hostname === 'example.com') {
  throw new Error('This gate only accepts a real HTTPS PWA origin.');
}
const targetUrl = new URL('/.well-known/assetlinks.json', site.origin);
const response = await fetch(targetUrl, {
  redirect: 'manual',
  signal: AbortSignal.timeout(12000),
  headers: { Accept: 'application/json' },
});
if (response.status !== 200) {
  throw new Error('PWA host must serve published DAL directly with HTTP 200; got ' + response.status);
}
const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
let live;
try {
  live = await response.json();
} catch {
  throw new Error('Live assetlinks.json is not valid JSON.');
}
if (!isValidTwaAssetLinks(live, expected)) {
  throw new Error('Live PWA assetlinks.json lacks current APK SHA-256 and both TWA relationships.');
}
console.log('PWA Digital Asset Links verified for the exact APK signature: ' + site.origin);
