import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const fixture = fileURLToPath(new URL('./fixtures/shelf.y4m', import.meta.url));
const baseURL = 'https://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true, // dev serves a self-signed certificate
    permissions: ['camera'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            // Until the shelf fixture exists (M2), Chromium's built-in test pattern is the camera.
            ...(existsSync(fixture) ? [`--use-file-for-fake-video-capture=${fixture}`] : []),
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @peripheral/web exec vite --strictPort',
    url: baseURL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
