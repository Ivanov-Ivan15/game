import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://localhost:3000/health',
    reuseExistingServer: false,
    timeout: 15000
  }
});