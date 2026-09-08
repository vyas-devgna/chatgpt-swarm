# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
