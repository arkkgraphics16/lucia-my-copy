// lucia-stripe-webhook/index.mjs
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { verifyWebhookSignature, handleWebhookEvent } from "../backend/src/lib/stripe.js";

const SECRET_ARN = process.env.LUCIA_STRIPE_SECRET_ARN;
const FALLBACK_ORIGIN = "https://www.luciadecode.com";

const sm = new SecretsManagerClient({});
let cachedSecret = null;

async function getSecret() {
  if (cachedSecret) return cachedSecret;
  const resp = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  const raw = resp.SecretString ?? Buffer.from(resp.SecretBinary || "", "base64").toString("utf8");
  const json = JSON.parse(raw);
  const norm = {};
  for (const [k, v] of Object.entries(json)) norm[k.toUpperCase()] = v;
  const secret = {
    ALLOW_ORIGIN: norm.ALLOW_ORIGIN || FALLBACK_ORIGIN
  };
  cachedSecret = secret;
  return secret;
}

function buildCors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || FALLBACK_ORIGIN,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,stripe-signature,x-app-secret",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": "application/json; charset=utf-8"
  };
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "POST";

  let secret;
  try {
    secret = await getSecret();
  } catch (err) {
    const cors = buildCors(FALLBACK_ORIGIN);
    if (method === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
    console.error("secrets_error", err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ ok: false, error: "secrets_error", detail: String(err.message || err) })
    };
  }

  const CORS = buildCors(secret.ALLOW_ORIGIN);

  // Preflight
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (method !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: "method_not_allowed" }) };
  }

  try {
    // ===== REPLACE THE PLACEHOLDER CODE WITH THIS =====
    
    // Get Stripe signature from headers
    const sig = event.headers['stripe-signature'] || 
                event.headers['Stripe-Signature'];
    
    if (!sig) {
      console.error("Missing Stripe signature header");
      return { 
        statusCode: 400, 
        headers: CORS, 
        body: JSON.stringify({ ok: false, error: "missing_signature" }) 
      };
    }

    // IMPORTANT: Use raw body, not parsed JSON
    const rawBody = event.body;
    
    // Verify webhook signature and construct event
    const stripeEvent = await verifyWebhookSignature(rawBody, sig);
    
    console.log("Stripe webhook verified", { 
      id: stripeEvent.id, 
      type: stripeEvent.type 
    });
    
    // Process the event (updates Firestore, grants access)
    await handleWebhookEvent(stripeEvent);
    
    return { 
      statusCode: 200, 
      headers: CORS, 
      body: JSON.stringify({ received: true }) 
    };
    
  } catch (err) {
    console.error("Webhook processing error:", err);
    return { 
      statusCode: 400, 
      headers: CORS, 
      body: JSON.stringify({ 
        ok: false, 
        error: err.message || String(err) 
      }) 
    };
  }
};