import { auth, db } from '../firebase';
import type { User } from 'firebase/auth';
import { deleteUser } from 'firebase/auth';
import { collection, doc, deleteDoc, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { destroyAccountCache } from './accountCache';

/** Explicit account deletion: do not just delete the parent document.
 * Firestore subcollections do NOT cascade when their parent is deleted.
 * For additional future / cross-user collections, a privileged server-side
 * recursive-delete function is still necessary.
 */
export async function deleteCurrentAccountAndPrivateData(user: User): Promise<void> {
  if (auth.currentUser?.uid !== user.uid)
    throw new Error('Hesap kimliği değişti. İşlem güvenli biçimde durduruldu.');
  const lastSignIn = Date.parse(user.metadata.lastSignInTime || '');
  if (!Number.isFinite(lastSignIn) || Date.now() - lastSignIn > 4*60*1000) {
    throw new Error('Hesap silmeden önce yeniden giriş yapmalısın. Veriler değiştirilmedi.');
  }
  const guard = 'fokus_deleting_account_uid';
  try { localStorage.setItem(guard,user.uid); } catch {}
  try {
    // All known owner-private child documents are removed before Auth revokes
    // the only credentials allowed to delete them. 200 ops per batch avoids
    // writeBatch limits; a partial network failure keeps the Auth user so the
    // operation can be retried from the same account.
    for (const name of ['sessions','tasks','active_focus','backups','cheers']) {
      const snap = await getDocsFromServer(collection(db,'users',user.uid,name));
      for (let i = 0; i < snap.docs.length; i += 200) {
        if(auth.currentUser?.uid !== user.uid) throw new Error('Hesap değişti; silme durduruldu.');
        const batch = writeBatch(db);
        for (const child of snap.docs.slice(i,i+200)) batch.delete(child.ref);
        await batch.commit();
      }
    }
    await deleteDoc(doc(db,'users',user.uid));
    await deleteUser(user);
    destroyAccountCache(user.uid);
  } finally {
    try { localStorage.removeItem(guard); } catch {}
  }
}
