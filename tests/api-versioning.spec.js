import { test, expect } from '@playwright/test';

/**
 * Critical Flow 5: API Versioning
 *
 * Tests that both versioned (/api/v1) and legacy (un-prefixed) 
 * API routes work correctly.
 */

const API_BASE = 'http://localhost:3001';

test.describe('API Versioning', () => {
    test('Legacy un-prefixed routes still work', async ({ request }) => {
        const response = await request.get(`${API_BASE}/games`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.games).toBeDefined();
        expect(data.games.length).toBe(4);
    });

    test('Versioned /api/v1 routes work', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/games`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.games).toBeDefined();
        expect(data.games.length).toBe(4);
    });

    test('Community categories via versioned route', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/community/categories`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.categories).toBeDefined();
    });

    test('Notifications via versioned route', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/notifications`);
        expect(response.status()).toBe(200);
    });

    test('User preferences via versioned route', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/preferences`);
        expect(response.status()).toBe(200);
    });

    test('Game progress via versioned route', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/v1/games/progress/1`);
        expect(response.status()).toBe(200);
    });
});
