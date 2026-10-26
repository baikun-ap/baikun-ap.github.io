import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web config for Google sign-in and cloud progress.
 *
 * These values are not secrets: a web app ships them to every visitor, and
 * access is controlled by Firestore security rules (firestore.rules) and the
 * list of authorised domains in the Firebase console.
 *
 * Leave as null until the Firebase project exists; the site then works fully
 * offline-only and the settings page explains that sign-in is not set up yet.
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = null;
