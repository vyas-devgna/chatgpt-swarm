/**
 * Structured logger with secret redaction.
 *
 * SECURITY: This logger strips conversation IDs, auth tokens, cookies,
 * and bearer tokens from all output to prevent credential leakage.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Patterns that indicate sensitive content. */
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // ChatGPT conversation IDs in URLs
  { pattern: /\/c\/[a-f0-9-]{36}/gi, replacement: '/c/[REDACTED]' },
  // Generic UUIDs that might be conversation IDs
  {
    pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
    replacement: '[UUID-REDACTED]',
  },
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: 'Bearer [REDACTED]' },
  // Authorization headers
  {
    pattern: /authorization['":\s]+[A-Za-z0-9._~+/=-]+/gi,
    replacement: 'authorization: [REDACTED]',
  },
  // Cookie values
  { pattern: /cookie['":\s]+[^\s;]+/gi, replacement: 'cookie: [REDACTED]' },
  // Session tokens
  { pattern: /sess-[A-Za-z0-9._~+/=-]+/gi, replacement: 'sess-[REDACTED]' },
];

/** Redact sensitive content from a string. */
export function redact(input: string): string {
  let result = input;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

let currentLevel: LogLevel = 'info';

/** Set the minimum log level. */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Get the current log level. */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  const redacted = redact(message);
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${redacted}`;
}

/** Create a logger scoped to a specific context. */
export function createLogger(context: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog('debug')) {
        const formatted = formatMessage('debug', context, message);
        // Using console.debug is intentional for dev tools
        // eslint-disable-next-line no-console
        console.debug(formatted, data ? redact(JSON.stringify(data)) : '');
      }
    },

    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog('info')) {
        const formatted = formatMessage('info', context, message);
        // eslint-disable-next-line no-console
        console.info(formatted, data ? redact(JSON.stringify(data)) : '');
      }
    },

    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog('warn')) {
        const formatted = formatMessage('warn', context, message);
        console.warn(formatted, data ? redact(JSON.stringify(data)) : '');
      }
    },

    error(message: string, error?: unknown) {
      if (shouldLog('error')) {
        const formatted = formatMessage('error', context, message);
        console.error(formatted, error instanceof Error ? redact(error.message) : error);
      }
    },
  };
}
