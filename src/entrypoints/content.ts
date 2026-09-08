import {
  getCapabilities,
  getComposerText,
  getGenerationState,
  getLastAssistantMessage,
  locateComposer,
  locateComposerMount,
  locateSidebarAnchor,
  sendMessage,
  stopGeneration,
} from '../adapter/chatgpt/adapter.js';
import { MAX_DELEGATION_REPAIR_ATTEMPTS, MUTATION_DEBOUNCE_MS } from '../shared/constants.js';
import { createLogger } from '../shared/logger.js';
import { debounce, extractProjectId, isChatGPTUrl } from '../shared/utils.js';
import { parseWorkerReport } from '../swarm/report.js';
import {
  parseDelegationResponse,
  validateRuntimeMessage,
  validateSwarmState,
} from '../swarm/schema.js';
import type {
  DelegationPlan,
  RuntimeMessage,
  RuntimeResponse,
  SwarmState,
} from '../swarm/types.js';

const log = createLogger('content-script');
const HOST_ID = 'chatgpt-swarm-root';
const SIDEBAR_HOST_ID = 'chatgpt-swarm-sidebar-root';
const GUIDE_HOST_ID = 'chatgpt-swarm-guide-root';

interface PlanningRun {
  objective: string;
  baseline: string | null;
  repairAttempts: number;
}

interface WorkerRun {
  swarmId: string;
  agentId: string;
  baseline: string | null;
}

let planning: PlanningRun | null = null;
let workerRun: WorkerRun | null = null;
let currentSwarm: SwarmState | null = null;
let statusText = 'Type a task in the ChatGPT composer, then choose Run swarm.';
let lastUrl = '';
let syncingWorkerUrl = false;

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    if (!isChatGPTUrl(location.href)) return;
    lastUrl = location.href;
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    chrome.storage.onChanged.addListener(handleStorageChange);
    observeMounts();
    void initialize().catch((error: unknown) => log.error('Initialization failed', error));
  },
});

async function initialize(): Promise<void> {
  const response = await runtimeMessage({ type: 'PAGE_READY', payload: { url: location.href } });
  if (response.assignment) {
    await startWorker(response.assignment);
    return;
  }
  currentSwarm = response.swarm ?? null;
  mountCaptainUi();
  observePage();
}

function handleBackgroundMessage(
  input: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: RuntimeResponse) => void,
): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  const message = validateRuntimeMessage(input);
  if (!message) return false;
  if (
    message.type === 'STOP_WORKER' &&
    workerRun?.swarmId === message.payload.swarmId &&
    workerRun.agentId === message.payload.agentId
  ) {
    const stopped = stopGeneration();
    workerRun = null;
    sendResponse({ ok: stopped });
    return false;
  }
  if (message.type !== 'SYNTHESIZE') return false;
  if (currentSwarm?.swarmId !== message.payload.swarmId) return false;
  waitForCapabilities()
    .then(() => sendMessage(message.payload.prompt))
    .then((sent) => sendResponse({ ok: sent, error: sent ? undefined : 'Composer unavailable' }))
    .catch(() => sendResponse({ ok: false, error: 'Composer unavailable' }));
  return true;
}

async function startWorker(assignment: NonNullable<RuntimeResponse['assignment']>): Promise<void> {
  setStatus('Preparing worker…');
  await waitForCapabilities();
  const baseline = getLastAssistantMessage();
  if (assignment.prompt && !(await sendMessage(assignment.prompt)))
    throw new Error('Worker composer is unavailable');
  workerRun = {
    swarmId: assignment.swarmId,
    agentId: assignment.agentId,
    baseline,
  };
  if (!(await reportWorkerUrl())) throw new Error('Worker tab identity could not be verified');
  observePage();
  if (!assignment.prompt && baseline && getGenerationState() !== 'streaming')
    await finishWorker(baseline);
}

