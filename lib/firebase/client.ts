"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize in the browser: `next build` server-renders every "use
// client" component once to produce its initial HTML, which would otherwise
// evaluate this module with no real env vars and crash the build.
const isBrowser = typeof window !== "undefined";

let app: FirebaseApp | undefined;
if (isBrowser) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const auth = (isBrowser ? getAuth(app!) : undefined) as Auth;
export const db = (isBrowser ? getFirestore(app!) : undefined) as Firestore;
