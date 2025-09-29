import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDL2tLUpEKMMdhxyRT0uuedtpgO2OtQMVo",
  authDomain: "seatsnag-prod-2025.firebaseapp.com",
  projectId: "seatsnag-prod-2025",
  storageBucket: "seatsnag-prod-2025.firebasestorage.app",
  messagingSenderId: "912468852621",
  appId: "1:912468852621:web:f72ba7330ff71d2f9387c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth  
export const auth = getAuth(app);

export default app;