# ChatGPT Swarm — Agent Operating Manual

> This file governs ALL agent behavior on this project.
> Every agent (human or AI) working in this repo MUST read and follow this file.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | ChatGPT Swarm |
| **Type** | Chromium browser extension (Manifest V3) |
| **Language** | TypeScript (strict mode) |
| **Build** | WXT framework (Vite-based) |
| **Test** | Vitest (unit/fixture) + Playwright (E2E) |
| **Schema** | Valibot (tree-shakeable, <2kB) |
| **UI** | Vanilla DOM + Shadow DOM isolation (NO React/Vue) |
| **License** | Apache-2.0 |
| **Repo** | github.com/vyas-devgna/chatgpt-swarm |

## 2. What This Project IS

A local orchestration layer that treats real ChatGPT Project conversations as agent processes.

ChatGPT provides: auth, subscription, models, reasoning, tools, web search, files, project context, project memory, individual conversations.

The extension adds ONLY: orchestration, delegation, concurrency, worker lifecycle, task state, agent identity/persona, per-agent model selection, small local swarm working memory, inter-chat handoff, recovery, multi-chat layout, observability, synthesis workflow.

## 3. What This Project Is NOT

- NOT a general multi-agent framework
- NOT a ChatGPT API client
- NOT a replacement for ChatGPT's UI
- NOT a cloud service
- NOT a user-account system
- NOT an AI platform
- NOT a vector database / RAG system
- NOT an authentication bypass tool

## 4. Engineering Priority Order

When making ANY design decision, rank priorities:

1. **Correctness** — no message to wrong chat
2. **No wrong-chat actions** — verified tab/conversation targeting
3. **Recovery** — survive service worker death, tab close, reload, restart
4. **Safety/Privacy** — no credential leakage, no telemetry, local-only
5. **DOM resilience** — multi-strategy selectors, confidence scoring
6. **Usability** — native ChatGPT feel, minimal friction
7. **Maintainability** — clear boundaries, typed interfaces, tests
8. **Performance** — batch mutations, debounce, budget ≤5 tabs
9. **Visual polish** — inherit ChatGPT styles, dark/light
10. **Feature count** — smaller stable > larger fragile

## 5. Architecture Boundaries

```
chatgpt.com page
    │
    ├── native Captain conversation (real ChatGPT)
    ├── injected Swarm workspace (Shadow DOM mount)
    └── content script (adapter + UI mount)
    │
    ▼
Extension service worker (STATELESS — rehydrates from storage)
    │
    ├── deterministic orchestrator (scheduler, lifecycle, delegation)
    ├── tab manager (create, group, protect, recover)
    ├── persisted state (chrome.storage.local + session)
    └── messaging (chrome.runtime typed messages)
    │
    ▼
Real ChatGPT worker tabs (background)
    ├── content script (adapter + minimal UI)
    ├── real worker conversation
    └── adapter events → service worker
```

### Hard Rules

- **Adapter isolation**: ALL ChatGPT DOM knowledge lives in `src/adapter/chatgpt/`. Zero DOM selectors anywhere else.
- **Orchestrator purity**: `src/orchestrator/` contains ZERO DOM references, ZERO ChatGPT-specific selectors. Pure state machine logic.
- **Service worker statelessness**: The service worker MUST survive termination + restart. ALL critical state in `chrome.storage`. Global variables ONLY for constants.
- **Shadow DOM for UI**: ALL extension-injected UI uses Shadow DOM to prevent style conflicts with ChatGPT.
- **Typed messages**: ALL cross-context messages use discriminated union types validated at boundaries.

## 6. Directory Structure

