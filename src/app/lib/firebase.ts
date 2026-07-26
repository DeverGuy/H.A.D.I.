/**
 * Firebase configuration for HADI.
 *
 * Setup (one-time, takes ~3 minutes):
 *  1. Go to https://console.firebase.google.com/ → New project
 *  2. Add a Web app (</>) → copy the firebaseConfig object
 *  3. In the Firebase console: Authentication → Sign-in method
 *     → Enable "Email/Password" and "Google"
 *  4. Create .env in this project root and paste your values (see .env.example)
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       "https://hadi-vvce-default-rtdb.firebaseio.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Avoid duplicate initialization on HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firebaseStorage = getStorage(app);
export const firebaseFunctions = getFunctions(app);
