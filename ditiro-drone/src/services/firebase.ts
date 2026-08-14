import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore - getReactNativePersistence is exported by firebase/auth when bundled for React Native
  getReactNativePersistence,
  Auth
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Client Config (Synchronized with main Ditiro Web Ecosystem)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDpkC67sI7vciiEHa4ESvUi85QM2MXfl8w",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "ditiro-cdf6e.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "ditiro-cdf6e",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "ditiro-cdf6e.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "246231271383",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:246231271383:web:3dbb7613a957d788c26d92"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const firestore = getFirestore(app);

// Safe Auth initialization with AsyncStorage persistence for React Native
let authInstance: Auth;
try {
  const persistenceOption = typeof getReactNativePersistence === 'function'
    ? getReactNativePersistence(AsyncStorage)
    : undefined;
  authInstance = initializeAuth(app, persistenceOption ? { persistence: persistenceOption } : {});
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const getDroneAuth = (): Auth => {
  return auth;
};

export default app;
