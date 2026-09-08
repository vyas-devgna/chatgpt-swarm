import {
  loadActiveSwarms,
  loadSwarm,
  markSwarmInactive,
  pruneOldSwarms,
  saveSwarm,
  withSwarmLock,
} from '../background/persistence.js';
import { CHATGPT_BASE_URL, SCHEMA_VERSION, TAB_GROUP_COLOR } from '../shared/constants.js';
import { createLogger } from '../shared/logger.js';
import {
  extractConversationId,
  extractProjectId,
  generateId,
  isChatGPTUrl,
  simpleHash,
  truncate,
} from '../shared/utils.js';
import { transitionWorker } from '../orchestrator/lifecycle.js';
import { buildSynthesisPrompt, buildWorkerPrompt } from '../orchestrator/prompts.js';
import { validateRuntimeMessage, type RuntimeMessageOutput } from '../swarm/schema.js';
import type { RuntimeResponse, SwarmState, WorkerRecord } from '../swarm/types.js';

const log = createLogger('service-worker');

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.storage.local.set({
      preferences: { maxWorkers: 4, autoModel: true, diagnosticsEnabled: false },
    });
    void pruneOldSwarms();
  });

  chrome.runtime.onMessage.addListener((input, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    const message = validateRuntimeMessage(input);
    if (!message) {
      sendResponse({ ok: false, error: 'Invalid message' } satisfies RuntimeResponse);
      return false;
    }
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error: unknown) => {
        log.error('Message handler failed', error);
        sendResponse({ ok: false, error: 'Swarm operation failed' } satisfies RuntimeResponse);
      });
    return true;
  });

  chrome.tabs.onRemoved.addListener((tabId) => void handleTabClosed(tabId));
});

async function handleMessage(
  message: RuntimeMessageOutput,
  sender: chrome.runtime.MessageSender,
): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'PING':
      return { ok: true };
    case 'PAGE_READY':
      return pageReady(sender.tab?.id, sender.tab?.url, message.payload.url);
    case 'START_SWARM':
      return startSwarm(message.payload, sender.tab);
    case 'WORKER_RUNNING':
      return withSwarmLock(message.payload.swarmId, () =>
        updateWorkerRunning(message.payload, sender.tab),
      );
    case 'WORKER_RESULT':
      return withSwarmLock(message.payload.swarmId, () =>
        completeWorker(message.payload, sender.tab),
      );
    case 'SWARM_COMMAND':
      return withSwarmLock(message.payload.swarmId, () => runCommand(message.payload, sender.tab));
    case 'RUN_WORKER':
    case 'STOP_WORKER':
    case 'SYNTHESIZE':
      return { ok: false, error: 'Invalid message direction' };
  }
}

