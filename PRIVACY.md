# Privacy Policy — ChatGPT Swarm

**Last updated**: 2026-09-08

## Summary

ChatGPT Swarm is a local-only browser extension. It does not collect, transmit, or store any data outside of your browser.

## Data Collection

**We collect NO data.** Specifically:

- ❌ No telemetry or analytics
- ❌ No usage tracking
- ❌ No crash reporting to external services
- ❌ No user accounts
- ❌ No cookies or authentication tokens accessed
- ❌ No conversation content transmitted externally

## Data Storage

All extension data is stored locally using Chrome's extension storage APIs:

| Data        | Storage                | Purpose                                    |
| ----------- | ---------------------- | ------------------------------------------ |
| Swarm state | `chrome.storage.local` | Track active/completed swarms for recovery |
| Preferences | `chrome.storage.local` | Extension settings                         |

Completed and stopped swarm records are retained locally for recovery/history. Records older than 30 days are pruned on extension update or the next swarm start.

### What is NOT stored:

- Full conversation transcripts (only final worker reports and concise summaries; raw reports are cleared after synthesis)
- Authentication credentials of any kind
- ChatGPT session cookies or tokens
- Personal account information

## Data Transmission

The extension makes **ZERO network requests** to any server other than chatgpt.com (which you are already using). There is:

- No backend server
- No cloud storage
- No analytics endpoint
- No update check beyond Chrome's built-in extension update mechanism

## Limited Use

ChatGPT page content is processed only to provide the user-triggered swarm workflow described by the extension. It is not sold, used for advertising, transferred to the developer or another third party, or made available for human review. Local processing and storage are disclosed here because website content and user-generated content are user data under Chrome Web Store policy.

## Data Deletion

Uninstalling the extension removes all locally stored data. No external data exists to delete.

## Changes

This privacy policy may be updated. Check the `PRIVACY.md` file in the repository for the latest version.

## Contact

For privacy questions, open an issue at: https://github.com/vyas-devgna/chatgpt-swarm/issues
