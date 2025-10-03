// frontend/src/lib/api.js
//
// Minimal API helper for Chat + Stripe.
// This version splits CHAT (Worker) from PAYMENTS (API/Functions) so
// Stripe calls never target the Worker domain.

// Works even without keys: UI will disable checkout if not connected.

export async function getIdToken() {
  // Lazy import to avoid circulars
  const { auth } = await import('../firebase');
  const u = auth.currentUser;
  return u ? await u.getIdToken() : null;
}

// Fallback publishable key (can be overridden via VITE_STRIPE_PUBLISHABLE_KEY)
const LIVE_STRIPE_PUBLISHABLE_KEY =
  'pk_live_51S1C5h2NCNcgXLO1oeZdRA6lXH6NHLi5wBDVVSoGwPCLxweZ2Xp8dZTee2QgrzPwwXwhalZAcY1xUeKNmKUxb5gq00tf0go3ih';

// ---------- shared helpers ----------

function trimTrailingSlashes(v) {
  return (v || '').replace(/\/+$/, '');
}

function normalizePath(pathname) {
  if (!pathname) return '';
  return pathname.replace(/\/+$/, '');
}

// ---------- CHAT URL (prefers Worker) ----------

function ensureChatUrl(base, { preferPlainChat } = {}) {
  const normalized = trimTrailingSlashes(base);
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
  // explicit override wins
  const override = trimTrailingSlashes(import.meta.env.VITE_CHAT_URL || '');
  if (override) return override;

  const workerBase = trimTrailingSlashes(import.meta.env.VITE_WORKER_API_URL || '');
  const functionsBase = trimTrailingSlashes(import.meta.env.VITE_FUNCTIONS_URL || '');

  // Choose a base: prefer Worker, then Functions, else same-origin
  const base = workerBase || functionsBase || '';
  if (!base) return '/api/chat';

  const preferPlainChat = Boolean(workerBase && workerBase !== functionsBase);

  // If absolute, preserve origin
  try {
    const url = new URL(base);
    const path = normalizePath(url.pathname);
    const root = path ? `${url.origin}${path}` : url.origin;
    return ensureChatUrl(root, { preferPlainChat });
  } catch {
    // relative
    return ensureChatUrl(base, { preferPlainChat });
  }
}

// ---------- PAYMENTS URL (prefers API/Functions; NEVER Worker) ----------

export function apiBaseUrl() {
  // Dedicated API base for non-chat calls.
  // Prefer VITE_API_URL, then VITE_FUNCTIONS_URL. Do NOT use Worker here.
  const api = trimTrailingSlashes(import.meta.env.VITE_API_URL || '');
  const funcs = trimTrailingSlashes(import.meta.env.VITE_FUNCTIONS_URL || '');
  return api || funcs || '';
}

function checkoutEndpoint() {
  const base = apiBaseUrl();
  if (!base) return '/api/pay/checkout'; // same-origin fallback
  if (base.endsWith('/api')) return `${base}/pay/checkout`;
  return `${base}/api/pay/checkout`;
}

function portalEndpoint() {
  // Keep existing server route shape if you're using /stripe/create-portal-session.
  // If you have /api/pay/portal in your router, point to that instead.
  const base = apiBaseUrl();
  if (!base) return '/stripe/create-portal-session';
  return `${base}/stripe/create-portal-session`;
}

// ---------- Stripe helpers ----------

export function stripePublishableKey() {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || LIVE_STRIPE_PUBLISHABLE_KEY).trim();
}

export function stripeEnabled() {
  return Boolean(stripePublishableKey());
}

export async function startCheckout(tier, { uid, email } = {}) {
  if (!tier) {
    throw new Error('tier is required');
  }
  const token = await getIdToken();
  const res = await fetch(checkoutEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tier, uid, email }),
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Checkout create failed (${res.status})`);
  }
  const { url } = await res.json();
  if (!url) {
    throw new Error('Checkout create failed: missing redirect URL');
  }
  window.location.href = url;
  return url;
}

export async function createPortalSession({ uid, email }) {
  const token = await getIdToken();
  const res = await fetch(portalEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ uid, email }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}