```
src/
  adapter/
    chatgpt/
      page.ts          # page detection, URL parsing
      composer.ts      # composer location, message sending
      conversation.ts  # conversation state, message extraction
      project.ts       # project detection, project chat creation
      model.ts         # model discovery, selection
      selectors.ts     # ALL DOM selector strategies (centralized)
      events.ts        # MutationObserver wrappers, DOM events
      capabilities.ts  # capability detection with confidence scoring
      types.ts         # adapter-specific types

  orchestrator/
    scheduler.ts       # worker scheduling, wave management
    lifecycle.ts       # state machine transitions
    delegation.ts      # Captain → worker task delegation
    recovery.ts        # state reconciliation, duplicate prevention
    messaging.ts       # typed message routing

  swarm/
    types.ts           # core domain types (SwarmState, AgentIdentity, etc.)
    schema.ts          # Valibot schemas for delegation, reports
    memory.ts          # SwarmWorkingMemory management
    persona.ts         # persona templates, editing
    models.ts          # model policy logic (auto/manual/fallback)

  ui/
    mount.ts           # Shadow DOM mount/remount logic
    sidebar/           # Swarm nav item injection
    workspace/         # worker grid layout (responsive)
    worker/            # worker pane (compact chat projection)
    captain/           # captain overlay controls
    controls/          # action buttons, modals
    styles/            # CSS inheriting ChatGPT variables
    accessibility.ts   # ARIA, focus management, announcements

  background/
    service-worker.ts  # event registration, message dispatch
    tabs.ts            # tab creation, grouping, protection
    persistence.ts     # chrome.storage read/write helpers

  content/
    index.ts           # content script entry, adapter init
    mount.ts           # UI mount point detection + injection

  shared/
    constants.ts       # version, limits, timeouts
    errors.ts          # error types, error boundaries
    logger.ts          # structured logging (redacts secrets)
    utils.ts           # debounce, retry, ID generation

  tests/
    unit/              # pure logic tests
    fixtures/          # sanitized DOM fixtures
    integration/       # adapter + fixture tests
    e2e/               # Playwright authenticated tests
    chaos/             # chaos/soak test scripts
```

## 7. Adapter Rules

The ChatGPT adapter is the most critical stability boundary.

### Selector Strategy Priority

1. ARIA roles and labels (`[role="textbox"][aria-label]`)
2. Accessible names (`button[aria-label="Send"]`)
3. Stable semantic attributes (`data-testid`, `data-message-id`)
4. Element semantics (`<textarea>`, `<button>`, `<nav>`)
5. Nearby textual content (button text, heading text)
6. Structural relationships (parent/child, sibling order)
7. CSS selectors as LAST RESORT (fragile, will break)

### Confidence Scoring

Every adapter capability MUST report a confidence score (0.0–1.0).

```typescript
interface CapabilityResult<T> {
  value: T | null;
  confidence: number;      // 0.0–1.0
  strategy: string;        // which strategy succeeded
  fallbacksUsed: string[]; // which strategies were tried
}
```

### Safety Threshold

Before performing ANY destructive action (sending a message, clicking buttons):
- Required confidence ≥ 0.90
- If below threshold: **FAIL CLOSED** — do not act, report to user

### Multi-Strategy Detection

Each critical capability MUST have ≥2 independent detection strategies.

```typescript
// Example: composer detection
const strategies = [
  { name: 'aria-textbox', fn: () => document.querySelector('[role="textbox"]') },
  { name: 'contenteditable', fn: () => document.querySelector('[contenteditable="true"]') },
  { name: 'prosemirror', fn: () => document.querySelector('.ProseMirror') },
];
```

## 8. State Machine

Worker states (linear with controlled backward edges):

```
PLANNED → CREATING → READY → RUNNING → COMPLETE
                                ↓         ↗
                             WAITING ──┘
                                ↓
                          REQUIRES_USER
                                ↓
                             FAILED
                             PAUSED
                             STOPPED
```

### Persistence Rules

- **EVERY state transition** must be persisted to `chrome.storage.local` BEFORE the transition is considered complete.
- **Write-ahead**: persist the target state, then perform the action, then confirm.
- **Idempotent transitions**: re-entering the same state is a no-op (safe for recovery).

## 9. Recovery Protocol

