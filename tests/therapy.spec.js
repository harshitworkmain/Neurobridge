import { test, expect } from '@playwright/test';

/**
 * Critical Flow 4: Therapy & Schedule
 *
 * Tests therapy page tabs, visual schedule, and goal tracking.
 */

test.describe('Therapy Plan', () => {
    test('Therapy page shows tab navigation', async ({ page }) => {
        await page.goto('/therapy');
        await page.waitForTimeout(2000);

        // Tab buttons should be visible
        await expect(page.locator("text=Today's Tasks")).toBeVisible();
        await expect(page.locator('text=Full Plan')).toBeVisible();
        await expect(page.locator('text=Schedule')).toBeVisible();
    });

    test('Schedule tab shows Visual Schedule', async ({ page }) => {
        await page.goto('/therapy');
        await page.waitForTimeout(2000);

        // Click Schedule tab
        await page.locator('text=Schedule').click();
        await page.waitForTimeout(1000);

        // Visual Schedule should show current activity
        await expect(page.locator('text=RIGHT NOW')).toBeVisible();

        // Time slots should be visible
        await expect(page.locator('text=MORNING')).toBeVisible();
    });

    test('Schedule has voice readback button', async ({ page }) => {
        await page.goto('/therapy');
        await page.waitForTimeout(2000);

        await page.locator('text=Schedule').click();
        await page.waitForTimeout(1000);

        // Speaker button should be present (title="Read aloud")
        const speakerBtn = page.locator('[title="Read aloud"]');
        await expect(speakerBtn).toBeVisible();
    });
});

test.describe('Therapy Goals', () => {
    test('Goals page loads', async ({ page }) => {
        await page.goto('/goals');
        await page.waitForTimeout(2000);

        await expect(page.locator('text=Therapy Goals')).toBeVisible();
    });

    test('Add goal button is visible', async ({ page }) => {
        await page.goto('/goals');
        await page.waitForTimeout(2000);

        await expect(page.locator('text=Add Goal')).toBeVisible();
    });
});
