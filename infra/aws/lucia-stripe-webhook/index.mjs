// lucia-stripe-webhook/index.mjs
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

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
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,stripe-signature,x-app-secret",
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
    // TEMP placeholder: just log and echo back to verify CORS + Stripe connectivity
    const body = event.body ? JSON.parse(event.body) : {};
    console.log("Stripe webhook payload:", body);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("Error in stripe webhook:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: String(err.message || err) }) };
  }
};
