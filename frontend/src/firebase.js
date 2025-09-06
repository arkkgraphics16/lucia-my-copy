import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onIdTokenChanged
} from 'firebase/auth';
import {
  getFirestore, serverTimestamp, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, query, orderBy, onSnapshot, increment
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);

// ===== Auth =====
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ===== Firestore =====
const db = getFirestore(app);

// --- helpers (Option B: client-side cap, simple & scalable) ---
async function ensureUser(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      tier: 'free',
      exchanges_used: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  return ref;
}

async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

async function createConversation(uid, title = 'New chat', system = '') {
  const ref = await addDoc(collection(db, 'users', uid, 'conversations'), {
    title, system, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
}

function listenMessages(uid, cid, cb) {
  const q = query(
    collection(db, 'users', uid, 'conversations', cid, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

async function addMessage(uid, cid, role, content) {
  return addDoc(collection(db, 'users', uid, 'conversations', cid, 'messages'), {
    role, content, createdAt: serverTimestamp()
  });
}

async function bumpUpdatedAt(uid, cid) {
  await updateDoc(doc(db, 'users', uid, 'conversations', cid), {
    updatedAt: serverTimestamp()
  });
}

async function incrementExchanges(uid) {
  await updateDoc(doc(db, 'users', uid), {
    exchanges_used: increment(1),
    updatedAt: serverTimestamp()
  });
}

export {
  app, auth, googleProvider, signInWithPopup, signOut, onIdTokenChanged,
  db,
  ensureUser, getUserData, createConversation, listenMessages,
  addMessage, bumpUpdatedAt, incrementExchanges
};
