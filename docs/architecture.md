# Architecture — ChatGPT Swarm

## Overview

ChatGPT Swarm is a Chromium browser extension (Manifest V3) that adds multi-agent orchestration to ChatGPT Project conversations. It operates entirely within the browser, using Chrome extension APIs and ChatGPT's web interface.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ chatgpt.com (Captain tab)                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Real ChatGPT conversation (Captain)                  │   │
│  │  - User's original task                              │   │
│  │  - Delegation planning                               │   │
│  │  - Worker result synthesis                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Swarm Workspace (Shadow DOM, extension-owned)        │   │
│  │  - Worker status cards                               │   │
│  │  - Controls (Stop, Merge, Pause)                     │   │
│  │  - Diagnostics                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Content Script                                       │   │
│  │  - ChatGPT Adapter (DOM detection, confidence)       │   │
│  │  - UI Mount Manager (Shadow DOM injection)           │   │
│  │  - Message Bridge (content ↔ service worker)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                  chrome.runtime.sendMessage
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Extension Service Worker (STATELESS)                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Orchestrator   │  │ Tab Manager    │  │ Persistence  │  │
│  │  - Scheduler   │  │  - Create      │  │  - storage   │  │
│  │  - Lifecycle   │  │  - Group       │  │    .local    │  │
│  │  - Delegation  │  │  - Protect     │  │  - storage   │  │
│  │  - Recovery    │  │  - Monitor     │  │              │  │
│  │  - Messaging   │  │  - Cleanup     │  │              │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
              chrome.tabs.create (background)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Worker Tabs (1-4, background, grouped)                      │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Worker 1 (chatgpt)   │  │ Worker 2 (chatgpt)   │        │
│  │  - Content script    │  │  - Content script    │        │
│  │  - Real conversation │  │  - Real conversation │        │
│  │  - Adapter events    │  │  - Adapter events    │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Worker 3 (chatgpt)   │  │ Worker 4 (chatgpt)   │        │
│  │  - Content script    │  │  - Content script    │        │
│  │  - Real conversation │  │  - Real conversation │        │
│  │  - Adapter events    │  │  - Adapter events    │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Module Boundaries

### Adapter (`src/adapter/chatgpt/`)

- ONLY location for ChatGPT DOM knowledge
- Multi-strategy detection with confidence scoring
- Fail-closed behavior below confidence threshold
- No other module may contain DOM selectors

### Orchestrator (`src/orchestrator/`)

- Pure state machine logic
- No DOM references
- No ChatGPT-specific knowledge
- Communicates via typed messages

### Swarm (`src/swarm/`)

- Domain types and schemas
- Persona management
- Model policies
- Working memory

### Background (`src/background/`)

- Service worker (stateless)
- Tab management
- Storage persistence

### UI (`src/ui/`)

- Shadow DOM injection
- ChatGPT-native styling
- Responsive worker grid

## State Machine

See `src/orchestrator/lifecycle.ts` for the canonical state machine implementation.

## Recovery

The extension is designed to survive:

- Service worker termination (rehydrates from storage)
- Tab closure (marks the worker FAILED and exposes Retry)
- Browser restart (recovers from persisted state)
- Temporary page interruption (rehydrates safely without blind resubmission)

## Security Model

- No credential access
- Schema-validated messages at all boundaries
- Sender verification on all cross-context messages
- No eval() of any content
- Shadow DOM isolation prevents XSS through style/DOM injection
