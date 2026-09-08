# Compatibility

## Implemented target

- Chromium Manifest V3
- Current `https://chatgpt.com` Project Chat surface
- One Captain plus up to four worker tabs
- Light/dark colors inherited from ChatGPT and responsive worker cards

## Explicitly unsupported

- ChatGPT Work mode
- Firefox and Safari
- Unauthenticated execution
- Chats outside Projects
- Undocumented ChatGPT APIs

Compatibility is capability-based: destructive DOM actions require confidence of at least 0.90. A ChatGPT UI change therefore disables Swarm instead of guessing.

Authenticated unpacked-extension testing and a 30-run real-account soak remain release gates. See [`POLICY.md`](../POLICY.md) before deploying the extension against ChatGPT consumer services.
