import cron from 'node-cron';
import db from './db.js';

/**
 * Scheduler — Automated background tasks using node-cron
 * 
 * Jobs:
 *  1. Daily therapy task generation (7:00 AM)
 *  2. Weekly digest data compilation (Sunday 8:00 AM)
 *  3. Stale notification cleanup (daily midnight)
 *  4. Game streak reset check (daily 11:59 PM)
 */

export function initScheduler() {
    console.log('📅 Initializing scheduler...');

    // ─── JOB 1: Daily Therapy Task Generation (7:00 AM) ───────────
    cron.schedule('0 7 * * *', () => {
        console.log('[Scheduler] Running daily therapy task generation...');
        try {
            const users = db.prepare('SELECT DISTINCT user_id FROM therapy_tasks').all();

            for (const { user_id } of users) {
                const today = new Date().toISOString().split('T')[0];
                const existing = db.prepare(
                    'SELECT COUNT(*) as count FROM therapy_task_completion WHERE user_id = ? AND DATE(completed_at) = ?'
                ).get(user_id, today);

                if (existing.count === 0) {
                    console.log(`  ➜ Tasks ready for user ${user_id}`);
                }
            }

            // Create a notification for users with pending tasks
            const usersWithTasks = db.prepare(`
                SELECT DISTINCT tt.user_id 
                FROM therapy_tasks tt 
                WHERE tt.is_active = 1
            `).all();

            for (const { user_id } of usersWithTasks) {
                try {
                    db.prepare(`
                        INSERT INTO notifications (user_id, type, source_module, title, message, link, created_at)
                        VALUES (?, 'therapy_reminder', 'therapy', '🌟 Good Morning!', 'Your therapy activities are ready!', '/therapy', datetime('now'))
                    `).run(user_id);
                } catch (e) {
                    // Notification insertion failed — non-critical
                }
            }

            console.log('[Scheduler] Daily therapy tasks generated.');
        } catch (error) {
            console.error('[Scheduler] Therapy task generation error:', error.message);
        }
    });

    // ─── JOB 2: Weekly Digest Compilation (Sunday 8:00 AM) ────────
    cron.schedule('0 8 * * 0', () => {
        console.log('[Scheduler] Compiling weekly digest data...');
        try {
            const users = db.prepare('SELECT id FROM users').all();

            for (const { id: userId } of users) {
                const gameSessions = db.prepare(`
                    SELECT COUNT(*) as count FROM game_sessions 
                    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
                `).get(userId)?.count || 0;

                const completedTasks = db.prepare(`
                    SELECT COUNT(*) as count FROM therapy_task_completion 
                    WHERE user_id = ? AND completed_at >= datetime('now', '-7 days')
                `).get(userId)?.count || 0;

                if (gameSessions > 0 || completedTasks > 0) {
                    try {
                        db.prepare(`
                            INSERT INTO notifications (user_id, type, source_module, title, message, link, created_at)
                            VALUES (?, 'weekly_digest', 'progress', '📊 Weekly Summary', 
                                'Check out your weekly progress report!', '/progress', datetime('now'))
                        `).run(userId);
                    } catch (e) { /* ok */ }
                }
            }

            console.log('[Scheduler] Weekly digest compiled.');
        } catch (error) {
            console.error('[Scheduler] Weekly digest error:', error.message);
        }
    });

    // ─── JOB 3: Notification Cleanup (daily midnight) ─────────────
    cron.schedule('0 0 * * *', () => {
        console.log('[Scheduler] Cleaning stale notifications...');
        try {
            const result = db.prepare(`
                DELETE FROM notifications 
                WHERE read = 1 AND created_at < datetime('now', '-30 days')
            `).run();

            if (result.changes > 0) {
                console.log(`  ➜ Cleaned ${result.changes} old notifications.`);
            }
        } catch (error) {
            console.error('[Scheduler] Notification cleanup error:', error.message);
        }
    });

    // ─── JOB 4: Game Streak Check (11:59 PM) ──────────────────────
    cron.schedule('59 23 * * *', () => {
        console.log('[Scheduler] Checking game streaks...');
        try {
            const todayPlayers = db.prepare(`
                SELECT DISTINCT user_id FROM game_sessions 
                WHERE DATE(created_at) = DATE('now')
            `).all();

            for (const { user_id } of todayPlayers) {
                try {
                    db.prepare(`
                        UPDATE game_progress 
                        SET current_streak = current_streak + 1,
                            best_streak = MAX(best_streak, current_streak + 1),
                            last_played = datetime('now')
                        WHERE user_id = ? AND DATE(last_played) != DATE('now')
                    `).run(user_id);
                } catch (e) { /* column might not exist */ }
            }

            try {
                db.prepare(`
                    UPDATE game_progress 
                    SET current_streak = 0
                    WHERE DATE(last_played) < DATE('now', '-1 day')
                `).run();
            } catch (e) { /* ok */ }

            console.log(`[Scheduler] Checked ${todayPlayers.length} player streaks.`);
        } catch (error) {
            console.error('[Scheduler] Streak check error:', error.message);
        }
    });

    console.log('📅 Scheduler initialized with 4 cron jobs:');
    console.log('   • Daily therapy reminders (7:00 AM)');
    console.log('   • Weekly digest compilation (Sunday 8:00 AM)');
    console.log('   • Notification cleanup (midnight)');
    console.log('   • Game streak check (11:59 PM)');
}

export default { initScheduler };
