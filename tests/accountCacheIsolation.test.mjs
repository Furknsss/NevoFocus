import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAccountCache,parkAccountCache,accountCacheIsBound,hasUnclaimedLegacyCache} from '../src/services/accountCache.ts';

class Store {
  items=new Map();
  getItem(k){return this.items.has(k)?this.items.get(k):null}
  setItem(k,v){this.items.set(k,String(v))}
  removeItem(k){this.items.delete(k)}
}
const put=(store,key,value)=>store.setItem(key,JSON.stringify(value));
const get=(store,key)=>JSON.parse(store.getItem(key)??'null');

test('first login never automatically claims unattributed legacy study sessions', () => {
  const s=new Store();
  put(s,'fokus_sessions_v4',[{id:'legacy',completedSeconds:190}]);
  put(s,'fokus_profile_v4',{name:'Previous owner'});
  assert.equal(bindAccountCache('alice',s),'legacy-quarantined');
  assert.equal(get(s,'fokus_sessions_v4'),null);
  assert.ok(hasUnclaimedLegacyCache(s));
  assert.ok(s.getItem('fokus_unassigned_legacy_cache_v2').includes('legacy'));
  assert.ok(accountCacheIsBound('alice',s));
});

test('different Google account never inherits private local sessions or deletion tombstones', () => {
  const s=new Store();bindAccountCache('alice',s);
  put(s,'fokus_sessions_v4',[{id:'a',completedSeconds:900}]);
  put(s,'fokus_deleted_task_ids_v4',['secret-task']);
  assert.equal(bindAccountCache('bob',s),'new');
  assert.equal(get(s,'fokus_sessions_v4'),null);
  assert.equal(get(s,'fokus_deleted_task_ids_v4'),null);
  put(s,'fokus_sessions_v4',[{id:'b',completedSeconds:65}]);
  assert.equal(bindAccountCache('alice',s),'resumed');
  assert.deepEqual(get(s,'fokus_sessions_v4'),[{id:'a',completedSeconds:900}]);
  assert.deepEqual(get(s,'fokus_deleted_task_ids_v4'),['secret-task']);
  assert.equal(bindAccountCache('bob',s),'resumed');
  assert.deepEqual(get(s,'fokus_sessions_v4'),[{id:'b',completedSeconds:65}]);
});

test('preexisting account with a matching authenticated UID can bind without losing records', () => {
  const s=new Store();
  s.setItem('fokus_user_uid','alice');
  put(s,'fokus_sessions_v4',[{id:'mine'}]);
  assert.equal(bindAccountCache('alice',s),'unchanged');
  assert.deepEqual(get(s,'fokus_sessions_v4'),[{id:'mine'}]);
});

test('sign-out parks all local data and can be restored for same user', () => {
  const s=new Store();bindAccountCache('alice',s);
  put(s,'fokus_tasks_v4',[{id:'homework'}]);
  parkAccountCache(s);
  assert.equal(get(s,'fokus_tasks_v4'),null);
  assert.ok(!accountCacheIsBound('alice',s));
  assert.equal(bindAccountCache('alice',s),'resumed');
  assert.deepEqual(get(s,'fokus_tasks_v4'),[{id:'homework'}]);
});

test('quota error during account switch preserves previous account data', () => {
  const s=new Store();bindAccountCache('alice',s);
  put(s,'fokus_sessions_v4',[{id:'a'}]);
  const realSet=s.setItem.bind(s);
  s.setItem=(k,v)=>{if(k==='fokus_per_account_cache_v2_alice')throw Error('QuotaExceeded');return realSet(k,v)};
  assert.throws(()=>bindAccountCache('bob',s),/QuotaExceeded/);
  assert.deepEqual(get(s,'fokus_sessions_v4'),[{id:'a'}]);
  assert.ok(accountCacheIsBound('alice',s));
});
