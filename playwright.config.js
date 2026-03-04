import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for NeuroBridge AI
 *
 * Runs E2E tests against the dev servers.
 * Expects both frontend (5173) and backend (3001) to be running.
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 30000,

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Optionally start dev servers before tests */
    // webServer: [
    //     {
    //         command: 'node server/index.js',
    //         port: 3001,
    //         reuseExistingServer: !process.env.CI,
    //     },
    //     {
    //         command: 'npm run dev',
    //         port: 5173,
    //         reuseExistingServer: !process.env.CI,
    //     },
    // ],
});
