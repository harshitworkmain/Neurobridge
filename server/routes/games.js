import { Router } from 'express';
import {
    getActiveGames,
    getGameConfig,
    saveGameSession,
    getUserGameProgress,
    getGameHistory,
    getRecommendations,
    createManualRecommendation,
    getGameAnalytics
} from '../engines/gameEngine.js';

const router = Router();

// ============================================
// GAME ROUTES
// ============================================

// GET /games — List all active games
router.get('/games', (req, res) => {
    try {
        const games = getActiveGames();
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /games/:gameId — Game config + metadata
router.get('/games/:gameId', (req, res) => {
    try {
        const game = getGameConfig(req.params.gameId);
        res.json({ success: true, game });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// POST /games/session — Save completed game session
router.post('/games/session', (req, res) => {
    try {
        const userId = (req.user && req.user.id) ? req.user.id : 1;
        const result = saveGameSession({
            user_id: userId,
            ...req.body
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /games/progress/:userId — User's progress across all games
router.get('/games/progress/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const progress = getUserGameProgress(userId);
        res.json({ success: true, ...progress });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /games/history/:userId/:gameId — Session history for specific game
router.get('/games/history/:userId/:gameId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const history = getGameHistory(userId, req.params.gameId);
        res.json({ success: true, sessions: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /games/recommendations/:userId — Adaptive game recommendations
router.get('/games/recommendations/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const recommendations = getRecommendations(userId);
        res.json({ success: true, recommendations });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /games/recommendations — Clinician creates manual recommendation
router.post('/games/recommendations', (req, res) => {
    try {
        const result = createManualRecommendation(req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /games/analytics/:userId — Aggregate game performance analytics
router.get('/games/analytics/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const analytics = getGameAnalytics(userId);
        res.json({ success: true, ...analytics });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
