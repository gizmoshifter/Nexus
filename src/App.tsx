import { useState } from "react";
import { Activity, ArrowUpRight, Check, ChevronDown, CircleHelp, Command, Cpu, GitBranch, Layers3, LockKeyhole, Play, Plus, Radio, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";
import { Agent, initialAgents, runLive } from "./engine";

const statusLabel = (status: Agent["status"]) => ({
  idle: "Standby", working: "Working", reviewing: "Reviewing", complete: "Complete"
}[status]);

export default function App() {
  const [goal, setGoal] = useState("");
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [phase, setPhase] = useState("Ready · zero-cost mode");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<string[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>(["NEXUS workspace initialized"]);

  async function startRun() {
    if (!goal.trim() || running) return;
    setRunning(true);
    setSynthesis("");
    setError("");
    setHistory((items) => [`Run started · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
    try {
      const result = await runLive(goal.trim(), (nextAgents, nextPhase, nextPlan) => {
        setAgents(nextAgents);
        setPhase(nextPhase);
        setPlan(nextPlan);
      });
      setSynthesis(result.synthesis);
      setHistory((items) => [`Run completed · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Workflow failed.");
      setPhase("Stopped · no paid fallback");
      setHistory((items) => [`Run stopped · ${new Date().toLocaleTimeString()}`, ...items].slice(0, 5));
    } finally {
      setRunning(false);
    }
  }

  const completed = agents.filter((agent) => agent.status === "complete").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Command size={19} /></div><span>NEXUS</span><span className="brand-beta">BETA</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><Workflow size={17} /> Command center</button>
        <button className="nav-item"><Layers3 size={17} /> Projects <span className="soon">SOON</span></button>
        <button className="nav-item"><Cpu size={17} /> Models <span className="soon">SOON</span></button>
        <div className="side-divider" />
        <div className="workspace-label">YOUR SPACE</div>
        <div className="project-row"><span className="project-dot" /> General workspace</div>
        <div className="sidebar-bottom">
          <div className="secure-note"><ShieldCheck size={15} /><span>Privacy-first by design</span></div>
          <div className="profile"><div className="avatar">N</div><div><strong>Local workspace</strong><small>Demo environment</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <strong>Command center</strong></div><div className="top-actions"><span className="connection"><i /> Free-only routing</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button></div></header>
        <div className="content">
          <section className="hero">
            <div className="eyebrow"><span className="eyebrow-line" /> MULTI-AGENT INTELLIGENCE</div>
            <h1>One goal.<br /><em>Collective intelligence.</em></h1>
            <p>Bring specialized AI agents together to plan, build, challenge, and deliver better work.</p>
          </section>

          <section className="composer panel">
            <div className="panel-head"><div><span className="section-kicker">NEW WORKFLOW</span><h2>What are we working on?</h2></div><span className="shortcut"><Command size={12} /> ENTER</span></div>
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Describe your goal. NEXUS will run available free models in parallel…" rows={3} />
            <div className="composer-foot"><span><LockKeyhole size={13} /> Only explicitly free models · no paid fallback</span><button className="run-button" onClick={startRun} disabled={!goal.trim() || running}>{running ? <><span className="spinner" /> Orchestrating</> : <><Play size={14} fill="currentColor" /> Run workflow</>}</button></div>
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

          {error && <section className="panel synthesis"><div className="synthesis-heading"><div className="synthesis-icon"><ShieldCheck size={17} /></div><div><span className="section-kicker">ZERO-COST PROTECTION</span><h2>Run stopped safely</h2></div></div><p>{error}</p></section>}
          {synthesis && <section className="panel synthesis"><div className="synthesis-heading"><div className="synthesis-icon"><Sparkles size={17} /></div><div><span className="section-kicker">COLLECTIVE OUTPUT</span><h2>Final synthesis</h2></div><span className="complete-tag"><Check size={12} /> Run complete</span></div><p>{synthesis}</p></section>}

          <footer><span>NEXUS <i>·</i> Built for better thinking, together.</span><span><LockKeyhole size={12} /> Free-only routing · paid models blocked <ArrowUpRight size={12} /></span></footer>
        </div>
      </main>
    </div>
  );
}