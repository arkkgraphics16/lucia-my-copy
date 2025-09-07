// lucia-secure/frontend/src/firebase.js
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

// --- helpers ---
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

// Create (server-created id)
async function createConversation(uid, title = 'New chat', system = '') {
  const ref = await addDoc(collection(db, 'users', uid, 'conversations'), {
    title, system, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
}

// ==== NEW: instant ID + write with specific ID (for optimistic UI) ====
function newConversationId(uid) {
  return doc(collection(db, 'users', uid, 'conversations')).id;
}

async function createConversationWithId(uid, id, init = {}) {
  const ref = doc(db, 'users', uid, 'conversations', id);
  await setDoc(ref, {
    title: init.title ?? 'New chat',
    system: init.system ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
}

// Stream messages
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

async function setConversationTitle(uid, cid, title) {
  await updateDoc(doc(db, 'users', uid, 'conversations', cid), {
    title, updatedAt: serverTimestamp()
  });
}

export {
  app, auth, googleProvider, signInWithPopup, signOut, onIdTokenChanged,
  db,
  ensureUser, getUserData,
  createConversation,
  newConversationId, createConversationWithId,       // <-- export new helpers
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges,
  setConversationTitle
};
