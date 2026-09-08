# ChatGPT Swarm

> Turn ChatGPT Project conversations into lightweight multi-agent swarm workflows — no API key required.

> **Engineering preview:** Source is published for review and development. OpenAI's current consumer Terms prohibit automatically/programmatically extracting Output, which this extension does to relay worker reports. Do not deploy it against ChatGPT consumer services unless your use is authorized and compliant. See [POLICY.md](POLICY.md).

[![CI](https://github.com/vyas-devgna/chatgpt-swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/vyas-devgna/chatgpt-swarm/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What Swarm Does

ChatGPT Swarm is a Chromium browser extension that adds multi-agent orchestration to ChatGPT Project **Chat** conversations. It treats real Project conversations as agent processes without using an API key. Work mode is intentionally unsupported.

1. **You write a task** in a ChatGPT Project conversation
2. **You press "Swarm"** — the current conversation becomes Captain
3. **Captain analyzes your task** and determines useful worker roles
4. **Extension creates real ChatGPT conversations** inside the same Project
5. **Workers run in parallel** with distinct personas and objectives
6. **Results flow back to Captain** for synthesis
7. **You can inspect, intervene, or redirect** any worker at any time

### Key Features

- 🐝 **Multi-agent orchestration** — 1–4 concurrent workers with distinct roles
- 🎭 **Agent personas** — Specialized reasoning styles (Architect, Security Reviewer, Critic, etc.)
- 🔄 **Recovery** — Rehydrates persisted swarms and lets you retry closed worker tabs
- 🔒 **Privacy-first** — No backend, no telemetry, no API key, all state local
- 🎨 **Native feel** — Integrates into ChatGPT's existing UI
- ♿ **Accessible** — Keyboard navigable, screen reader compatible

## What Swarm Does NOT Do

- ❌ Does NOT call the OpenAI API — uses your existing ChatGPT subscription
- ❌ Does NOT replace ChatGPT's UI — adds orchestration around it
- ❌ Does NOT store credentials — never reads cookies, tokens, or auth headers
- ❌ Does NOT phone home — zero network calls to non-ChatGPT origins
- ❌ Does NOT spawn unlimited agents — capped at 4 workers per swarm

## Installation

### Engineering Preview Release

Download [`chatgpt-swarm-0.1.3-chrome.zip`](https://github.com/vyas-devgna/chatgpt-swarm/releases/download/v0.1.3/chatgpt-swarm-0.1.3-chrome.zip), extract it, then choose the extracted directory in Chrome's **Load unpacked** dialog. That directory must contain `manifest.json` at its root.

> Do not use GitHub's automatically generated **Source code (zip)** archive: it contains the project source, not the built extension. Chrome also cannot load the extension directly from a ZIP file.

### From Source (Developer)

```bash
git clone https://github.com/vyas-devgna/chatgpt-swarm.git
cd chatgpt-swarm
npm install
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

### Requirements

- Chromium-based browser (Chrome, Edge, Brave, Arc)
- A ChatGPT account with Projects enabled
- At least one ChatGPT Project

## Permissions

| Permission           | Why                                                         |
| -------------------- | ----------------------------------------------------------- |
| `storage`            | Persist swarm state, preferences, and recovery data locally |
| `tabs`               | Create and manage worker conversation tabs                  |
| `tabGroups`          | Group worker tabs together for organization                 |
| `chatgpt.com` (host) | Inject the Swarm UI and adapter into ChatGPT pages          |

The extension does NOT request: `cookies`, `history`, `downloads`, `webRequest`, `debugger`, or `<all_urls>`.

## Architecture

```
ChatGPT page (chatgpt.com)
    ├── Your conversation (Captain)
    ├── Integrated Swarm controls (Shadow DOM)
    └── Content script (adapter + UI)
         │
         ▼
Extension Service Worker (stateless)
    ├── Orchestrator (scheduler, lifecycle, delegation)
    ├── Tab manager (create, group, protect, recover)
    └── Persistence (chrome.storage.local)
         │
         ▼
Worker tabs (background ChatGPT conversations)
    ├── Content script (adapter)
    └── Real ChatGPT conversations in your Project
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Agent Workflow

```
User task → Captain analyzes → Delegates to workers
                                    │
                    ┌───────┬───────┼───────┐
                    ▼       ▼       ▼       ▼
                Worker 1  Worker 2  Worker 3  Worker 4
                    │       │       │       │
                    └───────┴───────┼───────┘
                                    ▼
                        Captain synthesizes result
```

Workers produce structured reports (Result, Evidence, Risks, Recommendation) that flow back to Captain for synthesis. Open chat links keep every worker inspectable and available for manual intervention.

## Privacy

- **All state is local** — stored in Chrome extension storage only
- **No backend** — zero external network calls
- **No telemetry** — no analytics or tracking
- **No credentials** — never accesses cookies, tokens, or auth headers
- **Redacted logs** — conversation IDs and sensitive data stripped from all logging

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Development

```bash
# Development with hot reload
npm run dev

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Full check (typecheck + lint + test)
npm run check

# Production build
npm run build

# Packaged extension smoke tests
npm run test:e2e

# Complete local release gate
npm run verify
```

## Testing

The project uses four testing levels:

| Level             | Tool               | What                                               | CI     |
| ----------------- | ------------------ | -------------------------------------------------- | ------ |
| Unit              | Vitest             | Pure logic, schemas, state machine                 | ✅     |
| Fixture           | Vitest + happy-dom | Adapter against sanitized DOM fixtures             | ✅     |
| Packaged E2E      | Playwright         | MV3 load, Chat/Work isolation, lifecycle, recovery | ✅     |
| Authenticated E2E | Unpacked Chromium  | Real ChatGPT Project Chat                          | Manual |
| Chaos             | Manual             | Recovery, soak, reliability                        | Manual |

See [docs/testing.md](docs/testing.md) for the complete testing strategy.

## Known Limitations

- ChatGPT's DOM structure changes frequently — the adapter may need updates after major ChatGPT UI changes
- Swarms run only on the Chat surface; Work mode fails closed
- ChatGPT controls model availability. V1 uses Auto and records requested capability fallbacks
- Maximum 4 concurrent workers (by design, not a bug)
- Worker conversations consume your ChatGPT message quota
- Extension detects incompatibility and disables itself safely rather than guessing
- Authenticated unpacked-extension and 30-run soak gates are not yet complete
- Chrome Web Store submission is blocked pending OpenAI authorization and store disclosure/onboarding work

## Browser Compatibility

| Browser     | Status                                     |
| ----------- | ------------------------------------------ |
| Chrome 120+ | ✅ Supported                               |
| Edge 120+   | ✅ Expected to work                        |
| Brave       | ⚠️ Untested                                |
| Arc         | ⚠️ Untested                                |
| Firefox     | ❌ Not supported (Manifest V3 differences) |
| Safari      | ❌ Not supported                           |

## Security Reporting

If you discover a security vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md) for instructions.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Disclaimer

> **ChatGPT is a trademark/product of OpenAI. This project is independent and is not affiliated with, endorsed by, or sponsored by OpenAI.**
>
> This extension automates standard user interactions within ChatGPT's web interface for personal productivity purposes. It does not call undocumented APIs, extract authentication credentials, circumvent rate limits, or bypass protective systems.
>
> Users are responsible for ensuring their use complies with OpenAI's Terms of Service.

## License

[Apache License 2.0](LICENSE)
