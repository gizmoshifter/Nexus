# NEXUS

**A collaborative hybrid AI command center.**

NEXUS sends one goal to multiple independent models, runs their perspectives concurrently, challenges the outputs, and synthesizes one reviewed result.

## Current capabilities

- **Hybrid inference:** verified-free OpenRouter cloud models plus local Ollama models running on your computer.
- **Parallel collaboration:** research, solution design, and independent critique run as separate model calls.
- **Cross-model synthesis:** a final model combines the outputs and retains unresolved uncertainty.
- **Hard zero-cost cloud routing:** the server accepts only OpenRouter model IDs ending in `:free` and verifies prompt and completion prices are both zero before every request.
- **No paid fallback:** rate limits, provider failures, unknown pricing, and exhausted free quotas stop visibly. NEXUS never upgrades, buys credits, or rotates accounts to evade limits.
- **Local inference:** Ollama requests go directly from the browser to `http://localhost:11434`; no local model API key or cloud inference charge is required.
- **Privacy-first:** OpenRouter credentials remain in Cloudflare Pages encrypted secrets. Local inference stays on your machine.
- **No ads or tracking.**

## Quick start

1. Install Node.js 20+ and Ollama.
2. Pull a local model, e.g. `ollama pull qwen2.5:7b`.
3. Configure Ollama's `OLLAMA_ORIGINS` to allow the exact NEXUS origin (development: `http://localhost:5173`; production: your exact Pages origin). Do not use a wildcard or expose port 11434 publicly.
4. Run `npm install` then `npm run dev`.
5. For cloud models, add `OPENROUTER_API_KEY` as an encrypted Cloudflare Pages secret. Use an account with no purchased credits and auto-recharge disabled.

See [Hybrid cloud + local setup](docs/hybrid-setup.md) and [zero-cost policy](docs/zero-cost-policy.md).

## Deploy to Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Add `OPENROUTER_API_KEY` as an encrypted Pages secret.
- The local Ollama connection is optional; Cloud only mode works without it.

## Zero-cost limits

NEXUS enforces a $0.00 application-level cloud model selection policy for OpenRouter: it checks live catalog pricing on every request and fails closed if pricing is missing or nonzero. It cannot guarantee provider uptime or unlimited free quotas. Keep provider billing and auto-recharge disabled. Local inference may use electricity and hardware resources, but has no per-token API fee.

## Architecture

- `functions/api/models.ts`: live zero-priced OpenRouter model discovery.
- `functions/api/chat.ts`: server-side OpenRouter adapter with per-request live price verification.
- `src/engine.ts`: provider discovery, parallel agents, and cross-model synthesis.
- `src/App.tsx`: responsive command center, connection status, and routing modes.

Repository: https://github.com/gizmoshifter/Nexus
