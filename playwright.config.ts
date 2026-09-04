import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['desktop chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx next start -p 3100',
        port: 3100,
        reuseExistingServer: false,
        timeout: 120000,
      },
});
