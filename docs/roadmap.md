# NEXUS Roadmap

## Milestone 0 — Foundation
- [x] Establish repository and product principles.
- [x] Document architecture, security, and milestones.
- [x] Application scaffold and continuous integration.

## Milestone 1 — Hybrid multi-model prototype
- [x] Responsive dashboard and task composer.
- [x] Live discovery of explicitly zero-priced OpenRouter models.
- [x] Direct local Ollama model discovery.
- [x] Hybrid, cloud-only, and local-only routing modes.
- [x] Parallel research, solution, and independent critique agents.
- [x] Cross-model synthesis.

## Milestone 2 — Provider and workflow reliability
- [ ] Provider-neutral adapter contract and provider health telemetry.
- [ ] Bounded retries for transient failures without changing cost class.
- [ ] Cancellation and per-agent timeout controls.
- [ ] Run persistence and exportable audit records.
- [ ] Settings page for local endpoint and provider diagnostics.

## Milestone 3 — More free cloud providers
- [ ] Add official provider APIs only when a free-only account boundary can be verified or user-configured without a billing path.
- [ ] Add per-provider model allowlists and explicit cost ceilings.
- [ ] Add model capability metadata and user-selectable agent assignments.
- [ ] Never use consumer subscription credentials, scraping, account rotation, or quota evasion.

## Milestone 4 — Polish and portability
- [ ] Streaming output and responsive agent details.
- [ ] Accessible workflow templates.
- [ ] Automated unit, integration, and end-to-end tests.
- [ ] Keep deployments optional and preserve local-only mode.

## Release principles
- No ads, sponsored placements, or tracking.
- Hard $0.00 application spending ceiling.
- Never promise unlimited free inference.
- Never bypass provider rate limits or account restrictions.
- Fail closed whenever cloud pricing cannot be verified as zero.
