import { NEXUS_PERSONALITY } from "./personality";

export type Provider = "openrouter" | "ollama";
export type RoutingMode = "hybrid" | "cloud" | "local";
export type ProviderModel = { id: string; name: string; provider: Provider };
export type Agent = {
  id: string;
  name: string;
  role: string;
  model: string;
  accent: string;
  status: "idle" | "working" | "reviewing" | "complete";
  output: string;
};
export type RunResult = { plan: string[]; agents: Agent[]; synthesis: string };
type CloudModel = { id: string; name: string };
type OllamaTags = { models?: Array<{ name: string; model?: string }> };

const plan = [
  "Break the goal into clear workstreams",
  "Run independent models in parallel",
  "Compare outputs and challenge assumptions",
  "Synthesize and quality-check the result"
];

export const initialAgents: Agent[] = [
  { id: "planner", name: "Atlas", role: "Workflow planner", model: "NEXUS orchestration", accent: "violet", status: "idle", output: "" },
  { id: "research", name: "Scout", role: "Research analyst", model: "Waiting for model", accent: "blue", status: "idle", output: "" },
  { id: "builder", name: "Forge", role: "Solution designer", model: "Waiting for model", accent: "cyan", status: "idle", output: "" },
  { id: "reviewer", name: "Sage", role: "Independent critic", model: "Waiting for model", accent: "amber", status: "idle", output: "" }
];

const LOCAL_BASE = "http://localhost:11434";

