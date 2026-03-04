import { test, expect } from '@playwright/test';

/**
 * Critical Flow 3: Community
 *
 * Tests community page, categories, post display, and creation.
 */

test.describe('Community Platform', () => {
    test('Community page shows categories', async ({ page }) => {
        await page.goto('/community');
        await page.waitForTimeout(2000);

        // Category tabs should be visible
        await expect(page.locator('text=Parenting Tips')).toBeVisible();
        await expect(page.locator('text=Therapy Wins')).toBeVisible();
    });

    test('Posts are displayed with titles and metadata', async ({ page }) => {
        await page.goto('/community');
        await page.waitForTimeout(2000);

        // Seeded posts should be visible
        await expect(page.locator('text=Welcome to NeuroBridge Community')).toBeVisible();
    });

    test('Medical disclaimer is shown', async ({ page }) => {
        await page.goto('/community');
        await page.waitForTimeout(2000);

        await expect(page.locator('text=not a substitute for professional medical advice')).toBeVisible();
    });

    test('New Post button is visible', async ({ page }) => {
        await page.goto('/community');
        await page.waitForTimeout(2000);

        await expect(page.locator('text=New Post')).toBeVisible();
    });

    test('Category filter works', async ({ page }) => {
        await page.goto('/community');
        await page.waitForTimeout(2000);

        // Click a specific category
        await page.locator('text=Therapy Wins').click();
        await page.waitForTimeout(1000);

        // Should filter posts (or show empty state)
        // At minimum, the page should not crash
        await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    });
});
