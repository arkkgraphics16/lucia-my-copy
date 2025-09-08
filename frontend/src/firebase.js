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
      courtesy_used: false,
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

// Updated to support courtesy bonus logic
async function incrementExchanges(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const used = data.exchanges_used || 0;
  const courtesy = data.courtesy_used || false;
  const update = { updatedAt: serverTimestamp() };

  if (data.tier === 'pro') {
    update.exchanges_used = increment(1);
  } else {
    if (used < 10) {
      update.exchanges_used = increment(1);
    } else if (used === 10 && !courtesy) {
      update.exchanges_used = increment(1);
      update.courtesy_used = true;
    } else if (courtesy && used < 12) {
      update.exchanges_used = increment(1);
    }
  }

  await updateDoc(ref, update);
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
  newConversationId, createConversationWithId,
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges,
  setConversationTitle
};
