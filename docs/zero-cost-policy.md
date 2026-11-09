# NEXUS default free-only policy

NEXUS defaults to a $0 cloud budget. Its server-side cloud endpoint rejects paid OpenRouter models at the server boundary.

- Only model IDs ending in `:free` are accepted by the chat endpoint.
- The model catalog is filtered to entries whose prompt and completion prices are both reported as zero.
- Requests specify one exact model; there is no paid fallback, automatic upgrade, credit purchase, or retry against a paid model.
- If a free model is unavailable or its free quota is exhausted, the request fails visibly. NEXUS does not switch to a paid model.
- The API key is stored as a Cloudflare Pages secret and never sent to the browser or committed to Git.
- Free models still have provider rate limits and availability constraints. A provider may change its free offerings; NEXUS fails closed if pricing is not explicitly zero.

## Optional BYOK paid mode

Users may explicitly connect their own OpenRouter key in the app, choose a paid model, and move the per-workflow budget slider above $0. This path sends key validation and paid chat requests directly from the browser to OpenRouter; the key remains in tab memory and is not sent to the NEXUS server or saved by the app. It is separate from the server-side free-only endpoint.

The app estimates the maximum workflow cost before making paid calls, checks reported usage between stages, and stops before further paid requests if the selected limit is reached. Tokenization and provider billing can differ from estimates. Set a spending limit on the OpenRouter key for the authoritative account-level ceiling. The slider starts at $0 and ranges to $5 per workflow.

## Important account-side safeguard

For your own default free-only setup, use a dedicated OpenRouter key/account with no purchased credits and no enabled auto-recharge. For BYOK, use a separate key with an OpenRouter spending limit. NEXUS cannot control billing settings or prevent unrelated use of a key outside the app.

## Connect

1. Deploy this repository to Cloudflare Pages with the project root set to the repository root and build command `npm run build`, output directory `dist`.
2. In Cloudflare Pages, add `OPENROUTER_API_KEY` as an encrypted environment secret for Production (and Preview only if desired).
3. For free-only cloud mode, add a dedicated OpenRouter key to the encrypted Pages secret. Keep that key out of the app, source files, GitHub, and chat.
4. For optional BYOK paid mode, enter a separate key only in the app's OpenRouter key field. It is held in tab memory and sent directly to OpenRouter. Set that key's spending limit in OpenRouter; the app's slider is an estimate, not a billing guarantee.
5. Redeploy after adding the server secret.

Local `npm run dev` serves the Vite UI only; the Pages Functions API is available when deployed to Cloudflare Pages or run locally with Wrangler Pages.


## Local inference

NEXUS can also send requests directly from the browser to Ollama at `http://localhost:11434`. Local inference does not incur a per-token API charge. Configure Ollama to allow only the exact NEXUS browser origin using `OLLAMA_ORIGINS`; keep the Ollama service bound to localhost and do not expose port 11434 publicly. See [the hybrid setup guide](hybrid-setup.md).

