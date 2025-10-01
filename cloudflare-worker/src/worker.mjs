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

// FIXED: Real chat handler with OpenAI integration
async function handleChat(request, origin, env) {
  try {
    const body = await request.json();
    const prompt = (body?.prompt ?? "").toString();
    const history = Array.isArray(body?.history) ? body.history.slice(-20) : [];

    if (!prompt.trim()) return json({ error: "prompt required" }, origin, 400);

    // Dummy echo mode
    if (env.DUMMY_MODE === "true") {
      return json({ reply: `Echo: ${prompt}` }, origin, 200);
    }

    // OpenAI API call
    const apiBase = env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
    const res = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [...history, { role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: "upstream_error", status: res.status, body: text }, origin, 502);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return json({ reply }, origin, 200);
  } catch (e) {
    return json({ error: String(e?.message || e) }, origin, 500);
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

    // --- Client IP endpoint ---
    if (request.method === "GET" && url.pathname === "/ip") {
      return handleIp(request);
    }

    // Health check
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        {
          ok: true,
          service: "lucia-secure worker",
          mode: env.DUMMY_MODE === "true" ? "DUMMY" : "OPENAI",
          endpoints: ["GET /ip", "POST /chat", "GET /health"],
        },
        origin,
        200
      );
    }

    // Chat with OpenAI integration
    if (request.method === "POST" && url.pathname === "/chat") {
      return handleChat(request, origin, env);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};