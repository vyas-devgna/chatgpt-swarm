# Testing Strategy — ChatGPT Swarm

## Overview

Testing uses four levels, designed to provide fast feedback for development while ensuring reliability through authenticated real-world testing.

## Level 1 — Unit Tests [CI]

**Tool**: Vitest with happy-dom  
**Speed**: <5 seconds total  
**Runs**: On every commit via CI

Tests pure logic with no live ChatGPT dependency:

- Schema validation (delegation, reports)
- State machine transitions
- Persistence read/write
- Recovery logic
- Message routing
- Logger redaction
- Utility functions

### Running

```bash
npm run test           # single run
npm run test:watch     # watch mode
```

## Level 2 — DOM Fixture Tests [CI]

**Tool**: Vitest with happy-dom  
**Speed**: <10 seconds  
**Runs**: On every commit via CI

Tests the ChatGPT adapter against sanitized HTML fixture files:

- Composer detection across multiple strategies
- Message extraction
- Streaming state detection
- Model picker interaction
- Project detection
- Sidebar mount point detection

### Fixtures

Located in `fixtures/` — sanitized HTML snapshots of real ChatGPT states.

## Level 3 — Packaged Extension E2E [CI]

**Tool**: Playwright + packaged Chromium MV3 extension
**Runs**: On every pull request and release build

Tests service-worker loading, Chat-only mounting, live Chat→Work exclusion, a complete Captain-worker-synthesis lifecycle, closed-worker Retry, and Captain-tab recovery against deterministic sanitized pages.

### Running

```bash
npm run build
npm run test:e2e
```

## Level 4 — Authenticated E2E [Manual]

Load `.output/chrome-mv3` as an unpacked extension in a dedicated Chromium profile, sign in, and follow the Chat-only matrix in `docs/release.md`. This is never run in CI because it uses a real account and message quota.

## Level 5 — Chaos / Soak Tests [Manual]

**Protocol**: 30+ swarm runs with deliberate failures injected  
**Runs**: Before releases

Deliberately tests:

- Service worker termination
- Tab closure/freeze/discard
- Network interruption
- Rapid start/stop
- Navigation away and back

## Hard Invariants

These MUST pass at ALL levels:

1. No message delivered to wrong conversation
2. No completed worker result silently lost
3. No task submitted twice after recovery
4. No swarm disappears on Captain reload
5. No stopped swarm leaves hidden active workers
6. No low-confidence adapter action
7. No secrets in logs