On any restart (service worker, content script, tab reload):

1. Load persisted SwarmState from `chrome.storage.local`
2. Query existing tabs via `chrome.tabs.query`
3. Match tabs to persisted worker records by URL
4. For each worker:
   - Tab exists + URL matches → inspect actual conversation state
   - Tab missing → attempt to restore (navigate to saved URL)
   - Tab exists but wrong URL → mark as LOST, do not interact
5. Reconcile extension state against reality
6. **NEVER** blindly resend a task — check if worker already completed
7. Resume or surface recovery UI

### Duplicate Prevention

```typescript
interface WorkerRecord {
  taskHash: string;        // hash of the task content
  submittedAt: number;     // timestamp
  submissionId: string;    // unique per submission
}
```

Before sending a task: check if `taskHash` already exists for this worker. If yes → skip.

## 10. Message Schema

ALL messages between contexts use a discriminated union:

```typescript
type SwarmMessage =
  | { type: 'WORKER_CREATE'; payload: WorkerCreatePayload }
  | { type: 'WORKER_STATUS'; payload: WorkerStatusPayload }
  | { type: 'WORKER_RESULT'; payload: WorkerResultPayload }
  | { type: 'SWARM_COMMAND'; payload: SwarmCommandPayload }
  | { type: 'ADAPTER_EVENT'; payload: AdapterEventPayload }
  | { type: 'CAPABILITY_CHECK'; payload: CapabilityCheckPayload };
```

### Validation at Boundaries

Every message handler MUST:
1. Validate `sender.id === chrome.runtime.id`
2. Parse message against Valibot schema
3. Reject unknown message types
4. Never `eval()` message contents
5. Never treat assistant prose as executable commands

## 11. Security Invariants

- **No credential access**: Never read cookies, auth tokens, session headers
- **No backend**: Zero network calls to non-ChatGPT origins
- **No telemetry**: No analytics, no tracking, no phone-home
- **No eval**: Never eval model output, user input, or remote code
- **No private API replay**: Never call undocumented ChatGPT endpoints
- **Trust boundary**: Only Captain's validated schema output controls orchestration
- **DOM safety**: Use `textContent` not `innerHTML` for any model-generated content
- **Log redaction**: Logger MUST strip URLs containing conversation IDs, strip any auth-looking tokens

## 12. Privacy Rules

- ALL state is local (chrome.storage only)
- NO conversation content stored beyond concise worker reports
- NO full transcript duplication
- Diagnostic exports MUST redact: conversation IDs, URLs, any text that could be user content
- Uninstall leaves NOTHING external behind

## 13. Performance Budget

| Metric | Budget |
|---|---|
| Max worker tabs | 4 |
| Total ChatGPT tabs (Captain + workers) | ≤5 |
| Streaming UI update interval | 50–150ms (debounced) |
| MutationObserver scope | narrowest possible container |
| Storage writes | batch, ≤1 write per meaningful state change |
| Service worker wakeups | event-driven only, no polling |

