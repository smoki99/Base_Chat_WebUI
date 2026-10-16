import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Repo root so that `npm run dev -w <workspace>` resolves the workspace.
// (import.meta.dirname: __dirname is unavailable in ES module scope)
const root = path.resolve(import.meta.dirname, '../..');

// API port for the E2E web server. Defaults to 3001; override with
// E2E_API_PORT when 3001 is occupied locally (e.g. by another service).
const apiPort = process.env.E2E_API_PORT || '3001';

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
  // E2E_API_PORT lets local runs avoid a port already taken by another
  // service on the machine; CI and the default stay on 3001.
  webServer: [
    {
      command: 'npm run dev -w api',
      cwd: root,
      url: `http://localhost:${apiPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { ...process.env, CHAT_PROVIDER: 'mock', PORT: apiPort },
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
