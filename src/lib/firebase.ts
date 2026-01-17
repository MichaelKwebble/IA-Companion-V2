import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Defensive check to help debug missing env variables
if (!firebaseConfig.apiKey) {
    console.error('Firebase API Key is missing. Check your .env file and restart the dev server.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with settings for better Electron compatibility
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // Often more stable in Electron/Proxy environments
});

export default app;
