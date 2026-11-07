interface Env { OPENROUTER_API_KEY?: string }
interface Model { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }
const FREE_SUFFIX = ":free";
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.OPENROUTER_API_KEY) return Response.json({ error: "OpenRouter is not connected. Add OPENROUTER_API_KEY as a Cloudflare Pages secret." }, { status: 503 });
  const response = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } });
  if (!response.ok) return Response.json({ error: "Could not load the free-model catalog." }, { status: 502 });
  const payload = await response.json() as { data?: Model[] };
  const models = (payload.data ?? []).filter((m) =>
    m.id.endsWith(FREE_SUFFIX) &&
    Number(m.pricing?.prompt ?? 1) === 0 &&
    Number(m.pricing?.completion ?? 1) === 0
  ).map(({ id, name }) => ({ id, name: name ?? id }));
  return Response.json({ models, policy: "FREE_ONLY" }, { headers: { "Cache-Control": "no-store" } });
};
