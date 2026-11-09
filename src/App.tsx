import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, Check, ChevronDown, CircleHelp, Command, Cpu, GitBranch, Layers3, LockKeyhole, Play, Radio, ShieldCheck, Sparkles, Workflow, Zap, RefreshCw, Laptop, Cloud } from "lucide-react";
import { discoverModels, initialAgents, runLive } from "./engine";
import type { Agent, PaidRunSettings, ProviderModel, RoutingMode } from "./engine";
import { connectOpenRouterKey } from "./openrouter";
import type { PaidModel } from "./openrouter";

const statusLabel = (status: Agent["status"]) => ({
  idle: "Standby", working: "Working", reviewing: "Reviewing", complete: "Complete"
}[status]);

export default function App() {
  const [goal, setGoal] = useState("");
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [phase, setPhase] = useState("Ready · free-only by default");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<string[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>(["NEXUS workspace initialized"]);
  const [mode, setMode] = useState<RoutingMode>("hybrid");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [cloudError, setCloudError] = useState("");
  const [localError, setLocalError] = useState("");
  const [checking, setChecking] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [paidModels, setPaidModels] = useState<PaidModel[]>([]);
  const [paidModelId, setPaidModelId] = useState("");
  const [paidModelSearch, setPaidModelSearch] = useState("");
  const [paidBudget, setPaidBudget] = useState(0);
  const [keyStatus, setKeyStatus] = useState("");
  const [keyError, setKeyError] = useState("");
  const [connectingKey, setConnectingKey] = useState(false);
  const [keyLimitRemaining, setKeyLimitRemaining] = useState<number | null>(null);
  const [paidSpend, setPaidSpend] = useState(0);
  const runController = useRef<AbortController | null>(null);

  async function refreshModels() {
    setChecking(true);
    const result = await discoverModels();
    setModels(result.models);
    setCloudError(result.cloudError || "");
    setLocalError(result.localError || "");
    setChecking(false);
  }

  async function connectKey() {
    const candidate = keyInput.trim();
    if (!candidate) return;
    setConnectingKey(true);
    setKeyError("");
    setKeyStatus("");
    try {
      const info = await connectOpenRouterKey(candidate);
      setOpenRouterKey(candidate);
      setPaidModels(info.paidModels);
      setPaidModelId(info.paidModels[0]?.id || "");
      setKeyLimitRemaining(info.limitRemaining ?? null);
      setKeyInput("");
      setKeyStatus(info.limitRemaining == null
        ? `Key verified · ${info.paidModels.length} paid models available`
        : `Key verified · OpenRouter key limit remaining: $${info.limitRemaining.toFixed(2)}`);
    } catch (reason) {
      setKeyError(reason instanceof Error ? reason.message : "Could not verify that OpenRouter key.");
    } finally {
      setConnectingKey(false);
    }
  }

  function disconnectKey() {
    setOpenRouterKey("");
    setPaidModels([]);
    setPaidModelId("");
    setPaidModelSearch("");
    setPaidBudget(0);
    setPaidSpend(0);
    setKeyLimitRemaining(null);
    setKeyStatus("OpenRouter key disconnected.");
    setKeyError("");
  }

  function stopRun() {
    runController.current?.abort();
    setPhase("Stopping model requests…");
  }

  useEffect(() => { void refreshModels(); }, []);

  async function startRun() {
    if (!goal.trim() || running) return;
    const controller = new AbortController();
    runController.current = controller;
    setRunning(true);
    setAgents(initialAgents.map(agent => ({ ...agent })));
    setPlan([]);
    setSynthesis("");
    setError("");
    setPaidSpend(0);
    setHistory(items => [`Run started · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
    try {
      const selectedPaidModel = paidModels.find(model => model.id === paidModelId);
      const paidSettings: PaidRunSettings | undefined = openRouterKey && selectedPaidModel && paidBudget > 0
        ? { apiKey: openRouterKey, model: selectedPaidModel, budgetUsd: paidBudget, onSpend: setPaidSpend }
        : undefined;
      const result = await runLive(goal.trim(), mode, (nextAgents, nextPhase, nextPlan) => {
        setAgents(nextAgents);
        setPhase(nextPhase);
        setPlan(nextPlan);
      }, { signal: controller.signal, paid: paidSettings });
      setSynthesis(result.synthesis);
      setHistory(items => [`Run completed · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
      await refreshModels();
    } catch (reason) {
      const cancelled = controller.signal.aborted || (reason instanceof Error && reason.name === "AbortError");
      setError(cancelled ? "Run cancelled. A request already accepted by a provider may still appear in its usage." : reason instanceof Error ? reason.message : "Workflow failed.");
      setPhase(cancelled ? "Stopped · requests cancelled" : "Stopped · no automatic fallback");
      setAgents(current => current.map(agent => agent.status === "working" || agent.status === "reviewing"
        ? { ...agent, status: "idle", output: "Stopped before completion." }
        : agent));
      setHistory(items => [`Run stopped · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
    } finally {
      runController.current = null;
      setRunning(false);
    }
  }

  const completed = agents.filter(agent => agent.status === "complete").length;
  const cloudCount = models.filter(model => model.provider === "openrouter").length;
  const localCount = models.filter(model => model.provider === "ollama").length;
  const selectedPaidModel = paidModels.find(model => model.id === paidModelId);
  const filteredPaidModels = paidModels.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(paidModelSearch.toLowerCase())).slice(0, 80);
  if (selectedPaidModel && !filteredPaidModels.some(model => model.id === selectedPaidModel.id)) filteredPaidModels.unshift(selectedPaidModel);
  const paidBudgetMax = Math.min(5, keyLimitRemaining ?? 5);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Command size={19} /></div><span>NEXUS</span><span className="brand-beta">BETA</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><Workflow size={17} /> Command center</button>
        <button className="nav-item"><Layers3 size={17} /> Model network</button>
        <button className="nav-item"><Cpu size={17} /> Local inference</button>
        <div className="side-divider" />
        <div className="workspace-label">YOUR SPACE</div>
        <div className="project-row"><span className="project-dot" /> General workspace</div>
        <div className="sidebar-bottom">
          <div className="secure-note"><ShieldCheck size={15} /><span>{paidBudget > 0 && openRouterKey ? `Paid cap · $${paidBudget.toFixed(2)}/run` : "Free-only · $0 default"}</span></div>
          <div className="profile"><div className="avatar">N</div><div><strong>Hybrid workspace</strong><small>Cloud + local models</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>Command center</strong></div><div className="top-actions"><span className="connection"><i /> {paidBudget > 0 && openRouterKey ? `Paid budget set · $${paidBudget.toFixed(2)}/run` : "Free-only routing"}</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button></div></header>
        <div className="content">
          <section className="hero">
            <div className="eyebrow"><span className="eyebrow-line" /> MULTI-MODEL INTELLIGENCE</div>
            <h1>One goal.<br /><em>Many minds. One result.</em></h1>
            <p>Independent cloud and local models work in parallel, challenge each other, and produce one reviewed answer.</p>
          </section>

          <section className="panel provider-panel">
            <div className="panel-title"><div><span className="section-kicker">MODEL NETWORK</span><h2>Connected inference</h2></div><button className="refresh-button" onClick={refreshModels} disabled={checking}><RefreshCw size={13} className={checking ? "spin-icon" : ""} /> Refresh</button></div>
            <div className="provider-stats">
              <div className="provider-stat"><Cloud size={17} /><strong>{cloudCount}</strong><span>Free cloud models</span></div>
              <div className="provider-stat"><Laptop size={17} /><strong>{localCount}</strong><span>Local Ollama models</span></div>
              <div className="provider-stat"><ShieldCheck size={17} /><strong>${openRouterKey ? paidBudget.toFixed(2) : "0.00"}</strong><span>Per-workflow spend limit</span></div>
            </div>
            <div className="provider-details">
              <div><span className={cloudCount ? "connection-dot on" : "connection-dot"} /> <strong>OpenRouter free catalog</strong><small>{cloudCount ? `${cloudCount} verified zero-priced models` : cloudError || "Not connected"}</small></div>
              <div><span className={localCount ? "connection-dot on" : "connection-dot"} /> <strong>Ollama on this PC</strong><small>{localCount ? `${localCount} local models detected` : localError || "Not detected"}</small></div>
            </div>
            <div className="byok-panel">
              <div className="byok-heading"><strong>Optional · use your OpenRouter key</strong><span>{openRouterKey ? "CONNECTED" : "DISCONNECTED"}</span></div>
              <p>Your key stays in this tab's memory. Key checks and paid requests go directly to OpenRouter; NEXUS does not send it to its server.</p>
              {!openRouterKey ? <div className="key-row">
                <input type="password" value={keyInput} onChange={event => setKeyInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void connectKey(); }} placeholder="OpenRouter API key" autoComplete="off" aria-label="OpenRouter API key" />
                <button className="key-button" onClick={() => void connectKey()} disabled={!keyInput.trim() || connectingKey}>{connectingKey ? "Checking…" : "Connect key"}</button>
              </div> : <div className="key-row"><span className="key-status">{keyStatus}</span><button className="key-button secondary" onClick={disconnectKey} disabled={running}>Disconnect</button></div>}
              {keyError && <div className="key-error" role="status">{keyError}</div>}
              {openRouterKey && <div className="paid-controls">
                <input type="search" value={paidModelSearch} onChange={event => setPaidModelSearch(event.target.value)} placeholder="Find a paid model" aria-label="Find a paid OpenRouter model" />
                <select value={paidModelId} onChange={event => setPaidModelId(event.target.value)} aria-label="Paid OpenRouter model" disabled={!filteredPaidModels.length || running}>
                  {filteredPaidModels.map(model => <option key={model.id} value={model.id}>{model.name} · in ${((model.pricing.prompt) * 1_000_000).toFixed(2)} / out ${((model.pricing.completion) * 1_000_000).toFixed(2)} per 1M</option>)}
                </select>
                <label className="budget-label" htmlFor="paid-budget"><span>Paid budget per workflow</span><strong>${paidBudget.toFixed(2)}</strong></label>
                <input id="paid-budget" type="range" min="0" max={paidBudgetMax} step="0.25" value={Math.min(paidBudget, paidBudgetMax)} onChange={event => setPaidBudget(Number(event.target.value))} disabled={!paidModelId || paidBudgetMax === 0 || running} aria-label="Paid budget per workflow" />
                <div className="budget-caption"><span>$0 · free only</span><span>${paidBudgetMax.toFixed(2)} max / workflow</span></div>
                <small className="usage-note">$0 is the default. The workflow checks a conservative estimate and stops before further paid calls if reported usage reaches the selected limit. OpenRouter's own key limit remains the account-level control. Last run: ${paidSpend.toFixed(4)}.</small>
              </div>}
            </div>
            <div className="routing-row"><label htmlFor="routing-mode">Routing strategy</label><select id="routing-mode" value={mode} onChange={event => setMode(event.target.value as RoutingMode)}><option value="hybrid">Hybrid · cloud + local</option><option value="cloud">Cloud only · free, or paid if enabled</option><option value="local">Local only · Ollama</option></select></div>
            <p className="provider-note">At $0, cloud models are accepted only when the server verifies both token prices are zero. Paid models require your OpenRouter key and a nonzero workflow budget. Local inference uses your own hardware; failed requests never switch to a paid model automatically.</p>
          </section>

          <section className="composer panel">
            <div className="panel-head"><div><span className="section-kicker">NEW WORKFLOW</span><h2>What are we working on?</h2></div><span className="shortcut"><Command size={12} /> ENTER</span></div>
            <textarea value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe your goal. NEXUS will delegate to independent free cloud and local models…" rows={3} />
            <div className="composer-foot"><span><LockKeyhole size={13} /> {paidBudget > 0 && openRouterKey ? `Up to $${paidBudget.toFixed(2)} per workflow` : "$0 · free-only"} · no automatic fallback</span><div className="composer-actions">{running && <button className="stop-button" onClick={stopRun}>Stop run</button>}<button className="run-button" onClick={startRun} disabled={!goal.trim() || running}>{running ? <><span className="spinner" /> Orchestrating</> : <><Play size={14} fill="currentColor" /> Run workflow</>}</button></div></div>
          </section>

          <div className="section-heading"><div><span className="section-kicker">LIVE ORCHESTRATION</span><h2>Agent team</h2></div><div className="run-progress"><span>{completed}/{agents.length} complete</span><div className="progress-track"><i style={{ width: `${completed / agents.length * 100}%` }} /></div></div></div>

          <section className="agent-grid">
            {agents.map((agent, index) => <article className={`agent-card ${agent.accent}`} key={agent.id}>
              <div className="agent-top"><div className="agent-icon">{index === 0 ? <Workflow size={18} /> : index === 1 ? <Radio size={18} /> : index === 2 ? <Zap size={18} /> : <ShieldCheck size={18} />}</div><span className={`status ${agent.status}`}><i />{statusLabel(agent.status)}</span></div>
              <h3>{agent.name}</h3><div className="agent-role">{agent.role}</div><div className="agent-model">{agent.model}</div>
              <div className="agent-output">{agent.output || "Waiting for a task…"}</div>
            </article>)}
          </section>

          <div className="lower-grid">
            <section className="panel workflow-panel"><div className="panel-title"><div><span className="section-kicker">EXECUTION MAP</span><h2>Workflow</h2></div><span className="live-tag"><Activity size={13} /> {phase}</span></div>
              <div className="steps">{(plan.length ? plan : ["Define the goal", "Plan and delegate", "Run in parallel", "Review and refine", "Deliver the result"]).map((item, index) => <div className="step" key={item}><div className={`step-number ${index < completed ? "done" : ""}`}>{index < completed ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</div><span>{item}</span>{index === 1 && <span className="parallel-tag">PARALLEL</span>}</div>)}</div>
            </section>
            <section className="panel activity-panel"><div className="panel-title"><div><span className="section-kicker">RUN HISTORY</span><h2>Activity</h2></div><GitBranch size={17} className="muted-icon" /></div>
              <div className="activity-list">{history.map((item, index) => <div className="activity-item" key={item}><span className={index === 0 ? "activity-dot bright" : "activity-dot"} /><span>{item}</span></div>)}</div>
              <div className="activity-foot"><Sparkles size={14} /> Runs are traceable by design</div>
            </section>
          </div>

          {error && <section className="panel synthesis"><div className="synthesis-heading"><div className="synthesis-icon"><ShieldCheck size={17} /></div><div><span className="section-kicker">WORKFLOW GUARDRAIL</span><h2>Run stopped safely</h2></div></div><p>{error}</p></section>}
          {synthesis && <section className="panel synthesis"><div className="synthesis-heading"><div className="synthesis-icon"><Sparkles size={17} /></div><div><span className="section-kicker">COLLECTIVE OUTPUT</span><h2>Final synthesis</h2></div><span className="complete-tag"><Check size={12} /> Run complete</span></div><p className="synthesis-output">{synthesis}</p></section>}

          <footer><span>NEXUS <i>·</i> Built for better thinking, together.</span><span><LockKeyhole size={12} /> Free-only by default · no automatic paid fallbacks <ArrowUpRight size={12} /></span></footer>
        </div>
      </main>
    </div>
  );
}

