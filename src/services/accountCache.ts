/**
 * Never let an old device cache (or a different Google account's cache)
 * silently upload into a newly authenticated Firebase UID.
 *
 * This is an on-device isolation layer, NOT an account migration. A legacy
 * unowned cache is preserved as a recovery snapshot; the user must explicitly
 * import their JSON backup to the new account.
 */
const OWNER_KEY = 'fokus_cache_owner_uid_v2';
const PREFIX = 'fokus_per_account_cache_v2_';
const LEGACY_KEY = 'fokus_unassigned_legacy_cache_v2';
const DATA_KEYS = [
  'fokus_sessions_v4',
  'fokus_tasks_v4',
  'fokus_profile_v4',
  'fokus_deleted_session_ids_v4',
  'fokus_deleted_task_ids_v4',
  'fokus_last_sync_timestamp',
  'fokus_active_session_running',
] as const;

type AccountSnapshot = Record<string, string>;
type StorageLike = Pick<Storage, 'getItem'|'setItem'|'removeItem'>;

function capture(store: StorageLike): AccountSnapshot {
  const state: AccountSnapshot = {};
  for (const key of DATA_KEYS) {
    const item = store.getItem(key);
    if (item !== null) state[key] = item;
  }
  return state;
}

function restore(store: StorageLike, state: AccountSnapshot): void {
  // Validate and parse BEFORE mutating the shared working set.
  for (const key of DATA_KEYS) {
    const item = state[key];
    if (item !== undefined && key !== 'fokus_last_sync_timestamp') JSON.parse(item);
  }
  for (const key of DATA_KEYS) store.removeItem(key);
  for (const [key, value] of Object.entries(state)) {
    if ((DATA_KEYS as readonly string[]).includes(key)) store.setItem(key, value);
  }
}

function legacyUid(store: StorageLike): string {
  const fromKey = store.getItem('fokus_user_uid');
  if (fromKey) return fromKey;
  try {
    const profile = JSON.parse(store.getItem('fokus_profile_v4') || '{}');
    return typeof profile.userId === 'string' ? profile.userId : '';
  } catch { return ''; }
}

function hasData(state: AccountSnapshot): boolean {
  for (const key of ['fokus_sessions_v4', 'fokus_tasks_v4']) {
    try { if (JSON.parse(state[key] || '[]').length > 0) return true; }
    catch { return true; }
  }
  return Boolean(state.fokus_active_session_running);
}

export type AccountCacheBindingResult = 'unchanged'|'resumed'|'new'|'legacy-quarantined';

/** Atomic with respect to data loss: no existing cache is cleared unless a
 * separate recovery copy was successfully stored first. */
export function bindAccountCache(uid: string, store: StorageLike = localStorage): AccountCacheBindingResult {
  if (!uid || uid.includes('/')) throw new Error('Geçersiz Firebase kullanıcı kimliği.');
  const owner = store.getItem(OWNER_KEY);
  if (owner === uid) return 'unchanged';
  const current = capture(store);

  if (owner) {
    // Preserve any unsynced data for its original owner before switching.
    store.setItem(PREFIX + owner, JSON.stringify(current));
  } else if (hasData(current) || legacyUid(store)) {
    const claimed = legacyUid(store);
    if (claimed === uid) {
      // Existing signed-in device predates the per-account protection.
      store.setItem(OWNER_KEY, uid);
      return 'unchanged';
    }
    // Never erase an unclaimed legacy backup. The file import is explicit.
    if (!store.getItem(LEGACY_KEY)) store.setItem(LEGACY_KEY, JSON.stringify(current));
  }

  const target = store.getItem(PREFIX + uid);
  const state: AccountSnapshot = target ? JSON.parse(target) : {};
  // On quota errors, do not clear the existing unsynced cache.
  // Restore the previous snapshot if a write fails.
  try {
    restore(store, state);
    store.setItem(OWNER_KEY, uid);
  } catch (error) {
    try { restore(store, current); } catch {}
    throw new Error('Hesap değişiminde yerel veri yedeklenemedi. Depolama alanını kontrol et; buluta aktarım durduruldu.', { cause: error });
  }
  return target ? 'resumed' : !owner && hasData(current) ? 'legacy-quarantined' : 'new';
}

/** Stash the current private data on logout, then show an empty guest cache. */
export function parkAccountCache(store: StorageLike = localStorage): void {
  const owner = store.getItem(OWNER_KEY);
  if (!owner) return;
  const current = capture(store);
  store.setItem(PREFIX + owner, JSON.stringify(current));
  restore(store, {});
  store.removeItem(OWNER_KEY);
  store.removeItem('fokus_user_uid');
  store.removeItem('fokus_user_email');
  store.removeItem('fokus_user_authenticated');
}

export function accountCacheIsBound(uid: string, store: StorageLike = localStorage): boolean {
  return Boolean(uid && store.getItem(OWNER_KEY) === uid);
}

export function hasUnclaimedLegacyCache(store: StorageLike = localStorage): boolean {
  return Boolean(store.getItem(LEGACY_KEY));
}
