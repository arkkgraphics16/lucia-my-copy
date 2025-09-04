/**
 * Lucia AI Proxy (Cloudflare Worker)
 * - POST /chat  body: { prompt: string, history?: [{role, content}] }
 * Modes:
 *   DUMMY_MODE=true  -> echo
 *   DUMMY_MODE=false -> call DeepSeek (DEEPSEEK_API_URL or GATEWAY_URL)
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',            // for dev; restrict later
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/chat') {
      try {
        const { prompt, history } = await request.json()
        if (!prompt || typeof prompt !== 'string') {
          return json({ error: 'prompt required' }, 400)
        }

        // DUMMY mode
        if (env.DUMMY_MODE === 'true') {
          return json({ reply: `Echo: ${prompt}` })
        }

        // Real call — choose API base
        const apiBase = (env.GATEWAY_URL && env.GATEWAY_URL.trim().length)
          ? `${env.GATEWAY_URL}/chat/completions`
          : (env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions')

        const messages = Array.isArray(history) ? history.slice(-20) : []
        messages.push({ role: 'user', content: prompt })

        const res = await fetch(apiBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL || 'deepseek-chat',
            temperature: 0.7,
            messages
          })
        })

        if (!res.ok) {
          const text = await res.text()
          return json({ error: 'upstream_error', status: res.status, body: text }, 502)
        }

        const data = await res.json()
        // OpenAI-compatible shape:
        const reply = data?.choices?.[0]?.message?.content ?? ''
        return json({ reply })
      } catch (err) {
        return json({ error: String(err?.message || err) }, 500)
      }
    }

    return new Response('Not found', { status: 404, headers: CORS })
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}
