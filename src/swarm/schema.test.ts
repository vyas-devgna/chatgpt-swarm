/**
 * Unit tests for Valibot delegation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDelegation,
  extractJsonFromResponse,
  parseDelegationResponse,
} from './schema.js';

describe('DelegationSchema', () => {
  it('parses valid delegation with 1 worker', () => {
    const input = {
      swarm_version: 1,
      objective: 'Analyze the project architecture',
      workers: [
        {
          name: 'Iris',
          role: 'Architecture Analyst',
          task: 'Review the codebase structure and identify patterns',
        },
      ],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers).toHaveLength(1);
    expect(result?.objective).toBe('Analyze the project architecture');
  });

  it('parses valid delegation with 4 workers', () => {
    const input = {
      swarm_version: 1,
      objective: 'Full code review',
      workers: [
        { name: 'Iris', role: 'Architect', task: 'Review structure' },
        { name: 'Forge', role: 'Engineer', task: 'Check implementation' },
        { name: 'Shield', role: 'Security', task: 'Audit security' },
        { name: 'Echo', role: 'Tester', task: 'Review test coverage' },
      ],
      review_after: true,
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers).toHaveLength(4);
    expect(result?.review_after).toBe(true);
  });

  it('parses valid delegation with 0 workers', () => {
    const input = {
      swarm_version: 1,
      objective: 'Simple question that needs no workers',
      workers: [],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers).toHaveLength(0);
  });

  it('rejects delegation with 5+ workers', () => {
    const input = {
      swarm_version: 1,
      objective: 'Too many workers',
      workers: Array.from({ length: 5 }, (_, i) => ({
        name: `Worker${i}`,
        role: `Role${i}`,
        task: `Task${i}`,
      })),
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('rejects delegation without objective', () => {
    const input = {
      swarm_version: 1,
      workers: [{ name: 'Iris', role: 'Analyst', task: 'Do something' }],
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('rejects worker without role', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: 'Iris', task: 'Do something' }],
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('rejects worker without task', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: 'Iris', role: 'Analyst' }],
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('rejects worker with empty string name', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: '', role: 'Analyst', task: 'Do something' }],
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('accepts worker without persona (optional)', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: 'Iris', role: 'Analyst', task: 'Do something' }],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers[0]?.persona).toBeUndefined();
  });

  it('accepts worker without model_policy (defaults to auto)', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: 'Iris', role: 'Analyst', task: 'Do something' }],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers[0]?.model_policy).toBeUndefined();
  });

  it('accepts without review_after field', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test',
      workers: [{ name: 'Iris', role: 'Analyst', task: 'Analyze' }],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.review_after).toBeUndefined();
  });

  it('rejects swarm_version !== 1', () => {
    const input = {
      swarm_version: 2,
      objective: 'Test',
      workers: [],
    };
    const result = validateDelegation(input);
    expect(result).toBeNull();
  });

  it('handles name with HTML/script tags as plain text', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test XSS',
      workers: [
        {
          name: '<script>alert("xss")</script>',
          role: 'Analyst',
          task: 'Test',
        },
      ],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    // Schema treats it as a valid string — XSS prevention is at render time
    expect(result?.workers[0]?.name).toBe('<script>alert("xss")</script>');
  });

  it('handles unicode display names correctly', () => {
    const input = {
      swarm_version: 1,
      objective: 'Test unicode',
      workers: [
        { name: '分析者', role: 'アーキテクト', task: '構造を分析する' },
      ],
    };
    const result = validateDelegation(input);
    expect(result).not.toBeNull();
    expect(result?.workers[0]?.name).toBe('分析者');
  });
});

describe('extractJsonFromResponse', () => {
  it('extracts direct JSON', () => {
    const input = '{"swarm_version": 1, "objective": "test", "workers": []}';
    const result = extractJsonFromResponse(input);
    expect(result).toEqual({ swarm_version: 1, objective: 'test', workers: [] });
  });

  it('extracts JSON from markdown code block', () => {
    const input = `Here is my delegation plan:

\`\`\`json
{"swarm_version": 1, "objective": "test", "workers": []}
\`\`\`

Let me know if you want changes.`;
    const result = extractJsonFromResponse(input);
    expect(result).toEqual({ swarm_version: 1, objective: 'test', workers: [] });
  });

  it('extracts JSON from response with surrounding prose', () => {
    const input = `I've analyzed your request and here's my plan:

{"swarm_version": 1, "objective": "analyze code", "workers": [{"name": "Iris", "role": "Analyst", "task": "Review"}]}

I'll proceed with this delegation.`;
    const result = extractJsonFromResponse(input);
    expect(result).not.toBeNull();
  });

  it('returns null for unparseable response', () => {
    const input = 'This is just plain text with no JSON.';
    const result = extractJsonFromResponse(input);
    expect(result).toBeNull();
  });
});

describe('parseDelegationResponse', () => {
  it('parses valid JSON response', () => {
    const response = '{"swarm_version": 1, "objective": "test", "workers": []}';
    const result = parseDelegationResponse(response);
    expect(result.success).toBe(true);
    expect(result.plan).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns error for unparseable response', () => {
    const response = 'No JSON here at all';
    const result = parseDelegationResponse(response);
    expect(result.success).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.error).toContain('Could not extract JSON');
  });

  it('returns error for invalid schema', () => {
    const response = '{"swarm_version": 99, "workers": []}';
    const result = parseDelegationResponse(response);
    expect(result.success).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.error).toContain('Schema validation failed');
  });
});
