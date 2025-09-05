/**
 * Lucia Secure - Cloudflare Worker (DeepSeek Reasoner)
 * Endpoints:
 *   GET  /          -> {ok:true} (health)
 *   GET  /healthz   -> {ok:true} (health)
 *   POST /chat      -> {reply, raw} (non-streaming)
 *
 * Required env on Cloudflare:
 *   DEEPSEEK_API_KEY  (your DeepSeek key)
 * Optional:
 *   DEEPSEEK_MODEL    (default: "deepseek-reasoner")
 *   ALLOW_ORIGIN      (default: "*")
 */

const DS_URL = "https://api.deepseek.com/v1/chat/completions";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ALLOW_ORIGIN || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Health
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return json({ ok: true, service: "lucia-secure-worker" }, origin);
    }

    // Chat
    if (request.method === "POST" && url.pathname === "/chat") {
      try {
        if (!env.DEEPSEEK_API_KEY) {
          return json({ ok: false, error: "Missing DEEPSEEK_API_KEY" }, origin, 500);
        }

        const body = await safeJson(request);
        // Expect: { messages: [{role, content}, ...], system?: string }
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const system = body?.system;

        if (!messages.length) {
          return json({ ok: false, error: "messages[] required" }, origin, 400);
        }

        const dsMessages = [];
        if (system) dsMessages.push({ role: "system", content: system });
        for (const m of messages) {
          if (m && m.role && m.content !== undefined) {
            dsMessages.push({ role: m.role, content: String(m.content) });
          }
        }

        const payload = {
          model: env.DEEPSEEK_MODEL || "deepseek-reasoner",
          messages: dsMessages,
          temperature: typeof body?.temperature === "number" ? body.temperature : 0.2,
          top_p: typeof body?.top_p === "number" ? body.top_p : 0.95,
          stream: false
        };

        const r = await fetch(DS_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          const txt = await r.text();
          return json({ ok: false, error: "DeepSeek error", status: r.status, details: txt }, origin, 502);
        }

        const data = await r.json();
        const reply = data?.choices?.[0]?.message?.content ?? "";

        return json({ ok: true, reply, raw: data }, origin);
      } catch (err) {
        return json({ ok: false, error: String(err?.message || err) }, origin, 500);
      }
    }

    return json({ ok: false, error: "Not Found" }, env.ALLOW_ORIGIN || "*", 404);
  }
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}
function json(obj, origin = "*", status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    }
  });
}
async function safeJson(request) {
  try { return await request.json(); }
  catch { return {}; }
}
