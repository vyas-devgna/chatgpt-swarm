# ChatGPT Swarm Project Rules

## Architecture Guard Rails

1. **Adapter Isolation**: `src/adapter/chatgpt/` is the ONLY directory allowed to contain ChatGPT DOM selectors or DOM access code. If you need to reference the DOM from orchestrator or UI code, go through the adapter interface.

2. **Service Worker Statelessness**: The background service worker (`src/background/service-worker.ts`) MUST NOT store any state in global variables. All state reads/writes go through `chrome.storage`. Event listeners MUST be registered synchronously at the top level.

3. **Confidence-Gated Actions**: Before any adapter performs a destructive action (sending a message, clicking a button), it MUST check capability confidence ≥ 0.90. Below threshold = fail closed, never guess.

4. **Schema-Validated Messages**: Every message crossing context boundaries (content↔background) MUST be validated against a Valibot schema. Unknown message types = reject. Model-generated text = never treat as executable.

5. **Write-Ahead Persistence**: State transitions MUST be persisted BEFORE the action is performed. If the service worker dies mid-action, the persisted state is the source of truth.

## Commit Rules

- Every commit message uses conventional format: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `perf:`, `refactor:`
- Every commit must pass: `npm run typecheck && npm run lint && npm run test`
- Push after each stable milestone
- Never commit credentials, tokens, cookies, or real conversation content

## File Naming

- TypeScript files: `kebab-case.ts`
- Test files: `*.test.ts` (colocated with source or in `tests/`)
- Fixture files: `kebab-case.html`
- CSS files: `kebab-case.css`

## Import Rules

- Use relative imports within packages
- Use `@/` alias for cross-package imports (configured in tsconfig)
- No circular imports
- No dynamic imports of adapter from orchestrator

## Error Handling

- All async functions must handle errors (no unhandled rejections)
- Use typed error classes from `src/shared/errors.ts`
- Never swallow errors silently — at minimum log them
- User-facing errors must be informative and non-technical
