/**
 * Typed error classes for ChatGPT Swarm.
 *
 * All error paths should use these types for consistent handling.
 */

/** Base error class for all Swarm errors. */
export class SwarmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false,
  ) {
    super(message);
    this.name = 'SwarmError';
  }
}

/** Adapter failed to detect a capability with sufficient confidence. */
export class AdapterError extends SwarmError {
  constructor(
    message: string,
    public readonly capability: string,
    public readonly confidence: number,
  ) {
    super(message, 'ADAPTER_ERROR', false);
    this.name = 'AdapterError';
  }
}

/** Delegation schema validation or parsing failed. */
export class DelegationError extends SwarmError {
  constructor(
    message: string,
    public readonly repairAttempted: boolean = false,
  ) {
    super(message, 'DELEGATION_ERROR', true);
    this.name = 'DelegationError';
  }
}

/** Worker lifecycle transition error. */
export class LifecycleError extends SwarmError {
  constructor(
    message: string,
    public readonly fromState: string,
    public readonly toState: string,
  ) {
    super(message, 'LIFECYCLE_ERROR', false);
    this.name = 'LifecycleError';
  }
}

/** Recovery detected inconsistency. */
export class RecoveryError extends SwarmError {
  constructor(
    message: string,
    public readonly swarmId: string,
  ) {
    super(message, 'RECOVERY_ERROR', true);
    this.name = 'RecoveryError';
  }
}

/** Tab management error. */
export class TabError extends SwarmError {
  constructor(
    message: string,
    public readonly tabId?: number,
  ) {
    super(message, 'TAB_ERROR', true);
    this.name = 'TabError';
  }
}

/** Message validation error. */
export class MessageError extends SwarmError {
  constructor(
    message: string,
    public readonly messageType?: string,
  ) {
    super(message, 'MESSAGE_ERROR', false);
    this.name = 'MessageError';
  }
}

/** Storage operation error. */
export class StorageError extends SwarmError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR', true);
    this.name = 'StorageError';
  }
}
