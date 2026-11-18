import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(path, 'utf8');

test('new Firebase project has its own Google Web OAuth client', () => {
  const c = JSON.parse(src('firebase-applet-config.json'));
  assert.equal(c.projectId, 'nevofocus');
  assert.equal(c.firestoreDatabaseId, '(default)');
  assert.match(c.oAuthClientId, /^94701708130-[a-z0-9]+\.apps\.googleusercontent\.com$/);
});

test('private data security rules must not grant global access', () => {
  const rules = src('firestore.rules');
  assert.match(rules, /request\.auth\.uid == uid/);
  assert.match(rules, /match \/backups\/\{backupId\}/);
  assert.doesNotMatch(rules, /allow (?:read|write|read, write): if true/);
  assert.match(rules, /match \/test\/\{docId\} \{\s*allow read, write: if false;/);
});

test('focus sync no longer uses shared cross-account backups or stores music OAuth tokens', () => {
  const sync = src('src/services/syncService.ts');
  assert.doesNotMatch(sync, /doc\(db, 'test'/);
  assert.doesNotMatch(sync, /collection\(db, 'users'\)/);
  assert.match(sync, /'users', uid, 'backups', 'latest'/);
  assert.match(sync, /safeMusicPreferences\(currentProfile\.musicConnections\)/);
  assert.match(sync, /musicConnections: safeMusicPreferences\(profile\.musicConnections\)/);
  assert.match(sync, /userId: activeUser\.uid/);
});

test('all direct profile and music settings writes redact OAuth tokens', () => {
  const app = src('src/App.tsx');
  const settings = src('src/components/SettingsModal.tsx');
  assert.doesNotMatch(app, /backup_latest_shared/);
  assert.match(app, /'users', currentUser\.uid, 'backups', 'latest'/);
  assert.match(app, /musicConnections: safeMusicPreferences\(updatedData\.musicConnections\)/);
  assert.match(settings, /musicConnections: safeMusicPreferences\(updatedConfig\)/);
});
