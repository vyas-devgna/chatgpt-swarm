import { MIN_CONFIDENCE_THRESHOLD } from '../../shared/constants.js';
import type { CapabilityResult, GenerationState } from '../../swarm/types.js';
import { SELECTORS } from './selectors.js';

type ComposerElement = HTMLElement | HTMLTextAreaElement;

function findFirst<T extends Element>(
  root: ParentNode,
  selectors: readonly string[],
): CapabilityResult<T> {
  const attempted: string[] = [];
  for (const [index, selector] of selectors.entries()) {
    const value = root.querySelector<T>(selector);
    if (value) {
      return {
        value,
        confidence: index === 0 ? 1 : index === 1 ? 0.95 : 0.9,
        strategy: selector,
        fallbacksUsed: attempted,
      };
    }
    attempted.push(selector);
  }
  return { value: null, confidence: 0, strategy: 'none', fallbacksUsed: attempted };
}

/** Find the ChatGPT composer using independent semantic strategies. */
export function locateComposer(root: ParentNode = document): CapabilityResult<ComposerElement> {
  return findFirst<ComposerElement>(root, SELECTORS.composer);
}

/** Find the send control using semantic strategies. */
export function locateSendButton(root: ParentNode = document): CapabilityResult<HTMLButtonElement> {
  return findFirst<HTMLButtonElement>(root, SELECTORS.sendButton);
}

/** Return whether message submission is currently safe. */
export function canSend(root: ParentNode = document): boolean {
  const composer = locateComposer(root);
  const send = locateSendButton(root);
  return (
    composer.confidence >= MIN_CONFIDENCE_THRESHOLD &&
    send.confidence >= MIN_CONFIDENCE_THRESHOLD &&
    send.value?.disabled === false
  );
}

/** Read current composer text without touching React-owned state. */
export function getComposerText(root: ParentNode = document): string {
  const composer = locateComposer(root).value;
  if (!composer) return '';
  return composer instanceof HTMLTextAreaElement
    ? composer.value.trim()
    : composer.innerText.trim();
}

/** Replace composer text using the native input path ChatGPT observes. */
export function setComposerText(text: string, root: ParentNode = document): boolean {
  const result = locateComposer(root);
  if (!result.value || result.confidence < MIN_CONFIDENCE_THRESHOLD) return false;
  const composer = result.value;
  composer.focus();
  if (composer instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(composer, text);
  } else {
    composer.textContent = text;
  }
  composer.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
  return true;
}

/** Submit a message only when both composer and send control are confidently detected. */
export async function sendMessage(text: string, root: ParentNode = document): Promise<boolean> {
  if (!setComposerText(text, root)) return false;
  const send = await waitForSendButton(root);
  if (!send) return false;
  send.click();
  return true;
}

async function waitForSendButton(root: ParentNode): Promise<HTMLButtonElement | null> {
  const find = (): HTMLButtonElement | null => {
    const result = locateSendButton(root);
    return result.value && result.confidence >= MIN_CONFIDENCE_THRESHOLD && !result.value.disabled
      ? result.value
      : null;
  };
  const immediate = find();
  if (immediate) return immediate;
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const button = find();
      if (!button) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve(button);
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, 2_000);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
  });
}

/** Detect whether ChatGPT is idle or generating. */
export function getGenerationState(root: ParentNode = document): GenerationState {
  if (findFirst(root, SELECTORS.stopButton).value) return 'streaming';
  return getLastAssistantMessage(root) ? 'complete' : 'idle';
}

/** Stop an active generation only when the visible stop control is confidently identified. */
export function stopGeneration(root: ParentNode = document): boolean {
  const stop = findFirst<HTMLButtonElement>(root, SELECTORS.stopButton);
  if (!stop.value || stop.confidence < MIN_CONFIDENCE_THRESHOLD) return false;
  stop.value.click();
  return true;
}

/** Read the most recent completed assistant message. */
export function getLastAssistantMessage(root: ParentNode = document): string | null {
  for (const selector of SELECTORS.assistantMessage) {
    const messages = root.querySelectorAll<HTMLElement>(selector);
    const last = messages.item(messages.length - 1);
    const text = last?.innerText.trim();
    if (text) return text;
  }
  return null;
}

/** Compute the critical capability readiness used to fail closed. */
export function getCapabilities(root: ParentNode = document) {
  const composer = locateComposer(root);
  const send = locateSendButton(root);
  const surface = getChatSurface(root);
  return {
    composer,
    send,
    surface,
    canCompose:
      composer.confidence >= MIN_CONFIDENCE_THRESHOLD &&
      surface.value === 'chat' &&
      surface.confidence >= MIN_CONFIDENCE_THRESHOLD,
    ready:
      composer.confidence >= MIN_CONFIDENCE_THRESHOLD &&
      send.confidence >= MIN_CONFIDENCE_THRESHOLD &&
      surface.value === 'chat' &&
      surface.confidence >= MIN_CONFIDENCE_THRESHOLD,
  };
}

/** Locate the narrow conversation subtree for event observation. */
export function locateConversationRoot(root: ParentNode = document): CapabilityResult<HTMLElement> {
  return findFirst<HTMLElement>(root, SELECTORS.conversationRoot);
}

/** Locate a safe sibling insertion point above ChatGPT's composer form. */
export function locateComposerMount(root: ParentNode = document): HTMLElement | null {
  return locateComposer(root).value?.closest('form')?.parentElement ?? null;
}

/** Locate the Library link used as the stable sidebar insertion anchor. */
export function locateSidebarAnchor(root: ParentNode = document): HTMLElement | null {
  for (const navigationSelector of SELECTORS.sidebarNavigation) {
    for (const navigation of root.querySelectorAll<HTMLElement>(navigationSelector)) {
      const anchor = findFirst<HTMLElement>(navigation, SELECTORS.libraryLink).value;
      if (anchor) return anchor;
    }
  }
  return null;
}

/** Detect Chat vs Work without changing the user's selected surface. */
export function getChatSurface(root: ParentNode = document): CapabilityResult<'chat' | 'work'> {
  if (findFirst(root, SELECTORS.workSurface).value) {
    return { value: 'work', confidence: 1, strategy: SELECTORS.workSurface[0], fallbacksUsed: [] };
  }
  if (findFirst(root, SELECTORS.chatSurface).value) {
    return {
      value: 'chat',
      confidence: 1,
      strategy: SELECTORS.chatSurface[0],
      fallbacksUsed: [SELECTORS.workSurface[0]],
    };
  }
  const banner = findFirst<HTMLElement>(root, SELECTORS.pageBanner);
  if (banner.value) {
    const labels = Array.from(banner.value.querySelectorAll('span')).map((item) =>
      item.textContent?.trim().toLowerCase(),
    );
    if (labels.includes('work'))
      return {
        value: 'work',
        confidence: 0.95,
        strategy: 'banner-label',
        fallbacksUsed: [...SELECTORS.workSurface, ...SELECTORS.chatSurface],
      };
    if (labels.includes('chat'))
      return {
        value: 'chat',
        confidence: 0.95,
        strategy: 'banner-label',
        fallbacksUsed: [...SELECTORS.workSurface, ...SELECTORS.chatSurface],
      };
  }
  return {
    value: null,
    confidence: 0,
    strategy: 'none',
    fallbacksUsed: [...SELECTORS.workSurface, ...SELECTORS.chatSurface, ...SELECTORS.pageBanner],
  };
}
