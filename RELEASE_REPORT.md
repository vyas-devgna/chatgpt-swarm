# Release Quality Report

Version: **0.1.1 engineering preview**
Status: **source/package candidate; not a daily-use or browser-store release**
Repository: https://github.com/vyas-devgna/chatgpt-swarm
Report date: 2026-09-08

## Proven

### Architecture and features

- Chromium Manifest V3 extension built with WXT and strict TypeScript.
- Chat-only Captain planning with validated 0–4-worker delegation and one repair attempt.
- Real same-Project worker tabs, tab grouping, discard protection, structured reports, and Captain synthesis.
- Shadow DOM sidebar/composer controls, worker status cards, Open chat, Stop, Merge now, and failed-worker Retry.
- Stateless service worker with schema-validated local persistence, per-swarm Web Locks, 30-day pruning, and no backend/API-key flow.
- Work mode fails closed and removes all Swarm actions on initial load and live Chat→Work changes.

### Automated evidence

- 70 Vitest unit/fixture tests pass across 9 files.
- 7 packaged Playwright tests pass: MV3 service worker, Chat mount, initial/live-switch Work exclusion, Captain-worker-synthesis lifecycle, closed-worker Retry, and reopened-Captain synthesis recovery.
- The packaged suite also passed 35/35 cases under `--repeat-each=5`; this is deterministic stability evidence, not the required real-account soak.
- TypeScript, ESLint, Prettier, production build, archive integrity, and `npm audit` pass.
- Production unpacked size is approximately 53 kB; no runtime dependency or external network client is included.

### Recovery and security

- Worker identity is persisted before navigation, preventing missed assignments on fast tab loads.
- Closed workers become retryable; a missing Captain returns synthesis to recoverable `RUNNING` state.
- Runtime messages, sender IDs, tab IDs, exact Captain URLs, Project IDs, and persisted state are validated.
- Concurrent reports are serialized; worker text is XML-escaped and treated as untrusted evidence.
- No `cookies`, `webRequest`, `debugger`, broad-host, remote-code, telemetry, or credential permissions exist.
- An untracked generated Chromium profile discovered during review was moved to desktop trash and `scratch/` is ignored.

## Observed

- Authenticated ChatGPT Plus Project Chat URLs, semantic Chat selector, composer lifecycle, Send control, assistant turns, and sidebar anchors were inspected on 2026-09-08 without recording private content or authentication data.
- Work was not used for swarm execution or message testing; exclusion behavior is covered by sanitized packaged tests.
- The Codex in-app browser cannot load unpacked extensions because its extension-management page is blocked.

## Inferred

- Edge and other Chromium browsers should run the MV3 package, but only packaged Chromium is automated today.
- Capability confidence and centralized semantic selectors should make ordinary ChatGPT DOM changes fail closed, but future UI experiments can still require adapter updates.
- The small bundle and event-driven observers should be lightweight; production CPU/RAM measurements have not been collected.

## Not guaranteed / release blockers

- No authenticated unpacked-extension swarm has completed against the live account.
- The required 30+ real-swarm chaos/soak matrix, zoom/theme/screen-reader matrix, and normal-use beta period are incomplete.
- Manual model selection, persona editing, Add agent, Pause/Resume, explicit `REQUIRES_USER`, and embedded worker projections are not in 0.1.1; Auto model fallback and Open chat are the deliberate preview scope.
- OpenAI's current consumer Terms prohibit automatically/programmatically extracting Output. Because worker-report relay does that, unrestricted consumer deployment and browser-store publication require authorization or redesign. See [`POLICY.md`](POLICY.md).
- Chrome Web Store listing consent/onboarding, icons, screenshots, and developer-dashboard disclosures are not prepared.

## Privacy findings

Swarm state, tasks, concise report summaries, and recovery metadata stay in `chrome.storage.local`. Raw worker responses are cleared after synthesis. No data is sent to the developer or any non-ChatGPT service. Records older than 30 days are pruned on extension update or the next swarm start. See [`PRIVACY.md`](PRIVACY.md).

## Installation for authorized development

Do not download GitHub's automatically generated **Source code (zip)** archive. It has no generated extension manifest, and Chrome cannot load an extension directly from a ZIP file.

1. Download [`chatgpt-swarm-0.1.1-chrome.zip`](https://github.com/vyas-devgna/chatgpt-swarm/releases/download/v0.1.1/chatgpt-swarm-0.1.1-chrome.zip) and extract it.
2. Open `chrome://extensions` in a user-controlled Chromium profile.
3. Enable Developer mode, click **Load unpacked**, and select the extracted directory containing `manifest.json`.
4. Use only an authorized disposable ChatGPT Project **Chat** surface; never Work mode.

Source developers can instead run `npm ci && npm run verify && npm run zip`, then load `.output/chrome-mv3` unpacked.

## Release identity

- Release commit: resolved exactly by the immutable `v0.1.1` tag after publication
- Release tag: `v0.1.1` engineering prerelease
- Installable archive: `.output/chatgpt-swarm-0.1.1-chrome.zip`
- Archive SHA-256: `0c96d19755e6c7ea9a760a5cf08e36f375415f6081ae4b5207ff4cd450787694`
