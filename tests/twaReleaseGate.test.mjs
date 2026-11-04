import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTwaAssetLinks } from '../scripts/twaAssetLinksValidation.mjs';

const sha = '14:C9:1C:39:2D:7A:14:A2:E9:6C:10:CB:B6:9C:E8:7D:B5:B2:2C:D4:AB:FE:B0:1B:12:11:6E:89:37:AB:17:09';
const expected = [{
  relation: ['delegate_permission/common.handle_all_urls',
             'delegate_permission/common.use_as_origin'],
  target: { namespace: 'android_app', package_name: 'com.furknsss.nevofocus',
    sha256_cert_fingerprints: [sha] },
}];
const clone = x => JSON.parse(JSON.stringify(x));

test('exact certificate and both valid TWA relations are accepted', () => {
  assert.equal(isValidTwaAssetLinks(clone(expected), expected), true);
});

test('missing JS bridge permission rejects release', () => {
  const published = clone(expected);
  published[0].relation = ['delegate_permission/common.handle_all_urls'];
  assert.equal(isValidTwaAssetLinks(published, expected), false);
});

test('missing full-screen TWA permission rejects release', () => {
  const published = clone(expected);
  published[0].relation = ['delegate_permission/common.use_as_origin'];
  assert.equal(isValidTwaAssetLinks(published, expected), false);
});

test('stale APK certificate rejects release even when package matches', () => {
  const published = clone(expected);
  published[0].target.sha256_cert_fingerprints = ['00:11:22:33:44:55:66:77'];
  assert.equal(isValidTwaAssetLinks(published, expected), false);
});

test('other package app association cannot authorize NevoFocus', () => {
  const published = clone(expected);
  published[0].target.package_name = 'com.someone.else';
  assert.equal(isValidTwaAssetLinks(published, expected), false);
});

test('malformed or empty DAL document is rejected', () => {
  for (const invalid of [null, '', undefined, {}, [], [null], [{ relation: [] }]]) {
    assert.equal(isValidTwaAssetLinks(invalid, expected), false);
  }
});
