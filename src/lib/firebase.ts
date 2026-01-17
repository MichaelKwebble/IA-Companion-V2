import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const isProduction = import.meta.env.VITE_APP_MODE === 'production';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: any = null;
let auth: any = null;
let db: any = null;

if (!isProduction) {
    // Defensive check to help debug missing env variables
    if (!firebaseConfig.apiKey) {
        console.error('Firebase API Key is missing. Check your .env file and restart the dev server.');
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = initializeFirestore(app, {
            experimentalForceLongPolling: true,
        });
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
    }
} else {
    console.log('Production mode detected: Skipping Firebase initialization.');
    // Mock auth for signOut etc.
    auth = {
        signOut: async () => console.log('Mock signOut called'),
        currentUser: null,
    };
    db = {}; // Empty object for db
}

export { auth, db };
export default app;
