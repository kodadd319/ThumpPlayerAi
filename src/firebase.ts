import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase Config Object — Pre-configured with workspace applet credentials
// You can replace these with your own production credentials in the future.
const firebaseConfig = {
  apiKey: "AIzaSyD2Dx7sh46DY_nMdPoF8iOoHV33bKoJ0zA",
  authDomain: "gen-lang-client-0036974014.firebaseapp.com",
  projectId: "gen-lang-client-0036974014",
  storageBucket: "gen-lang-client-0036974014.firebasestorage.app",
  messagingSenderId: "591006778984",
  appId: "1:591006778984:web:8b42dc5d220649802b1ddd",
  measurementId: "G-DF7EJQG12V"
};

// Initialize Firebase Service Stack
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInAnonymously, GoogleAuthProvider };
export default app;
