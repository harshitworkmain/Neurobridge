import db from '../db.js';

// ============================================
// GAME ENGINE
// Handles: Game sessions, progress, adaptive recommendations
// ============================================

/**
 * Get all active games
 */
export function getActiveGames() {
    return db.prepare('SELECT * FROM games WHERE is_active = 1 ORDER BY category, name').all();
}

/**
 * Get single game config
 */
export function getGameConfig(gameId) {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) throw new Error(`Game not found: ${gameId}`);
    return game;
}

/**
 * Save a completed game session and update progress
 */
export function saveGameSession({
    user_id, game_id, duration_seconds, level, accuracy_score,
    completion_rate, avg_response_time_ms, error_count, hint_usage,
    engagement_score, gaze_metrics_json, raw_events_json, caregiver_notes_json
}) {
    if (!user_id || !game_id) throw new Error('user_id and game_id are required');

    // Validate game exists
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(game_id);
    if (!game) throw new Error(`Game not found: ${game_id}`);

    // Calculate difficulty adjustment
    const difficulty_adjustment = calculateDifficultyAdjustment(user_id, game_id, accuracy_score || 0);

    // Derive engagement if not provided
    const derivedEngagement = engagement_score != null ? engagement_score :
        Math.min(1, ((completion_rate || 0) * 0.5 + (1 - Math.min(1, (error_count || 0) / 10)) * 0.3 +
            (duration_seconds ? Math.min(1, duration_seconds / 300) : 0.5) * 0.2));

    // Insert session
    const stmt = db.prepare(`
    INSERT INTO game_sessions (
      user_id, game_id, duration_seconds, level, accuracy_score,
      completion_rate, avg_response_time_ms, error_count, hint_usage,
      engagement_score, difficulty_adjustment, gaze_metrics_json,
      raw_events_json, caregiver_notes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const info = stmt.run(
        user_id, game_id,
        duration_seconds || 0,
        level || 1,
        accuracy_score || 0,
        completion_rate || 0,
        avg_response_time_ms || 0,
        error_count || 0,
        hint_usage || 0,
        derivedEngagement,
        difficulty_adjustment,
        gaze_metrics_json ? JSON.stringify(gaze_metrics_json) : null,
        raw_events_json ? JSON.stringify(raw_events_json) : null,
        caregiver_notes_json ? JSON.stringify(caregiver_notes_json) : null
    );

    // Update progress
    updateGameProgress(user_id, game_id, accuracy_score || 0, duration_seconds || 0, difficulty_adjustment);

    // Run adaptive recommendations
    updateRecommendations(user_id);

    // Create notification for milestones
    checkAndNotifyMilestones(user_id, game_id);

    return {
        session_id: info.lastInsertRowid,
        difficulty_adjustment,
        engagement_score: derivedEngagement,
        success: true
    };
}

/**
 * Get user's progress across all games
 */
export function getUserGameProgress(userId) {
    const progress = db.prepare(`
    SELECT 
      gp.*,
      g.name as game_name,
      g.category,
      g.target_skill,
      g.description,
      g.max_level
    FROM game_progress gp
    JOIN games g ON gp.game_id = g.id
    WHERE gp.user_id = ?
    ORDER BY gp.last_played_at DESC
  `).all(userId);

    // Also get games not yet played
    const playedIds = new Set(progress.map(p => p.game_id));
    const unplayed = db.prepare('SELECT * FROM games WHERE is_active = 1').all()
        .filter(g => !playedIds.has(g.id))
        .map(g => ({
            game_id: g.id,
            game_name: g.name,
            category: g.category,
            target_skill: g.target_skill,
            description: g.description,
            max_level: g.max_level,
            current_level: 0,
            total_sessions: 0,
            best_accuracy: 0,
            avg_accuracy: 0,
            total_play_time_seconds: 0,
            streak_days: 0,
            badges_json: '[]',
            not_started: true
        }));

    return { played: progress, unplayed, total_games: progress.length + unplayed.length };
}

/**
 * Get session history for a specific game
 */
export function getGameHistory(userId, gameId) {
    return db.prepare(`
    SELECT * FROM game_sessions
    WHERE user_id = ? AND game_id = ?
    ORDER BY started_at DESC
    LIMIT 50
  `).all(userId, gameId);
}

/**
 * Get adaptive game recommendations for a user
 */
export function getRecommendations(userId) {
    const recs = db.prepare(`
    SELECT 
      gr.*,
      g.name as game_name,
      g.category,
      g.target_skill,
      g.description
    FROM game_recommendations gr
    JOIN games g ON gr.game_id = g.id
    WHERE gr.user_id = ? AND gr.dismissed = 0
    ORDER BY gr.priority ASC
    LIMIT 5
  `).all(userId);

    return recs;
}

/**
 * Create a manual recommendation (clinician)
 */
export function createManualRecommendation({ user_id, game_id, reason, priority }) {
    if (!user_id || !game_id) throw new Error('user_id and game_id are required');

    const stmt = db.prepare(`
    INSERT INTO game_recommendations (user_id, game_id, reason, priority, source)
    VALUES (?, ?, ?, ?, 'clinician')
  `);

    const info = stmt.run(user_id, game_id, reason || 'Clinician recommendation', priority || 3);

    // Notify patient
    const game = db.prepare('SELECT name FROM games WHERE id = ?').get(game_id);
    createNotification(user_id, 'game_recommended', 'games',
        'New Game Recommended',
        `Your clinician recommends playing ${game?.name || game_id}: ${reason || ''}`,
        `/games/${game_id}`
    );

    return { id: info.lastInsertRowid, success: true };
}

/**
 * Get aggregate game analytics for a user
 */
export function getGameAnalytics(userId) {
    // Overall stats
    const overallStats = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(duration_seconds) as total_play_time,
      AVG(accuracy_score) as avg_accuracy,
      AVG(engagement_score) as avg_engagement,
      MIN(started_at) as first_played,
      MAX(started_at) as last_played
    FROM game_sessions
    WHERE user_id = ?
  `).get(userId);

    // Per-category stats
    const categoryStats = db.prepare(`
    SELECT 
      g.category,
      COUNT(*) as sessions,
      AVG(gs.accuracy_score) as avg_accuracy,
      AVG(gs.engagement_score) as avg_engagement,
      SUM(gs.duration_seconds) as total_time
    FROM game_sessions gs
    JOIN games g ON gs.game_id = g.id
    WHERE gs.user_id = ?
    GROUP BY g.category
  `).all(userId);

    // Accuracy trend (last 20 sessions)
    const accuracyTrend = db.prepare(`
    SELECT 
      game_id,
      accuracy_score,
      level,
      started_at
    FROM game_sessions
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT 20
  `).all(userId).reverse();

    // Streak info
    const progress = db.prepare(`
    SELECT MAX(streak_days) as max_streak
    FROM game_progress
    WHERE user_id = ?
  `).get(userId);

    return {
        overall: {
            ...overallStats,
            total_play_time_minutes: Math.round((overallStats.total_play_time || 0) / 60),
            avg_accuracy: Math.round((overallStats.avg_accuracy || 0) * 100) / 100,
            avg_engagement: Math.round((overallStats.avg_engagement || 0) * 100) / 100
        },
        by_category: categoryStats,
        accuracy_trend: accuracyTrend,
        max_streak: progress?.max_streak || 0
    };
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Calculate difficulty adjustment based on recent performance
 * Rule: 3 consecutive ≥80% → up, 2 consecutive ≤40% → down, else hold
 */
function calculateDifficultyAdjustment(userId, gameId, currentAccuracy) {
    const recentSessions = db.prepare(`
    SELECT accuracy_score FROM game_sessions
    WHERE user_id = ? AND game_id = ?
    ORDER BY started_at DESC
    LIMIT 3
  `).all(userId, gameId);

    const scores = [currentAccuracy, ...recentSessions.map(s => s.accuracy_score)];

    // Check for level up: 3 consecutive ≥ 0.80
    if (scores.length >= 3 && scores.slice(0, 3).every(s => s >= 0.80)) {
        return 'up';
    }

    // Check for level down: 2 consecutive ≤ 0.40
    if (scores.length >= 2 && scores.slice(0, 2).every(s => s <= 0.40)) {
        return 'down';
    }

    return 'hold';
}

/**
 * Update aggregate game progress after a session
 */
function updateGameProgress(userId, gameId, accuracy, durationSeconds, difficultyAdjustment) {
    const existing = db.prepare('SELECT * FROM game_progress WHERE user_id = ? AND game_id = ?').get(userId, gameId);
    const today = new Date().toISOString().split('T')[0];

    if (existing) {
        // Calculate new level
        let newLevel = existing.current_level;
        const game = db.prepare('SELECT max_level FROM games WHERE id = ?').get(gameId);

        if (difficultyAdjustment === 'up' && newLevel < (game?.max_level || 5)) {
            newLevel++;
        } else if (difficultyAdjustment === 'down' && newLevel > 1) {
            newLevel--;
        }

        // Calculate streak
        let streak = existing.streak_days;
        const lastPlayed = existing.last_played_at ? existing.last_played_at.split('T')[0] : null;
        if (lastPlayed === today) {
            // Same day, don't change streak
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (lastPlayed === yesterday) {
                streak++;
            } else {
                streak = 1; // Reset streak
            }
        }

        // Update
        const newTotal = existing.total_sessions + 1;
        const newAvg = ((existing.avg_accuracy * existing.total_sessions) + accuracy) / newTotal;

        db.prepare(`
      UPDATE game_progress SET
        current_level = ?,
        total_sessions = ?,
        best_accuracy = MAX(best_accuracy, ?),
        avg_accuracy = ?,
        total_play_time_seconds = total_play_time_seconds + ?,
        last_played_at = CURRENT_TIMESTAMP,
        streak_days = ?
      WHERE user_id = ? AND game_id = ?
    `).run(newLevel, newTotal, accuracy, newAvg, durationSeconds, streak, userId, gameId);
    } else {
        // First session for this game
        db.prepare(`
      INSERT INTO game_progress (user_id, game_id, current_level, total_sessions, best_accuracy, avg_accuracy, total_play_time_seconds, last_played_at, streak_days)
      VALUES (?, ?, 1, 1, ?, ?, ?, CURRENT_TIMESTAMP, 1)
    `).run(userId, gameId, accuracy, accuracy, durationSeconds);
    }
}

/**
 * Update adaptive recommendations based on analytics + game data
 */
function updateRecommendations(userId) {
    try {
        // Get patient analytics (if exists)
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);

        // Get game progress
        const progress = db.prepare('SELECT * FROM game_progress WHERE user_id = ?').all(userId);
        const playedGameIds = new Set(progress.map(p => p.game_id));

        // Clear old system recommendations  
        db.prepare("DELETE FROM game_recommendations WHERE user_id = ? AND source = 'system'").run(userId);

        const recommendations = [];

        // Rule 1: If low fixation_avg in screenings → attention games
        if (analytics && analytics.gaze_variance_trend > 0.5) {
            if (!playedGameIds.has('gaze_garden') || getLatestAccuracy(userId, 'gaze_garden') < 0.7) {
                recommendations.push({ game_id: 'gaze_garden', reason: 'High gaze variance detected — attention training recommended', priority: 1 });
            }
        }

        // Rule 2: If no game played in 3+ days → recommend easiest unplayed
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
        const recentSession = db.prepare('SELECT id FROM game_sessions WHERE user_id = ? AND started_at > ?').get(userId, threeDaysAgo);
        if (!recentSession) {
            const unplayed = db.prepare('SELECT id FROM games WHERE is_active = 1').all()
                .filter(g => !playedGameIds.has(g.id));
            if (unplayed.length > 0) {
                recommendations.push({ game_id: unplayed[0].id, reason: "Haven't played in a while — try something new!", priority: 2 });
            } else {
                // Recommend game with lowest accuracy
                const lowest = progress.sort((a, b) => a.avg_accuracy - b.avg_accuracy)[0];
                if (lowest) {
                    recommendations.push({ game_id: lowest.game_id, reason: 'Practice makes progress — try improving your score!', priority: 3 });
                }
            }
        }

        // Rule 3: If current game accuracy > 85% for 5+ sessions → next category
        for (const p of progress) {
            if (p.avg_accuracy > 0.85 && p.total_sessions >= 5) {
                const currentCategory = db.prepare('SELECT category FROM games WHERE id = ?').get(p.game_id)?.category;
                const nextGame = db.prepare('SELECT id FROM games WHERE is_active = 1 AND category != ? AND id NOT IN (SELECT game_id FROM game_progress WHERE user_id = ? AND total_sessions > 0)').get(currentCategory, userId);
                if (nextGame) {
                    recommendations.push({ game_id: nextGame.id, reason: `Great progress in ${currentCategory}! Time to try a new skill area.`, priority: 4 });
                    break;
                }
            }
        }

        // Insert recommendations
        const insertRec = db.prepare(`
      INSERT INTO game_recommendations (user_id, game_id, reason, priority, source)
      VALUES (?, ?, ?, ?, 'system')
    `);

        for (const rec of recommendations.slice(0, 3)) {
            try {
                insertRec.run(userId, rec.game_id, rec.reason, rec.priority);
            } catch (e) {
                // Ignore duplicates
            }
        }
    } catch (e) {
        console.warn('Recommendation update failed:', e.message);
    }
}

