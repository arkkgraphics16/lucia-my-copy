const router = require('express').Router();
const { callOpenAI } = require('../lib/openai');

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-20)
    .map((entry) => {
      const role = typeof entry?.role === 'string' ? entry.role : 'user';
      const content = typeof entry?.content === 'string' ? entry.content : '';
      return { role, content: content.trim() };
    })
    .filter((entry) => entry.content.length > 0);
}

router.post('/', async (req, res) => {
  const prompt = (req.body?.prompt ?? '').toString();
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'prompt_required' });
  }

  const history = sanitizeHistory(req.body?.history);
  const options = {};
  if (history.length > 0) {
    options.history = history;
    options.messages = [...history, { role: 'user', content: prompt }];
  }

  try {
    const reply = await callOpenAI(prompt, options);
    return res.json({ reply });
  } catch (err) {
    const message = err?.message || 'openai_request_failed';
    console.error('Chat proxy failed', message);
    return res.status(502).json({ error: 'openai_request_failed', message });
  }
});

module.exports = router;
