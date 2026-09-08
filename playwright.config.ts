import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  forbidOnly: true,
  workers: 1,
  reporter: 'list',
});
