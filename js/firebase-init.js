// js/firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// Read keys securely from environment variables (provided by Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Basic check if variables loaded
if (!firebaseConfig.apiKey) {
    console.error("Firebase config is missing! Make sure .env file is set up and Vite is restarted.");
}

// Initialize Firebase ONCE
const app = initializeApp(firebaseConfig);

// Export the initialized services
export const db = getFirestore(app);
export const auth = getAuth(app); // We need this for login

console.log("🔥 Firebase Initialized");