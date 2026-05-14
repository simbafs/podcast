import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8787',
    headless: true,
  },
  webServer: {
    command: 'pnpm run build && wrangler dev --local --ip 0.0.0.0',
    port: 8787,
    timeout: 60000,
    reuseExistingServer: true,
  },
})