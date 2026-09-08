import { describe, expect, it, vi } from 'vitest';
import {
  getCapabilities,
  getChatSurface,
  getGenerationState,
  getLastAssistantMessage,
  locateComposer,
  locateSendButton,
  sendMessage,
} from './adapter.js';

describe('ChatGPT adapter', () => {
  it('prefers semantic composer and send selectors', () => {
    document.body.innerHTML =
      '<button role="radio" data-tpp-toggle-value="chatgpt" aria-checked="true">Chat</button><form><div role="textbox" contenteditable="true"></div><button data-testid="send-button" type="button">Send</button></form>';
    expect(locateComposer().confidence).toBe(1);
    expect(locateSendButton().confidence).toBe(1);
    expect(getCapabilities().ready).toBe(true);
  });

  it('accepts independent fallbacks at the safety threshold', () => {
    document.body.innerHTML =
      '<header><span>Chat</span></header><form><textarea placeholder="Message"></textarea><button aria-label="Send prompt" type="button">Send</button></form>';
    expect(locateComposer().confidence).toBe(0.95);
    expect(locateSendButton().confidence).toBe(0.95);
    expect(getCapabilities().ready).toBe(true);
  });

  it('fails closed on Work mode', () => {
    document.body.innerHTML =
      '<button role="radio" data-tpp-toggle-value="work" aria-checked="true">Work</button><form><div role="textbox" contenteditable="true"></div><button data-testid="send-button">Send</button></form>';
    expect(getChatSurface().value).toBe('work');
    expect(getCapabilities().ready).toBe(false);
  });

  it('can compose before ChatGPT creates the send button', async () => {
    document.body.innerHTML =
      '<button role="radio" data-tpp-toggle-value="chatgpt" aria-checked="true">Chat</button><form><textarea placeholder="Message"></textarea></form>';
    expect(getCapabilities().canCompose).toBe(true);
    const sending = sendMessage('hello');
    const button = document.createElement('button');
    button.dataset.testid = 'send-button';
    document.querySelector('form')?.append(button);
    await expect(sending).resolves.toBe(true);
  });

  it('fails closed when critical controls are absent', async () => {
    document.body.innerHTML = '<main>No composer</main>';
    expect(getCapabilities().ready).toBe(false);
    await expect(sendMessage('do not send')).resolves.toBe(false);
  });

  it('submits through the visible button', async () => {
    document.body.innerHTML =
      '<form><textarea placeholder="Message"></textarea><button data-testid="send-button" type="button">Send</button></form>';
    const click = vi.fn();
    document.querySelector('button')?.addEventListener('click', click);
    await expect(sendMessage('hello')).resolves.toBe(true);
    expect(document.querySelector('textarea')?.value).toBe('hello');
    expect(click).toHaveBeenCalledOnce();
  });

  it('detects streaming and reads the latest assistant result', () => {
    document.body.innerHTML =
      '<section data-turn="assistant" data-testid="conversation-turn-1">Old</section><section data-turn="assistant" data-testid="conversation-turn-2">Final report</section><button data-testid="stop-button">Stop</button>';
    expect(getGenerationState()).toBe('streaming');
    expect(getLastAssistantMessage()).toBe('Final report');
  });
});
