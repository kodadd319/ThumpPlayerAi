import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase Service Stack using the credentials in firebase-applet-config.json
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: Must use the specific firestoreDatabaseId */
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInAnonymously, GoogleAuthProvider };
export default app;
