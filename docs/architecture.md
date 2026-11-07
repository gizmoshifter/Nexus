# NEXUS Architecture

## Workflow

`Goal → Planner → Task graph → Router → Executors → Reviewers → Revision → Synthesizer → Deliverable`

### Core services

- **Workspace:** stores a user's task, success criteria, project context, and run history.
- **Planner:** converts the goal into a dependency-aware task graph with explicit completion criteria.
- **Router:** selects eligible provider adapters based on capability, availability, user configuration, quota, latency, and cost ceiling.
- **Executor:** runs ready tasks concurrently while respecting provider limits.
- **Reviewer:** independently checks outputs against the task's acceptance criteria and identifies unsupported claims, gaps, and test failures.
- **Revision loop:** sends actionable review feedback to the authoring agent, with a bounded number of iterations.
- **Synthesizer:** assembles accepted outputs and records provenance, decisions, and unresolved risks.

## Provider adapter contract

Each provider adapter should expose:
- supported capabilities and model identifiers;
- authentication status without exposing secrets;
- quota/rate-limit and error information when available;
- a normalized request/response interface;
- cancellation and timeout behavior.

Use official provider APIs and supported OAuth/device flows. Never collect consumer account passwords, scrape private chat interfaces, or rotate accounts to evade provider limits. A consumer subscription is not assumed to grant API access.

## Execution model

- Independent tasks may run in parallel.
- Dependent tasks wait for their prerequisites.
- Every run has configurable concurrency, time, and spend limits.
- Retries are bounded and only used for retryable failures.
- Reviewer feedback must be actionable and tied to acceptance criteria.
- Model output is untrusted input, never executable authority.

## Initial implementation direction

Build a responsive TypeScript web application with a provider-neutral orchestration core. Keep provider adapters isolated so the UI and workflow engine do not depend on a single vendor. Start with a deterministic mock adapter to validate the full workflow before enabling live API calls.

## Human approval boundaries

Require explicit approval before:
- spending money or exceeding a configured free-tier budget;
- publishing, sending, deleting, or modifying external resources;
- writing to a Git repository or opening/merging a pull request;
- executing code or commands outside a restricted test environment.