function observePage(): void {
  const process = debounce(processConversation, MUTATION_DEBOUNCE_MS);
  new MutationObserver(process).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function processConversation(): void {
  if (workerRun && lastUrl !== location.href) {
    if (syncingWorkerUrl) return;
    syncingWorkerUrl = true;
    void reportWorkerUrl().finally(() => {
      syncingWorkerUrl = false;
      processConversation();
    });
    return;
  }
  const state = getGenerationState();
  if (state === 'streaming') return;
  const response = getLastAssistantMessage();
  if (planning && response && response !== planning.baseline) void finishPlanning(response);
  if (workerRun && response && response !== workerRun.baseline) void finishWorker(response);
  mountCaptainUi();
}

async function reportWorkerUrl(): Promise<boolean> {
  const run = workerRun;
  if (!run) return false;
  const url = location.href;
  const response = await runtimeMessage({
    type: 'WORKER_RUNNING',
    payload: { swarmId: run.swarmId, agentId: run.agentId, url },
  });
  if (response.ok) lastUrl = url;
  return response.ok;
}

async function finishPlanning(response: string): Promise<void> {
  const run = planning;
  if (!run) return;
  planning = null;
  const parsed = parseDelegationResponse(response);
  if (!parsed.success || !parsed.plan) {
    if (run.repairAttempts < MAX_DELEGATION_REPAIR_ATTEMPTS) {
      const repairPrompt = `Your swarm plan was invalid (${parsed.error ?? 'unknown error'}). Return only one valid JSON object using the requested schema.`;
      const baseline = getLastAssistantMessage();
      if (await sendMessage(repairPrompt)) {
        planning = {
          ...run,
          baseline,
          repairAttempts: run.repairAttempts + 1,
        };
        setStatus('Captain is repairing the plan…');
        return;
      }
    }
    setStatus('The Captain could not produce a safe plan. Nothing was started.');
    return;
  }

  if (parsed.plan.workers.length === 0) {
    const sent = await sendMessage(
      `No workers are needed. Answer the original objective directly now:\n\n${run.objective}`,
    );
    setStatus(sent ? 'Captain is answering directly…' : 'Unable to return the task to Captain.');
    return;
  }

  const projectId = extractProjectId(location.href);
  if (!projectId) {
    setStatus('Open a conversation inside a ChatGPT Project to start a swarm.');
    return;
  }
  const plan: DelegationPlan = {
    swarmVersion: 1,
    objective: run.objective,
    workers: parsed.plan.workers.map((worker) => ({
      name: worker.name,
      role: worker.role,
      task: worker.task,
      persona: worker.persona,
      modelPolicy: worker.model_policy,
    })),
    reviewAfter: parsed.plan.review_after ?? false,
  };
  const result = await runtimeMessage({
    type: 'START_SWARM',
    payload: { captainUrl: location.href, projectId, plan },
  });
  if (!result.ok) {
    setStatus(result.error ?? 'Unable to start swarm.');
    return;
  }
  currentSwarm = result.swarm ?? null;
  setStatus(`Running ${plan.workers.length} worker${plan.workers.length === 1 ? '' : 's'}…`);
  renderUi();
}

async function finishWorker(response: string): Promise<void> {
  const run = workerRun;
  if (!run) return;
  workerRun = null;
  const result = await runtimeMessage({
    type: 'WORKER_RESULT',
    payload: { swarmId: run.swarmId, agentId: run.agentId, report: parseWorkerReport(response) },
  });
  if (!result.ok) {
    workerRun = run;
    log.warn('Worker report was not accepted', { error: result.error });
  }
}

async function beginPlanning(): Promise<void> {
  if (
    planning ||
    (currentSwarm && !['COMPLETE', 'FAILED', 'STOPPED'].includes(currentSwarm.status))
  )
    return;
  const objective = getComposerText();
  if (!objective) {
    setStatus('Write a task first, then choose Swarm.');
    return;
  }
  if (!extractProjectId(location.href)) {
    setStatus('Swarm is available only inside a ChatGPT Project conversation.');
    return;
  }
  const capabilities = getCapabilities();
  if (!capabilities.ready) {
    setStatus('ChatGPT appears to have changed. Swarm cannot safely start.');
    return;
  }
  const baseline = getLastAssistantMessage();
  const prompt = buildPlanningPrompt(objective);
  planning = { objective, baseline, repairAttempts: 0 };
  currentSwarm = null;
  setStatus('Captain is planning the swarm…');
  if (!(await sendMessage(prompt))) {
    planning = null;
    setStatus('ChatGPT appears to have changed. Swarm cannot safely start.');
    return;
  }
}

function buildPlanningPrompt(objective: string): string {
  return [
    'Plan a focused multi-agent swarm for the objective below. Use 0 to 4 non-overlapping workers; use 0 when delegation adds no value.',
    'Return ONLY valid JSON with this exact shape:',
    '{"swarm_version":1,"objective":"...","workers":[{"name":"...","role":"...","task":"...","persona":"...","model_policy":"auto"}],"review_after":false}',
    'Allowed model_policy values: auto, fast, deep, code, research.',
    `Objective: ${objective}`,
  ].join('\n\n');
}

function mountCaptainUi(): void {
  const capabilities = getCapabilities();
  if (capabilities.surface.value !== 'chat' || !extractProjectId(location.href)) {
    document.getElementById(HOST_ID)?.remove();
    return;
  }
  if (document.getElementById(HOST_ID)) return;
  const composerContainer = locateComposerMount();
  if (!composerContainer?.parentElement) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.attachShadow({ mode: 'open' });
  composerContainer.before(host);
  renderUi();
}

function observeMounts(): void {
  const reconcile = debounce(() => {
    mountSidebarUi();
    mountCaptainUi();
  }, MUTATION_DEBOUNCE_MS);
  new MutationObserver(reconcile).observe(document.body, { childList: true, subtree: true });
  mountSidebarUi();
}

function mountSidebarUi(): void {
  const capabilities = getCapabilities();
  const projectId = extractProjectId(location.href);
  if (
    capabilities.surface.value === 'work' ||
    (projectId && capabilities.surface.value !== 'chat')
  ) {
    document.getElementById(SIDEBAR_HOST_ID)?.remove();
    document.getElementById(GUIDE_HOST_ID)?.remove();
    return;
  }
  if (document.getElementById(SIDEBAR_HOST_ID)) return;
  const anchor = locateSidebarAnchor();
  if (!anchor?.parentElement) return;
  const host = document.createElement('div');
  host.id = SIDEBAR_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{display:block;font:inherit;color:inherit}button{box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;min-height:36px;border:0;border-radius:8px;padding:8px 10px;text-align:left;line-height:20px;background:transparent;color:inherit;font:inherit;cursor:pointer}svg{width:20px;height:20px;flex:none}button:hover,button:focus-visible{background:color-mix(in srgb,currentColor 9%,transparent);outline:none}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open ChatGPT Swarm');
  button.append(createSwarmIcon(), 'Swarm');
  button.addEventListener('click', openSwarmGuide);
  shadow.append(style, button);
  anchor.parentElement.insertBefore(host, anchor);
}

function createSwarmIcon(): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<circle cx="12" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m10.5 9.6-3 4.8m6-4.8 3 4.8M9 17h6"/>';
  return icon;
}

