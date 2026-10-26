/**
 * Firebase project settings (Firebase console → Project settings → Your apps → Web app → SDK setup).
 * These values identify the project; they are not secrets — access is controlled by the
 * Firestore security rules (see CLOUD_SETUP.md). Leave apiKey empty to run without accounts.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const cloudEnabled = !!firebaseConfig.apiKey;

/** Accounts use a nickname; Firebase needs an email-shaped login, so this domain is appended. */
export const LOGIN_DOMAIN = 'users.gym-log.app';
