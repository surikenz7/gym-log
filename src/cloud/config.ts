/**
 * Firebase project settings (Firebase console → Project settings → Your apps → Web app → SDK setup).
 * These values identify the project; they are not secrets — access is controlled by the
 * Firestore security rules (see CLOUD_SETUP.md). Leave apiKey empty to run without accounts.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCwpPZNQwFbI6zyShEHLTMRoyKV3tyvs7I',
  authDomain: 'gym-log-a23f0.firebaseapp.com',
  projectId: 'gym-log-a23f0',
  storageBucket: 'gym-log-a23f0.firebasestorage.app',
  messagingSenderId: '573179253161',
  appId: '1:573179253161:web:b66653a32d08b4a09434b8',
};

export const cloudEnabled = !!firebaseConfig.apiKey;

/** Accounts use a nickname; Firebase needs an email-shaped login, so this domain is appended. */
export const LOGIN_DOMAIN = 'users.gym-log.app';