function openSwarmGuide(): void {
  document.getElementById(GUIDE_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = GUIDE_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `dialog{box-sizing:border-box;width:min(420px,calc(100vw - 32px));border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:16px;padding:22px;background:Canvas;color:CanvasText;font:14px/1.45 system-ui,sans-serif;box-shadow:0 18px 60px #0005}dialog::backdrop{background:#0006}h2{margin:0 0 8px;font-size:18px}p{margin:0 0 18px;color:color-mix(in srgb,currentColor 72%,transparent)}.actions{display:flex;justify-content:flex-end;gap:8px}button,a{box-sizing:border-box;border:0;border-radius:9px;padding:9px 13px;font:inherit;cursor:pointer;text-decoration:none}.secondary{background:transparent;color:inherit}.primary{background:CanvasText;color:Canvas}`;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'swarm-guide-title');
  const title = document.createElement('h2');
  title.id = 'swarm-guide-title';
  title.textContent = 'Start a swarm';
  const eligible =
    getCapabilities().surface.value === 'chat' && Boolean(extractProjectId(location.href));
  const description = document.createElement('p');
  description.textContent = eligible
    ? 'Type your task in the ChatGPT composer. Then choose Run swarm above it to plan and start the workers.'
    : 'Swarm runs inside Project Chat. Open or create a Project, keep Chat selected, then type the task you want the agents to handle.';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'secondary';
  close.textContent = 'Close';
  close.addEventListener('click', () => dialog.close());
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'primary';
  primary.textContent = eligible ? 'Focus task box' : 'Browse projects';
  primary.addEventListener('click', () => {
    dialog.close();
    if (!eligible) {
      if (location.pathname !== '/projects') location.assign('/projects');
      return;
    }
    mountCaptainUi();
    setStatus('Type your task in the composer, then choose Run swarm.');
    locateComposer().value?.focus();
    document.getElementById(HOST_ID)?.scrollIntoView({ block: 'nearest' });
  });
  actions.append(close, primary);
  dialog.append(title, description, actions);
  shadow.append(style, dialog);
  document.body.append(host);
  dialog.addEventListener('close', () => host.remove(), { once: true });
  dialog.showModal();
}

