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
  return w || f || ''; // same-origin if both blank
}

export function stripeEnabled() {
  // We only enable buttons when owner provided at least a publishable key AND an API base
  return Boolean((import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim() && baseUrl());
}

export async function createCheckoutSession(priceId, uid) {
  const url = baseUrl() + '/stripe/create-checkout-session';
  const token = await getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ priceId, uid })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}

export async function createPortalSession(uid) {
  const url = baseUrl() + '/stripe/create-portal-session';
  const token = await getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ uid })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}
