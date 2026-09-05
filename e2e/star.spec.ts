import { execSync } from 'child_process';
import { test, expect } from '@playwright/test';

function workingTreeSha(): string {
  return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
}

/**
 * STAR acceptance smoke over HTTP-rendered pages (P1 acceptance SAFE-004:
 * synthetic data visibly labeled on every page; read-only boundary text).
 * Client PGlite seeds in the browser, so assertions check server-rendered
 * chrome plus client-rendered content after hydration.
 */
test.describe('six-page render + safety labels', () => {
  for (const path of ['/', '/cycle-radar', '/narrative-map', '/project/proj-neural', '/risk-center', '/replay-lab']) {
    test(`${path} renders with synthetic label and boundary`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      // 语义断言：稳定 testid + 双语关键语，不依赖营销文案措辞
      const banner = page.getByTestId('synthetic-fixture-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('夹具自动阻击');
      await expect(banner).toContainText('无广播');
      await expect(banner).toContainText('FIXTURE AUTO-SNIPE');
      await expect(banner).toContainText('NO BROADCAST');
    });
  }

  test('snipe desk auto-runs the fixture cycle without the research db', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('阻击台').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('snipe-value-meme@v0').first()).toBeVisible();
    await expect(page.getByText('DRY_RUN').first()).toBeVisible();
    await expect(page.getByText('组合净值').first()).toBeVisible();
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
    await expect(page.getByText('代币权限').first()).toBeVisible();
    await expect(page.getByText(/时点后被隐藏/).first()).toBeVisible();
    await expect(page.getByText('历史冻结').first()).toBeVisible();
    await expect(page.getByText('证据溯源').first()).toBeVisible();
  });

  test('P0-C2: init failure degrades explicitly, no gates/scores/stale data, retry is safe', async ({ page }) => {
    // Fault injection: fresh context (empty idb) → initDb must fetch
    // /init.sql to create tables; aborting it forces initialization failure.
    await page.route('**/init.sql', (route) => route.abort());

    await page.goto('/risk-center');

    // LOADING TERMINATES + ERROR MESSAGE VISIBLE
    const alert = page.getByTestId('data-unavailable');
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('数据不可用')).toBeVisible();
    await expect(page.getByText('本地研究数据初始化失败。')).toBeVisible();
    await expect(page.getByText('STAR 未加载任何项目结论、门禁状态或机会分数。')).toBeVisible();
    await expect(page.getByText('STAR 初始化中')).toHaveCount(0);

    await expect(page.getByTestId('synthetic-fixture-banner')).toBeVisible();
    await expect(page.locator('header')).toContainText('无广播');

    // GATE STATUS / OPPORTUNITY SCORE / STALE PROJECT DATA = ZERO
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b(PASS|FAIL|UNKNOWN)\b/);
    expect(body).not.toMatch(/总分|可决策|已阻断|需补研|通过|未通过/);
    expect(body).not.toMatch(/Neural Swarm|LLM Lab|Rocket Moon|SafeMoon/);

    // RETRY ACTION = SAFE: unblock init.sql, reload re-runs initialization,
    // app recovers to the normal synthetic queue (no stale state).
    await page.unroute('**/init.sql');
    await page.getByRole('button', { name: '重新加载' }).click();
    await expect(page.getByText('风险中心').first()).toBeVisible({ timeout: 30000 });
  });
});

test('capability and snipe APIs stay aligned', async ({ request }) => {
  const cap = await request.get('/api/capability');
  expect(cap.status()).toBe(200);
  const ledger = await cap.json();
  expect(ledger.id).toBe('star-capability@3');
  expect(ledger.purpose).toBe('MEME-SNIPE-AUTO');
  expect(ledger.money).toBe('NO-EVIDENCE');
  expect(ledger.runtime.autoTrade).toBe(true);
  expect(ledger.runtime.snipeCycleWired).toBe(true);
  expect(ledger.runtime.deskRequiresResearchDb).toBe(false);
  expect(ledger.runtime.strategy).toBe('snipe-value-meme@v0');
  expect(ledger.runtime.executionMode).toBe('DRY_RUN');

  const snipe = await request.get('/api/snipe');
  expect(snipe.status()).toBe(200);
  const body = await snipe.json();
  expect(body.capability).toBe(ledger.id);
  expect(body.purpose).toBe(ledger.purpose);
  expect(body.strategy).toBe(ledger.runtime.strategy);
  expect(body.mode).toBe('DRY_RUN');
  expect(body.money).toBe('NO-EVIDENCE');
});

test('S0/health: liveness probe — 200, build identity, no secrets, method-limited, prod CSP clean', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('liveness');
  expect(typeof body.commit).toBe('string');
  expect(typeof body.build_sha).toBe('string');
  expect(body.build_sha).toBe(body.commit);
  expect(body.build_sha).toBe(workingTreeSha());
  expect(typeof body.schema).toBe('string');
  expect(typeof body.server_time).toBe('string');
  // No secrets / endpoints leak
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/https?:\/\/|api[_-]?key|secret|password|authorization/i);
  // Method limit
  const post = await request.post('/api/health');
  expect(post.status()).toBe(405);
  // Production CSP must not carry unsafe-eval (dev-only concession)
  const page = await request.get('/');
  const csp = page.headers()['content-security-policy'] ?? '';
  expect(csp).toContain('frame-ancestors');
  if (process.env.NODE_ENV === 'production') {
    // General JS eval stays banned; WASM compilation granted narrowly.
    expect(csp).not.toMatch(/(^|[^-])unsafe-eval/);
    expect(csp).toContain('wasm-unsafe-eval');
  }
});
