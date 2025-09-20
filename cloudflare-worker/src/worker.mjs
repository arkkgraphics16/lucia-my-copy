// cloudflare-worker/src/worker.mjs

// Small helpers
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, origin = "*", status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

async function handleIp(request) {
  // Try Cloudflare + common proxy headers
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    "0.0.0.0";

  return json({ ip });
}

// OPTIONAL: a minimal /chat stub so the worker stays compatible
async function handleChat(request, origin) {
  try {
    const body = await request.json().catch(() => ({}));
    // Echo-style stub — replace with your real logic if you already have one
    return json(
      {
        ok: true,
        message:
          "Worker is alive. Replace handleChat() with your real /chat logic if needed.",
        received: body || null,
      },
      origin,
      200
    );
  } catch (err) {
    return json({ ok: false, error: String(err) }, origin, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ALLOW_ORIGIN || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // --- New: client IP endpoint ---
    if (request.method === "GET" && url.pathname === "/ip") {
      return handleIp(request);
    }

    // Health check
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        {
          ok: true,
          service: "lucia-secure worker",
          endpoints: ["GET /ip", "POST /chat", "GET /health"],
        },
        origin,
        200
      );
    }

    // Chat (optional stub)
    if (request.method === "POST" && url.pathname === "/chat") {
      return handleChat(request, origin);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};
