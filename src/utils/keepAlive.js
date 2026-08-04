/**
 * Keep-Alive Utility — Prevents Render cold-start by pinging backend
 *
 * Render free-tier backends sleep after ~15 minutes of inactivity.
 * This module sends periodic GET /api/health pings every 4 minutes
 * to keep the container warm while the app is active.
 */
import { API_BASE } from '../config/api.js';

let keepAliveInterval = null;

/**
 * Start background keep-alive pings every 4 minutes.
 * Safe to call multiple times — only one interval will run.
 */
export function startKeepAlivePing() {
    if (keepAliveInterval) return; // Already running

    // Immediate first ping
    pingBackendNow();

    // Then every 4 minutes
    keepAliveInterval = setInterval(() => {
        pingBackendNow();
    }, 4 * 60 * 1000);

    console.log('🏓 Keep-alive pings started (every 4 min)');
}

/**
 * Stop keep-alive pings (e.g. on app unmount).
 */
export function stopKeepAlivePing() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('🏓 Keep-alive pings stopped');
    }
}

/**
 * Trigger a single immediate background health check.
 * Use this when navigating to critical pages (/screening, /therapy)
 * to pre-warm the backend before the user needs it.
 */
export async function pingBackendNow() {
    try {
        const res = await fetch(`${API_BASE}/api/health`, {
            method: 'GET',
            cache: 'no-store',
        });
        if (res.ok) {
            console.log('✅ Backend is online');
            return true;
        }
        console.warn('⚠️ Backend responded with status:', res.status);
        return false;
    } catch (err) {
        console.warn('⚠️ Backend ping failed (may be cold-starting):', err.message);
        return false;
    }
}

/**
 * Fetch with exponential backoff retry.
 * Used for critical API calls (e.g. POST /api/screenings) that may
 * hit a cold-starting backend on Render free tier.
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Standard fetch options
 * @param {Object} retryConfig - Retry configuration
 * @param {number} retryConfig.maxRetries - Max retry attempts (default: 5)
 * @param {number} retryConfig.baseDelay - Initial delay in ms (default: 2000)
 * @param {number} retryConfig.maxDelay - Max delay cap in ms (default: 15000)
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithRetry(url, options = {}, { maxRetries = 5, baseDelay = 2000, maxDelay = 15000 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok || response.status < 500) {
                return response; // Success or client error (don't retry 4xx)
            }
            // Server error — retry
            lastError = new Error(`Server responded with ${response.status}`);
            console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed: ${response.status}`);
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} network error:`, err.message);
        }

        if (attempt < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            const jitter = delay * (0.5 + Math.random() * 0.5); // Add jitter
            console.log(`⏳ Retrying in ${Math.round(jitter)}ms...`);
            await new Promise(resolve => setTimeout(resolve, jitter));
        }
    }
    throw lastError;
}
