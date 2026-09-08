/**
 * Application constants and configuration.
 * These values are the ONLY place hard limits and defaults are defined.
 */

/** Extension version — must match package.json and manifest. */
export const EXTENSION_VERSION = '0.1.0';

/** Schema version for persisted state migration. */
export const SCHEMA_VERSION = 1;

/** Maximum number of workers per swarm wave. */
export const MAX_WORKERS = 4;

/** Maximum total ChatGPT tabs (Captain + workers). */
export const MAX_TOTAL_TABS = 5;

/** Maximum number of waves (Wave 1 + optional Wave 2 review). */
export const MAX_WAVES = 2;

/** Maximum workers in Wave 2 (review round). */
export const MAX_WAVE_2_WORKERS = 1;

/** Minimum adapter confidence to perform destructive actions. */
export const MIN_CONFIDENCE_THRESHOLD = 0.9;

/** Debounce interval for streaming UI updates (ms). */
export const STREAMING_DEBOUNCE_MS = 100;

/** Debounce interval for MutationObserver callbacks (ms). */
export const MUTATION_DEBOUNCE_MS = 150;

/** Maximum age for persisted swarm records before cleanup (ms). 30 days. */
export const SWARM_RECORD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum length of a worker report before truncation (chars). */
export const MAX_REPORT_LENGTH = 50_000;

/** Maximum user objective length accepted for orchestration. */
export const MAX_OBJECTIVE_LENGTH = 12_000;

/** Maximum individual delegated task length. */
export const MAX_TASK_LENGTH = 20_000;

/** Maximum behavioral persona length. */
export const MAX_PERSONA_LENGTH = 4_000;

/** Maximum human-readable identity field lengths. */
export const MAX_AGENT_NAME_LENGTH = 80;
export const MAX_AGENT_ROLE_LENGTH = 120;

/** Maximum extension-controlled URL length. */
export const MAX_URL_LENGTH = 2_048;

/** Maximum retries for delegation schema repair. */
export const MAX_DELEGATION_REPAIR_ATTEMPTS = 1;

/** ChatGPT host for URL matching. */
export const CHATGPT_HOST = 'chatgpt.com';

/** ChatGPT base URL. */
export const CHATGPT_BASE_URL = 'https://chatgpt.com';

/** Storage key prefixes. */
export const STORAGE_KEYS = {
  SWARM_PREFIX: 'swarm:',
  PERSONA_PREFIX: 'persona:',
  PREFERENCES: 'preferences',
  ACTIVE_SWARMS: 'activeSwarms',
  DIAGNOSTICS: 'diagnostics',
} as const;

/** Tab group color for swarm worker tabs. */
export const TAB_GROUP_COLOR = 'blue' as const;
