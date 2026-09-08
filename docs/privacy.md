# Privacy Architecture

ChatGPT Swarm has no backend, telemetry, analytics, account system, or API-key flow. It requests only `storage`, `tabs`, `tabGroups`, and `https://chatgpt.com/*` host access.

Local storage contains swarm state, agent identities, task assignments, concise report summaries, and recovery metadata. Raw worker responses are cleared after synthesis; no full conversation transcript is copied. Records older than 30 days are pruned on extension update or the next swarm start. Logs redact conversation IDs and authentication-looking values.

See [`PRIVACY.md`](../PRIVACY.md) for the user-facing policy.
