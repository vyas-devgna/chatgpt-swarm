import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getChatSurface,
  getGenerationState,
  getLastAssistantMessage,
  locateComposer,
  locateSidebarAnchor,
} from './adapter.js';

function load(name: string): void {
  document.documentElement.innerHTML = readFileSync(resolve('fixtures', name), 'utf8');
}

describe('sanitized ChatGPT fixtures', () => {
  it('detects the idle Project composer in Chat mode', () => {
    load('project-chat.html');
    expect(getChatSurface().value).toBe('chat');
    expect(locateComposer().confidence).toBe(1);
    expect(getGenerationState()).toBe('idle');
  });

  it('distinguishes streaming from completed turns', () => {
    load('chat-streaming.html');
    expect(getGenerationState()).toBe('streaming');
    load('chat-complete.html');
    expect(getGenerationState()).toBe('complete');
    expect(getLastAssistantMessage()).toBe('Completed response');
  });

  it('finds the expanded sidebar anchor and fails safely when collapsed', () => {
    load('sidebar-expanded.html');
    expect(locateSidebarAnchor()?.textContent).toBe('Library');
    load('sidebar-collapsed.html');
    expect(locateSidebarAnchor()).toBeNull();
  });

  it('treats a tool run as streaming', () => {
    load('tool-running.html');
    expect(getGenerationState()).toBe('streaming');
  });
});
