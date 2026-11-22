import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeSyncedRecords, collectDeletedIds, recordNeedsUpload,
  canonicalStatsFromSessions } from '../src/services/syncIntegrity.ts';

test('no deleted session can come back from a second device',()=>{
  const local=[{id:'a',timestamp:1,completedSeconds:15},{id:'b',timestamp:2,completedSeconds:30}];
  const cloud=[{id:'a',timestamp:1,deleted:true},{id:'c',timestamp:3,completedSeconds:40}];
  const deleted=collectDeletedIds(cloud,new Set());
  assert.deepEqual(mergeSyncedRecords(local,cloud,deleted,'session').map(s=>s.id),['c','b']);
});

test('task completion can be switched back to incomplete when most recent edit wins',()=>{
  const local=[{id:'task',createdAt:1,updatedAt:500,isCompleted:false}];
  const cloud=[{id:'task',createdAt:1,updatedAt:400,isCompleted:true}];
  assert.equal(mergeSyncedRecords(local,cloud,new Set(),'task')[0].isCompleted,false);
  const newerCloud=[{...cloud[0],updatedAt:600}];
  assert.equal(mergeSyncedRecords(local,newerCloud,new Set(),'task')[0].isCompleted,true);
});

test('metadata from sync does not trigger unnecessary upload loops',()=>{
  const local={id:'x',updatedAt:101,createdAt:100,plannedMinutes:30};
  assert.equal(recordNeedsUpload(local,{...local,syncedAt:Date.now(),userId:'another'}),false);
  assert.equal(recordNeedsUpload({...local,updatedAt:102},{...local,updatedAt:101}),true);
  assert.equal(recordNeedsUpload({...local,updatedAt:100},{...local,updatedAt:101}),false);
});

test('stats derive from canonical real sessions, not a stale profile maximum',()=>{
  const s=[{id:'1',completedSeconds:3600,completed:true},{id:'2',completedSeconds:90,completed:true},
    {id:'3',completedSeconds:36000,completed:false},{id:'4',completedSeconds:-800,completed:true}];
  assert.deepEqual(canonicalStatsFromSessions(s),{count:2,seconds:3690,totalMinutes:62,totalHours:1});
});

test('record filtering handles invalid paths and duplicate IDs safely',()=>{
  const data=[{id:'valid',createdAt:5},{id:'invalid/path',createdAt:9},{id:'valid',createdAt:5,updatedAt:100}];
  assert.deepEqual(mergeSyncedRecords(data,[],new Set(),'task').map(x=>x.id),['valid']);
});

test('sync uses Firestore transactions so stale upload cannot resurrect deleted records',()=>{
  const code=readFileSync('src/services/syncService.ts','utf8');
  assert.match(code,/runTransaction\(db, async \(transaction\)/);
  assert.match(code,/deletedNow \|\| remote\?\.deleted/);
  assert.match(code,/!accountCacheIsBound\(uid\)/);
  assert.match(code,/transaction\.set\(path,/);
});
