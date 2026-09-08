import { LifecycleError } from '../shared/errors.js';
import type { WorkerStatus } from '../swarm/types.js';

const TRANSITIONS: Record<WorkerStatus, readonly WorkerStatus[]> = {
  PLANNED: ['CREATING', 'STOPPED'],
  CREATING: ['READY', 'FAILED', 'STOPPED'],
  READY: ['RUNNING', 'FAILED', 'STOPPED'],
  RUNNING: ['WAITING', 'REQUIRES_USER', 'COMPLETE', 'FAILED', 'PAUSED', 'STOPPED'],
  WAITING: ['RUNNING', 'REQUIRES_USER', 'COMPLETE', 'FAILED', 'PAUSED', 'STOPPED'],
  REQUIRES_USER: ['RUNNING', 'FAILED', 'STOPPED'],
  COMPLETE: [],
  FAILED: ['CREATING', 'STOPPED'],
  PAUSED: ['RUNNING', 'STOPPED'],
  STOPPED: [],
};

/** Validate a worker state transition; same-state writes are idempotent. */
export function transitionWorker(from: WorkerStatus, to: WorkerStatus): WorkerStatus {
  if (from === to) return to;
  if (!TRANSITIONS[from].includes(to)) {
    throw new LifecycleError(`Invalid worker transition: ${from} -> ${to}`, from, to);
  }
  return to;
}
