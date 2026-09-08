/**
 * Content script entry point — injected into chatgpt.com pages.
 *
 * Responsibilities:
 * 1. Initialize the ChatGPT adapter
 * 2. Detect page state (project, conversation, capabilities)
 * 3. Mount extension UI (Shadow DOM)
 * 4. Bridge adapter events to service worker
 */

import { createLogger } from '../shared/logger.js';
import { isChatGPTUrl } from '../shared/utils.js';

const log = createLogger('content-script');

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',

  main() {
    log.info('Content script loaded');

    // Verify we're on a ChatGPT page
    if (!isChatGPTUrl(window.location.href)) {
      log.warn('Not a ChatGPT URL, skipping initialization');
      return;
    }

    // Initialize the adapter and mount UI
    initializeSwarm();
  },
});

/**
 * Initialize the Swarm extension on the ChatGPT page.
 */
function initializeSwarm(): void {
  log.info('Initializing ChatGPT Swarm');

  // Notify service worker that the page is ready
  chrome.runtime.sendMessage(
    {
      type: 'ADAPTER_EVENT',
      payload: {
        event: 'PAGE_READY',
        tabId: -1, // Will be filled by the service worker from sender.tab
        data: {
          url: window.location.href,
          timestamp: Date.now(),
        },
      },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        log.warn('Failed to notify service worker', {
          error: chrome.runtime.lastError.message,
        });
        return;
      }
      log.info('Service worker acknowledged page ready', { response });
    },
  );

  // TODO: Initialize adapter capability detection
  // TODO: Mount Swarm UI via Shadow DOM
  // TODO: Set up MutationObserver for remounting
}
