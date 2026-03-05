// ============================================
// Push Notification Manager
// Frontend utility for subscribing to push notifications
// ============================================

import { API_BASE } from '../config/api';

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
}

/**
 * Request notification permission from user
 */
export async function requestPermission() {
    if (!isPushSupported()) return 'unsupported';
    const permission = await Notification.requestPermission();
    return permission;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        console.log('✅ Service Worker registered:', registration.scope);
        return registration;
    } catch (err) {
        console.error('❌ Service Worker registration failed:', err);
        return null;
    }
}

/**
 * Subscribe to push notifications
 * @returns {Object} Result with subscription info
 */
export async function subscribeToPush() {
    try {
        // 1. Request permission
        const permission = await requestPermission();
        if (permission !== 'granted') {
            return { success: false, reason: 'permission_denied' };
        }

        // 2. Register service worker
        const registration = await registerServiceWorker();
        if (!registration) {
            return { success: false, reason: 'sw_registration_failed' };
        }

        // 3. Get VAPID key from server
        const keyResponse = await fetch(`${API_BASE}/push/vapid-key`);
        const keyData = await keyResponse.json();
        if (!keyData.publicKey) {
            return { success: false, reason: 'vapid_key_missing' };
        }

        // 4. Subscribe to push
        const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
        });

        // 5. Send subscription to server
        const saveResponse = await fetch(`${API_BASE}/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() })
        });
        const saveResult = await saveResponse.json();

        return { success: true, ...saveResult };
    } catch (err) {
        console.error('Push subscription failed:', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Unsubscribe locally
            await subscription.unsubscribe();

            // Notify server
            await fetch(`${API_BASE}/push/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
        }

        return { success: true };
    } catch (err) {
        console.error('Push unsubscribe failed:', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Check if currently subscribed to push
 */
export async function isSubscribedToPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}

/**
 * Send a test notification via the API
 */
export async function sendTestNotification() {
    const response = await fetch(`${API_BASE}/push/test`, { method: 'POST' });
    return response.json();
}

// ============================================
// HELPERS
// ============================================

/**
 * Convert VAPID key from base64 URL-safe to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
