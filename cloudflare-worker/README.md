Lucía Worker
============

Endpoints:
- GET / or /chat or /api/chat -> health JSON
- POST /chat or /api/chat     -> { prompt, history? } -> { reply }

Env (Dashboard -> Variables/Secrets):
- DUMMY_MODE: "true" (echo) or "false" (DeepSeek)
- DEEPSEEK_API_URL: https://api.deepseek.com/v1/chat/completions
- DEEPSEEK_MODEL: deepseek-chat
- DEEPSEEK_API_KEY: (Secret)
