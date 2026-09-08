import { describe, expect, it } from 'vitest';
import { LifecycleError } from '../shared/errors.js';
import { transitionWorker } from './lifecycle.js';

describe('worker lifecycle', () => {
  it('allows the normal lifecycle and idempotent recovery', () => {
    expect(transitionWorker('PLANNED', 'CREATING')).toBe('CREATING');
    expect(transitionWorker('RUNNING', 'COMPLETE')).toBe('COMPLETE');
    expect(transitionWorker('RUNNING', 'RUNNING')).toBe('RUNNING');
  });

  it('rejects backward or terminal transitions', () => {
    expect(() => transitionWorker('COMPLETE', 'RUNNING')).toThrow(LifecycleError);
    expect(() => transitionWorker('READY', 'PLANNED')).toThrow(LifecycleError);
  });
});
