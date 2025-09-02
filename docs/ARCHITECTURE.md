# High-level
User → React (Vercel) → Node API (Render/Fly) → Vault (HCP) → OpenAI
                                  ↘ S3 (encrypted) / Firebase / Stripe

No prompts/files in DB or logs. Secrets only in Vault. Backend reads at runtime.
