/**
 * API Configuration — Centralized endpoint management
 *
 * All frontend API calls should use this config
 * instead of hardcoded 'http://localhost:3001' strings.
 *
 * The backend supports both versioned (/api/v1) and legacy routes.
 * Frontend uses the base URL since routes have mixed prefixes.
 */

// Base URL — reads from environment or defaults to localhost
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// API version prefix (for explicit versioned calls)
export const API_VERSION = '/api/v1';

// Default export = base URL (matches the old behavior)
export const API = API_BASE;

// WebSocket URL (same base, no version prefix)
export const WS_URL = API_BASE;

export default API;
