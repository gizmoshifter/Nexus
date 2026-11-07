# NEXUS zero-cost policy

NEXUS is configured to reject paid OpenRouter models at the server boundary.

- Only model IDs ending in `:free` are accepted by the chat endpoint.
- The model catalog is filtered to entries whose prompt and completion prices are both reported as zero.
- Requests specify one exact model; there is no paid fallback, automatic upgrade, credit purchase, or retry against a paid model.
- If a free model is unavailable or its free quota is exhausted, the request fails visibly. NEXUS does not switch to a paid model.
- The API key is stored as a Cloudflare Pages secret and never sent to the browser or committed to Git.
- Free models still have provider rate limits and availability constraints. A provider may change its free offerings; NEXUS fails closed if pricing is not explicitly zero.

## Important account-side safeguard

Use a dedicated OpenRouter key/account with no purchased credits and no enabled auto-recharge. Keep provider-side spending limits at zero if the account exposes that control. The application enforces free model IDs, but cannot control account billing settings or prevent unrelated use of the same key outside NEXUS.

## Connect

1. Deploy this repository to Cloudflare Pages with the project root set to the repository root and build command `npm run build`, output directory `dist`.
2. In Cloudflare Pages, add `OPENROUTER_API_KEY` as an encrypted environment secret for Production (and Preview only if desired).
3. Create a key at https://openrouter.ai/keys. Do not paste it into the app, source files, GitHub, or chat.
4. In the OpenRouter account, do not buy credits or enable auto-recharge. Use account/key spending controls to block paid usage where available.
5. Redeploy after adding the secret.

Local `npm run dev` serves the Vite UI only; the Pages Functions API is available when deployed to Cloudflare Pages or run locally with Wrangler Pages.
