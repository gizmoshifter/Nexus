import { NEXUS_PERSONALITY } from "./personality";
import type { PaidModel } from "./openrouter";

export type Provider = "openrouter" | "ollama" | "openrouter-byok";
export type RoutingMode = "hybrid" | "cloud" | "local";
export type ProviderModel = { id: string; name: string; provider: Provider; pricing?: { prompt: number; completion: number } };
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
const DISCOVERY_TIMEOUT_MS = 12_000;
const MODEL_TIMEOUT_MS = 90_000;
const MAX_COMPLETION_TOKENS = 900;

export type PaidRunSettings = {
  apiKey: string;
  model: PaidModel;
  budgetUsd: number;
  onSpend?: (spentUsd: number) => void;
};

function abortError() {
  const error = new Error("The workflow was cancelled.");
  error.name = "AbortError";
  return error;
}

async function withRequestTimeout<T>(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await request(controller.signal);
  } catch (error) {
    if (parentSignal?.aborted) throw abortError();
    if (timedOut) throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    throw error;
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function discoverModels(signal?: AbortSignal): Promise<{ models: ProviderModel[]; cloudError?: string; localError?: string }> {
  const [cloudResult, localResult] = await Promise.allSettled([
    withRequestTimeout(signal, DISCOVERY_TIMEOUT_MS, async requestSignal => {
      const response = await fetch("/api/models", { signal: requestSignal });
      const payload = await response.json() as { models?: CloudModel[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Cloud catalog unavailable");
      return payload.models ?? [];
    }),
    withRequestTimeout(signal, DISCOVERY_TIMEOUT_MS, async requestSignal => {
      const response = await fetch(`${LOCAL_BASE}/api/tags`, { signal: requestSignal });
      if (!response.ok) throw new Error("Ollama is not responding");
      const payload = await response.json() as OllamaTags;
      return (payload.models ?? []).map(model => ({
        id: model.name,
        name: model.name,
        provider: "ollama" as const
      }));
    })
  ]);
  if (signal?.aborted) throw abortError();

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

async function callModel(
  model: ProviderModel,
  system: string,
  prompt: string,
  signal?: AbortSignal,
  apiKey?: string
): Promise<{ content: string; costUsd: number }> {
  const systemPrompt = `${NEXUS_PERSONALITY}\n\nROLE-SPECIFIC INSTRUCTIONS:\n${system}`;
  if (model.provider === "openrouter") {
    if (!model.id.endsWith(":free")) throw new Error("Blocked by NEXUS: cloud model is not explicitly free.");
    return withRequestTimeout(signal, MODEL_TIMEOUT_MS, async requestSignal => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestSignal,
        body: JSON.stringify({ model: model.id, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] })
      });
      const payload = await response.json() as { content?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Free cloud model request failed. No paid fallback was attempted.");
      return { content: payload.content || "The model returned an empty response.", costUsd: 0 };
    });
  }

  if (model.provider === "openrouter-byok") {
    if (!apiKey || !model.pricing) throw new Error("Connect an OpenRouter key and choose a paid model before enabling paid use.");
    return withRequestTimeout(signal, MODEL_TIMEOUT_MS, async requestSignal => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: requestSignal,
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          temperature: 0.4,
          stream: false
        })
      });
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { cost?: string | number };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || `OpenRouter returned HTTP ${response.status}.`);
      const costUsd = Number(payload.usage?.cost);
      if (!Number.isFinite(costUsd) || costUsd < 0) throw new Error("OpenRouter did not return request cost, so NEXUS stopped paid use before the next request.");
      return { content: payload.choices?.[0]?.message?.content || "The model returned an empty response.", costUsd };
    });
  }

  // Local Ollama runs on the user's machine. It receives no cloud API key and incurs no inference API charge.
  return withRequestTimeout(signal, MODEL_TIMEOUT_MS, async requestSignal => {
    const response = await fetch(`${LOCAL_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: requestSignal,
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
    return { content: payload.choices?.[0]?.message?.content || "The local model returned an empty response.", costUsd: 0 };
  });
}

export type RunOptions = { signal?: AbortSignal; paid?: PaidRunSettings };

function estimatePaidCost(model: ProviderModel, system: string, prompt: string, maxOutputTokens = MAX_COMPLETION_TOKENS): number {
  if (model.provider !== "openrouter-byok" || !model.pricing) return 0;
  // UTF-8 bytes are intentionally used as a conservative prompt-token estimate.
  const inputUnits = new TextEncoder().encode(`${NEXUS_PERSONALITY}\n\nROLE-SPECIFIC INSTRUCTIONS:\n${system}\n${prompt}`).length;
  return inputUnits * model.pricing.prompt + maxOutputTokens * model.pricing.completion;
}

export async function runLive(
  goal: string,
  mode: RoutingMode,
  update: (agents: Agent[], phase: string, plan: string[]) => void,
  options: RunOptions = {}
): Promise<RunResult> {
  const { signal, paid } = options;
  const paidEnabled = Boolean(paid?.apiKey && paid.model && paid.budgetUsd > 0);
  if (signal?.aborted) throw abortError();
  let agents = initialAgents.map(agent => ({ ...agent }));
  const set = (id: string, patch: Partial<Agent>, phase = "Models collaborating") => {
    agents = agents.map(agent => agent.id === id ? { ...agent, ...patch } : agent);
    update(agents, phase, plan);
  };

  set("planner", { status: "complete", output: "Created four stages and assigned independent perspectives." }, "Planning workflow");
  const discovered = await discoverModels(signal);
  const cloud = [
    ...(paidEnabled && paid ? [{ ...paid.model } as ProviderModel] : []),
    ...discovered.models.filter(model => model.provider === "openrouter")
  ];
  const local = discovered.models.filter(model => model.provider === "ollama");
  // Hybrid mode deliberately samples both providers when both are available.
  // Keep cloud-only and local-only strict: the synthesizer must use the same route.
  const pool = mode === "cloud"
    ? cloud
    : mode === "local"
      ? local
      : [
          ...cloud.slice(0, 1),
          ...local.slice(0, 1),
          ...cloud.slice(1, 2),
          ...local.slice(1, 2),
          ...cloud.slice(2),
          ...local.slice(2)
        ];
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

  const rolePrompts = [
    "You are Scout, an analytical research partner. Identify important facts, options, constraints and uncertainties. Distinguish verified facts from assumptions. Be direct and useful.",
    "You are Forge, a practical solution designer. Produce a concrete, prioritized approach with implementation details, tradeoffs and next steps.",
    "You are Sage, an independent critic. Evaluate the request and other likely approaches. Identify weak assumptions, risks, omissions and specific improvements. Do not agree just to be agreeable."
  ];
  const synthesisSystem = "You are the NEXUS synthesis editor. Combine multiple independent model outputs into one accurate, useful answer. Resolve disagreements explicitly, retain uncertainty, remove repetition, and prioritize actionable recommendations. Do not invent citations or claim actions were performed.";
  const maximumOutput = "x".repeat(MAX_COMPLETION_TOKENS * 8);
  const maximumSynthesisPrompt = `USER GOAL:\n${goal}\n\nRESEARCH:\n${maximumOutput}\n\nSOLUTION PROPOSAL:\n${maximumOutput}\n\nINDEPENDENT CRITIQUE:\n${maximumOutput}\n\nProduce the best integrated result and mention unresolved uncertainties.`;
  const projectedPaidCost = [
    ...chosen.map((model, index) => estimatePaidCost(model, rolePrompts[index], goal)),
    estimatePaidCost(mode === "local" ? local[0] ?? chosen[0] : mode === "cloud" ? cloud[0] ?? chosen[0] : local[0] ?? cloud[0] ?? chosen[0], synthesisSystem, maximumSynthesisPrompt)
  ].reduce((sum, cost) => sum + cost, 0);
  if (paidEnabled && paid && projectedPaidCost > paid.budgetUsd) {
    throw new Error(`Estimated paid use is $${projectedPaidCost.toFixed(4)}, above this workflow's $${paid.budgetUsd.toFixed(2)} limit. Raise the limit or choose a less expensive model.`);
  }

  let paidSpendUsd = 0;
  paid?.onSpend?.(paidSpendUsd);
  const trackedCall = async (model: ProviderModel, system: string, prompt: string, requestSignal?: AbortSignal) => {
    const result = await callModel(model, system, prompt, requestSignal, paidEnabled ? paid?.apiKey : undefined);
    if (model.provider === "openrouter-byok") {
      paidSpendUsd += result.costUsd;
      paid?.onSpend?.(paidSpendUsd);
      if (paid && paidSpendUsd > paid.budgetUsd) throw new Error(`OpenRouter reported $${paidSpendUsd.toFixed(4)} for this workflow, above the selected $${paid.budgetUsd.toFixed(2)} limit. Further paid requests were stopped.`);
    }
    return result.content;
  };
  update(agents, "Running independent models in parallel", plan);
  set("research", { status: "working", output: "Researching facts, options and constraints…" });
  set("builder", { status: "working", output: "Designing an actionable solution…" });
  set("reviewer", { status: "working", output: "Independently challenging assumptions…" });

  const agentController = new AbortController();
  const stopAgentGroup = () => agentController.abort();
  if (signal?.aborted) stopAgentGroup();
  else signal?.addEventListener("abort", stopAgentGroup, { once: true });
  const agentOutputs: string[] = [];
  try {
    const paidIndexes = chosen.flatMap((model, index) => model.provider === "openrouter-byok" ? [index] : []);
    const nonPaidTasks = chosen.flatMap((model, index) => model.provider === "openrouter-byok" ? [] : [
      trackedCall(model, rolePrompts[index], goal, agentController.signal).then(output => { agentOutputs[index] = output; })
    ]);
    const nonPaidResults = Promise.all(nonPaidTasks);
    void nonPaidResults.catch(() => agentController.abort());
    // Keep paid stages sequential so each reported charge is known before another paid request starts.
    for (const index of paidIndexes) {
      agentOutputs[index] = await trackedCall(chosen[index], rolePrompts[index], goal, agentController.signal);
    }
    await nonPaidResults;
  } catch (error) {
    agentController.abort();
    throw error;
  } finally {
    signal?.removeEventListener("abort", stopAgentGroup);
  }

  const [research, solution, critique] = agentOutputs as [string, string, string];

  set("research", { status: "complete", output: research });
  set("builder", { status: "complete", output: solution });
  set("reviewer", { status: "reviewing", output: critique }, "Cross-model review and synthesis");

  const synthesizer = mode === "local"
    ? local[0] ?? chosen[0]
    : mode === "cloud"
      ? cloud[0] ?? chosen[0]
      : local[0] ?? cloud[0] ?? chosen[0];
  const synthesisPrompt =
    `USER GOAL:\n${goal}\n\nRESEARCH:\n${research}\n\nSOLUTION PROPOSAL:\n${solution}\n\nINDEPENDENT CRITIQUE:\n${critique}\n\nProduce the best integrated result and mention unresolved uncertainties.`;
  const synthesisEstimate = estimatePaidCost(synthesizer, synthesisSystem, synthesisPrompt);
  if (paid && paidSpendUsd + synthesisEstimate > paid.budgetUsd) {
    throw new Error(`The remaining $${Math.max(0, paid.budgetUsd - paidSpendUsd).toFixed(4)} is below the synthesis estimate of $${synthesisEstimate.toFixed(4)}. Increase the workflow limit to finish this paid run.`);
  }
  const synthesis = await trackedCall(
    synthesizer,
    synthesisSystem,
    synthesisPrompt,
    signal
  );
  set("reviewer", { status: "complete", output: critique }, "Synthesis complete");

  const spendNote = paidSpendUsd > 0
    ? `BYOK SPEND: OpenRouter reported $${paidSpendUsd.toFixed(4)} for this workflow. The selected per-workflow limit was $${paid?.budgetUsd.toFixed(2)}. The budget check is an estimate; the OpenRouter key's own spending limit remains the account-level control.`
    : "FREE-ONLY POLICY: Cloud requests used only server-verified zero-priced OpenRouter models. Local requests went directly to Ollama. No paid model or fallback was used.";

  return {
    plan,
    agents,
    synthesis: `COLLABORATIVE MODEL RUN\nResearch · ${chosen[0].name} (${chosen[0].provider})\nSolution · ${chosen[1].name} (${chosen[1].provider})\nCritique · ${chosen[2].name} (${chosen[2].provider})\nSynthesizer · ${synthesizer.name} (${synthesizer.provider})\n\n${synthesis}\n\n${spendNote}`
  };
}

