export async function getIdToken() {
  // Lazy import to avoid circulars
  const { auth } = await import("../firebase");
  const u = auth.currentUser;
  return u ? await u.getIdToken() : null;
}

// Fallback publishable key (can be overridden via VITE_STRIPE_PUBLISHABLE_KEY)
const LIVE_STRIPE_PUBLISHABLE_KEY =
  "pk_live_51S1C5h2NCNcgXLO1oeZdRA6lXH6NHLi5wBDVVSoGwPCLxweZ2Xp8dZTee2QgrzPwwXwhalZAcY1xUeKNmKUxb5gq00tf0go3ih";

// ---------- shared helpers ----------
function trimTrailingSlashes(v) {
  return (v || "").replace(/\/+$/, "");
}
function normalizePath(pathname) {
  if (!pathname) return "";
  return pathname.replace(/\/+$/, "");
}

// ---------- CHAT URL (prefers Worker) ----------
function ensureChatUrl(base, { preferPlainChat } = {}) {
  const normalized = trimTrailingSlashes(base);
  if (!normalized) return preferPlainChat ? "/chat" : "/api/chat";
  if (normalized.endsWith("/api/chat") || normalized.endsWith("/chat")) return normalized;
  if (normalized.endsWith("/api")) return `${normalized}/chat`;
  return `${normalized}${preferPlainChat ? "/chat" : "/api/chat"}`;
}

export function chatUrl() {
  // explicit override wins
  const override = trimTrailingSlashes(import.meta.env.VITE_CHAT_URL || "");
  if (override) return override;

  const workerBase = trimTrailingSlashes(import.meta.env.VITE_WORKER_API_URL || "");
  const functionsBase = trimTrailingSlashes(import.meta.env.VITE_FUNCTIONS_URL || "");

  // Choose a base: prefer Worker, then Functions, else same-origin
  const base = workerBase || functionsBase || "";
  if (!base) return "/api/chat";

  const preferPlainChat = Boolean(workerBase && workerBase !== functionsBase);

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

// ---------- PAYMENTS URL (HARD-PINNED to the working Lambda) ----------
const CHECKOUT_FUNCTION_URL = "https://lt2masjrrscsh556e35szjp4u40yaifr.lambda-url.eu-west-1.on.aws";

export function apiBaseUrl() {
  // TEMP: hard-pin to bypass any env bleed/caching that points to bokhpf...
  return CHECKOUT_FUNCTION_URL;
}

function checkoutEndpoint() {
  const base = trimTrailingSlashes(apiBaseUrl());
  return `${base}/api/pay/checkout`;
}

function portalEndpoint() {
  const base = trimTrailingSlashes(apiBaseUrl());
  return `${base}/api/pay/portal`;
}

// ---------- Stripe helpers ----------
export function stripePublishableKey() {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || LIVE_STRIPE_PUBLISHABLE_KEY).trim();
}
export function stripeEnabled() {
  return Boolean(stripePublishableKey());
}

/**
 * Create a Stripe Checkout session via Lambda.
 *
 * Usage (preferred):
 *   await startCheckout({ price: "price_XXXX", quantity: 1, metadata: { uid, email } })
 *
 * Legacy:
 *   await startCheckout("price_XXXX", { uid, email })
 */
export async function startCheckout(arg, info = {}) {
  let price, quantity = 1, metadata = {};
  if (typeof arg === "string") {
    price = arg;
    if (info?.uid) metadata.uid = info.uid;
    if (info?.email) metadata.email = info.email;
  } else if (arg && typeof arg === "object") {
    price = arg.price;
    quantity = arg.quantity ?? 1;
    metadata = arg.metadata ?? {};
  }

  if (!price || !/^price_/.test(price)) {
    throw new Error("startCheckout expects a Stripe price id (e.g. 'price_...').");
  }

  const endpoint = checkoutEndpoint();
  console.log("Calling Stripe checkout:", endpoint);

  // IMPORTANT: No Authorization header here → simpler CORS path
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price, quantity, metadata })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Checkout failed (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  if (!data?.url) throw new Error("Checkout failed: missing redirect URL");
  window.location.href = data.url;
  return data.url;
}

export async function createPortalSession({ uid, email }) {
  // Portal can stay authenticated if your Lambda expects it
  const token = await getIdToken();
  const res = await fetch(portalEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ uid, email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url }
}

export { fetchChatCompletion } from "./aiClient";