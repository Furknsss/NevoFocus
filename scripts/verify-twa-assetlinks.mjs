/**
 * Production release gate for the exact Android debug APK and its real site.
 *
 * Usage: node scripts/verify-twa-assetlinks.mjs https://LIVE-PWA-ORIGIN/ android-twa-assetlinks.json
 * Fails unless origin is HTTPS, DAL responds with HTTP 200 (no redirect),
 * and the published JSON proves the exact package, current APK fingerprint,
 * and both TWA browser/JS-bridge relationships.
 */
import fs from 'node:fs';

const [siteRaw, expectedPath] = process.argv.slice(2);
if (!siteRaw || !expectedPath || !fs.existsSync(expectedPath)) {
  throw new Error('Provide live PWA HTTPS URL and generated local android-twa-assetlinks.json.');
}

export function isValidTwaAssetLinks(found, expected) {
  if (!Array.isArray(found) || !Array.isArray(expected) || !expected.length) return false;
  const requiredRelations = [
    'delegate_permission/common.handle_all_urls',
    'delegate_permission/common.use_as_origin',
  ];
  for (const relation of requiredRelations) {
    if (!found.some(row => row &&
      Array.isArray(row.relation) && row.relation.includes(relation) &&
      row.target?.namespace === 'android_app' &&
      row.target?.package_name === 'com.furknsss.nevofocus' &&
      expected.some(e => e.target?.package_name === 'com.furknsss.nevofocus' &&
        e.target?.sha256_cert_fingerprints?.some(fp =>
          row.target?.sha256_cert_fingerprints?.includes(fp))
      )
    )) return false;
  }
  return true;
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
