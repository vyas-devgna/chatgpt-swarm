# Release Procedure

1. Run `npm ci` on Node 20 or 22.
2. Run `npm run verify`.
3. Load `.output/chrome-mv3` unpacked in a dedicated Chromium profile.
4. Sign in and verify only the Chat surface in a disposable Project.
5. Exercise 1-, 2-, and 4-worker swarms; Stop, Merge now, Retry, Captain reload, and worker reload.
6. Confirm Work mode has no Swarm action and no message was submitted there.
7. Run `npm run zip` and inspect the archive contents.
8. Update `RELEASE_REPORT.md` with exact evidence and unresolved limitations.

Never publish when authenticated E2E, dependency audit, or the Work-mode exclusion fails.

Public source artifacts may be released as an engineering preview. Do not submit to a browser store or describe the extension as approved for unrestricted ChatGPT consumer use until the gates in [`POLICY.md`](../POLICY.md) are resolved.
