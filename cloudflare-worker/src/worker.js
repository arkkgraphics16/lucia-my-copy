const CORS = {
  "Access-Control-Allow-Origin": "*",            // tighten later for prod
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

export default {
  async fetch(request, env) {
    const { method } = request;
    const url = new URL(request.url);

    if (method === "OPTIONS") return new Response(null, { headers: CORS });

    // Health/help
    if (method === "GET" && (url.pathname === "/" || url.pathname === "/chat")) {
      const info = {
        ok: true,
        service: "lucia-secure worker",
        mode: env.DUMMY_MODE === "true" ? "DUMMY" : "DEEPSEEK",
        endpoint: "POST /chat { prompt, history? }"
      };
      return json(info, 200);
    }

    if (method === "POST" && url.pathname === "/chat") {
      try {
        const body = await request.json();
        const prompt = (body?.prompt ?? "").toString();
        const history = Array.isArray(body?.history) ? body.history.slice(-20) : [];

        if (!prompt.trim()) return json({ error: "prompt required" }, 400);

        // Dummy echo mode
        if (env.DUMMY_MODE === "true") {
          return json({ reply: `Echo: ${prompt}` }, 200);
        }

        // DeepSeek
        const apiBase = env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions";
        const res = await fetch(apiBase, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL || "deepseek-chat",
            messages: [...history, { role: "user", content: prompt }],
            temperature: 0.7
          })
        });

        if (!res.ok) {
          const text = await res.text();
          return json({ error: "upstream_error", status: res.status, body: text }, 502);
        }

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content ?? "";
        return json({ reply }, 200);
      } catch (e) {
        return json({ error: String(e?.message || e) }, 500);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
