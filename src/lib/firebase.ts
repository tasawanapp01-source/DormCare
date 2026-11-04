/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseConfigState } from '../types';
import appletConfig from '../../firebase-applet-config.json';

const STORAGE_KEY = 'dormcare_firebase_config';

export function getStoredFirebaseConfig(): FirebaseConfigState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read stored Firebase config:', err);
  }
  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseConfigState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearStoredFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Config from officially provisioned firebase-applet-config.json
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigState = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  firestoreDatabaseId: appletConfig.firestoreDatabaseId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

export function getActiveFirebaseConfig(): FirebaseConfigState | null {
  // Check env vars first
  const envConfig: FirebaseConfigState = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  // Check local storage config
  const stored = getStoredFirebaseConfig();
  if (stored && stored.apiKey && stored.projectId) {
    return stored;
  }

  // Default to officially provisioned project from firebase-applet-config.json
  return DEFAULT_FIREBASE_CONFIG;
}

let primaryApp: FirebaseApp | null = null;
let primaryAuth: Auth | null = null;
let primaryDb: Firestore | null = null;

export function initFirebase() {
  const config = getActiveFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, auth: null, db: null, isConfigured: false };
  }

  try {
    if (!getApps().length) {
      primaryApp = initializeApp(config);
    } else {
      primaryApp = getApp();
    }
    primaryAuth = getAuth(primaryApp);
    // CRITICAL: Connect to the provisioned database ID
    const databaseId = config.firestoreDatabaseId || (appletConfig as any).firestoreDatabaseId;
    primaryDb = databaseId ? getFirestore(primaryApp, databaseId) : getFirestore(primaryApp);

    return {
      app: primaryApp,
      auth: primaryAuth,
      db: primaryDb,
      isConfigured: true,
    };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return { app: null, auth: null, db: null, isConfigured: false, error: err };
  }
}

// Initial attempt
const initial = initFirebase();
export const firebaseApp = initial.app;
export const auth = initial.auth;
export const db = initial.db;
export const isFirebaseConfigured = () => Boolean(getActiveFirebaseConfig()?.apiKey);

/**
 * Creates a secondary temporary Firebase App instance.
 * Allows an administrator to create new auth accounts for staff/residents
 * without terminating or overwriting the administrator's current active session!
 */
export function getSecondaryAuth(): Auth | null {
  const config = getActiveFirebaseConfig();
  if (!config || !config.apiKey) return null;

  const appName = 'DormCareSecondaryAdminApp';
  let secondaryApp: FirebaseApp;
  const existingApps = getApps();
  const found = existingApps.find((a) => a.name === appName);
  if (found) {
    secondaryApp = found;
  } else {
    secondaryApp = initializeApp(config, appName);
  }
  return getAuth(secondaryApp);
}
