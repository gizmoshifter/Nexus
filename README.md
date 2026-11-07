# NEXUS

**A collaborative AI command center.**

NEXUS turns one goal into a coordinated workflow: plan the work, route tasks to suitable AI providers, run independent tasks in parallel, review results, revise weak outputs, and assemble a traceable deliverable.

## Principles

- **Hard free-only routing:** only explicitly free OpenRouter model IDs ending in `:free` are accepted by the server. No paid fallback or automatic upgrade.
- **Provider-agnostic direction:** official APIs only. Consumer chat subscriptions are not assumed to include API access.
- **Human-controlled:** no purchases, auto-recharge, or external side effects.
- **Secure by default:** API credentials stay in server-side Cloudflare Pages secrets, never in browser code or Git.
- **Lightweight and polished:** responsive, mobile-friendly UI.
- **No ads or tracking.**

## Current implementation

- Responsive command-center interface.
- Cloudflare Pages Functions endpoints for discovering explicitly zero-priced OpenRouter free models and calling one selected free model.
- Server rejects model IDs that do not end in `:free`.
- If a free model is rate-limited or unavailable, the request fails; it does not fall back to a paid model.

## Deploy

See [the zero-cost policy and setup guide](docs/zero-cost-policy.md). The UI can be built with `npm run build`; live provider calls require deployment to Cloudflare Pages and an encrypted `OPENROUTER_API_KEY` secret.

## Important

Free access is quota-limited and can change. The app enforces free model selection, but account billing controls must also be configured at OpenRouter. Do not buy credits or enable auto-recharge. Do not reuse this key in other applications.

## Repository

https://github.com/gizmoshifter/Nexus
