import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";

export async function addCase(data: any) {
  return await addDoc(collection(db, "cases"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getCases() {
  const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    firebaseId: d.id,
    ...d.data(),
  }));
}
