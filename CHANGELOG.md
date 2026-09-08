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
