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

| Data | Storage | Purpose |
|---|---|---|
| Swarm state | `chrome.storage.local` | Track active/completed swarms for recovery |
| Agent personas | `chrome.storage.local` | User-customized agent configurations |
| Preferences | `chrome.storage.local` | Extension settings |
| Active tab mapping | `chrome.storage.session` | Track which tabs belong to active workers |

### What is NOT stored:

- Full conversation transcripts (only concise worker report summaries)
- Authentication credentials of any kind
- ChatGPT session cookies or tokens
- Personal account information

## Data Transmission

The extension makes **ZERO network requests** to any server other than chatgpt.com (which you are already using). There is:

- No backend server
- No cloud storage
- No analytics endpoint
- No update check beyond Chrome's built-in extension update mechanism

## Diagnostics

If you export diagnostics:
- Conversation IDs are redacted
- URLs are sanitized
- Authentication material is never included
- You control what you share

## Data Deletion

Uninstalling the extension removes all locally stored data. No external data exists to delete.

## Changes

This privacy policy may be updated. Check the `PRIVACY.md` file in the repository for the latest version.

## Contact

For privacy questions, open an issue at: https://github.com/vyas-devgna/chatgpt-swarm/issues
