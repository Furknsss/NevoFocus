import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repo, 'scripts/generate-twa-assetlinks.mjs');

function withCertificate(report, check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nevofocus-assetlinks-'));
  try {
    const source = path.join(directory, 'signer.txt');
    const destination = path.join(directory, 'assetlinks.json');
    fs.writeFileSync(source, report);
    check({ source, destination });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const hex = '14c91c392d7a14a2e96c10cbb69ce87db5b22cd4abfeb01b12116e8937ab1709';

test('Android apksigner V2 output generates valid Digital Asset Links', () => {
  withCertificate('V2 Signer: certificate SHA-256 digest: ' + hex, ({ source, destination }) => {
    execFileSync(process.execPath, [script, source, destination]);
    const [link] = JSON.parse(fs.readFileSync(destination, 'utf8'));
    assert.equal(link.target.package_name, 'com.furknsss.nevofocus');
    assert.deepEqual(link.relation, [
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.use_as_origin',
    ]);
    assert.equal(link.target.sha256_cert_fingerprints[0].replaceAll(':', ''), hex.toUpperCase());
  });
});
test('Legacy apksigner signer format is supported', () => {
  withCertificate('Signer #1 certificate SHA-256 digest: ' + hex, ({ source, destination }) => {
    execFileSync(process.execPath, [script, source, destination]);
    assert.equal(JSON.parse(fs.readFileSync(destination, 'utf8')).length, 1);
  });
});
test('Invalid certificate causes hard failure without publishing asset links', () => {
  withCertificate('Signer 1 certificate SHA-256 digest: 0000', ({ source, destination }) => {
    const output = spawnSync(process.execPath, [script, source, destination], { encoding: 'utf8' });
    assert.notEqual(output.status, 0);
    assert.equal(fs.existsSync(destination), false);
  });
});
