import { test, expect } from '@playwright/test';

/**
 * STAR acceptance smoke over HTTP-rendered pages (P1 acceptance SAFE-004:
 * synthetic data visibly labeled on every page; read-only boundary text).
 * Client PGlite seeds in the browser, so assertions check server-rendered
 * chrome plus client-rendered content after hydration.
 */
test.describe('four-page render + safety labels', () => {
  for (const path of ['/', '/narrative-map', '/project/proj-neural', '/replay-lab']) {
    test(`${path} renders with synthetic label and boundary`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('header')).toContainText('SYNTHETIC FIXTURE DATA');
      await expect(page.locator('header')).toContainText('NO WALLET');
    });
  }

  test('star desk shows the decision queue after hydration', async ({ page }) => {
    await page.goto('/');
    // Client PGlite seeds the timeline fixture; the desk lists all projects
    // in either the research queue or the risk queue.
    await expect(page.getByText('Neural Swarm', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('SafeMoon Yield', { exact: false }).first()).toBeVisible();
  });

  test('replay lab evaluates a point-in-time cutoff', async ({ page }) => {
    await page.goto('/replay-lab');
    await page.getByRole('button', { name: '运行回放' }).waitFor({ timeout: 30000 });
    // default project may be empty; select Neural Swarm and run
    await page.getByText('选择项目').click();
    await page.getByRole('option', { name: 'Neural Swarm' }).click();
    await page.locator('input[type="datetime-local"]').fill('2026-08-16T12:00');
    await page.getByRole('button', { name: '运行回放' }).click();
    await expect(page.getByText('时点门禁').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('token-permissions').first()).toBeVisible();
    await expect(page.getByText(/时点后被隐藏/).first()).toBeVisible();
  });
});
