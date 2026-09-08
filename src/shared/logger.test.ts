/**
 * Unit tests for the logger with redaction.
 */

import { describe, it, expect } from 'vitest';
import { redact } from './logger.js';

describe('Logger redaction', () => {
  it('redacts conversation IDs in URLs', () => {
    const input = 'Navigating to /c/12345678-1234-1234-1234-123456789abc';
    const result = redact(input);
    expect(result).not.toContain('12345678-1234-1234-1234-123456789abc');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJSUzI1NiIs.payload.signature';
    const result = redact(input);
    expect(result).not.toContain('eyJhbGciOiJSUzI1NiIs');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts authorization headers', () => {
    const input = 'authorization: sk-proj-abc123def456';
    const result = redact(input);
    expect(result).not.toContain('sk-proj-abc123def456');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts cookie values', () => {
    const input = 'cookie: session_token=abc123xyz789';
    const result = redact(input);
    expect(result).not.toContain('abc123xyz789');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts session tokens', () => {
    const input = 'Token: sess-abc123def456ghi789';
    const result = redact(input);
    expect(result).not.toContain('sess-abc123def456ghi789');
    expect(result).toContain('[REDACTED]');
  });

  it('preserves non-sensitive content', () => {
    const input = 'Worker Iris completed task: Architecture Analysis';
    const result = redact(input);
    expect(result).toBe(input);
  });

  it('handles empty string', () => {
    expect(redact('')).toBe('');
  });

  it('handles multiple sensitive patterns in one string', () => {
    const input = 'URL /c/12345678-1234-1234-1234-123456789abc with Bearer token123';
    const result = redact(input);
    expect(result).not.toContain('12345678-1234-1234-1234-123456789abc');
    expect(result).not.toContain('token123');
  });
});
