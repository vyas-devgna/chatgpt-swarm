# Contributing to ChatGPT Swarm

Thank you for considering contributing! This document outlines how to contribute effectively.

## Development Setup

```bash
git clone https://github.com/vyas-devgna/chatgpt-swarm.git
cd chatgpt-swarm
npm install
npm run dev  # starts extension in dev mode with hot reload
```

## Before Submitting a PR

1. **Run the full check**: `npm run check` (typecheck + lint + test)
2. **Add tests** for new functionality
3. **Update documentation** if behavior changes
4. **Follow conventional commits**: `feat:`, `fix:`, `test:`, `docs:`, `chore:`

## Architecture Rules

- **Adapter isolation**: All ChatGPT DOM knowledge stays in `src/adapter/chatgpt/`
- **Service worker statelessness**: No global state — everything in `chrome.storage`
- **Shadow DOM for UI**: All injected UI uses Shadow DOM
- **Typed messages**: All cross-context messages are typed and validated
- **No `any`**: Use `unknown` at boundaries, proper types elsewhere

## Code Style

- TypeScript strict mode
- ESLint + Prettier (run `npm run lint:fix && npm run format`)
- JSDoc on public functions
- No unhandled promise rejections

## Testing

- Unit tests: `npm run test`
- Run relevant tests before committing
- Add regression tests for bug fixes

## Security

- Never introduce credential access
- Never add external network calls
- Never use `eval()` or `innerHTML` with dynamic content
- Always validate message boundaries with schemas
