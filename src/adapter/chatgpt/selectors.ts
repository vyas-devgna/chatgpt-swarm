/** All ChatGPT DOM selectors live in this module. */
export const SELECTORS = {
  composer: [
    '[role="textbox"][contenteditable="true"]',
    'textarea[placeholder]',
    '[contenteditable="true"].ProseMirror',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'form button[type="submit"]',
  ],
  stopButton: ['button[data-testid="stop-button"]', 'button[aria-label*="Stop"]'],
  assistantMessage: [
    'section[data-turn="assistant"][data-testid^="conversation-turn-"]',
    '[data-message-author-role="assistant"]',
    'article[data-turn="assistant"]',
  ],
  navigation: ['nav', '[role="navigation"]'],
  chatSurface: ['[role="radio"][data-tpp-toggle-value="chatgpt"][aria-checked="true"]'],
  workSurface: ['[role="radio"][data-tpp-toggle-value="work"][aria-checked="true"]'],
  pageBanner: ['header', '[role="banner"]'],
  conversationRoot: ['main', '[role="main"]'],
  sidebarNavigation: ['nav[aria-label="Chat history"]', 'nav'],
  libraryLink: ['a[href^="/library"]'],
} as const;
