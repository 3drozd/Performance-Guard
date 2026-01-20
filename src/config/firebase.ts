import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD02QFlDtXFfrljcvT4OSjEHEzgXammFVQ",
  authDomain: "performance-guard.firebaseapp.com",
  projectId: "performance-guard",
  storageBucket: "performance-guard.firebasestorage.app",
  messagingSenderId: "355235207794",
  appId: "1:355235207794:web:0a2f911f73fbd95b6780eb"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Enable offline persistence
enableIndexedDbPersistence(db).catch(() => {
  // Ignore persistence errors (multiple tabs or unsupported browser)
});
