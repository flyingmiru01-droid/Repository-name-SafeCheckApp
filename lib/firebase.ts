import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

const firebaseConfig = {
  apiKey: "AIzaSyApab4M4tNRBrvJKvbR2HDlhLkYNXxuY2w",
  authDomain: "safecheck-89b25.firebaseapp.com",
  projectId: "safecheck-89b25",
  storageBucket: "safecheck-89b25.firebasestorage.app",
  messagingSenderId: "203482076018",
  appId: "1:203482076018:web:4106e95e155c95342ac3eb",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const storage = firebase.storage();
export const auth = firebase.auth();

export default firebase;
