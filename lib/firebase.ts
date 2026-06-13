import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDB1DG8X92_xSVw1xrcRbFnJtKCee_UDm4",
  authDomain: "safecheck-89b25.firebaseapp.com",
  projectId: "safecheck-89b25",
  storageBucket: "safecheck-89b25.firebasestorage.app",
  messagingSenderId: "203482076018",
  appId: "1:203482076018:web:4106e95e155c95342ac3eb",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
