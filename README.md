# Lucia Secure MVP Skeleton
Scaffold for React (frontend), Node/Express (backend), Vault, S3, Firebase, Stripe, OpenAI.

Next:
1) cd backend && npm i
2) cd ../frontend && npm i
3) Fill env files (*.example → actual)
4) Start: backend `npm run dev`, frontend `npm run dev`

## Stripe configuration

- Provide `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as environment variables **or** expose them via AWS Secrets Manager using the ARN in `LUCIA_STRIPE_SECRET_ARN`.
- Optional overrides: `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL`, `STRIPE_ALLOWED_PRICE_IDS`.
- Frontend publishable key + price IDs go in `VITE_STRIPE_PUBLISHABLE_KEY` and `VITE_STRIPE_PRICE_*` env vars.

## OpenAI proxy

- Set `OPENAI_PROXY_URL` if you need to override the default Lambda URL.
- Optionally set `LUCIA_OPENAI_PROMPT_SECRET` (Secrets Manager) or `OPENAI_SYSTEM_PROMPT` to inject the private system prompt when calling the proxy.