function renderUi(): void {
  const shadow = document.getElementById(HOST_ID)?.shadowRoot;
  if (!shadow) return;
  shadow.replaceChildren();
  const style = document.createElement('style');
  style.textContent = `
    :host { display:block; font:inherit; color:inherit; margin:0 auto 8px; max-width:48rem; }
    .bar { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius:14px; background:color-mix(in srgb, Canvas 92%, transparent); }
    button { font:inherit; color:inherit; background:transparent; border:0; border-radius:8px; padding:6px 9px; cursor:pointer; }
    button:hover, button:focus-visible { background:color-mix(in srgb, currentColor 10%, transparent); outline:none; }
    button:disabled { opacity:.5; cursor:default; }
    .status { flex:1; color:color-mix(in srgb, currentColor 70%, transparent); font-size:.875rem; }
    .workers { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:6px 0 0; }
    .worker { border:1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius:10px; padding:7px 9px; font-size:.8125rem; }
    @media (max-width:650px) { .workers { grid-template-columns:1fr; max-height:9rem; overflow:auto; } }
    @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto !important; } }
  `;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Run swarm';
  button.setAttribute('aria-label', 'Plan this task with Swarm');
  button.disabled = planning !== null || currentSwarm?.status === 'RUNNING';
  button.addEventListener('click', () => void beginPlanning());
  const status = document.createElement('div');
  status.className = 'status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = statusText;
  bar.append(button, status);
  if (currentSwarm && ['RUNNING', 'DELEGATING'].includes(currentSwarm.status)) {
    const merge = document.createElement('button');
    merge.type = 'button';
    merge.textContent = 'Merge now';
    merge.disabled = currentSwarm.workers.every((worker) => worker.report === null);
    merge.addEventListener('click', () => void commandCurrentSwarm('MERGE_NOW'));
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'Stop';
    stop.addEventListener('click', () => void commandCurrentSwarm('STOP'));
    bar.append(merge, stop);
  }
  shadow.append(style, bar);
  if (currentSwarm) renderWorkers(shadow, currentSwarm);
}

function renderWorkers(shadow: ShadowRoot, swarm: SwarmState): void {
  const list = document.createElement('div');
  list.className = 'workers';
  for (const worker of swarm.workers) {
    const card = document.createElement('div');
    card.className = 'worker';
    const label = document.createElement('span');
    const model =
      worker.requestedModel && worker.requestedModel !== 'auto'
        ? `${worker.actualModel ?? 'Auto'} fallback from ${worker.requestedModel}`
        : (worker.actualModel ?? 'Auto');
    label.textContent = `${worker.agent.displayName} — ${worker.agent.role} · ${worker.agent.status} · ${model}`;
    card.append(label);
    if (worker.agent.conversationUrl && isChatGPTUrl(worker.agent.conversationUrl)) {
      const open = document.createElement('a');
      open.href = worker.agent.conversationUrl;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Open chat';
      open.setAttribute('aria-label', `Open ${worker.agent.displayName} chat`);
      card.append(' · ', open);
    }
    if (worker.agent.status === 'FAILED') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.setAttribute('aria-label', `Retry ${worker.agent.displayName}`);
      retry.addEventListener('click', () => void commandCurrentSwarm('RETRY', worker.agent.id));
      card.append(' · ', retry);
    }
    list.append(card);
  }
  shadow.append(list);
}

async function commandCurrentSwarm(
  command: 'STOP' | 'MERGE_NOW' | 'RETRY',
  agentId?: string,
): Promise<void> {
  if (!currentSwarm) return;
  const result = await runtimeMessage({
    type: 'SWARM_COMMAND',
    payload: { command, swarmId: currentSwarm.swarmId, agentId },
  });
  if (!result.ok) setStatus(result.error ?? 'Swarm command failed.');
  else if (result.swarm) {
    currentSwarm = result.swarm;
    setStatus(
      command === 'STOP'
        ? 'Swarm stopped. Worker chats remain available.'
        : command === 'RETRY'
          ? 'Retrying failed worker…'
          : 'Available reports sent to Captain.',
    );
  }
}

function setStatus(text: string): void {
  statusText = text;
  renderUi();
}

function handleStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
): void {
  if (area !== 'local' || !currentSwarm) return;
  const change = changes[`swarm:${currentSwarm.swarmId}`];
  if (!change || !isSwarmState(change.newValue)) return;
  currentSwarm = change.newValue;
  setStatus(
    currentSwarm.status === 'COMPLETE'
      ? 'Worker reports sent to Captain.'
      : `Swarm ${currentSwarm.status.toLowerCase()}…`,
  );
}

function isSwarmState(value: unknown): value is SwarmState {
  return validateSwarmState(value) !== null;
}

async function waitForCapabilities(timeoutMs = 30_000): Promise<void> {
  const current = getCapabilities();
  if (current.surface.value === 'work') throw new Error('Swarm does not run in Work mode');
  if (current.canCompose) return;
  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const capabilities = getCapabilities();
      if (capabilities.surface.value === 'work') {
        clearTimeout(timeout);
        observer.disconnect();
        reject(new Error('Swarm does not run in Work mode'));
        return;
      }
      if (!capabilities.canCompose) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('ChatGPT composer unavailable'));
    }, timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function runtimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: RuntimeResponse | undefined) => {
      if (chrome.runtime.lastError) {
        log.warn('Background message failed', { error: chrome.runtime.lastError.message });
        resolve({ ok: false, error: 'Extension background is unavailable' });
        return;
      }
      resolve(response ?? { ok: false, error: 'No response from extension background' });
    });
  });
}