## 14. Code Style

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`)
- ESLint with `@typescript-eslint/recommended`
- Prettier (default config)
- NO `any` types without justification comment
- NO `as` type assertions without justification comment  
- Prefer `unknown` over `any` at boundaries
- All public functions documented with JSDoc
- All error paths must be handled (no unhandled promise rejections)

## 15. Commit Protocol

- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `perf:`, `refactor:`
- Every commit must pass: typecheck + lint + relevant tests
- Push after each stable milestone
- CHANGELOG.md updated continuously
- No broken commits on main branch

## 16. Test Requirements

### Level 1 — Unit (Vitest + happy-dom)
- Pure logic: scheduler, lifecycle, persistence, schema validation, recovery, persona, model policy
- NO live ChatGPT needed
- Target: instant feedback (<5s total)

### Level 2 — Fixture (Vitest + happy-dom)  
- DOM adapter tests against sanitized HTML fixtures
- Test ALL selector strategies including fallbacks
- Test confidence scoring
- Test mount/remount

### Level 3 — Authenticated E2E (Playwright)
- Real ChatGPT, real conversations
- 1/2/4 worker scenarios
- Recovery, intervention, model switching
- Manual run only (no CI — requires auth)

### Level 4 — Chaos/Soak
- Service worker kill, tab close, reload, network disconnect
- 30+ swarms across worker counts
- Record: success rate, latency, lost reports, orphaned workers

## 17. ChatGPT Compatibility

The extension MUST detect incompatibility and **fail safely**.

On capability check failure:
1. Display a native-looking notification: "ChatGPT appears to have changed. Swarm cannot safely start."
2. Disable all Swarm actions
3. Log capability scores to diagnostics
4. Do NOT attempt to guess or click arbitrary elements

## 18. Accessibility Requirements

- Keyboard navigable (all controls reachable via Tab)
- Logical tab order
- Focus restoration after actions
- ARIA labels on all interactive elements
- Screen-reader announcements for status changes
- `prefers-reduced-motion` respected
- Status conveyed via text, not color alone
- Works at 200% browser zoom
- Works in light AND dark mode

## 19. OpenAI Policy Compliance

This extension does NOT:
- Call undocumented APIs
- Extract authentication credentials  
- Circumvent rate limits
- Bypass CAPTCHAs
- Defeat anti-bot systems
- Claim OpenAI affiliation

It DOES:
- Automate only standard user interactions (typing, clicking visible UI)
- Operate within a single user's authenticated session
- Function as a personal productivity tool

The README must include: "ChatGPT is a trademark/product of OpenAI. This project is independent and is not affiliated with or endorsed by OpenAI."

## 20. Files That Must Exist

```
README.md           # comprehensive project documentation
LICENSE             # Apache-2.0
SECURITY.md         # security reporting instructions
CONTRIBUTING.md     # contribution guidelines
CODE_OF_CONDUCT.md  # contributor covenant
PRIVACY.md          # privacy policy
CHANGELOG.md        # version history
RELEASE_REPORT.md   # release quality evidence

docs/
  architecture.md
  reconnaissance.md
  testing.md
  privacy.md
  compatibility.md
  release.md

.github/
  workflows/ci.yml
  ISSUE_TEMPLATE/
  pull_request_template.md

fixtures/
  chat-idle.html
  chat-streaming.html
  chat-complete.html
  project-chat.html
  sidebar-expanded.html
  sidebar-collapsed.html
  model-picker.html
  tool-running.html
  error.html
```

## 21. Dependencies Policy

- MINIMAL dependencies
- Every dependency must be justified
- Audit for: maintenance status, bundle size, security, necessity
- Lock all versions (lockfile committed)
- No dependency may have known critical CVEs at release time

### Pre-Approved Dependencies

| Package | Purpose | Justification |
|---|---|---|
| `wxt` | Extension framework | MV3 build, HMR, manifest gen |
| `valibot` | Schema validation | <2kB, tree-shakeable |
| `vitest` | Unit testing | Fast, Vite-native |
| `@playwright/test` | E2E testing | Browser automation |
| `typescript` | Type safety | Required |
| `eslint` | Linting | Required |
| `prettier` | Formatting | Required |

Any additional dependency requires explicit justification in the commit message.

## 22. Glossary

| Term | Definition |
|---|---|
| **Captain** | The user's original ChatGPT conversation that orchestrates workers |
| **Worker** | A real ChatGPT conversation created by the extension to handle a subtask |
| **Swarm** | One complete Captain → workers → synthesis cycle |
| **Wave** | A batch of concurrent workers (max 4 per wave) |
| **Adapter** | The layer that bridges extension logic to ChatGPT DOM |
| **Confidence** | 0.0–1.0 score indicating how certain the adapter is about a detection |
| **Merge Now** | User action to collect available results without waiting for all workers |
| **REQUIRES_USER** | State indicating a worker needs human intervention |
