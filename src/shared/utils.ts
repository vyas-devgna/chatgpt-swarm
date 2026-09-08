/**
 * Shared utility functions.
 */

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID when available, falls back to manual generation.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a debounced version of a function.
 * @param fn The function to debounce.
 * @param delayMs Delay in milliseconds.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Compute a simple hash of a string for duplicate detection.
 * NOT cryptographic — used only for task deduplication.
 */
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Retry an async operation with exponential backoff.
 * @param fn The async function to retry.
 * @param maxAttempts Maximum number of attempts.
 * @param baseDelayMs Base delay between retries.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - 3) + '...';
}

/**
 * Check if a URL belongs to ChatGPT.
 */
export function isChatGPTUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com';
  } catch {
    return false;
  }
}

/**
 * Extract conversation ID from a ChatGPT URL.
 * URL format: https://chatgpt.com/c/{conversationId}
 */
export function extractConversationId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Extract project ID from a ChatGPT URL.
 * URL format: https://chatgpt.com/g/{projectId}/...
 * or: https://chatgpt.com/project/{projectId}/...
 */
export function extractProjectId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:g|project)\/([a-f0-9-]+)/);
    return match ? match[1] ?? null : null;
  } catch {
    return null;
  }
}
