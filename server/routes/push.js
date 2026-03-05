import { Router } from 'express';
import {
    saveSubscription,
    removeSubscription,
    sendPushToUser,
    getUserPushStatus,
    getVapidPublicKey
} from '../engines/pushEngine.js';

const router = Router();

// Helper to get user ID with fallback
function getUserId(req) {
    return (req.user && req.user.id) ? req.user.id : 1;
}

// GET /push/vapid-key — Get VAPID public key for frontend subscription
router.get('/push/vapid-key', (req, res) => {
    res.json({ success: true, publicKey: getVapidPublicKey() });
});

// POST /push/subscribe — Save push subscription
router.post('/push/subscribe', (req, res) => {
    try {
        const userId = getUserId(req);
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({ error: 'subscription object is required' });
        }

        const result = saveSubscription(userId, subscription);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /push/unsubscribe — Remove push subscription
router.post('/push/unsubscribe', (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

        const result = removeSubscription(endpoint);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /push/status — Get user's push subscription status
router.get('/push/status', (req, res) => {
    const userId = getUserId(req);
    const status = getUserPushStatus(userId);
    res.json({ success: true, ...status });
});

// POST /push/test — Send a test push notification to current user
router.post('/push/test', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await sendPushToUser(userId, {
            title: '🧠 NeuroBridge AI',
            body: 'Push notifications are working! You will receive therapy reminders and updates here.',
            tag: 'test-notification',
            type: 'test',
            url: '/'
        });
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
