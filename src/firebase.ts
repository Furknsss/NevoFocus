import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  browserLocalPersistence,
  setPersistence,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, setDoc, getDocs, onSnapshot, query, where, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Cihaz hatırlaması: Tarayıcı ve PWA kapatılıp açılsa dahi oturum açık kalır
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase persistence warning:', err);
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test initial connection as required by skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

/**
 * Checks if a value is a Firestore FieldValue sentinel or special Firestore object
 * (increment, arrayUnion, arrayRemove, serverTimestamp, deleteField, Timestamp, Date, GeoPoint)
 */
export function isFirestoreSentinel(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Date) return true;
  if (typeof val._methodName === 'string') return true;
  const name = val.constructor?.name;
  if (name && (name === 'FieldValue' || name.includes('FieldValue') || name === 'Timestamp' || name === 'GeoPoint' || name === 'FieldPath')) {
    return true;
  }
  return false;
}

/**
 * Safely parses any numeric field from Firestore or localStorage, preventing React crashes
 * if an object like {_methodName, Vi} was mistakenly saved.
 */
export function parseNumericField(val: any, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (!isNaN(parsed)) return parsed;
  }
  if (val && typeof val === 'object') {
    if (typeof val.Vi === 'number' && !isNaN(val.Vi)) return val.Vi;
    if (typeof val.value === 'number' && !isNaN(val.value)) return val.value;
  }
  return fallback;
}

/**
 * Deeply sanitizes any payload before sending to Firestore.
 * Strips all `undefined` values that cause Firestore SDK crashes ("Unsupported field value: undefined").
 * Preserves FieldValue sentinels (increment, arrayUnion, serverTimestamp, deleteField, etc.).
 */
export function cleanFirestoreData<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (isFirestoreSentinel(obj)) return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !isFirestoreSentinel(val)) {
        cleaned[key] = cleanFirestoreData(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

/**
 * Safe wrapper for setDoc that guarantees no undefined field will cause an error
 * while preserving FieldValue sentinels like increment() and arrayUnion().
 */
export async function safeSetDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const cleaned = cleanFirestoreData(data);
  return options ? setDoc(docRef, cleaned, options) : setDoc(docRef, cleaned);
}

/**
 * Safe wrapper for updateDoc that guarantees no undefined field will cause an error
 * while preserving FieldValue sentinels.
 */
export async function safeUpdateDoc(docRef: any, data: any) {
  const cleaned = cleanFirestoreData(data);
  return updateDoc(docRef, cleaned);
}