async function startSwarm(
  payload: Extract<RuntimeMessageOutput, { type: 'START_SWARM' }>['payload'],
  senderTab: chrome.tabs.Tab | undefined,
): Promise<RuntimeResponse> {
  await pruneOldSwarms();
  if (
    senderTab?.id === undefined ||
    !senderTab.url ||
    senderTab.url !== payload.captainUrl ||
    !isChatGPTUrl(senderTab.url) ||
    extractProjectId(senderTab.url) !== payload.projectId
  ) {
    return { ok: false, error: 'Captain tab identity could not be verified.' };
  }
  if (payload.plan.workers.length === 0) {
    return { ok: false, error: 'Captain determined that no workers are useful.' };
  }
  const now = Date.now();
  const state: SwarmState = {
    swarmId: generateId(),
    projectId: payload.projectId,
    captainConversationUrl: payload.captainUrl,
    captainTabId: senderTab.id,
    workers: payload.plan.workers.map((worker): WorkerRecord => {
      const agentId = generateId();
      return {
        agent: {
          id: agentId,
          displayName: worker.name,
          role: worker.role,
          objective: payload.plan.objective,
          persona: worker.persona ?? 'Be concise, evidence-first, and explicit about uncertainty.',
          modelPolicy: { type: worker.modelPolicy ?? 'auto' },
          task: worker.task,
          status: 'PLANNED',
          conversationId: null,
          conversationUrl: null,
          projectId: payload.projectId,
        },
        tabId: null,
        taskHash: simpleHash(worker.task),
        submissionId: generateId(),
        submittedAt: null,
        report: null,
        wave: 1,
        actualModel: 'Auto',
        requestedModel: worker.modelPolicy ?? 'auto',
      };
    }),
    status: 'DELEGATING',
    objective: payload.plan.objective,
    delegationPlan: payload.plan,
    memory: {
      objective: payload.plan.objective,
      findings: [],
      decisions: [],
      unresolvedQuestions: [],
      workerReports: [],
    },
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await saveSwarm(state);

  const workerUrl = getProjectHomeUrl(payload.projectId);
  const tabIds: number[] = [];
  for (const worker of state.workers) {
    try {
      tabIds.push(await createWorkerTab(state, worker, workerUrl));
    } catch (error) {
      log.warn('Worker tab creation failed', { error: String(error) });
      if (worker.tabId !== null) await chrome.tabs.remove(worker.tabId).catch(() => undefined);
      worker.tabId = null;
      worker.agent.status = 'FAILED';
      await saveSwarm(state);
    }
  }

  if (tabIds.length === 0) {
    state.status = 'FAILED';
    await saveSwarm(state);
    await markSwarmInactive(state.swarmId);
    return { ok: false, error: 'No worker tabs could be created.', swarm: state };
  }
  try {
    await groupWorkerTabs(tabIds, state.objective);
  } catch (error) {
    log.warn('Tab grouping unavailable', { error: String(error) });
  }
  state.status = 'RUNNING';
  await saveSwarm(state);
  return { ok: true, swarm: state };
}

async function createWorkerTab(
  state: SwarmState,
  worker: WorkerRecord,
  workerUrl: string,
): Promise<number> {
  worker.agent.status = transitionWorker(worker.agent.status, 'CREATING');
  await saveSwarm(state);
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
  if (tab.id === undefined) throw new Error('Browser did not return a worker tab ID');
  worker.tabId = tab.id;
  worker.agent.status = transitionWorker(worker.agent.status, 'READY');
  await saveSwarm(state);
  await chrome.tabs.update(tab.id, { url: workerUrl, autoDiscardable: false });
  return tab.id;
}

async function groupWorkerTabs(tabIds: number[], objective: string): Promise<void> {
  const [first, ...rest] = tabIds;
  if (first === undefined) return;
  const groupId = await new Promise<number>((resolve, reject) => {
    chrome.tabs.group({ tabIds: [first, ...rest] }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });
  await new Promise<void>((resolve, reject) => {
    chrome.tabGroups.update(
      groupId,
      {
        title: `Swarm — ${truncate(objective, 32)}`,
        color: TAB_GROUP_COLOR,
        collapsed: true,
      },
      () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      },
    );
  });
}

function getProjectHomeUrl(projectId: string): string {
  try {
    const url = new URL(CHATGPT_BASE_URL);
    url.pathname = `/g/${encodeURIComponent(projectId)}/project`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return `${CHATGPT_BASE_URL}/g/${encodeURIComponent(projectId)}/project`;
  }
}

async function pageReady(
  tabId: number | undefined,
  senderUrl: string | undefined,
  reportedUrl: string,
): Promise<RuntimeResponse> {
  if (tabId === undefined || !senderUrl || senderUrl !== reportedUrl || !isChatGPTUrl(senderUrl))
    return { ok: false, error: 'Page identity could not be verified.' };
  for (const candidate of await loadActiveSwarms()) {
    const response = await withSwarmLock(
      candidate.swarmId,
      async (): Promise<RuntimeResponse | null> => {
        const swarm = await loadSwarm(candidate.swarmId);
        if (!swarm) return null;
        if (extractProjectId(senderUrl) !== swarm.projectId) return null;
        if (swarm.captainConversationUrl === senderUrl) {
          swarm.captainTabId = tabId;
          await saveSwarm(swarm);
          return { ok: true, swarm };
        }
        const worker = swarm.workers.find(
          (entry) =>
            (entry.agent.conversationUrl === null && entry.tabId === tabId) ||
            entry.agent.conversationUrl === senderUrl,
        );
        if (!worker) return null;
        worker.tabId = tabId;
        if (['READY', 'CREATING'].includes(worker.agent.status)) {
          if (worker.agent.status === 'CREATING')
            worker.agent.status = transitionWorker(worker.agent.status, 'READY');
          worker.agent.status = transitionWorker(worker.agent.status, 'RUNNING');
          worker.submittedAt = Date.now();
          await saveSwarm(swarm);
          return {
            ok: true,
            assignment: {
              swarmId: swarm.swarmId,
              agentId: worker.agent.id,
              prompt: buildWorkerPrompt(worker),
            },
          };
        }
        if (['RUNNING', 'WAITING'].includes(worker.agent.status)) {
          await saveSwarm(swarm);
          return {
            ok: true,
            assignment: { swarmId: swarm.swarmId, agentId: worker.agent.id, prompt: '' },
          };
        }
        return { ok: true };
      },
    );
    if (response) return response;
  }
  return { ok: true };
}

async function updateWorkerRunning(
  payload: Extract<RuntimeMessageOutput, { type: 'WORKER_RUNNING' }>['payload'],
  senderTab: chrome.tabs.Tab | undefined,
): Promise<RuntimeResponse> {
  const state = await loadSwarm(payload.swarmId);
  const worker = state?.workers.find((candidate) => candidate.agent.id === payload.agentId);
  if (!state || !worker) return { ok: false, error: 'Worker not found' };
  if (
    senderTab?.id === undefined ||
    worker.tabId !== senderTab.id ||
    senderTab.url !== payload.url ||
    !isChatGPTUrl(payload.url) ||
    extractProjectId(payload.url) !== state.projectId
  )
    return { ok: false, error: 'Worker tab identity could not be verified.' };
  if (worker.agent.status !== 'RUNNING')
    worker.agent.status = transitionWorker(worker.agent.status, 'RUNNING');
  worker.submittedAt ??= Date.now();
  worker.agent.conversationUrl = payload.url;
  worker.agent.conversationId = extractConversationId(payload.url);
  await saveSwarm(state);
  return { ok: true, swarm: state };
}

async function completeWorker(
  payload: Extract<RuntimeMessageOutput, { type: 'WORKER_RESULT' }>['payload'],
  senderTab: chrome.tabs.Tab | undefined,
): Promise<RuntimeResponse> {
  const state = await loadSwarm(payload.swarmId);
  const worker = state?.workers.find((candidate) => candidate.agent.id === payload.agentId);
  if (!state || !worker) return { ok: false, error: 'Worker not found' };
  if (
    senderTab?.id === undefined ||
    worker.tabId !== senderTab.id ||
    !senderTab.url ||
    !isChatGPTUrl(senderTab.url) ||
    extractProjectId(senderTab.url) !== state.projectId ||
    (worker.agent.conversationUrl !== null && worker.agent.conversationUrl !== senderTab.url)
  )
    return { ok: false, error: 'Worker tab identity could not be verified.' };
  if (['COMPLETE', 'STOPPED'].includes(state.status)) return { ok: true, swarm: state };
  if (worker.agent.status === 'COMPLETE') return { ok: true, swarm: state };
  worker.report = payload.report;
  worker.agent.status = transitionWorker(worker.agent.status, 'COMPLETE');
  state.memory.workerReports.push({
    agentId: worker.agent.id,
    agentName: worker.agent.displayName,
    role: worker.agent.role,
    resultSummary: truncate(payload.report.result, 500),
    hasRisks: payload.report.risks.trim().length > 0,
    hasOpenQuestions: payload.report.openQuestions.trim().length > 0,
    capturedAt: payload.report.capturedAt,
  });
  if (worker.tabId !== null) await chrome.tabs.update(worker.tabId, { autoDiscardable: true });
  await saveSwarm(state);
  if (state.workers.every((candidate) => candidate.agent.status === 'COMPLETE'))
    await synthesize(state);
  return { ok: true, swarm: state };
}

async function synthesize(state: SwarmState): Promise<void> {
  const completed = state.workers.filter((worker) => worker.report !== null);
  if (completed.length === 0) throw new Error('No completed reports are available');
  state.status = 'SYNTHESIZING';
  await saveSwarm(state);
  let captainTabId: number | null = null;
  try {
    captainTabId = await findCaptainTab(state);
    if (captainTabId === null) throw new Error('Captain tab is unavailable');
    const response: RuntimeResponse | undefined = await chrome.tabs.sendMessage(captainTabId, {
      type: 'SYNTHESIZE',
      payload: { swarmId: state.swarmId, prompt: buildSynthesisPrompt(state.objective, completed) },
    } satisfies RuntimeMessageOutput);
    if (!response?.ok) throw new Error(response?.error ?? 'Captain rejected synthesis');
  } catch (error) {
    state.status = 'RUNNING';
    await saveSwarm(state);
    throw error;
  }
  state.captainTabId = captainTabId;
  state.status = 'COMPLETE';
  for (const worker of state.workers) {
    if (worker.report) worker.report.rawResponse = '';
  }
  await saveSwarm(state);
  await markSwarmInactive(state.swarmId);
}

async function findCaptainTab(state: SwarmState): Promise<number | null> {
  if (state.captainTabId !== null) {
    try {
      const tab = await chrome.tabs.get(state.captainTabId);
      if (tab.url === state.captainConversationUrl) return state.captainTabId;
    } catch {
      /* Fall through to URL recovery. */
    }
  }
  const tabs = await chrome.tabs.query({ url: `${CHATGPT_BASE_URL}/*` });
  return tabs.find((tab) => tab.url === state.captainConversationUrl)?.id ?? null;
}

async function runCommand(
  payload: Extract<RuntimeMessageOutput, { type: 'SWARM_COMMAND' }>['payload'],
  senderTab: chrome.tabs.Tab | undefined,
): Promise<RuntimeResponse> {
  const state = await loadSwarm(payload.swarmId);
  if (!state) return { ok: false, error: 'Swarm not found' };
  if (
    senderTab?.id === undefined ||
    state.captainTabId !== senderTab.id ||
    state.captainConversationUrl !== senderTab.url
  ) {
    return { ok: false, error: 'Captain tab identity could not be verified.' };
  }
  if (payload.command === 'MERGE_NOW') {
    await stopWorkerTabs(state);
    for (const worker of state.workers) {
      if (worker.agent.status !== 'COMPLETE') worker.agent.status = 'STOPPED';
    }
    await saveSwarm(state);
    await synthesize(state);
    return { ok: true, swarm: state };
  }
  if (payload.command === 'RETRY') {
    const worker = state.workers.find((candidate) => candidate.agent.id === payload.agentId);
    if (!worker || worker.agent.status !== 'FAILED' || !state.projectId) {
      return { ok: false, error: 'Only a failed worker can be retried.' };
    }
    worker.submissionId = generateId();
    worker.submittedAt = null;
    worker.report = null;
    worker.agent.conversationId = null;
    worker.agent.conversationUrl = null;
    state.status = 'RUNNING';
    await createWorkerTab(state, worker, getProjectHomeUrl(state.projectId));
    return { ok: true, swarm: state };
  }
  state.status =
    payload.command === 'STOP' ? 'STOPPED' : payload.command === 'PAUSE' ? 'PAUSED' : 'RUNNING';
  if (payload.command === 'STOP') await stopWorkerTabs(state);
  for (const worker of state.workers) {
    if (
      payload.command === 'STOP' &&
      !['COMPLETE', 'FAILED', 'STOPPED'].includes(worker.agent.status)
    )
      worker.agent.status = 'STOPPED';
    else if (payload.command === 'PAUSE' && ['RUNNING', 'WAITING'].includes(worker.agent.status))
      worker.agent.status = 'PAUSED';
    else if (payload.command === 'RESUME' && worker.agent.status === 'PAUSED')
      worker.agent.status = 'RUNNING';
  }
  await saveSwarm(state);
  if (payload.command === 'STOP') await markSwarmInactive(state.swarmId);
  return { ok: true, swarm: state };
}

async function stopWorkerTabs(state: SwarmState): Promise<void> {
  await Promise.allSettled(
    state.workers.flatMap((worker) => {
      if (worker.tabId === null || ['COMPLETE', 'FAILED', 'STOPPED'].includes(worker.agent.status))
        return [];
      return [
        chrome.tabs.sendMessage(worker.tabId, {
          type: 'STOP_WORKER',
          payload: { swarmId: state.swarmId, agentId: worker.agent.id },
        } satisfies RuntimeMessageOutput),
        chrome.tabs.update(worker.tabId, { autoDiscardable: true }),
      ];
    }),
  );
}

async function handleTabClosed(tabId: number): Promise<void> {
  for (const candidate of await loadActiveSwarms()) {
    await withSwarmLock(candidate.swarmId, async () => {
      const state = await loadSwarm(candidate.swarmId);
      const worker = state?.workers.find((entry) => entry.tabId === tabId);
      if (!state || !worker || ['COMPLETE', 'STOPPED', 'FAILED'].includes(worker.agent.status))
        return;
      worker.agent.status = 'FAILED';
      worker.tabId = null;
      await saveSwarm(state);
    });
  }
}
