import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Repo root so that `npm run dev -w <workspace>` resolves the workspace.
// (import.meta.dirname: __dirname is unavailable in ES module scope)
const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Chromium only for a fast, light baseline. Add firefox/webkit later if needed.
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Start both servers ourselves (no manual `npm run dev`) with per-server
  // readiness checks so tests never race a half-started server.
  webServer: [
    {
      command: 'npm run dev -w api',
      cwd: root,
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -w web',
      cwd: root,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
