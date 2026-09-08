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

## Level 3 — Authenticated E2E Tests [Manual]

**Tool**: Playwright + real ChatGPT  
**Runs**: Manual before releases  

Tests the complete workflow against a real ChatGPT account:
- Full swarm lifecycle (1/2/4 workers)
- User intervention scenarios
- Recovery scenarios
- UI adaptation (dark/light, sidebar, zoom)
- Tab management

### Running
Requires authenticated ChatGPT session:
```bash
npx playwright test --headed
```

## Level 4 — Chaos / Soak Tests [Manual]

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
