# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-09-08

### Fixed

- Recognize current Project Chat conversations from their project header when ChatGPT omits the Chat/Work surface controls.
- Continue to fail closed when a Project header identifies Work mode.

## [0.1.2] - 2026-09-08

### Added

- Keep the Swarm sidebar entry available outside Projects and explain the Project Chat workflow in an accessible native dialog.

### Fixed

- Replace the placeholder star glyph with a consistent vector agent-network icon.
- Label the composer action and its prerequisites explicitly.
- Use the browser's native contenteditable input path so ChatGPT receives orchestration prompts reliably.

## [0.1.1] - 2026-09-08

### Fixed

- Mount the Captain controls above ChatGPT's constrained composer shell so they remain visible.
- Show the sidebar shortcut only in eligible Project Chat surfaces and focus the Captain control instead of redirecting to Projects.
- Match the sidebar shortcut's spacing to ChatGPT's navigation.

## [0.1.0] - 2026-09-08

### Added

- Initial project structure with WXT, TypeScript, Vitest
- Core domain types (SwarmState, AgentIdentity, WorkerRecord, DelegationPlan)
- Valibot schemas for delegation validation
- Structured logger with secret redaction
- Shared utilities (ID generation, debounce, hashing, URL parsing)
- Typed error hierarchy
- Service worker entry point with message routing
- Content script entry point
- Unit tests for schemas, logger, and utilities
- CI pipeline (lint, typecheck, test, build)
- Project documentation (README, SECURITY, CONTRIBUTING, PRIVACY, CODE_OF_CONDUCT)
- Chat-only Captain planning, worker tab creation, result capture, Merge now, Stop, and synthesis
- Native-looking Shadow DOM composer controls, worker status cards, and sidebar entry
- Worker tab grouping, discard protection, persisted recovery, closed-tab detection, and Retry
- Sanitized ChatGPT DOM fixtures and packaged Chromium MV3 lifecycle/recovery tests
- Thirty-day local swarm-record pruning on extension update or swarm start

### Security

- Validate all cross-context messages and persisted swarm state with bounded schemas
- Bind Captain commands and worker results to verified ChatGPT tabs and canonical Project IDs
- Serialize concurrent swarm mutations with Web Locks to prevent lost worker reports
- Delimit and escape untrusted worker reports before Captain synthesis
- Remove every Swarm action on Work mode, including after a live Chat→Work switch
