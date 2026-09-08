# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ChatGPT Swarm, please report it responsibly:

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email: [Create a private security advisory](https://github.com/vyas-devgna/chatgpt-swarm/security/advisories/new)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix release**: Within 2 weeks for critical issues

## Scope

The following are in scope:

- Extension code (content scripts, service worker, UI)
- Message passing between extension contexts
- Storage handling
- DOM interaction security
- Credential/secret exposure

The following are out of scope:

- ChatGPT's own security (report to OpenAI)
- Browser security (report to the browser vendor)
- Social engineering attacks

## Security Design Principles

- No credential access (cookies, tokens, auth headers)
- No external network calls
- No eval() of any content
- Schema-validated message passing
- Sender verification on all messages
- Log redaction of sensitive data
- Shadow DOM isolation for injected UI
- Content Security Policy enforcement via Manifest V3
