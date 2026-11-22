import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const env=await initializeTestEnvironment({
  projectId:'demo-nevofocus-sync-integrity',
  firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')},
});
const alice=env.authenticatedContext('alice').firestore();
const bob=env.authenticatedContext('bob').firestore();
const guest=env.unauthenticatedContext().firestore();

test('only signed-in owner may create and view own profile',async()=>{
  await assertSucceeds(setDoc(doc(alice,'users','alice'),{userId:'alice',name:'A'}));
  await assertFails(getDoc(doc(bob,'users','alice')));
  await assertFails(getDoc(doc(guest,'users','alice')));
  await assertFails(setDoc(doc(bob,'users','alice'),{userId:'alice'}));
});

test('private session/task IDs and UID ownership cannot be forged',async()=>{
  await assertSucceeds(setDoc(doc(alice,'users','alice','sessions','s1'),{
    id:'s1',userId:'alice',completedSeconds:600,deleted:false,
  }));
  await assertFails(getDoc(doc(bob,'users','alice','sessions','s1')));
  await assertFails(setDoc(doc(alice,'users','alice','sessions','s2'),{
    id:'s2',userId:'bob',completedSeconds:100,deleted:false,
  }));
  await assertFails(setDoc(doc(alice,'users','alice','tasks','t3'),{
    id:'wrong',userId:'alice',isCompleted:true,deleted:false,
  }));
  await assertSucceeds(setDoc(doc(alice,'users','alice','tasks','t4'),{
    id:'t4',userId:'alice',isCompleted:false,deleted:false,
  }));
  await assertFails(getDoc(doc(bob,'users','alice','tasks','t4')));
});

test('private backup manifest checks authenticated UID and schema',async()=>{
  await assertSucceeds(setDoc(doc(alice,'users','alice','backups','latest_v2'),{
    uid:'alice',version:2,kind:'indexed-subcollections',
    sessionCount:1,taskCount:1,sessionSeconds:600,completedAt:200,
  }));
  await assertFails(setDoc(doc(alice,'users','alice','backups','latest_v2'),{
    uid:'bob',version:2,kind:'indexed-subcollections',
    sessionCount:1,taskCount:1,sessionSeconds:600,completedAt:201,
  }));
  await assertFails(getDoc(doc(bob,'users','alice','backups','latest_v2')));
});

test('retired global backup and community mutation are forbidden',async()=>{
  await assertFails(setDoc(doc(alice,'test','backup_latest_shared'),{sessions:[]}));
  await assertFails(getDoc(doc(alice,'test','backup_latest_shared')));
  await assertFails(setDoc(doc(alice,'study_rooms','public-room'),{owner:'alice'}));
});

test.after(async()=>{await env.cleanup()});
