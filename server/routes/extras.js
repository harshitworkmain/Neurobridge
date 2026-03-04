import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Helper to get user ID
function getUserId(req) {
    return (req.user && req.user.id) ? req.user.id : 1;
}

// ============================================
// USER PROFILE
// ============================================

// GET /users/:id — Get user profile
router.get('/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        const user = db.prepare('SELECT id, name, age_string, role, display_name FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// USER PREFERENCES (Sensory Mode, Dark Mode, Onboarding)
// ============================================

// GET /preferences — Get user preferences
router.get('/preferences', (req, res) => {
    try {
        const userId = getUserId(req);

        // Ensure preferences row exists
        db.prepare(`
      INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)
    `).run(userId);

        const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
        res.json({
            success: true,
            preferences: {
                sensory_mode: !!prefs.sensory_mode,
                dark_mode: !!prefs.dark_mode,
                onboarding_completed: !!prefs.onboarding_completed,
                ...(prefs.preferences_json ? JSON.parse(prefs.preferences_json) : {})
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /preferences — Update user preferences
router.patch('/preferences', (req, res) => {
    try {
        const userId = getUserId(req);
        const { sensory_mode, dark_mode, onboarding_completed, ...extra } = req.body;

        // Ensure row exists
        db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);

        const current = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId);
        const currentExtra = current?.preferences_json ? JSON.parse(current.preferences_json) : {};

        db.prepare(`
      UPDATE user_preferences SET
        sensory_mode = COALESCE(?, sensory_mode),
        dark_mode = COALESCE(?, dark_mode),
        onboarding_completed = COALESCE(?, onboarding_completed),
        preferences_json = ?
      WHERE user_id = ?
    `).run(
            sensory_mode != null ? (sensory_mode ? 1 : 0) : null,
            dark_mode != null ? (dark_mode ? 1 : 0) : null,
            onboarding_completed != null ? (onboarding_completed ? 1 : 0) : null,
            JSON.stringify({ ...currentExtra, ...extra }),
            userId
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// WEEKLY DIGEST (D5)
// ============================================

// GET /digest/weekly/:userId — Weekly progress digest
router.get('/digest/weekly/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        // User info
        const user = db.prepare('SELECT name, age_string FROM users WHERE id = ?').get(userId);

        // Game sessions this week
        const gameSessions = db.prepare(`
      SELECT gs.*, g.name as game_name, g.category
      FROM game_sessions gs
      JOIN games g ON gs.game_id = g.id
      WHERE gs.user_id = ? AND gs.started_at > ?
      ORDER BY gs.started_at DESC
    `).all(userId, oneWeekAgo);

        const gameStats = {
            total_sessions: gameSessions.length,
            total_play_time_minutes: Math.round(gameSessions.reduce((s, g) => s + (g.duration_seconds || 0), 0) / 60),
            avg_accuracy: gameSessions.length > 0
                ? Math.round(gameSessions.reduce((s, g) => s + (g.accuracy_score || 0), 0) / gameSessions.length * 100)
                : 0,
            games_played: [...new Set(gameSessions.map(g => g.game_name))]
        };

        // Previous week for comparison
        const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
        const prevSessions = db.prepare(`
      SELECT accuracy_score FROM game_sessions
      WHERE user_id = ? AND started_at > ? AND started_at <= ?
    `).all(userId, twoWeeksAgo, oneWeekAgo);

        const prevAvg = prevSessions.length > 0
            ? Math.round(prevSessions.reduce((s, g) => s + (g.accuracy_score || 0), 0) / prevSessions.length * 100)
            : null;

        gameStats.accuracy_change = prevAvg != null ? gameStats.avg_accuracy - prevAvg : null;

        // Therapy tasks this week
        const therapyTasks = db.prepare(`
      SELECT * FROM therapy_completion
      WHERE user_id = ? AND date > ?
    `).all(userId, oneWeekAgo.split('T')[0]);

        const completedTasks = therapyTasks.filter(t => t.status === 'completed');
        const therapyStats = {
            total_tasks: therapyTasks.length,
            completed: completedTasks.length,
            completion_rate: therapyTasks.length > 0
                ? Math.round(completedTasks.length / therapyTasks.length * 100)
                : 0
        };

        // Appointments this week
        const appointments = db.prepare(`
      SELECT * FROM appointments
      WHERE (patient_id = ? OR clinician_id = ?) AND scheduled_at > ?
      ORDER BY scheduled_at ASC
    `).all(userId, userId, oneWeekAgo);

        const appointmentStats = {
            total: appointments.length,
            completed: appointments.filter(a => a.status === 'completed').length,
            upcoming: appointments.filter(a => a.status === 'scheduled' && new Date(a.scheduled_at) > new Date()).length
        };

        // Screenings this week
        const screenings = db.prepare(`
      SELECT overall_score, risk_level FROM screenings
      WHERE user_id = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `).all(userId, oneWeekAgo);

        // Build digest message
        const parts = [];
        if (user) parts.push(`📊 Weekly Digest for ${user.name}`);

        if (gameStats.total_sessions > 0) {
            parts.push(`🎮 Played ${gameStats.total_sessions} game sessions (avg accuracy: ${gameStats.avg_accuracy}%${gameStats.accuracy_change != null ? `, ${gameStats.accuracy_change > 0 ? '+' : ''}${gameStats.accuracy_change}% from last week` : ''})`);
        }
        if (therapyStats.total_tasks > 0) {
            parts.push(`✅ Completed ${therapyStats.completed}/${therapyStats.total_tasks} therapy tasks (${therapyStats.completion_rate}% rate)`);
        }
        if (appointmentStats.upcoming > 0) {
            parts.push(`📅 ${appointmentStats.upcoming} upcoming appointment(s)`);
        }
        if (screenings.length > 0) {
            parts.push(`🧠 ${screenings.length} screening(s) — latest risk: ${screenings[0].risk_level}`);
        }

        res.json({
            success: true,
            digest: {
                user: user || {},
                period: { from: oneWeekAgo, to: new Date().toISOString() },
                games: gameStats,
                therapy: therapyStats,
                appointments: appointmentStats,
                screenings: { count: screenings.length, latest: screenings[0] || null },
                summary_text: parts.join('\n'),
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DATA EXPORT (F2)
// ============================================

// GET /export/:userId — Export all user data as JSON
router.get('/export/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const user = db.prepare('SELECT id, name, age_string, parent_email, role, display_name, account_status FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const screenings = db.prepare('SELECT * FROM screenings WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
        const therapyOutcomes = db.prepare('SELECT * FROM therapy_outcomes WHERE user_id = ?').all(userId);
        const therapyCompletion = db.prepare('SELECT * FROM therapy_completion WHERE user_id = ?').all(userId);
        const alerts = db.prepare('SELECT * FROM alerts WHERE user_id = ?').all(userId);
        const appointments = db.prepare('SELECT * FROM appointments WHERE patient_id = ? OR clinician_id = ?').all(userId, userId);
        const sessionNotes = db.prepare('SELECT * FROM session_notes WHERE patient_id = ?').all(userId);
        const gameProgress = db.prepare('SELECT * FROM game_progress WHERE user_id = ?').all(userId);
        const gameSessions = db.prepare('SELECT * FROM game_sessions WHERE user_id = ?').all(userId);
        const communityPosts = db.prepare('SELECT * FROM community_posts WHERE author_id = ?').all(userId);
        const communityComments = db.prepare('SELECT * FROM community_comments WHERE author_id = ?').all(userId);
        const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);

        const exportData = {
            export_metadata: {
                exported_at: new Date().toISOString(),
                platform: 'NeuroBridge AI v4.0',
                user_id: userId,
                disclaimer: 'This data export contains all information stored by NeuroBridge for this user. This data is not a diagnostic record.'
            },
            user,
            screenings,
            patient_analytics: analytics || null,
            therapy_outcomes: therapyOutcomes,
            therapy_completion: therapyCompletion,
            alerts,
            appointments,
            session_notes: sessionNotes,
            game_progress: gameProgress,
            game_sessions: gameSessions,
            community_posts: communityPosts,
            community_comments: communityComments,
            notifications
        };

        res.setHeader('Content-Disposition', `attachment; filename=neurobridge_export_user_${userId}_${Date.now()}.json`);
        res.setHeader('Content-Type', 'application/json');
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PATIENT 360 VIEW (B2)
// ============================================

// GET /patient360/:userId — Cross-module unified timeline
router.get('/patient360/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const user = db.prepare('SELECT id, name, age_string, role FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Build unified timeline
        const timeline = [];

        // Screenings
        const screenings = db.prepare(`
      SELECT id, timestamp as date, overall_score, risk_level, quality_label, fusion_mode
      FROM screenings WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT 20
    `).all(userId);
        screenings.forEach(s => timeline.push({
            type: 'screening',
            date: s.date,
            title: `AI Screening — ${s.risk_level || 'Unknown'} Risk`,
            detail: `Score: ${s.overall_score}${s.quality_label ? ` (Quality: ${s.quality_label})` : ''}`,
            data: s
        }));

        // Appointments
        const appointments = db.prepare(`
      SELECT a.*, c.name as clinician_name
      FROM appointments a
      LEFT JOIN users c ON a.clinician_id = c.id
      WHERE a.patient_id = ?
      ORDER BY a.scheduled_at DESC LIMIT 20
    `).all(userId);
        appointments.forEach(a => timeline.push({
            type: 'appointment',
            date: a.scheduled_at,
            title: `${a.type === 'consultation' ? 'Consultation' : a.type} with ${a.clinician_name || 'Clinician'}`,
            detail: `Status: ${a.status} | Duration: ${a.duration_minutes}min`,
            data: a
        }));

        // Session Notes
        const notes = db.prepare(`
      SELECT sn.*, c.name as clinician_name
      FROM session_notes sn
      LEFT JOIN users c ON sn.clinician_id = c.id
      WHERE sn.patient_id = ?
      ORDER BY sn.created_at DESC LIMIT 20
    `).all(userId);
        notes.forEach(n => timeline.push({
            type: 'session_note',
            date: n.created_at,
            title: `Session Notes by ${n.clinician_name || 'Clinician'}`,
            detail: n.content?.substring(0, 100) + (n.content?.length > 100 ? '...' : ''),
            data: n
        }));

        // Game Sessions
        const gameSessions = db.prepare(`
      SELECT gs.*, g.name as game_name, g.category
      FROM game_sessions gs
      JOIN games g ON gs.game_id = g.id
      WHERE gs.user_id = ?
      ORDER BY gs.started_at DESC LIMIT 20
    `).all(userId);
        gameSessions.forEach(gs => timeline.push({
            type: 'game_session',
            date: gs.started_at,
            title: `🎮 ${gs.game_name} — Level ${gs.level}`,
            detail: `Accuracy: ${Math.round((gs.accuracy_score || 0) * 100)}% | ${Math.round(gs.duration_seconds || 0)}s | ${gs.difficulty_adjustment}`,
            data: gs
        }));

        // Alerts
        const alerts = db.prepare(`
      SELECT * FROM alerts WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 10
    `).all(userId);
        alerts.forEach(a => timeline.push({
            type: 'alert',
            date: a.created_at,
            title: `⚠️ ${a.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
            detail: a.message,
            data: a
        }));

        // Therapy completion
        const therapy = db.prepare(`
      SELECT * FROM therapy_completion WHERE user_id = ?
      ORDER BY date DESC LIMIT 20
    `).all(userId);
        therapy.forEach(t => timeline.push({
            type: 'therapy_task',
            date: t.date,
            title: `${t.status === 'completed' ? '✅' : '⏳'} ${t.task_name || t.task_id}`,
            detail: `${t.duration_minutes}min`,
            data: t
        }));

        // Sort by date descending
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Summary stats
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
        const gameProgress = db.prepare(`
      SELECT gp.*, g.name as game_name FROM game_progress gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.user_id = ?
    `).all(userId);

        res.json({
            success: true,
            patient: user,
            timeline: timeline.slice(0, 50),
            summary: {
                total_screenings: screenings.length,
                total_appointments: appointments.length,
                total_game_sessions: gameSessions.length,
                total_alerts: alerts.length,
                risk_trend: analytics?.risk_trend || null,
                engagement_trend: analytics?.engagement_trend || null,
                latest_risk_level: screenings[0]?.risk_level || 'Unknown',
                game_progress: gameProgress
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// MODULE-SPECIFIC CONSENT (F3)
// ============================================

const MODULE_CONSENTS = ['screening', 'teleconsult_camera', 'teleconsult_mic', 'games_camera', 'games_gaze', 'community_tos'];

// GET /consent/status/:userId — Get consent status for all modules
router.get('/consent/status/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const consents = db.prepare(`
      SELECT consent_type, consent_given, MAX(timestamp) as last_updated
      FROM consent_audit
      WHERE user_id = ?
      GROUP BY consent_type
    `).all(userId);

        const consentMap = {};
        for (const type of MODULE_CONSENTS) {
            const found = consents.find(c => c.consent_type === type);
            consentMap[type] = {
                given: found ? !!found.consent_given : false,
                last_updated: found?.last_updated || null
            };
        }

        res.json({ success: true, consents: consentMap });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /consent/grant — Grant consent for a module
router.post('/consent/grant', (req, res) => {
    try {
        const userId = getUserId(req);
        const { consent_type } = req.body;

        if (!MODULE_CONSENTS.includes(consent_type)) {
            return res.status(400).json({ error: 'Invalid consent type', valid_types: MODULE_CONSENTS });
        }

        db.prepare(`
      INSERT INTO consent_audit (user_id, consent_type, consent_given, ip_address, user_agent)
      VALUES (?, ?, 1, ?, ?)
    `).run(userId, consent_type, req.ip || 'unknown', req.headers['user-agent'] || 'unknown');

        res.json({ success: true, message: `Consent granted for ${consent_type}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /consent/revoke — Revoke consent for a module
router.post('/consent/revoke', (req, res) => {
    try {
        const userId = getUserId(req);
        const { consent_type } = req.body;

        if (!MODULE_CONSENTS.includes(consent_type)) {
            return res.status(400).json({ error: 'Invalid consent type' });
        }

        db.prepare(`
      INSERT INTO consent_audit (user_id, consent_type, consent_given, ip_address, user_agent)
      VALUES (?, ?, 0, ?, ?)
    `).run(userId, consent_type, req.ip || 'unknown', req.headers['user-agent'] || 'unknown');

        res.json({ success: true, message: `Consent revoked for ${consent_type}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PRE-VISIT SUMMARY (B4)
// ============================================

// GET /previsit/:appointmentId — Auto-generate pre-visit summary for clinician
router.get('/previsit/:appointmentId', (req, res) => {
    try {
        const appointmentId = parseInt(req.params.appointmentId);
        if (isNaN(appointmentId)) return res.status(400).json({ error: 'Invalid appointment ID' });

        const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

        const patientId = appointment.patient_id;
        const patient = db.prepare('SELECT id, name, age_string FROM users WHERE id = ?').get(patientId);

        // Latest screening
        const latestScreening = db.prepare(`
      SELECT overall_score, risk_level, quality_label, fusion_mode, timestamp
      FROM screenings WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(patientId);

        // Recent screenings trend (last 5)
        const screeningTrend = db.prepare(`
      SELECT overall_score, risk_level, timestamp
      FROM screenings WHERE user_id = ?
      ORDER BY timestamp DESC LIMIT 5
    `).all(patientId);

        // Recent game performance
        const recentGames = db.prepare(`
      SELECT gs.game_id, g.name as game_name, g.category, gs.accuracy_score, gs.level, gs.started_at
      FROM game_sessions gs
      JOIN games g ON gs.game_id = g.id
      WHERE gs.user_id = ?
      ORDER BY gs.started_at DESC LIMIT 10
    `).all(patientId);

        // Game progress summary
        const gameProgress = db.prepare(`
      SELECT gp.game_id, g.name as game_name, gp.current_level, gp.avg_accuracy, gp.total_sessions, gp.streak_days
      FROM game_progress gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.user_id = ?
    `).all(patientId);

        // Last session notes
        const lastNotes = db.prepare(`
      SELECT content, follow_up_actions, created_at
      FROM session_notes WHERE patient_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(patientId);

        // Active alerts
        const activeAlerts = db.prepare(`
      SELECT type, message, severity, created_at
      FROM alerts WHERE user_id = ? AND resolved = 0
      ORDER BY created_at DESC
    `).all(patientId);

        // Therapy completion rate last 7 days
        const recentTherapy = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM therapy_completion
      WHERE user_id = ? AND date > date('now', '-7 days')
    `).get(patientId);

        // Analytics
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(patientId);

        res.json({
            success: true,
            summary: {
                appointment: {
                    id: appointment.id,
                    scheduled_at: appointment.scheduled_at,
                    type: appointment.type,
                    notes: appointment.notes
                },
                patient,
                clinical_snapshot: {
                    latest_screening: latestScreening || null,
                    screening_trend: screeningTrend,
                    risk_trend: analytics?.risk_trend || null,
                    engagement_trend: analytics?.engagement_trend || null,
                    active_alerts: activeAlerts
                },
                game_performance: {
                    progress: gameProgress,
                    recent_sessions: recentGames
                },
                therapy_adherence: {
                    last_7_days_total: recentTherapy?.total || 0,
                    last_7_days_completed: recentTherapy?.completed || 0,
                    completion_rate: recentTherapy?.total > 0
                        ? Math.round((recentTherapy.completed / recentTherapy.total) * 100)
                        : 0
                },
                last_session_notes: lastNotes ? {
                    content: lastNotes.content,
                    follow_up: lastNotes.follow_up_actions ? JSON.parse(lastNotes.follow_up_actions) : [],
                    date: lastNotes.created_at
                } : null,
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// THERAPY GOALS (B5)
// ============================================

// GET /goals/:userId — List therapy goals for a user
router.get('/goals/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const { status, domain } = req.query;
        let query = 'SELECT g.*, u.name as created_by_name FROM therapy_goals g LEFT JOIN users u ON g.created_by = u.id WHERE g.user_id = ?';
        const params = [userId];

        if (status) { query += ' AND g.status = ?'; params.push(status); }
        if (domain) { query += ' AND g.domain = ?'; params.push(domain); }

        query += ' ORDER BY CASE g.priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, g.created_at DESC';

        const goals = db.prepare(query).all(...params);

        // Calculate progress for each goal
        const enrichedGoals = goals.map(g => ({
            ...g,
            progress_pct: g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0
        }));

        const summary = {
            total: goals.length,
            active: goals.filter(g => g.status === 'active').length,
            completed: goals.filter(g => g.status === 'completed').length,
            paused: goals.filter(g => g.status === 'paused').length,
            domains: [...new Set(goals.map(g => g.domain))]
        };

        res.json({ success: true, goals: enrichedGoals, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /goals — Create a new therapy goal
router.post('/goals', (req, res) => {
    try {
        const userId = getUserId(req);
        const { user_id, title, description, domain, target_metric, target_value, priority, due_date } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const targetUserId = user_id || userId;

        const result = db.prepare(`
      INSERT INTO therapy_goals (user_id, created_by, title, description, domain, target_metric, target_value, priority, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(targetUserId, userId, title, description || '', domain || 'general', target_metric || '', target_value || 0, priority || 'medium', due_date || null);

        const goal = db.prepare('SELECT * FROM therapy_goals WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, goal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /goals/:goalId — Update a therapy goal (progress, status, etc.)
router.patch('/goals/:goalId', (req, res) => {
    try {
        const goalId = parseInt(req.params.goalId);
        if (isNaN(goalId)) return res.status(400).json({ error: 'Invalid goal ID' });

        const existing = db.prepare('SELECT * FROM therapy_goals WHERE id = ?').get(goalId);
        if (!existing) return res.status(404).json({ error: 'Goal not found' });

        const { current_value, status, title, description, priority, due_date } = req.body;

        const updates = [];
        const params = [];

        if (current_value !== undefined) { updates.push('current_value = ?'); params.push(current_value); }
        if (status) {
            updates.push('status = ?'); params.push(status);
            if (status === 'completed') { updates.push('completed_at = ?'); params.push(new Date().toISOString()); }
        }
        if (title) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (priority) { updates.push('priority = ?'); params.push(priority); }
        if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }

        updates.push('updated_at = ?'); params.push(new Date().toISOString());
        params.push(goalId);

        db.prepare(`UPDATE therapy_goals SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        const updated = db.prepare('SELECT * FROM therapy_goals WHERE id = ?').get(goalId);

        // Auto-complete if target reached
        if (updated.target_value > 0 && updated.current_value >= updated.target_value && updated.status === 'active') {
            db.prepare('UPDATE therapy_goals SET status = ?, completed_at = ? WHERE id = ?').run('completed', new Date().toISOString(), goalId);
            updated.status = 'completed';
        }

        res.json({ success: true, goal: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /goals/:goalId — Delete a therapy goal
router.delete('/goals/:goalId', (req, res) => {
    try {
        const goalId = parseInt(req.params.goalId);
        if (isNaN(goalId)) return res.status(400).json({ error: 'Invalid goal ID' });

        const existing = db.prepare('SELECT * FROM therapy_goals WHERE id = ?').get(goalId);
        if (!existing) return res.status(404).json({ error: 'Goal not found' });

        db.prepare('DELETE FROM therapy_goals WHERE id = ?').run(goalId);
        res.json({ success: true, message: 'Goal deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

