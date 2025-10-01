// frontend/src/lib/api.js

// Minimal API helper for Stripe endpoints (placeholder-safe).
// Works even without keys: UI will disable checkout if not connected.

export async function getIdToken() {
  // Lazy import to avoid circulars
  const { auth } = await import('../firebase');
  const u = auth.currentUser;
  return u ? await u.getIdToken() : null;
}

function baseUrl() {
  const w = (import.meta.env.VITE_WORKER_API_URL || '').trim();
  const f = (import.meta.env.VITE_FUNCTIONS_URL || '').trim();
  const raw = w || f || '';
  return raw ? raw.replace(/\/+$/, '') : '';
}

function normalizePath(pathname) {
  if (!pathname) return '';
  return pathname.replace(/\/+$/, '');
}

export function apiBaseUrl() {
  return baseUrl();
}

function ensureChatUrl(base, { preferPlainChat } = {}) {
  const normalized = (base || '').replace(/\/+$/, '');
  if (!normalized) {
    return preferPlainChat ? '/chat' : '/api/chat';
  }

  if (normalized.endsWith('/api/chat') || normalized.endsWith('/chat')) {
    return normalized;
  }

  if (normalized.endsWith('/api')) {
    return `${normalized}/chat`;
  }

  return `${normalized}${preferPlainChat ? '/chat' : '/api/chat'}`;
}

export function chatUrl() {
  const override = (import.meta.env.VITE_CHAT_URL || '').trim();
  if (override) return override;

  const workerBase = (import.meta.env.VITE_WORKER_API_URL || '').trim();
  const functionsBase = (import.meta.env.VITE_FUNCTIONS_URL || '').trim();

  const base = baseUrl();
  if (!base) return '/api/chat';

  const normalizedBase = base.replace(/\/+$/, '');
  if (!normalizedBase) return '/api/chat';

  const normalizedWorkerBase = workerBase.replace(/\/+$/, '');
  const normalizedFunctionsBase = functionsBase.replace(/\/+$/, '');
  const preferPlainChat = Boolean(
    normalizedWorkerBase &&
      normalizedWorkerBase === normalizedBase &&
      normalizedWorkerBase !== normalizedFunctionsBase
  );

  const tryParseAbsolute = () => {
    try {
      const url = new URL(normalizedBase);
      const path = normalizePath(url.pathname);
      const root = path ? `${url.origin}${path}` : url.origin;
      return ensureChatUrl(root, { preferPlainChat });
    } catch (_err) {
      return null;
    }
  };

  const absolute = tryParseAbsolute();
  if (absolute) return absolute;

  return ensureChatUrl(normalizedBase, { preferPlainChat });
}

export function stripeEnabled() {
  // We only enable buttons when owner provided at least a publishable key AND an API base
  return Boolean((import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim() && baseUrl());
}

export async function createCheckoutSession({ priceId, uid, email }) {
  const url = baseUrl() + '/stripe/create-checkout-session';
  const token = await getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ priceId, uid, email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}

export async function createPortalSession({ uid, email }) {
  const url = baseUrl() + '/stripe/create-portal-session';
  const token = await getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ uid, email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}
