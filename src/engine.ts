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
type FreeModel = { id: string; name: string };
const plan = [
  "Break the goal into clear workstreams",
  "Run independent free models in parallel",
  "Compare outputs and identify disagreements",
  "Synthesize a practical result"
];
export const initialAgents: Agent[] = [
  { id: "planner", name: "Atlas", role: "Planner", model: "NEXUS orchestration", accent: "violet", status: "idle", output: "" },
  { id: "research", name: "Scout", role: "Researcher", model: "OpenRouter free model", accent: "blue", status: "idle", output: "" },
  { id: "builder", name: "Forge", role: "Solution designer", model: "OpenRouter free model", accent: "cyan", status: "idle", output: "" },
  { id: "reviewer", name: "Sage", role: "Independent critic", model: "OpenRouter free model", accent: "amber", status: "idle", output: "" }
];
async function callFreeModel(model: string, system: string, goal: string): Promise<string> {
  if (!model.endsWith(":free")) throw new Error("Blocked: NEXUS only permits explicitly free model IDs.");
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: goal }] })
  });
  const payload = await response.json() as { content?: string; error?: string };
  if (!response.ok) throw new Error(payload.error || "Free model request failed. No paid fallback was attempted.");
  return payload.content || "The model returned an empty response.";
}
export async function runLive(goal: string, update: (agents: Agent[], phase: string, plan: string[]) => void): Promise<RunResult> {
  let agents = initialAgents.map(a => ({ ...a }));
  const set = (id: string, patch: Partial<Agent>, phase = "Free models collaborating") => {
    agents = agents.map(a => a.id === id ? { ...a, ...patch } : a);
    update(agents, phase, plan);
  };
  set("planner", { status: "complete", output: "Created four stages. Independent perspectives will run concurrently." }, "Planning workflow");
  set("research", { status: "working", output: "Researching options and constraints…" });
  set("builder", { status: "working", output: "Designing a practical solution…" });
  set("reviewer", { status: "working", output: "Independently challenging assumptions…" });
  const catalogResponse = await fetch("/api/models");
  const catalog = await catalogResponse.json() as { models?: FreeModel[]; error?: string };
  if (!catalogResponse.ok || !catalog.models?.length) throw new Error(catalog.error || "No explicitly free OpenRouter models are currently available.");
  const models = catalog.models;
  const chosen = [models[0], models[1] ?? models[0], models[2] ?? models[0]];
  agents = agents.map((a, i) => i > 0 ? { ...a, model: chosen[i - 1].name } : a);
  update(agents, "Running free models in parallel", plan);
  const tasks = [
    callFreeModel(chosen[0].id, "You are Scout, a careful research analyst. Identify key facts to verify, options, constraints, and uncertainties. Do not invent sources.", goal),
    callFreeModel(chosen[1].id, "You are Forge, a practical solution designer. Propose a concrete, prioritized solution with implementation details.", goal),
    callFreeModel(chosen[2].id, "You are Sage, an independent critic. Find risks, missing assumptions, failure modes, and improvements.", goal)
  ];
  const [research, solution, critique] = await Promise.all(tasks);
  set("research", { status: "complete", output: research });
  set("builder", { status: "complete", output: solution });
  set("reviewer", { status: "complete", output: critique }, "Synthesis complete");
  return {
    plan, agents,
    synthesis: `FREE-ONLY MODEL COLLABORATION\n\nResearch ( ${chosen[0].name} )\n${research}\n\nProposed solution ( ${chosen[1].name} )\n${solution}\n\nIndependent critique ( ${chosen[2].name} )\n${critique}\n\nCost protection: each request used a model ID ending in :free. No paid fallback was attempted. Free quotas and availability are controlled by the provider; if a free model fails, NEXUS stops rather than paying.`
  };
}
