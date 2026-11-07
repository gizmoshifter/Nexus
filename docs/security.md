# NEXUS Security Baseline

## Secrets
- Never commit API keys, OAuth tokens, passwords, or private credentials.
- Keep secrets in an appropriate server-side secret store or encrypted environment configuration.
- Never expose provider secrets to browser code.
- Redact authorization headers, tokens, and sensitive request fields from logs.
- Provide disconnect and credential-rotation paths.

## Authentication and permissions
- Use official provider APIs and supported authorization flows.
- Request the minimum scopes required.
- Separate read permissions from write permissions.
- Use project-scoped permissions and explicit user consent.
- Do not collect consumer passwords or automate account switching to evade quotas.

## Untrusted content
- Treat model responses, uploaded files, retrieved pages, and tool output as untrusted data.
- Do not allow model text to silently grant permissions or trigger privileged actions.
- Validate structured outputs against schemas.
- Escape untrusted content in the UI.
- Keep tool execution behind allowlists and approval gates.

## Spending and abuse controls
- Enforce configurable request, concurrency, token, and spend limits.
- Respect provider rate limits and terms.
- Bound retries and agent revision loops.
- Display estimated or known costs and quota uncertainty before execution.

## External actions
Require explicit user approval before sending messages, publishing content, deleting or modifying external data, writing to repositories, merging pull requests, or executing commands with external effects.

## Data handling
- Minimize collected data.
- Provide clear retention and deletion controls.
- Do not use project data for unrelated purposes.
- Avoid logging full prompts and outputs by default when they may contain secrets or personal data.
