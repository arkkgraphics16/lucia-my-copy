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

export function chatUrl() {
  const override = (import.meta.env.VITE_CHAT_URL || '').trim();
  if (override) return override;

  const base = baseUrl();
  if (!base) return '/api/chat';

  const normalizedBase = base.replace(/\/+$/, '');
  if (!normalizedBase) return '/api/chat';

  const tryParseAbsolute = () => {
    try {
      const url = new URL(normalizedBase);
      const path = normalizePath(url.pathname);

      if (!path) return `${url.origin}/api/chat`;
      if (path.endsWith('/api/chat') || path.endsWith('/chat')) {
        return `${url.origin}${path}`;
      }
      if (path.endsWith('/api')) {
        return `${url.origin}${path}/chat`;
      }
      return `${url.origin}${path}/api/chat`;
    } catch (_err) {
      return null;
    }
  };

  const absolute = tryParseAbsolute();
  if (absolute) return absolute;

  if (normalizedBase.endsWith('/api/chat') || normalizedBase.endsWith('/chat')) {
    return normalizedBase;
  }
  if (normalizedBase.endsWith('/api')) {
    return `${normalizedBase}/chat`;
  }
  return `${normalizedBase}/api/chat`;
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
