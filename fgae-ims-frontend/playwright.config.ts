import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 3, timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev:live -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI },
  ],
})
