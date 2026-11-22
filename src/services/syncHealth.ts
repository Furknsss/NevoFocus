import { auth, db } from '../firebase';
import { doc, getDocFromServer, collection, getDocsFromServer } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { FocusSession } from '../types';
import { canonicalStatsFromSessions } from './syncIntegrity';
import { accountCacheIsBound } from './accountCache';

export type CloudHealthStatus = 'verified' | 'missing' | 'mismatch' | 'offline' | 'unauthorized';
export interface CloudHealth {
  status: CloudHealthStatus;
  sessions: number;
  tasks: number;
  totalSeconds: number;
  lastCompleteAt: number | null;
  message: string;
}

/** Read only server-acknowledged data. Client cache or UI counters are not a
 * valid verification that the backup actually exists in Firebase. */
export async function verifyCloudHealth(user: User | null): Promise<CloudHealth> {
  const uid = auth.currentUser?.uid || '';
  const fail = (status: CloudHealthStatus, message: string): CloudHealth => ({
    status,sessions:0,tasks:0,totalSeconds:0,lastCompleteAt:null,message,
  });
  if (!uid || user?.uid !== uid || !accountCacheIsBound(uid))
    return fail('unauthorized','Giriş yapılan Firebase hesabı doğrulanamadı.');
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return fail('offline','İnternet yok. Yerel kayıtlar korunuyor; sunucu doğrulaması yapılamadı.');
  try {
    const [manifestSnap,sessionsSnap,tasksSnap] = await Promise.all([
      getDocFromServer(doc(db,'users',uid,'backups','latest_v2')),
      getDocsFromServer(collection(db,'users',uid,'sessions')),
      getDocsFromServer(collection(db,'users',uid,'tasks')),
    ]);
    if (auth.currentUser?.uid !== uid) return fail('unauthorized','Hesap değişti, doğrulama iptal edildi.');
    const sessions = sessionsSnap.docs.map(x=>x.data()).filter(x=>!x.deleted) as FocusSession[];
    const tasks = tasksSnap.docs.map(x=>x.data()).filter(x=>!x.deleted);
    const stats=canonicalStatsFromSessions(sessions);
    if(!manifestSnap.exists()) return {
      status:'missing',sessions:sessions.length,tasks:tasks.length,
      totalSeconds:stats.seconds,lastCompleteAt:null,
      message:'Sunucuda kayıtlar olabilir ancak tamamlanmış otomatik yedek bildirimi henüz yok.',
    };
    const manifest=manifestSnap.data();
    const completeAt=Number(manifest.completedAt)||null;
    const verified=manifest.uid===uid && manifest.version===2 &&
      manifest.sessionCount===sessions.length && manifest.taskCount===tasks.length &&
      Math.abs(Number(manifest.sessionSeconds)-stats.seconds)<0.1;
    return {
      status:verified?'verified':'mismatch',sessions:sessions.length,
      tasks:tasks.length,totalSeconds:stats.seconds,lastCompleteAt:completeAt,
      message:verified
        ? 'Firebase sunucusunda seans, görev ve toplam süre doğrulandı.'
        : 'Sunucu kayıtları ile son yedek özeti uyuşmuyor. Yeniden eşitlemeyi dene.',
    };
  } catch (error) {
    return fail('offline',error instanceof Error
      ? `Sunucu doğrulaması başarısız: ${error.message}`
      : 'Firebase doğrulaması başarısız oldu.');
  }
}
