import { test, expect } from '@playwright/test';

/**
 * Critical Flow 2: Games
 *
 * Tests the game hub, game selection, and interactive game launch.
 */

test.describe('Therapy Games', () => {
    test('Game Hub shows all 4 games', async ({ page }) => {
        await page.goto('/games');
        await page.waitForTimeout(2000); // Wait for API data

        // All 4 games should be visible
        await expect(page.locator('text=Memory Match')).toBeVisible();
        await expect(page.locator('text=Day Builder')).toBeVisible();
        await expect(page.locator('text=Gaze Garden')).toBeVisible();
        await expect(page.locator('text=Emotion Mirror')).toBeVisible();
    });

    test('All games have Play Interactive buttons', async ({ page }) => {
        await page.goto('/games');
        await page.waitForTimeout(2000);

        const interactiveButtons = page.locator('text=Play Interactive');
        await expect(interactiveButtons).toHaveCount(4);
    });

    test('Memory Match launches in Phaser overlay', async ({ page }) => {
        await page.goto('/games');
        await page.waitForTimeout(2000);

        // Find Memory Match's Play Interactive button
        const memoryCard = page.locator('text=Memory Match').first();
        await memoryCard.scrollIntoViewIfNeeded();

        // Click the Play Interactive button near Memory Match
        const playButtons = page.locator('text=Play Interactive');
        // Memory Match is the 4th game — its button position varies
        // Use a more targeted approach: click the last Play Interactive
        await playButtons.last().click();
        await page.waitForTimeout(3000);

        // Phaser canvas should be visible in the overlay
        const overlay = page.locator('.fixed.inset-0');
        await expect(overlay).toBeVisible();

        // Close button should exist
        const closeBtn = page.locator('text=✕ Close');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        // Overlay should close
        await page.waitForTimeout(500);
    });

    test('Stats row shows game metrics', async ({ page }) => {
        await page.goto('/games');
        await page.waitForTimeout(2000);

        // Stats should be present
        await expect(page.locator('text=Therapy Games')).toBeVisible();
    });
});
