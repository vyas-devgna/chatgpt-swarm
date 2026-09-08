# ChatGPT Web Reconnaissance

Last verified: 2026-09-08 against an authenticated ChatGPT Plus account. No cookies, tokens, private account identifiers, or conversation contents were recorded.

## Confirmed Chat-only anchors

| Capability           | Primary anchor                                                         | Fallback                                    | Confidence         |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------- | ------------------ |
| Project              | `/g/g-p-{32 hex}[-slug]/project`                                       | Project conversation URL                    | 1.00               |
| Project conversation | `/g/g-p-{32 hex}[-slug]/c/{conversation}`                              | none                                        | 1.00               |
| Chat surface         | `[role="radio"][data-tpp-toggle-value="chatgpt"][aria-checked="true"]` | exact `Chat` label in banner                | 1.00 / 0.95        |
| Work surface         | `[role="radio"][data-tpp-toggle-value="work"][aria-checked="true"]`    | exact `Work` label in banner                | 1.00 / 0.95        |
| Composer             | `[role="textbox"][contenteditable="true"]`                             | `textarea[placeholder]`, `.ProseMirror`     | 1.00 / 0.95 / 0.90 |
| Submit               | `button[data-testid="send-button"]`                                    | `button[aria-label*="Send"]`, submit button | 1.00 / 0.95 / 0.90 |
| Assistant turn       | `section[data-turn="assistant"][data-testid^="conversation-turn-"]`    | legacy author/turn attributes               | 1.00               |
| Streaming            | visible semantic Stop button                                           | `aria-label*="Stop"`                        | 1.00 / 0.95        |

The Send control is absent on an empty Chat composer and appears after text entry. The adapter therefore validates the composer and Chat surface first, injects text, then waits for a confident Send control.

## Safety decisions

- Work mode is never selected, tested with messages, or used for workers.
- Unknown surfaces, missing composers, and low-confidence controls fail closed.
- Project slugs are removed before creating worker Project tabs.
- No undocumented endpoints or authentication material are inspected.

## Still release-gated

Authenticated end-to-end runs require the unpacked extension in a user-controlled Chromium profile. The Codex in-app browser can validate live DOM but blocks its internal extension-management page.