function getLatestAccuracy(userId, gameId) {
    const session = db.prepare('SELECT accuracy_score FROM game_sessions WHERE user_id = ? AND game_id = ? ORDER BY started_at DESC LIMIT 1').get(userId, gameId);
    return session?.accuracy_score || 0;
}

/**
 * Check for milestones and create notifications
 */
function checkAndNotifyMilestones(userId, gameId) {
    const progress = db.prepare('SELECT * FROM game_progress WHERE user_id = ? AND game_id = ?').get(userId, gameId);
    if (!progress) return;

    const game = db.prepare('SELECT name FROM games WHERE id = ?').get(gameId);
    const gameName = game?.name || gameId;

    // First session ever
    if (progress.total_sessions === 1) {
        createNotification(userId, 'milestone', 'games', '🎮 First Game!', `You played ${gameName} for the first time!`, `/games/${gameId}`);

        // Add badge
        const badges = JSON.parse(progress.badges_json || '[]');
        badges.push({ type: 'first_game', game_id: gameId, earned_at: new Date().toISOString() });
        db.prepare('UPDATE game_progress SET badges_json = ? WHERE user_id = ? AND game_id = ?').run(JSON.stringify(badges), userId, gameId);
    }

    // 5-day streak
    if (progress.streak_days === 5) {
        createNotification(userId, 'milestone', 'games', '🔥 5-Day Streak!', `Amazing consistency with ${gameName}!`, `/games/${gameId}`);

        const badges = JSON.parse(progress.badges_json || '[]');
        if (!badges.find(b => b.type === 'streak_5')) {
            badges.push({ type: 'streak_5', game_id: gameId, earned_at: new Date().toISOString() });
            db.prepare('UPDATE game_progress SET badges_json = ? WHERE user_id = ? AND game_id = ?').run(JSON.stringify(badges), userId, gameId);
        }
    }

    // Level up
    if (progress.current_level > 1) {
        const prevSession = db.prepare('SELECT level FROM game_sessions WHERE user_id = ? AND game_id = ? ORDER BY started_at DESC LIMIT 1 OFFSET 1').get(userId, gameId);
        if (prevSession && progress.current_level > prevSession.level) {
            createNotification(userId, 'milestone', 'games', '⬆️ Level Up!', `You reached Level ${progress.current_level} in ${gameName}!`, `/games/${gameId}`);
        }
    }
}

function createNotification(userId, type, sourceModule, title, message, link) {
    try {
        db.prepare(`
      INSERT INTO notifications (user_id, type, source_module, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, sourceModule, title, message, link);
    } catch (e) {
        console.warn('Notification creation failed:', e.message);
    }
}
