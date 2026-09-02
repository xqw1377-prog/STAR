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

  test('P0-C2: init failure degrades explicitly, no gates/scores/stale data, retry is safe', async ({ page }) => {
    // Fault injection: fresh context (empty idb) → initDb must fetch
    // /init.sql to create tables; aborting it forces initialization failure.
    await page.route('**/init.sql', (route) => route.abort());

    await page.goto('/');

    // LOADING TERMINATES + ERROR MESSAGE VISIBLE
    const alert = page.getByTestId('data-unavailable');
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('DATA UNAVAILABLE')).toBeVisible();
    await expect(page.getByText('本地研究数据初始化失败。')).toBeVisible();
    await expect(page.getByText('STAR 未加载任何项目结论、门禁状态或机会分数。')).toBeVisible();
    await expect(page.getByText('STAR 初始化中')).toHaveCount(0);

    // READ-ONLY BOUNDARY still visible (server-rendered header)
    await expect(page.locator('header')).toContainText('SYNTHETIC FIXTURE DATA');
    await expect(page.locator('header')).toContainText('NO WALLET');

    // GATE STATUS / OPPORTUNITY SCORE / STALE PROJECT DATA = ZERO
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b(PASS|FAIL|UNKNOWN)\b/);
    expect(body).not.toMatch(/总分|READY|BLOCKED|RESEARCH_REQUIRED/);
    expect(body).not.toMatch(/Neural Swarm|LLM Lab|Rocket Moon|SafeMoon/);

    // RETRY ACTION = SAFE: unblock init.sql, reload re-runs initialization,
    // app recovers to the normal synthetic queue (no stale state).
    await page.unroute('**/init.sql');
    await page.getByRole('button', { name: '重新加载' }).click();
    await expect(page.getByText('Neural Swarm', { exact: false }).first()).toBeVisible({ timeout: 30000 });
  });
});
