// lucia-stripe-webhook/index.mjs
const ORIGIN = "https://www.luciadecode.com";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,stripe-signature,x-app-secret",
  "Access-Control-Max-Age": "86400",
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  // Preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    // TEMP placeholder: echo to verify deployment
    const body = event.body ? JSON.parse(event.body) : {};
    console.log("Stripe webhook payload:", body);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("Error in stripe webhook:", e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false }) };
  }
};
