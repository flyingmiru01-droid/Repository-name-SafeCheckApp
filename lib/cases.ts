import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";

function removeUndefined(data: any) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

export async function addCase(data: any) {
  return await addDoc(collection(db, "cases"), {
    ...removeUndefined(data),
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
