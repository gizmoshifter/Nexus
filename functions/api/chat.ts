interface Env { OPENROUTER_API_KEY?: string }
interface ChatBody { model?: string; messages?: Array<{ role: "system" | "user" | "assistant"; content: string }> }
interface CatalogModel { id: string; pricing?: { prompt?: string; completion?: string } }
const FREE_SUFFIX = ":free";
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OPENROUTER_API_KEY) return Response.json({ error: "OpenRouter is not connected. Add OPENROUTER_API_KEY as a Cloudflare Pages secret." }, { status: 503 });
  let body: ChatBody;
  try { body = await request.json() as ChatBody; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const model = body.model ?? "";
  if (!model.endsWith(FREE_SUFFIX)) return Response.json({ error: "Blocked by NEXUS zero-cost policy: only explicitly free (:free) models are allowed." }, { status: 403 });
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12 ||
      body.messages.some((m) => !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000)) {
    return Response.json({ error: "Invalid messages." }, { status: 400 });
  }
  // Fail closed: verify current provider catalog pricing on every call, not just the model suffix.
  const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }
  });
  if (!catalogResponse.ok) return Response.json({ error: "Could not verify current model pricing. Request blocked to protect the zero-cost policy." }, { status: 503 });
  const catalog = await catalogResponse.json() as { data?: CatalogModel[] };
  const selected = (catalog.data ?? []).find((entry) => entry.id === model);
  if (!selected || Number(selected.pricing?.prompt ?? 1) !== 0 || Number(selected.pricing?.completion ?? 1) !== 0) {
    return Response.json({ error: "Blocked: OpenRouter does not currently report this model as zero-priced. No request was sent." }, { status: 403 });
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://nexus.pages.dev", "X-Title": "NEXUS" },
    body: JSON.stringify({ model, messages: body.messages, max_tokens: 900, temperature: 0.4 })
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) return Response.json({ error: payload.error?.message ?? "The free model is unavailable or its quota is exhausted. No paid fallback was attempted." }, { status: response.status });
  return Response.json({ content: payload.choices?.[0]?.message?.content ?? "", model });
};
