import { Capacitor, registerPlugin } from '@capacitor/core';
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

interface SigningIdentity {
  packageName: string;
  sha1: string;
  sha256: string;
  androidSdk: number;
}

const nativeDiagnostics = registerPlugin<{
  getSigningIdentity: () => Promise<SigningIdentity>;
}>('NativeOAuthDiagnostics');

/**
 * This report contains only public app configuration and APK certificate
 * fingerprints. It deliberately never includes passwords, Google ID tokens,
 * Firebase refresh tokens or private signing keys.
 */
export async function getNativeGoogleOAuthDiagnosticReport(): Promise<string> {
  if (!isAndroidNativeAuth) return 'Android uygulaması dışında tanılama kullanılamaz.';
  const signing = await nativeDiagnostics.getSigningIdentity();
  return [
    'NevoFocus Android Google OAuth tanılama',
    'Firebase proje ID: ' + firebaseConfig.projectId,
    'Google Cloud proje numarası: ' + firebaseConfig.messagingSenderId,
    'Kurulu Android paket: ' + signing.packageName,
    'Kurulu APK SHA-1: ' + signing.sha1,
    'Kurulu APK SHA-256: ' + signing.sha256,
    'Web OAuth istemci ID: ' + firebaseConfig.oAuthClientId,
    'Android SDK: ' + signing.androidSdk,
    'Gereken: Bu Web ve Android OAuth istemcileri AYNI Google Cloud projesinde olmalı.',
  ].join('\n');
}
