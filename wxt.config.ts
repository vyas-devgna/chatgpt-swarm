import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  manifest: {
    name: 'ChatGPT Swarm',
    description: 'Turn ChatGPT Project conversations into lightweight multi-agent swarm workflows',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'tabGroups'],
    host_permissions: ['https://chatgpt.com/*'],
  },
});
