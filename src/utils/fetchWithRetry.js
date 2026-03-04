/**
 * fetchWithRetry — Resilient API call wrapper
 *
 * Automatically retries failed API requests with exponential backoff.
 * Designed for NeuroBridge AI's therapy data which is critical and
 * should not be lost due to transient network issues.
 *
 * @param {string} url - The URL to fetch
 * @param {object} options - Standard fetch options
 * @param {object} config - Retry configuration
 * @param {number} config.maxRetries - Maximum number of retries (default: 3)
 * @param {number} config.baseDelay - Initial delay in ms (default: 1000)
 * @param {number} config.maxDelay - Maximum delay cap in ms (default: 10000)
 * @param {number[]} config.retryOn - HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504])
 * @returns {Promise<Response>} - The fetch Response
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        retryOn = [408, 429, 500, 502, 503, 504]
    } = config;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // If the response is OK or a non-retryable error, return it
            if (response.ok || !retryOn.includes(response.status)) {
                return response;
            }

            // Retryable status code
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

            if (attempt < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                const jitter = delay * (0.5 + Math.random() * 0.5);
                console.warn(`[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed (${response.status}). Retrying in ${Math.round(jitter)}ms...`);
                await new Promise(resolve => setTimeout(resolve, jitter));
            }
        } catch (error) {
            // Network error (offline, DNS failure, etc.)
            lastError = error;

            if (attempt < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                const jitter = delay * (0.5 + Math.random() * 0.5);
                console.warn(`[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed (${error.message}). Retrying in ${Math.round(jitter)}ms...`);
                await new Promise(resolve => setTimeout(resolve, jitter));
            }
        }
    }

    throw lastError;
}

/**
 * isOnline — Check if the browser has network connectivity
 * @returns {boolean}
 */
export function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * onConnectionChange — Listen for online/offline events
 * @param {function} callback - Called with { online: boolean }
 * @returns {function} - Cleanup function to remove listeners
 */
export function onConnectionChange(callback) {
    const handleOnline = () => callback({ online: true });
    const handleOffline = () => callback({ online: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}

export default fetchWithRetry;
