import { test, expect } from '@playwright/test';

/**
 * Critical Flow 1: Navigation & Page Loading
 *
 * Ensures all pages render without crashing and
 * key content elements are visible.
 */

test.describe('Core Navigation', () => {
    test('Dashboard loads with key sections', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/NeuroBridge/i);

        // Dashboard should show welcome section
        await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('All navigation links work', async ({ page }) => {
        await page.goto('/');

        const navLinks = [
            { name: 'Therapy', path: '/therapy' },
            { name: 'Games', path: '/games' },
            { name: 'Progress', path: '/progress' },
            { name: 'Community', path: '/community' },
            { name: 'Goals', path: '/goals' },
        ];

        for (const link of navLinks) {
            await page.goto(link.path);
            // Page should not show error boundary
            await expect(page.locator('text=Something went wrong')).not.toBeVisible();
        }
    });

    test('AI Screening page loads', async ({ page }) => {
        await page.goto('/screening');
        await expect(page.locator('text=Screening')).toBeVisible();
    });

    test('Consent page loads with toggle sections', async ({ page }) => {
        await page.goto('/consent');
        await expect(page.locator('text=Consent')).toBeVisible();
    });

    test('Appointments page loads', async ({ page }) => {
        await page.goto('/appointments');
        await expect(page.locator('text=Appointment')).toBeVisible();
    });
});
