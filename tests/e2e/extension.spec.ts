import { expect, test, chromium, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let context: BrowserContext | undefined;

test.afterEach(async () => {
  await context?.close();
});

async function launchExtension(): Promise<BrowserContext> {
  const extensionPath = resolve('.output/chrome-mv3');
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
}

test('loads the packaged MV3 service worker', async () => {
  context = await launchExtension();
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  expect(worker.url()).toMatch(/^chrome-extension:\/\/.+\/background\.js$/);
});

test('mounts Chat-only controls on a sanitized Project page', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `${readFileSync(resolve('fixtures/sidebar-expanded.html'), 'utf8')}${readFileSync(resolve('fixtures/project-chat.html'), 'utf8')}`,
    });
  });
  const page = await context.newPage();
  await page.goto('https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/project');
  await expect(page.locator('#chatgpt-swarm-root').locator('button')).toHaveText('Swarm');
  await expect(page.locator('#chatgpt-swarm-sidebar-root').locator('button')).toHaveText('Swarm');
});

test('never mounts a Swarm action in Work mode', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: readFileSync(resolve('fixtures/project-work.html'), 'utf8'),
    });
  });
  const page = await context.newPage();
  await page.goto('https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/project');
  await expect(page.locator('#chatgpt-swarm-root')).toHaveCount(0);
  await expect(page.locator('#chatgpt-swarm-sidebar-root')).toHaveCount(0);
});

test('removes every Swarm action when a Project switches from Chat to Work', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `${readFileSync(resolve('fixtures/sidebar-expanded.html'), 'utf8')}${readFileSync(resolve('fixtures/project-chat.html'), 'utf8')}`,
    });
  });
  const page = await context.newPage();
  await page.goto('https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/project');
  await expect(page.locator('#chatgpt-swarm-root')).toHaveCount(1);
  await page.evaluate(() => {
    document
      .querySelector('[data-tpp-toggle-value="chatgpt"]')
      ?.setAttribute('aria-checked', 'false');
    const work = document.createElement('button');
    work.setAttribute('role', 'radio');
    work.setAttribute('data-tpp-toggle-value', 'work');
    work.setAttribute('aria-checked', 'true');
    document.body.append(work);
  });
  await expect(page.locator('#chatgpt-swarm-root')).toHaveCount(0);
  await expect(page.locator('#chatgpt-swarm-sidebar-root')).toHaveCount(0);
});

test('completes a packaged Captain-worker-synthesis lifecycle', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: readFileSync(resolve('fixtures/project-interactive.html'), 'utf8'),
    });
  });
  const page = await context.newPage();
  await page.goto('https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/c/captain-1');
  await page.locator('#chatgpt-swarm-root').locator('button', { hasText: 'Swarm' }).click();
  await expect
    .poll(
      () =>
        context?.pages().filter((candidate) => candidate.url().startsWith('https://chatgpt.com'))
          .length,
    )
    .toBe(2);
  const workerPage = context
    .pages()
    .find((candidate) => candidate !== page && candidate.url().startsWith('https://chatgpt.com'));
  expect(workerPage).toBeDefined();
  await workerPage!.bringToFront();
  await expect
    .poll(async () =>
      JSON.stringify({
        url: workerPage!.url(),
        body: await workerPage!.locator('body').innerText(),
      }),
    )
    .toContain('Lifecycle passed.');
  await expect(page.getByText('Final synthesis from worker evidence.')).toBeVisible();

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const records = await worker.evaluate(async () => chrome.storage.local.get(null));
  const swarm = Object.entries(records).find(([key]) => key.startsWith('swarm:'))?.[1] as {
    status?: string;
    workers?: Array<{ report?: { rawResponse?: string } }>;
  };
  expect(swarm.status).toBe('COMPLETE');
  expect(swarm.workers?.[0]?.report?.rawResponse).toBe('');
  expect(records.activeSwarms).toEqual([]);
});

test('recovers a closed worker with Retry', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: readFileSync(resolve('fixtures/project-interactive.html'), 'utf8'),
    });
  });
  const captain = await context.newPage();
  await captain.goto(
    'https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/c/captain-retry',
  );
  await captain.locator('#chatgpt-swarm-root').locator('button', { hasText: 'Swarm' }).click();
  await expect(captain.locator('#chatgpt-swarm-root')).toContainText('RUNNING');
  const failedWorker = context
    .pages()
    .find(
      (candidate) => candidate !== captain && candidate.url().startsWith('https://chatgpt.com/g/'),
    );
  expect(failedWorker).toBeDefined();
  await failedWorker!.close();

  const retry = captain.locator('#chatgpt-swarm-root').locator('button', { hasText: 'Retry' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(captain.getByText('Final synthesis from worker evidence.')).toBeVisible();
});

test('recovers synthesis after the Captain tab is reopened', async () => {
  context = await launchExtension();
  await context.route('https://chatgpt.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: readFileSync(resolve('fixtures/project-interactive.html'), 'utf8'),
    });
  });
  const captainUrl =
    'https://chatgpt.com/g/g-p-00000000000000000000000000000000-example/c/captain-reopen';
  const captain = await context.newPage();
  await captain.goto(captainUrl);
  await captain.locator('#chatgpt-swarm-root').locator('button', { hasText: 'Swarm' }).click();
  await expect(captain.locator('#chatgpt-swarm-root')).toContainText('RUNNING');
  await captain.close();

  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await expect
    .poll(async () => {
      const records = await serviceWorker.evaluate(async () => chrome.storage.local.get(null));
      const swarm = Object.entries(records).find(([key]) => key.startsWith('swarm:'))?.[1] as {
        status?: string;
        workers?: Array<{ agent?: { status?: string } }>;
      };
      return `${swarm.status}:${swarm.workers?.[0]?.agent?.status}`;
    })
    .toBe('RUNNING:COMPLETE');

  const reopened = await context.newPage();
  await reopened.goto(captainUrl);
  const merge = reopened.locator('#chatgpt-swarm-root').locator('button', { hasText: 'Merge now' });
  await expect(merge).toBeEnabled();
  await merge.click();
  await expect(reopened.getByText('Final synthesis from worker evidence.')).toBeVisible();
});
