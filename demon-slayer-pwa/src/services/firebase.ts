import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TODO: Replace with your Firebase project configuration
// You can find this in the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAqGHIttPZniNNGn606ZkQU283kOVcWO2c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dndapp-71a1c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dndapp-71a1c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dndapp-71a1c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "554592472716",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:554592472716:web:0cc0b78e841195e0b2b5a9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
