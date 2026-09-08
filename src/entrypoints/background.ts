/**
 * Background service worker entry point.
 *
 * CRITICAL: This service worker is STATELESS. It may be terminated at any time
 * by the browser and must rehydrate all state from chrome.storage on wakeup.
 *
 * All event listeners are registered synchronously at the top level.
 */

import { createLogger } from '../shared/logger.js';

const log = createLogger('service-worker');

export default defineBackground(() => {
  log.info('Service worker started');

  // ─── Event Listeners (synchronous registration) ─────────────────────

  /**
   * Extension installed or updated.
   */
  chrome.runtime.onInstalled.addListener((details) => {
    log.info(`Extension ${details.reason}`, { version: chrome.runtime.getManifest().version });

    if (details.reason === 'install') {
      // First install — initialize default preferences
      chrome.storage.local.set({
        preferences: {
          maxWorkers: 4,
          autoModel: true,
          diagnosticsEnabled: false,
        },
      });
    }
  });

  /**
   * Message handler for all cross-context communication.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // SECURITY: Verify sender is our extension
    if (sender.id !== chrome.runtime.id) {
      log.warn('Rejected message from unknown sender', { senderId: sender.id });
      return false;
    }

    handleMessage(message, sender)
      .then((response) => sendResponse(response))
      .catch((error) => {
        log.error('Message handler error', error);
        sendResponse({ error: 'Internal error' });
      });

    // Return true to indicate async response
    return true;
  });

  /**
   * Tab close handler — detect worker tab closures.
   */
  chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
    handleTabClosed(tabId).catch((error) => {
      log.error('Tab close handler error', error);
    });
  });

  /**
   * Tab update handler — detect navigation and state changes.
   */
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      handleTabUpdated(tabId, changeInfo).catch((error) => {
        log.error('Tab update handler error', error);
      });
    }
  });
});

// ─── Message Routing ────────────────────────────────────────────────

async function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  // Validate message structure
  if (!message || typeof message !== 'object' || !('type' in message)) {
    log.warn('Received malformed message');
    return { error: 'Invalid message format' };
  }

  const msg = message as { type: string; payload?: unknown };

  switch (msg.type) {
    case 'PING':
      return { type: 'PONG', timestamp: Date.now() };

    case 'CAPABILITY_CHECK':
      log.info('Capability check received', { tabId: sender.tab?.id });
      return { type: 'CAPABILITY_ACK' };

    case 'ADAPTER_EVENT':
      log.info('Adapter event received', { event: msg.payload, tabId: sender.tab?.id });
      return { type: 'EVENT_ACK' };

    case 'WORKER_STATUS':
      log.info('Worker status update', { payload: msg.payload });
      // TODO: Route to orchestrator
      return { type: 'STATUS_ACK' };

    case 'WORKER_RESULT':
      log.info('Worker result received', { payload: msg.payload });
      // TODO: Route to orchestrator
      return { type: 'RESULT_ACK' };

    case 'SWARM_COMMAND':
      log.info('Swarm command received', { payload: msg.payload });
      // TODO: Route to orchestrator
      return { type: 'COMMAND_ACK' };

    default:
      log.warn('Unknown message type', { type: msg.type });
      return { error: `Unknown message type: ${msg.type}` };
  }
}

// ─── Tab Lifecycle ──────────────────────────────────────────────────

async function handleTabClosed(tabId: number): Promise<void> {
  log.info('Tab closed', { tabId });
  // TODO: Check if this tab belongs to an active swarm worker
  // If so, mark worker as LOST and trigger recovery
}

async function handleTabUpdated(
  tabId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changeInfo: any,
): Promise<void> {
  log.info('Tab updated', { tabId, status: changeInfo.status, url: changeInfo.url });
  // TODO: Check if this tab belongs to an active swarm worker
  // If URL changed, verify it's still a valid ChatGPT conversation
}
