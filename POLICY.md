# Policy and Distribution Status

Last reviewed: 2026-09-08. This is an engineering assessment, not legal advice.

## OpenAI consumer-service gate

OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use/) effective January 1, 2026 state that users may not automatically or programmatically extract data or Output. ChatGPT Swarm reads completed worker Output from the visible page and relays a concise report to the Captain, so unrestricted consumer deployment cannot be represented as authorized under the current terms.

Decision:

- Public source code and technical artifacts may be published for review and development.
- Do not submit this build to a browser store or claim unrestricted daily consumer compatibility.
- Before broader distribution, obtain written OpenAI authorization or redesign the relay so it no longer programmatically extracts Output, then re-review the current terms.

## Chrome Web Store gate

Chrome's [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) and [user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) treat locally processed website content and user-generated content as user data. They require accurate pre-install disclosure and informed consent, an accessible privacy policy, a narrow single purpose, minimum permissions, complete listing assets, and consistency between behavior and dashboard disclosures.

This repository documents its purpose, permissions, and local-only processing. A store submission still needs reviewed listing disclosures, consent/onboarding UI, icons/screenshots, developer contact verification, and resolution of the OpenAI gate above.
