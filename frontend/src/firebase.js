// lucia-secure/frontend/src/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore, serverTimestamp, doc, getDoc, setDoc, updateDoc,
  addDoc, collection, query, orderBy, onSnapshot, increment
} from 'firebase/firestore';

// --------------------------
// Firebase init
// --------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);

// ===== Auth =====
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Extra helpers for Email/Password
async function registerWithEmail(email, password) {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return res.user;
}
async function loginWithEmail(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

// ===== Firestore =====
const db = getFirestore(app);

// --------------------------
// Client-side crypto helpers
// AES-GCM 256; per-user DEK, cached by uid.
// Stored as Base64 'raw' key in localStorage (lucia_dek_v1:<uid>).
// --------------------------
const TEXT = {
  enc: new TextEncoder(),
  dec: new TextDecoder()
};

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

function dekStorageKey(uid) {
  return `lucia_dek_v1:${uid}`;
}

async function getOrCreateDEK(uid) {
  if (!uid) throw new Error('Missing uid for DEK');
  const k = dekStorageKey(uid);
  const existing = localStorage.getItem(k);
  if (existing) {
    const raw = fromBase64(existing);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(k, toBase64(raw));
  return key;
}

async function encryptForUser(uid, text) {
  const dek = await getOrCreateDEK(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = TEXT.enc.encode(String(text ?? ''));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, pt);
  return { ciphertext: toBase64(ctBuf), iv: toBase64(iv.buffer) };
}

async function decryptForUser(uid, ciphertextB64, ivB64) {
  const dek = await getOrCreateDEK(uid);
  const ct = fromBase64(ciphertextB64);
  const iv = new Uint8Array(fromBase64(ivB64));
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ct);
  return TEXT.dec.decode(ptBuf);
}

// --------------------------
// User and conversations
// --------------------------
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

async function createConversation(uid, title = 'New chat', system = '') {
  const ref = await addDoc(collection(db, 'users', uid, 'conversations'), {
    title, system, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
}

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

// --------------------------
// Messages (ENCRYPTED AT REST)
// --------------------------
function listenMessages(uid, cid, cb) {
  const q = query(
    collection(db, 'users', uid, 'conversations', cid, 'messages'),
    orderBy('createdAt', 'asc')
  );

  // onSnapshot callback cannot be async directly; use IIFE.
  return onSnapshot(q, (snap) => {
    (async () => {
      const items = await Promise.all(snap.docs.map(async d => {
        const raw = d.data();
        let content = '';

        // Back-compat: plaintext content (legacy)
        if (typeof raw.content === 'string') {
          content = raw.content;
        } else if (raw.ciphertext && raw.iv) {
          // Decrypt new-format messages
          try {
            content = await decryptForUser(uid, raw.ciphertext, raw.iv);
          } catch (e) {
            // If decryption fails, show a placeholder rather than crashing UI
            content = '[Cannot decrypt message on this device]';
            // You may log this if needed
            // console.warn('Decrypt failed:', e);
          }
        } else {
          // Unknown shape; keep it safely empty
          content = '';
        }

        return {
          id: d.id,
          role: raw.role || 'assistant',
          content,
          createdAt: raw.createdAt ?? null
        };
      }));

      cb(items);
    })();
  });
}

async function addMessage(uid, cid, role, content) {
  // Always store encrypted
  const { ciphertext, iv } = await encryptForUser(uid, content);
  return addDoc(collection(db, 'users', uid, 'conversations', cid, 'messages'), {
    role,
    ciphertext,
    iv,
    createdAt: serverTimestamp()
  });
}

async function bumpUpdatedAt(uid, cid) {
  await updateDoc(doc(db, 'users', uid, 'conversations', cid), {
    updatedAt: serverTimestamp()
  });
}

// Free 10 + courtesy +2
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
      // Set exact values instead of using increment for courtesy transition
      update.exchanges_used = 11;
      update.courtesy_used = true;
    } else if (courtesy && used === 10) {
      // Handle recovery case: courtesy was set but still at 10
      update.exchanges_used = 11;
    } else if (courtesy && used >= 11 && used < 12) {
      update.exchanges_used = increment(1);
    }
  }

  await updateDoc(ref, update);
}

// ---- NEW: courtesy flag helper (admin / debug) ----
// NOTE: Under your "tight" rules, calling this alone from the client is blocked.
// Use incrementExchanges(uid) for the 10→11 courtesy bump.
async function markCourtesyUsed(uid) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    courtesy_used: true,
    updatedAt: serverTimestamp()
  });
}

async function setConversationTitle(uid, cid, title) {
  await updateDoc(doc(db, 'users', uid, 'conversations', cid), {
    title, updatedAt: serverTimestamp()
  });
}

async function softDeleteConversation(uid, cid) {
  const ref = doc(db, 'users', uid, 'conversations', cid);
  await updateDoc(ref, { deletedAt: serverTimestamp() });
}

async function setConversationFolder(uid, cid, folder) {
  const ref = doc(db, 'users', uid, 'conversations', cid);
  await updateDoc(ref, {
    folder: folder || null,
    updatedAt: serverTimestamp()
  });
}

export {
  app, auth, googleProvider, signInWithPopup, signOut, onIdTokenChanged,
  db,
  ensureUser, getUserData,
  createConversation,
  newConversationId, createConversationWithId,
  listenMessages, addMessage, bumpUpdatedAt, incrementExchanges,
  setConversationTitle, softDeleteConversation, setConversationFolder,
  registerWithEmail, loginWithEmail,
  markCourtesyUsed
};