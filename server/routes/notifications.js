import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper to get user ID with fallback
function getUserId(req) {
    return (req.user && req.user.id) ? req.user.id : 1;
}

// ============================================
// NOTIFICATION ROUTES
// ============================================

// GET /notifications — Get user's notifications
router.get('/notifications', (req, res) => {
    try {
        const userId = getUserId(req);
        const limit = parseInt(req.query.limit) || 20;

        const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);

        const unreadCount = db.prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
        ).get(userId).count;

        res.json({ success: true, notifications, unread_count: unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /notifications/:id/read — Mark notification as read
router.post('/notifications/:id/read', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid notification ID' });

        db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, getUserId(req));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /notifications/read-all — Mark all notifications as read
router.post('/notifications/read-all', (req, res) => {
    try {
        const userId = getUserId(req);
        db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /notifications/unread-count — Get unread notification count (lightweight)
router.get('/notifications/unread-count', (req, res) => {
    try {
        const userId = getUserId(req);
        const count = db.prepare(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
        ).get(userId).count;

        res.json({ success: true, unread_count: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
