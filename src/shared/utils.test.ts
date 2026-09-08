/**
 * Unit tests for shared utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  debounce,
  simpleHash,
  truncate,
  isChatGPTUrl,
  extractConversationId,
  extractProjectId,
} from './utils.js';

describe('generateId', () => {
  it('generates a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0;
    const fn = debounce(() => { callCount++; }, 50);

    fn();
    fn();
    fn();

    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });
});

describe('simpleHash', () => {
  it('produces consistent hashes', () => {
    const hash1 = simpleHash('hello world');
    const hash2 = simpleHash('hello world');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = simpleHash('hello');
    const hash2 = simpleHash('world');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    expect(simpleHash('')).toBe('0');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    const result = truncate('a very long string that exceeds the limit', 20);
    expect(result.length).toBe(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles exact length', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });
});

describe('isChatGPTUrl', () => {
  it('recognizes chatgpt.com', () => {
    expect(isChatGPTUrl('https://chatgpt.com/')).toBe(true);
    expect(isChatGPTUrl('https://chatgpt.com/c/abc-123')).toBe(true);
  });

  it('recognizes chat.openai.com', () => {
    expect(isChatGPTUrl('https://chat.openai.com/')).toBe(true);
  });

  it('rejects other URLs', () => {
    expect(isChatGPTUrl('https://google.com')).toBe(false);
    expect(isChatGPTUrl('https://evil.com/chatgpt.com')).toBe(false);
  });

  it('handles invalid URLs', () => {
    expect(isChatGPTUrl('not a url')).toBe(false);
    expect(isChatGPTUrl('')).toBe(false);
  });
});

describe('extractConversationId', () => {
  it('extracts from standard conversation URL', () => {
    const id = extractConversationId('https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc');
    expect(id).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('returns null for non-conversation URL', () => {
    expect(extractConversationId('https://chatgpt.com/')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(extractConversationId('not a url')).toBeNull();
  });
});

describe('extractProjectId', () => {
  it('extracts from project URL', () => {
    const id = extractProjectId('https://chatgpt.com/g/12345678-1234-1234-1234-123456789abc');
    expect(id).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('returns null for non-project URL', () => {
    expect(extractProjectId('https://chatgpt.com/')).toBeNull();
  });
});
