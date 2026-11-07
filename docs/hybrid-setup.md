# Hybrid cloud + local setup

NEXUS supports two inference paths:

1. **Cloud:** OpenRouter model IDs ending in `:free`. The Cloudflare Pages function checks the live model catalog and requires both prompt and completion prices to be exactly zero before sending a request.
2. **Local:** Ollama on the same computer as the browser. Requests go directly to `http://localhost:11434/v1/chat/completions`; the Cloudflare backend never proxies local prompts.

## Install a local model

Install Ollama from https://ollama.com/download, then in PowerShell run:

```powershell
ollama pull qwen2.5:7b
ollama list
```

A 7B quantized model is a reasonable starting point for many 24 GB GPUs, but performance depends on quantization, context length, RAM, and other running applications. Your model list in NEXUS refreshes from Ollama's local tags endpoint.

## Allow the browser origin

Ollama must allow requests from the origin hosting NEXUS. Configure `OLLAMA_ORIGINS` using the exact origin(s), not a wildcard:

- Wrangler Pages development (`npm run dev:pages`): `http://localhost:8788`
- Production: your exact deployed origin, for example `https://your-project.pages.dev`

Set the environment variable before launching Ollama, then restart Ollama. On Windows, use Windows Environment Variables or PowerShell to set it for the Ollama process. Exact service restart steps depend on how Ollama was installed. Keep the Ollama server bound to localhost; do not expose port 11434 to the public internet.

## Cloud model connection

Add `OPENROUTER_API_KEY` as an encrypted Cloudflare Pages secret. Create the key in an account with no purchased credits and auto-recharge disabled. NEXUS only requests models that the live OpenRouter catalog marks as zero-priced. If the provider changes pricing, the request is blocked.

## Routing modes

- **Hybrid:** uses cloud and local models together when available.
- **Cloud only:** uses only verified zero-priced OpenRouter models.
- **Local only:** uses only models returned by the local Ollama server.

If a chosen route has no available models or a request fails, the workflow stops and displays the error. It does not silently switch to paid services.

## Security and privacy

- Never commit API keys or paste them into chat.
- Local prompts are sent to the local Ollama service.
- Cloud prompts are sent to the selected cloud provider through OpenRouter.
- Treat model responses as untrusted content. Review output before using it for consequential decisions.
- Do not rotate personal accounts to bypass provider quotas or rate limits.