export async function discoverModels(): Promise<{ models: ProviderModel[]; cloudError?: string; localError?: string }> {
  const [cloudResult, localResult] = await Promise.allSettled([
    fetch("/api/models").then(async response => {
      const payload = await response.json() as { models?: CloudModel[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Cloud catalog unavailable");
      return payload.models ?? [];
    }),
    fetch(`${LOCAL_BASE}/api/tags`).then(async response => {
      if (!response.ok) throw new Error("Ollama is not responding");
      const payload = await response.json() as OllamaTags;
      return (payload.models ?? []).map(model => ({
        id: model.name,
        name: model.name,
        provider: "ollama" as const
      }));
    })
  ]);

  const models: ProviderModel[] = [];
  let cloudError: string | undefined;
  let localError: string | undefined;
  if (cloudResult.status === "fulfilled") {
    models.push(...cloudResult.value.map(model => ({ ...model, provider: "openrouter" as const })));
  } else cloudError = cloudResult.reason instanceof Error ? cloudResult.reason.message : "Cloud models unavailable";
  if (localResult.status === "fulfilled") models.push(...localResult.value);
  else localError = "Local Ollama not detected. Start Ollama and allow this app's origin in OLLAMA_ORIGINS.";
  return { models, cloudError, localError };
}

async function callModel(model: ProviderModel, system: string, prompt: string): Promise<string> {
  const systemPrompt = `${NEXUS_PERSONALITY}\\n\\nROLE-SPECIFIC INSTRUCTIONS:\\n${system}`;
  if (model.provider === "openrouter") {
    if (!model.id.endsWith(":free")) throw new Error("Blocked by NEXUS: cloud model is not explicitly free.");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.id, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] })
    });
    const payload = await response.json() as { content?: string; error?: string };
    if (!response.ok) throw new Error(payload.error || "Free cloud model request failed. No paid fallback was attempted.");
    return payload.content || "The model returned an empty response.";
  }

  // Local Ollama runs on the user's machine. It receives no cloud API key and incurs no inference API charge.
  const response = await fetch(`${LOCAL_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.id,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      stream: false,
      max_tokens: 1200,
      temperature: 0.4
    })
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Local Ollama request failed. Check that Ollama is running and CORS is configured.");
  return payload.choices?.[0]?.message?.content || "The local model returned an empty response.";
}

export async function runLive(
  goal: string,
  mode: RoutingMode,
  update: (agents: Agent[], phase: string, plan: string[]) => void
): Promise<RunResult> {
  let agents = initialAgents.map(agent => ({ ...agent }));
  const set = (id: string, patch: Partial<Agent>, phase = "Models collaborating") => {
    agents = agents.map(agent => agent.id === id ? { ...agent, ...patch } : agent);
    update(agents, phase, plan);
  };

  set("planner", { status: "complete", output: "Created four stages and assigned independent perspectives." }, "Planning workflow");
  const discovered = await discoverModels();
  const cloud = discovered.models.filter(model => model.provider === "openrouter");
  const local = discovered.models.filter(model => model.provider === "ollama");
  const pool = mode === "cloud" ? cloud : mode === "local" ? local : [...cloud.slice(0, 2), ...local.slice(0, 2), ...cloud.slice(2)];
  if (!pool.length) {
    const detail = mode === "local" ? discovered.localError : mode === "cloud" ? discovered.cloudError : [discovered.cloudError, discovered.localError].filter(Boolean).join(" ");
    throw new Error(detail || "No eligible models found. Connect a free cloud provider or start local Ollama.");
  }

  const chosen = [pool[0], pool[1] ?? pool[0], pool[2] ?? pool[0]];
  agents = agents.map(agent => {
    if (agent.id === "research") return { ...agent, model: chosen[0].name };
    if (agent.id === "builder") return { ...agent, model: chosen[1].name };
    if (agent.id === "reviewer") return { ...agent, model: chosen[2].name };
    return agent;
  });
  update(agents, "Running independent models in parallel", plan);
  set("research", { status: "working", output: "Researching facts, options and constraints…" });
  set("builder", { status: "working", output: "Designing an actionable solution…" });
  set("reviewer", { status: "working", output: "Independently challenging assumptions…" });

  const [research, solution, critique] = await Promise.all([
    callModel(chosen[0], "You are Scout, an analytical research partner. Identify important facts, options, constraints and uncertainties. Distinguish verified facts from assumptions. Be direct and useful.", goal),
    callModel(chosen[1], "You are Forge, a practical solution designer. Produce a concrete, prioritized approach with implementation details, tradeoffs and next steps.", goal),
    callModel(chosen[2], "You are Sage, an independent critic. Evaluate the request and other likely approaches. Identify weak assumptions, risks, omissions and specific improvements. Do not agree just to be agreeable.", goal)
  ]);

  set("research", { status: "complete", output: research });
  set("builder", { status: "complete", output: solution });
  set("reviewer", { status: "reviewing", output: critique }, "Cross-model review and synthesis");

  const synthesizer = local[0] ?? cloud[0] ?? chosen[0];
  const synthesis = await callModel(
    synthesizer,
    "You are the NEXUS synthesis editor. Combine multiple independent model outputs into one accurate, useful answer. Resolve disagreements explicitly, retain uncertainty, remove repetition, and prioritize actionable recommendations. Do not invent citations or claim actions were performed.",
    `USER GOAL:\n${goal}\n\nRESEARCH:\n${research}\n\nSOLUTION PROPOSAL:\n${solution}\n\nINDEPENDENT CRITIQUE:\n${critique}\n\nProduce the best integrated result and mention unresolved uncertainties.`
  );
  set("reviewer", { status: "complete", output: critique }, "Synthesis complete");

  return {
    plan,
    agents,
    synthesis: `COLLABORATIVE MODEL RUN\nResearch · ${chosen[0].name} (${chosen[0].provider})\nSolution · ${chosen[1].name} (${chosen[1].provider})\nCritique · ${chosen[2].name} (${chosen[2].provider})\nSynthesizer · ${synthesizer.name} (${synthesizer.provider})\n\n${synthesis}\n\nZERO-COST POLICY: Cloud requests are restricted to OpenRouter models whose IDs end in :free and whose prompt and completion prices are verified as zero on the server for each request. Local requests go directly to Ollama on this computer. No paid fallback or account rotation is used. Provider quotas still apply.`
  };
}
