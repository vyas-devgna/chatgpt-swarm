---
name: chatgpt-swarm-dev
description: Development skill for the ChatGPT Swarm browser extension. Contains ChatGPT DOM patterns, adapter strategies, WXT conventions, and extension-specific workflows.
---

# ChatGPT Swarm Development Skill

## Quick Reference

### Build & Test Commands
```bash
# Development (hot reload)
cd "/home/dev/Documents/ChatGPT swarm"
npm run dev          # starts WXT dev mode for Chrome

# Testing
npm run test         # vitest unit + fixture tests
npm run test:watch   # vitest watch mode
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write

# Build
npm run build        # production build
npm run zip          # create distributable ZIP
```

### Key Files
- `wxt.config.ts` — WXT/manifest configuration
- `src/adapter/chatgpt/selectors.ts` — ALL DOM selectors (centralized)
- `src/adapter/chatgpt/capabilities.ts` — capability confidence scoring
- `src/orchestrator/lifecycle.ts` — state machine
- `src/background/service-worker.ts` — event-driven entry point
- `src/content/index.ts` — content script entry
- `.agents/agents.md` — project rules and architecture

### ChatGPT DOM Patterns (Updated via Reconnaissance)

The ChatGPT web UI is React-based with frequently changing class names.

**Stable anchors to prefer:**
- Composer: `[role="textbox"]`, `[contenteditable="true"]`, `.ProseMirror`
- Send: `button[aria-label*="Send"]`, `[data-testid="send-button"]`
- Messages: `[data-message-id]`, `[role="article"]`
- Model picker: `[role="combobox"]`, button containing model name text
- Sidebar nav: `<nav>` element, `[role="navigation"]`
- Streaming: look for actively mutating text elements, cursor/blinking element

**Unstable patterns to avoid:**
- Generated CSS class names (hash-based)
- nth-child selectors
- React internal attributes (data-reactid, etc.)
- Deeply nested structural paths

### WXT Conventions
- Entrypoints go in `entrypoints/` (auto-detected by WXT)
- Background script: `entrypoints/background.ts`
- Content script: `entrypoints/content.ts` (with `export default defineContentScript(...)`)
- Manifest properties: defined in `wxt.config.ts`
- Run `wxt prepare` after creating new entrypoints

### Extension Architecture Rules
1. Service worker is STATELESS — all state in chrome.storage
2. Content script has DOM access — adapter lives here
3. Shadow DOM for all injected UI
4. Typed messages between all contexts
5. Confidence ≥ 0.90 required before any destructive DOM action
6. Multi-strategy detection for every capability

### Valibot Quick Reference
```typescript
import * as v from 'valibot';

// Define schema
const MySchema = v.object({
  name: v.string(),
  count: v.number(),
  items: v.array(v.string()),
  optional: v.optional(v.boolean()),
});

// Validate
const result = v.safeParse(MySchema, data);
if (result.success) {
  const validated = result.output; // typed!
} else {
  const issues = result.issues;
}
```

### Chrome Storage Helpers Pattern
```typescript
// Always async, always handle errors
async function getSwarmState(swarmId: string): Promise<SwarmState | null> {
  const key = `swarm:${swarmId}`;
  const result = await chrome.storage.local.get(key);
  if (!result[key]) return null;
  const parsed = v.safeParse(SwarmStateSchema, result[key]);
  return parsed.success ? parsed.output : null;
}

async function setSwarmState(state: SwarmState): Promise<void> {
  const key = `swarm:${state.swarmId}`;
  await chrome.storage.local.set({ [key]: state });
}
```

### Tab Management Pattern
```typescript
// Create worker tab in background
const tab = await chrome.tabs.create({
  url: workerUrl,
  active: false, // background
});

// Protect from discard
await chrome.tabs.update(tab.id!, { autoDiscardable: false });

// Group tabs
const groupId = await chrome.tabs.group({ tabIds: workerTabIds });
await chrome.tabGroups.update(groupId, {
  title: `Swarm — ${taskName}`,
  color: 'blue',
});

// Restore discardable after completion
await chrome.tabs.update(tab.id!, { autoDiscardable: true });
```
