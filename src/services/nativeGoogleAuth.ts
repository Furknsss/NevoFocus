import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../firebase';

// Never use signInWithPopup / signInWithRedirect in the Android WebView.
// Chrome and the embedded WebView have separate storage partitions, which
// causes Firebase's "missing initial state" error on the hosted auth helper.
export const isAndroidNativeAuth =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

let initialization: Promise<void> | null = null;

async function initializeGoogle() {
  if (!isAndroidNativeAuth) {
    throw new Error('Native Google Sign-In is only supported inside the Android app.');
  }
  if (!firebaseConfig.oAuthClientId) {
    throw new Error('Google Web OAuth client ID is missing from Firebase configuration.');
  }
  if (!initialization) {
    initialization = GoogleSignIn.initialize({
      clientId: firebaseConfig.oAuthClientId,
    }).then(() => undefined).catch(error => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

export async function signInWithNativeGoogle(): Promise<UserCredential> {
  await initializeGoogle();
  const googleResult = await GoogleSignIn.signIn();
  if (!googleResult.idToken) {
    throw new Error('Google did not return an ID token.');
  }
  // Firebase JS Auth remains the only session used by the React/Firestore app.
  // This preserves the same Firebase UID, accounts, and cloud data as the website.
  const firebaseCredential = GoogleAuthProvider.credential(googleResult.idToken);
  return signInWithCredential(auth, firebaseCredential);
}

export async function signOutNativeGoogle(): Promise<void> {
  if (!isAndroidNativeAuth) return;
  try {
    await GoogleSignIn.signOut();
  } catch (error) {
    // Firebase sign-out must not fail because native account-picker state
    // was already cleared or the Google service is temporarily unavailable.
    console.warn('[NevoFocus] Google native sign-out:', error);
  }
}
