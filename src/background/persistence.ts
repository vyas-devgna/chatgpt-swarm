import { STORAGE_KEYS, SWARM_RECORD_MAX_AGE_MS } from '../shared/constants.js';
import { StorageError } from '../shared/errors.js';
import { validateSwarmState } from '../swarm/schema.js';
import type { SwarmState } from '../swarm/types.js';

function swarmKey(swarmId: string): string {
  return `${STORAGE_KEYS.SWARM_PREFIX}${swarmId}`;
}

/** Serialize mutations for one swarm using the browser's origin-scoped lock manager. */
export function withSwarmLock<T>(swarmId: string, action: () => Promise<T>): Promise<T> {
  return navigator.locks.request(`chatgpt-swarm:${swarmId}`, action);
}

/** Persist complete state before callers perform its next side effect. */
export async function saveSwarm(state: SwarmState): Promise<void> {
  const stored = { ...state, updatedAt: Date.now() };
  try {
    await chrome.storage.local.set({ [swarmKey(state.swarmId)]: stored });
    await navigator.locks.request('chatgpt-swarm:active-index', async () => {
      const active = await listActiveSwarmIds();
      if (!active.includes(state.swarmId)) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.ACTIVE_SWARMS]: [...active, state.swarmId],
        });
      }
    });
  } catch {
    throw new StorageError('Unable to persist swarm state');
  }
}

/** Load one persisted swarm, rejecting malformed storage content. */
export async function loadSwarm(swarmId: string): Promise<SwarmState | null> {
  const stored = await chrome.storage.local.get(swarmKey(swarmId));
  const value: unknown = stored[swarmKey(swarmId)];
  return validateSwarmState(value);
}

/** Return active swarm IDs from local storage. */
export async function listActiveSwarmIds(): Promise<string[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SWARMS);
  const value: unknown = stored[STORAGE_KEYS.ACTIVE_SWARMS];
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

/** Load all valid active swarms. */
export async function loadActiveSwarms(): Promise<SwarmState[]> {
  const states = await Promise.all((await listActiveSwarmIds()).map(loadSwarm));
  return states.filter((state): state is SwarmState => state !== null);
}

/** Remove a terminal swarm from the active index while retaining its local record. */
export async function markSwarmInactive(swarmId: string): Promise<void> {
  await navigator.locks.request('chatgpt-swarm:active-index', async () => {
    const active = await listActiveSwarmIds();
    await chrome.storage.local.set({
      [STORAGE_KEYS.ACTIVE_SWARMS]: active.filter((id) => id !== swarmId),
    });
  });
}

/** Remove terminal swarm records older than the documented retention window. */
export async function pruneOldSwarms(now = Date.now()): Promise<number> {
  return navigator.locks.request('chatgpt-swarm:active-index', async () => {
    const stored = await chrome.storage.local.get(null);
    const expired = Object.entries(stored).flatMap(([key, value]) => {
      if (!key.startsWith(STORAGE_KEYS.SWARM_PREFIX)) return [];
      const state = validateSwarmState(value);
      return state && now - state.updatedAt > SWARM_RECORD_MAX_AGE_MS ? [key] : [];
    });
    if (expired.length === 0) return 0;
    await chrome.storage.local.remove(expired);
    const expiredIds = new Set(expired.map((key) => key.slice(STORAGE_KEYS.SWARM_PREFIX.length)));
    const active = await listActiveSwarmIds();
    await chrome.storage.local.set({
      [STORAGE_KEYS.ACTIVE_SWARMS]: active.filter((id) => !expiredIds.has(id)),
    });
    return expired.length;
  });
}
