// ============================================
// PUSH NOTIFICATION ENGINE
// Web Push notifications for therapy reminders,
// appointment alerts, and community updates
// ============================================

import webPush from 'web-push';
import db from '../db.js';

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BN2qnUNfe7ns8EmTLcCPsL71DZ8ZJ13s3L_zGYR_BYiTkLxVd2FMLpG_UIZX2l0izOsdX979sIfcXJtVEFe4f8M';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'GKQXc_oVUUVNneLQ-wasndDIH7UCEQnFrrlSI5EGkEo';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:harshit.workmain@gmail.com';

// Configure web-push
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/**
 * Initialize push subscriptions table
 */
export function initPushTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            keys_p256dh TEXT NOT NULL,
            keys_auth TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME,
            active INTEGER DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);
    console.log('📬 Push Notifications: table initialized');
}

/**
 * Save a push subscription for a user
 */
export function saveSubscription(userId, subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        throw new Error('Invalid push subscription object');
    }

    const existing = db.prepare(
        'SELECT id FROM push_subscriptions WHERE endpoint = ?'
    ).get(subscription.endpoint);

    if (existing) {
        // Update existing subscription
        db.prepare(`
            UPDATE push_subscriptions 
            SET user_id = ?, keys_p256dh = ?, keys_auth = ?, active = 1, last_used_at = CURRENT_TIMESTAMP
            WHERE endpoint = ?
        `).run(userId, subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint);
        return { updated: true, success: true };
    }

    db.prepare(`
        INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
        VALUES (?, ?, ?, ?)
    `).run(userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);

    return { created: true, success: true };
}

/**
 * Remove a push subscription
 */
export function removeSubscription(endpoint) {
    db.prepare('UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?').run(endpoint);
    return { success: true };
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(userId, payload) {
    const subscriptions = db.prepare(
        'SELECT * FROM push_subscriptions WHERE user_id = ? AND active = 1'
    ).all(userId);

    if (subscriptions.length === 0) return { sent: 0, reason: 'no_subscriptions' };

    const notification = JSON.stringify({
        title: payload.title || 'NeuroBridge AI',
        body: payload.body || '',
        icon: payload.icon || '/brain-icon.png',
        badge: '/badge-icon.png',
        tag: payload.tag || 'neurobridge-notification',
        data: {
            url: payload.url || '/',
            type: payload.type || 'general',
            timestamp: new Date().toISOString()
        },
        actions: payload.actions || []
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth
            }
        };

        try {
            await webPush.sendNotification(pushSubscription, notification);
            db.prepare('UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(sub.id);
            sent++;
        } catch (err) {
            failed++;
            if (err.statusCode === 404 || err.statusCode === 410) {
                // Subscription expired — deactivate
                db.prepare('UPDATE push_subscriptions SET active = 0 WHERE id = ?').run(sub.id);
            }
            console.warn(`Push failed for sub ${sub.id}:`, err.message);
        }
    }

    return { sent, failed, total: subscriptions.length };
}

/**
 * Broadcast push notification to all active subscribers
 */
export async function broadcastPush(payload) {
    const subscriptions = db.prepare(
        'SELECT DISTINCT user_id FROM push_subscriptions WHERE active = 1'
    ).all();

    let totalSent = 0;
    for (const { user_id } of subscriptions) {
        const result = await sendPushToUser(user_id, payload);
        totalSent += result.sent;
    }

    return { sent: totalSent, users: subscriptions.length };
}

/**
 * Send therapy reminder push notification
 */
export async function sendTherapyReminder(userId, taskName) {
    return sendPushToUser(userId, {
        title: '🧩 Therapy Reminder',
        body: `Time for today's activity: ${taskName}`,
        tag: 'therapy-reminder',
        type: 'therapy',
        url: '/therapy',
        actions: [
            { action: 'start', title: '▶️ Start Now' },
            { action: 'later', title: '⏰ Remind Later' }
        ]
    });
}

/**
 * Send appointment reminder push notification
 */
export async function sendAppointmentReminder(userId, appointmentTime, clinicianName) {
    return sendPushToUser(userId, {
        title: '📅 Appointment Reminder',
        body: `Upcoming session with ${clinicianName} at ${appointmentTime}`,
        tag: 'appointment-reminder',
        type: 'appointment',
        url: '/appointments',
        actions: [
            { action: 'join', title: '🎥 Join Call' },
            { action: 'reschedule', title: '📋 Reschedule' }
        ]
    });
}

/**
 * Send community notification push
 */
export async function sendCommunityNotification(userId, title, message) {
    return sendPushToUser(userId, {
        title: `💬 ${title}`,
        body: message,
        tag: 'community-update',
        type: 'community',
        url: '/community'
    });
}

/**
 * Get push subscription status for a user
 */
export function getUserPushStatus(userId) {
    const subs = db.prepare(
        'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ? AND active = 1'
    ).get(userId);

    return {
        subscribed: subs.count > 0,
        subscription_count: subs.count
    };
}

/**
 * Get VAPID public key (needed by frontend to subscribe)
 */
export function getVapidPublicKey() {
    return VAPID_PUBLIC_KEY;
}

/**
 * Clean up expired subscriptions (call periodically)
 */
export function cleanupExpiredSubscriptions() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(
        'DELETE FROM push_subscriptions WHERE active = 0 AND last_used_at < ?'
    ).run(thirtyDaysAgo);
    return { cleaned: result.changes };
}
