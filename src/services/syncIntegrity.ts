import type { FocusSession, FocusTask } from '../types';

/** Firestore and on-device cache merge rules. No record may resurrect after
 * a tombstone was observed on any authenticated device. */
export type PersistedRecord = { id: string; updatedAt?: number; deleted?: boolean };
const valid = (item: unknown): item is PersistedRecord =>
  Boolean(item && typeof item === 'object' && typeof (item as any).id === 'string' &&
    (item as any).id.length > 0 && (item as any).id.length <= 500 &&
    !(item as any).id.includes('/'));

export function mergeSyncedRecords<T extends PersistedRecord>(
  local: T[],
  cloud: T[],
  deletedIds: ReadonlySet<string>,
  kind: 'session' | 'task',
): T[] {
  const records = new Map<string, T>();
  const absorb = (item: T, fromCloud: boolean) => {
    if (!valid(item) || item.deleted || deletedIds.has(item.id)) return;
    const prev = records.get(item.id);
    if (!prev) { records.set(item.id, item); return; }
    const newer = Number(item.updatedAt || 0) - Number(prev.updatedAt || 0);
    // With equal revision prefer the server. Older task completion must never
    // undo a more recent user's "mark as not completed" action.
    if (newer > 0 || (newer === 0 && fromCloud)) records.set(item.id, item);
  };
  for (const item of local) absorb(item, false);
  for (const item of cloud) absorb(item, true);
  return [...records.values()].sort((a, b) => {
    const aa = Number(kind === 'session' ? (a as FocusSession).timestamp : (a as FocusTask).createdAt) || 0;
    const bb = Number(kind === 'session' ? (b as FocusSession).timestamp : (b as FocusTask).createdAt) || 0;
    return bb - aa;
  });
}

export function collectDeletedIds<T extends PersistedRecord>(
  cloud: T[], existing: ReadonlySet<string>,
): Set<string> {
  const tombstones = new Set(existing);
  for (const item of cloud) if (valid(item) && item.deleted) tombstones.add(item.id);
  return tombstones;
}

/** Only meaningful record fields count as data changes. Never compare syncedAt
 * (a network timestamp) or userId (changes during account migration). */
export function contentFingerprint(item: PersistedRecord): string {
  const raw = { ...item } as Record<string, unknown>;
  delete raw.syncedAt;
  delete raw.userId;
  // A server's unrelated metadata should not force an upload every time.
  return JSON.stringify(Object.keys(raw).sort().map(k => [k, raw[k]]));
}

export function recordNeedsUpload(local: PersistedRecord, cloud?: PersistedRecord): boolean {
  if (!cloud) return true;
  if (cloud.deleted) return false;
  const l = Number(local.updatedAt || 0);
  const r = Number(cloud.updatedAt || 0);
  if (l < r) return false;
  return l > r || contentFingerprint(local) !== contentFingerprint(cloud);
}

export function canonicalStatsFromSessions(sessions: FocusSession[]) {
  const completed = sessions.filter(s => s && s.completed !== false &&
    Number.isFinite(Number(s.completedSeconds)) && Number(s.completedSeconds) > 0);
  const seconds = completed.reduce((sum, s) => sum + Math.max(0, Number(s.completedSeconds)), 0);
  return { count: completed.length, seconds, totalMinutes: Math.round(seconds / 60),
    totalHours: Math.round(seconds / 360) / 10 };
}
