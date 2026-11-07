export type Agent = {
  id: string;
  name: string;
  role: string;
  model: string;
  accent: string;
  status: "idle" | "working" | "reviewing" | "complete";
  output: string;
};

export type RunResult = {
  plan: string[];
  agents: Agent[];
  synthesis: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const initialAgents: Agent[] = [
  { id: "planner", name: "Atlas", role: "Planner", model: "NEXUS orchestration", accent: "violet", status: "idle", output: "" },
  { id: "research", name: "Scout", role: "Researcher", model: "Demo provider", accent: "blue", status: "idle", output: "" },
  { id: "builder", name: "Forge", role: "Builder", model: "Demo provider", accent: "cyan", status: "idle", output: "" },
  { id: "reviewer", name: "Sage", role: "Reviewer", model: "Independent review", accent: "amber", status: "idle", output: "" }
];

export async function runDemo(
  goal: string,
  update: (agents: Agent[], phase: string, plan: string[]) => void
): Promise<RunResult> {
  const plan = [
    "Clarify the goal and define a measurable outcome",
    "Explore approaches and identify constraints",
    "Develop a proposed solution",
    "Review the solution against the goal",
    "Synthesize the strongest result"
  ];
  let agents = initialAgents.map((agent) => ({ ...agent }));
  const set = (id: string, patch: Partial<Agent>) => {
    agents = agents.map((agent) => agent.id === id ? { ...agent, ...patch } : agent);
    update(agents, "Agents collaborating", plan);
  };

  set("planner", { status: "working", output: "Breaking the goal into a sequence of verifiable tasks." });
  update(agents, "Planning workflow", plan);
  await wait(850);
  set("planner", { status: "complete", output: "Five-step plan created. Research and solution design can proceed in parallel." });

  set("research", { status: "working", output: "Mapping the problem, constraints, and useful approaches." });
  set("builder", { status: "working", output: "Developing a first-pass solution from the goal and plan." });
  await wait(1500);
  set("research", { status: "complete", output: `Research pass complete for: “${goal}”. Key considerations and viable approaches have been identified.` });
  set("builder", { status: "complete", output: "A first-pass solution is ready for independent review. Assumptions are called out for verification." });

  set("reviewer", { status: "reviewing", output: "Checking completeness, clarity, feasibility, and unsupported assumptions." });
  update(agents, "Independent review", plan);
  await wait(1200);
  set("reviewer", { status: "complete", output: "Review complete: strengthen measurable success criteria, make assumptions explicit, and keep the next action testable." });

  return {
    plan,
    agents,
    synthesis: `A coordinated first pass for “${goal}” is complete. The planner decomposed the request, research and solution design ran in parallel, and an independent reviewer checked the result. This is a demonstration run: no external AI provider was called and no claims have been independently verified. Connect supported provider APIs to enable live model execution.`
  };
}