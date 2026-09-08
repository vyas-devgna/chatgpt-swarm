import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SwarmState } from '../swarm/types.js';
import {
  listActiveSwarmIds,
  loadSwarm,
  markSwarmInactive,
  pruneOldSwarms,
  saveSwarm,
  withSwarmLock,
} from './persistence.js';

const values: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string | null) =>
          key === null ? { ...values } : { [key]: values[key] },
        ),
        set: vi.fn(async (entries: Record<string, unknown>) => Object.assign(values, entries)),
        remove: vi.fn(async (keys: string[]) => keys.forEach((key) => delete values[key])),
      },
    },
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: vi.fn(async (_name: string, action: () => Promise<unknown>) => action()) },
  });
});

function state(): SwarmState {
  return {
    swarmId: 'swarm-1',
    projectId: 'g-p-project',
    captainConversationUrl: 'https://chatgpt.com/g/g-p-project/c/captain',
    captainTabId: 1,
    workers: [],
    status: 'RUNNING',
    objective: 'Test',
    delegationPlan: null,
    memory: {
      objective: 'Test',
      findings: [],
      decisions: [],
      unresolvedQuestions: [],
      workerReports: [],
    },
    schemaVersion: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('swarm persistence', () => {
  it('stores, loads, indexes, and deactivates a swarm', async () => {
    await saveSwarm(state());
    expect((await loadSwarm('swarm-1'))?.objective).toBe('Test');
    expect(await listActiveSwarmIds()).toEqual(['swarm-1']);
    await markSwarmInactive('swarm-1');
    expect(await listActiveSwarmIds()).toEqual([]);
  });

  it('uses a per-swarm Web Lock for state mutations', async () => {
    await withSwarmLock('swarm-1', async () => 'done');
    expect(navigator.locks.request).toHaveBeenCalledWith(
      'chatgpt-swarm:swarm-1',
      expect.any(Function),
    );
  });

  it('rejects malformed stored state', async () => {
    values['swarm:swarm-1'] = { swarmId: 'swarm-1', workers: 'invalid', schemaVersion: 1 };
    await expect(loadSwarm('swarm-1')).resolves.toBeNull();
  });

  it('prunes expired swarm records and their active index entries', async () => {
    const expired = state();
    expired.updatedAt = 1;
    values['swarm:swarm-1'] = expired;
    values.activeSwarms = ['swarm-1'];
    await expect(pruneOldSwarms(40 * 24 * 60 * 60 * 1_000)).resolves.toBe(1);
    expect(values['swarm:swarm-1']).toBeUndefined();
    expect(values.activeSwarms).toEqual([]);
  });
});
