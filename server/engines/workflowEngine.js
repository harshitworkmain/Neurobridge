/**
 * NeuroBridge AI — Product Workflow Engine
 * 
 * Converts the screening-only system into a full clinical workflow platform:
 *   Phase 1: Daily Caregiver Value Loop (therapy completion tracking)
 *   Phase 2: Clinician Worklist + Alerts
 *   Phase 3: Outcome Measurement
 *   Phase 4: One-Click Clinical Report (PDFKit)
 *   Phase 5: Trust & Safety Layer
 *   Phase 6: Engagement & Retention (Reminders)
 *   Phase 7: Clinic Growth (Bulk Upload)
 * 
 * All computation is lightweight: rule-based logic + SQL.
 * No external ML dependencies.
 */

import db from '../db.js';
import { getTherapyPlanFromScreening, THERAPY_MODULES } from './therapyEngine.js';
import { getPatientAnalytics, updatePatientAnalytics } from './analyticsEngine.js';

// ============================================
// CONSTANTS
// ============================================

const DISCLAIMER = 'This is a screening support tool and not a medical diagnosis. All results should be reviewed by a qualified healthcare professional.';

// ============================================
// PHASE 1 — DAILY CAREGIVER VALUE LOOP
// ============================================

/**
 * Get today's therapy tasks for a user.
 * Pulls the latest therapy plan, checks completion status, generates daily insight.
 * 
 * @param {number} userId
 * @returns {Object} { tasks, completionSummary, dailyInsight, disclaimer }
 */
function getTodayTasks(userId) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get latest screening to derive therapy plan
    const latestScreening = db.prepare(`
        SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId);

    if (!latestScreening) {
        return {
            tasks: [],
            completionSummary: { total: 0, completed: 0, pending: 0, totalMinutes: 0 },
            dailyInsight: 'Complete your first screening session to receive a personalized therapy plan.',
            disclaimer: DISCLAIMER
        };
    }

    // Generate therapy plan from latest screening
    const plan = getTherapyPlanFromScreening(latestScreening);
    const allTasks = [];

    // Flatten plan domains into individual tasks
    if (plan && plan.domains) {
        for (const domain of plan.domains) {
            for (const task of (domain.tasks || [])) {
                allTasks.push({
                    task_id: task.id,
                    task_name: task.title,
                    domain: domain.name || domain.id,
                    priority: domain.priority || 'Medium',
                    duration_minutes: parseInt(task.duration) || 5,
                    description: task.description
                });
            }
        }
    }

    // Check completion status from therapy_completion table
    const completions = db.prepare(`
        SELECT task_id, status, duration_minutes FROM therapy_completion
        WHERE user_id = ? AND date = ?
    `).all(userId, today);

    const completionMap = new Map(completions.map(c => [c.task_id, c]));

    const tasks = allTasks.map(t => {
        const comp = completionMap.get(t.task_id);
        return {
            ...t,
            status: comp ? comp.status : 'pending',
            actual_duration: comp ? comp.duration_minutes : null
        };
    });

    // If no tasks were auto-seeded today, seed them
    if (completions.length === 0 && tasks.length > 0) {
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO therapy_completion (user_id, task_id, task_name, date, status, duration_minutes)
            VALUES (?, ?, ?, ?, 'pending', 0)
        `);
        const seedMany = db.transaction((items) => {
            for (const t of items) {
                insertStmt.run(userId, t.task_id, t.task_name, today);
            }
        });
        seedMany(tasks);
    }

    const completed = tasks.filter(t => t.status === 'completed').length;
    const totalMinutes = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);

    // Generate daily insight from existing analytics
    const dailyInsight = generateDailyInsight(userId, latestScreening, plan);

    return {
        tasks,
        completionSummary: {
            total: tasks.length,
            completed,
            pending: tasks.length - completed,
            totalMinutes,
            completionPercent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
        },
        dailyInsight,
        disclaimer: DISCLAIMER
    };
}

/**
 * Mark a therapy task as completed.
 * 
 * @param {Object} params - { user_id, task_id, duration_minutes }
 * @returns {Object} result
 */
function completeTherapyTask({ user_id, task_id, duration_minutes }) {
    const today = new Date().toISOString().split('T')[0];
    const taskName = task_id; // fallback

    // Look up task name from therapy modules
    let resolvedName = task_id;
    for (const modKey of Object.keys(THERAPY_MODULES)) {
        const mod = THERAPY_MODULES[modKey];
        const found = (mod.tasks || []).find(t => t.id === task_id);
        if (found) { resolvedName = found.title; break; }
    }

    // Upsert completion record
    db.prepare(`
        INSERT INTO therapy_completion (user_id, task_id, task_name, date, status, duration_minutes)
        VALUES (?, ?, ?, ?, 'completed', ?)
        ON CONFLICT(user_id, task_id, date) DO UPDATE SET
            status = 'completed',
            duration_minutes = excluded.duration_minutes
    `).run(user_id, task_id, resolvedName, today, duration_minutes || 0);

    return { success: true, task_id, status: 'completed', date: today };
}

/**
 * Generate a simple daily insight message from existing analytics.
 */
function generateDailyInsight(userId, latestScreening, plan) {
    const insights = [];

    // Check patient analytics for trends
    try {
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
        if (analytics) {
            if (analytics.engagement_trend > 3) {
                insights.push('Engagement is improving! Keep up the consistent sessions.');
            } else if (analytics.engagement_trend < -3) {
                insights.push('Engagement dropped recently. Try increasing daily interaction time with high-interest activities.');
            }

            if (analytics.risk_trend_slope < -2) {
                insights.push('Great progress — risk scores are trending downward.');
            } else if (analytics.risk_trend_slope > 5) {
                insights.push('Risk trend is rising. Consider more frequent screening and focused therapy.');
            }

            if (analytics.improvement_rate > 10) {
                insights.push(`${Math.round(analytics.improvement_rate)}% improvement from baseline. Continue current therapy modules.`);
            }
        }
    } catch (e) { /* analytics not available yet */ }

    // Check gaze/fixation from latest screening
    if (latestScreening) {
        const components = latestScreening.component_scores_json
            ? JSON.parse(latestScreening.component_scores_json) : null;
        if (components) {
            if (components.fixation_risk < 30) {
                insights.push('Eye contact improved this week. Continue Joint Attention exercises.');
            }
            if (components.engagement_risk > 60) {
                insights.push('Focus on engagement activities — try interactive play sessions.');
            }
        }
    }

    // Prioritize plan-based insight
    if (plan && plan.domains && plan.domains.length > 0) {
        const topDomain = plan.domains[0];
        if (topDomain.priority === 'High') {
            insights.push(`Priority focus today: ${topDomain.name || topDomain.id}. ${topDomain.reason || ''}`);
        }
    }

    if (insights.length === 0) {
        insights.push('Keep up consistent daily therapy sessions for the best outcomes.');
    }

    return insights[0]; // Return the most relevant single insight
}


// ============================================
// PHASE 2 — CLINICIAN WORKLIST + ALERTS
// ============================================

/**
 * Generate clinical alerts for a user based on their analytics.
 * Triggered after screening save or analytics update.
 * 
 * @param {number} userId
 * @returns {Array} Generated alerts
 */
function generateAlerts(userId) {
    const generated = [];

    // Get patient analytics
    const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);

    // Get last screening date
    const lastScreening = db.prepare(`
        SELECT timestamp FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId);

    // Condition 1: Risk trend slope > +5 (regression)
    if (analytics && analytics.risk_trend_slope > 5) {
        const existing = db.prepare(`
            SELECT id FROM alerts WHERE user_id = ? AND type = 'risk_regression' AND resolved = 0
        `).get(userId);

        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (user_id, type, severity, message) 
                VALUES (?, 'risk_regression', 'high', ?)
            `).run(userId, `Risk regression detected: slope +${analytics.risk_trend_slope.toFixed(1)} per session. Immediate clinical review recommended.`);
            generated.push({ type: 'risk_regression', severity: 'high' });
        }
    }

    // Condition 2: Engagement drop > 20%
    if (analytics && analytics.engagement_trend < -20) {
        const existing = db.prepare(`
            SELECT id FROM alerts WHERE user_id = ? AND type = 'engagement_drop' AND resolved = 0
        `).get(userId);

        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (user_id, type, severity, message) 
                VALUES (?, 'engagement_drop', 'medium', ?)
            `).run(userId, `Significant engagement decline: ${analytics.engagement_trend.toFixed(1)}% trend. Consider adjusting therapy approach.`);
            generated.push({ type: 'engagement_drop', severity: 'medium' });
        }
    }

    // Condition 3: No screening in 7+ days
    if (lastScreening) {
        const daysSince = Math.floor((Date.now() - new Date(lastScreening.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 7) {
            const existing = db.prepare(`
                SELECT id FROM alerts WHERE user_id = ? AND type = 'no_screening' AND resolved = 0
            `).get(userId);

            if (!existing) {
                db.prepare(`
                    INSERT INTO alerts (user_id, type, severity, message)
                    VALUES (?, 'no_screening', 'low', ?)
                `).run(userId, `No screening for ${daysSince} days. Follow-up recommended to maintain monitoring cadence.`);
                generated.push({ type: 'no_screening', severity: 'low' });
            }
        }
    } else {
        // No screenings at all
        const existing = db.prepare(`
            SELECT id FROM alerts WHERE user_id = ? AND type = 'no_screening' AND resolved = 0
        `).get(userId);
        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (user_id, type, severity, message)
                VALUES (?, 'no_screening', 'medium', ?)
            `).run(userId, 'No screening sessions recorded for this patient. Initial assessment needed.');
            generated.push({ type: 'no_screening', severity: 'medium' });
        }
    }

    // Condition 4: High predicted risk
    if (analytics && analytics.predicted_risk_30d > 70) {
        const existing = db.prepare(`
            SELECT id FROM alerts WHERE user_id = ? AND type = 'high_forecast' AND resolved = 0
        `).get(userId);

        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (user_id, type, severity, message)
                VALUES (?, 'high_forecast', 'high', ?)
            `).run(userId, `30-day risk forecast is HIGH (${analytics.predicted_risk_30d}). Proactive intervention recommended.`);
            generated.push({ type: 'high_forecast', severity: 'high' });
        }
    }

    return generated;
}

/**
 * Get clinician worklist — all patients sorted by urgency.
 * 
 * @returns {Array} Worklist entries
 */
function getClinicianWorklist() {
    const users = db.prepare('SELECT id, name, age_string FROM users').all();
    const severityOrder = { high: 3, medium: 2, low: 1 };

    const worklist = users.map(user => {
        // Latest screening
        const lastScreening = db.prepare(`
            SELECT overall_score, risk_level, timestamp FROM screenings
            WHERE user_id = ? ORDER BY id DESC LIMIT 1
        `).get(user.id);

        // Patient analytics
        const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(user.id);

        // Active alerts
        const alerts = db.prepare(`
            SELECT type, severity, message, created_at FROM alerts
            WHERE user_id = ? AND resolved = 0 ORDER BY created_at DESC
        `).all(user.id);

        const highestSeverity = alerts.reduce((max, a) => {
            return (severityOrder[a.severity] || 0) > (severityOrder[max] || 0) ? a.severity : max;
        }, 'none');

        // Determine trend direction
        let trendDirection = 'stable';
        if (analytics) {
            if (analytics.risk_trend_slope > 3) trendDirection = 'worsening';
            else if (analytics.risk_trend_slope < -3) trendDirection = 'improving';
        }

        return {
            user_id: user.id,
            name: user.name,
            age: user.age_string,
            current_risk: lastScreening ? lastScreening.overall_score : null,
            risk_level: lastScreening ? lastScreening.risk_level : 'Unknown',
            trend_direction: trendDirection,
            last_session_date: lastScreening ? lastScreening.timestamp : null,
            alert_count: alerts.length,
            highest_severity: highestSeverity,
            alerts: alerts.slice(0, 3), // Top 3 alerts
            improvement_rate: analytics ? analytics.improvement_rate : null,
            predicted_risk_30d: analytics ? analytics.predicted_risk_30d : null,
            confidence_level: lastScreening ? (lastScreening.overall_score != null ? 'computed' : 'insufficient_data') : 'no_data',
            disclaimer: DISCLAIMER
        };
    });

    // Sort by urgency: high severity first, then by risk score
    worklist.sort((a, b) => {
        const sevDiff = (severityOrder[b.highest_severity] || 0) - (severityOrder[a.highest_severity] || 0);
        if (sevDiff !== 0) return sevDiff;
        return (b.current_risk || 0) - (a.current_risk || 0);
    });

    return worklist;
}


// ============================================
// PHASE 3 — OUTCOME MEASUREMENT
// ============================================

/**
 * Calculate improvement score and related outcome metrics.
 * 
 * @param {number} userId
 * @returns {Object} Outcome summary
 */
function calculateImprovement(userId) {
    // Ensure analytics are fresh
    try { updatePatientAnalytics(userId); } catch (e) { /* ok */ }

    const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
    const user = db.prepare('SELECT name, age_string FROM users WHERE id = ?').get(userId);

    if (!analytics) {
        return { error: 'No analytics data available. Complete at least one screening session.' };
    }

    // Calculate improvement score
    const improvementScore = Math.round((analytics.baseline_risk - analytics.current_risk) * 100) / 100;

    // Engagement change (from engagement_trend slope)
    const engagementChange = analytics.engagement_trend;

    // Therapy effectiveness (from therapy_outcomes table)
    const therapyOutcomes = db.prepare(`
        SELECT therapy_module, status, risk_change, engagement_change
        FROM therapy_outcomes WHERE user_id = ?
    `).all(userId);

    const effectiveCount = therapyOutcomes.filter(t => t.status === 'effective').length;
    const therapyEffectiveness = therapyOutcomes.length > 0
        ? Math.round((effectiveCount / therapyOutcomes.length) * 100)
        : null;

    // Weeks tracked
    const firstSession = db.prepare(`
        SELECT timestamp FROM screenings WHERE user_id = ? ORDER BY id ASC LIMIT 1
    `).get(userId);
    const lastSession = db.prepare(`
        SELECT timestamp FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId);

    let weeksTracked = 0;
    if (firstSession && lastSession) {
        const diffMs = new Date(lastSession.timestamp).getTime() - new Date(firstSession.timestamp).getTime();
        weeksTracked = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 7)));
    }

    return {
        user_id: userId,
        patient_name: user ? user.name : 'Unknown',
        age: user ? user.age_string : null,
        improvement_score: improvementScore,
        baseline_risk: analytics.baseline_risk,
        current_risk: analytics.current_risk,
        risk_level: analytics.current_risk > 70 ? 'High' : analytics.current_risk > 40 ? 'Moderate' : 'Low',
        engagement_change: Math.round(engagementChange * 100) / 100,
        therapy_effectiveness: therapyEffectiveness,
        therapy_modules_tried: therapyOutcomes.length,
        effective_modules: effectiveCount,
        weeks_tracked: weeksTracked,
        total_sessions: analytics.total_sessions,
        stability_index: analytics.stability_index,
        predicted_risk_30d: analytics.predicted_risk_30d,
        regression_flag: analytics.regression_flag === 1,
        confidence_level: analytics.total_sessions >= 3 ? 'high' : analytics.total_sessions >= 2 ? 'moderate' : 'low',
        disclaimer: DISCLAIMER
    };
}


// ============================================
// PHASE 4 — CLINICAL REPORT GENERATION
// ============================================

/**
 * Generate clinical report data for PDF generation.
 * Returns structured data suitable for PDFKit rendering.
 * 
 * @param {number} userId
 * @returns {Object} Report data
 */
function generateReportData(userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return { error: 'Patient not found' };

    // Patient outcome
    const outcome = calculateImprovement(userId);
    if (outcome.error) return { error: outcome.error };

    // Latest screening
    const latestScreening = db.prepare(`
        SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId);

    // Therapy plan
    let therapyPlan = null;
    if (latestScreening) {
        therapyPlan = getTherapyPlanFromScreening(latestScreening);
    }

    // Risk history (for trend chart data)
    const riskHistory = db.prepare(`
        SELECT overall_score, engagement, timestamp 
        FROM screenings WHERE user_id = ? ORDER BY timestamp ASC
    `).all(userId);

    // Active alerts
    const alerts = db.prepare(`
        SELECT type, severity, message, created_at FROM alerts
        WHERE user_id = ? AND resolved = 0
    `).all(userId);

    // Analytics
    const analytics = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);

    // Parse explanations from latest screening
    let explanations = null;
    if (latestScreening && latestScreening.explanations_json) {
        try { explanations = JSON.parse(latestScreening.explanations_json); } catch (e) { /* ok */ }
    }

    return {
        report_generated_at: new Date().toISOString(),
        report_type: 'Clinical Progress Report',

        patient: {
            id: user.id,
            name: user.name,
            age: user.age_string,
            email: user.parent_email
        },

        outcome_summary: {
            improvement_score: outcome.improvement_score,
            baseline_risk: outcome.baseline_risk,
            current_risk: outcome.current_risk,
            risk_level: outcome.risk_level,
            engagement_change: outcome.engagement_change,
            therapy_effectiveness: outcome.therapy_effectiveness,
            weeks_tracked: outcome.weeks_tracked,
            total_sessions: outcome.total_sessions
        },

        risk_trend_data: riskHistory.map(r => ({
            date: r.timestamp,
            risk_score: r.overall_score,
            engagement: r.engagement
        })),

        latest_therapy_plan: therapyPlan ? {
            domains: (therapyPlan.domains || []).map(d => ({
                name: d.name || d.id,
                priority: d.priority,
                severity: d.severity,
                task_count: (d.tasks || []).length
            })),
            total_daily_time: therapyPlan.total_daily_time || 'N/A'
        } : null,

        ai_explanations: explanations,

        forecast: analytics ? {
            predicted_risk_30d: analytics.predicted_risk_30d,
            risk_trend_slope: analytics.risk_trend_slope,
            regression_flag: analytics.regression_flag === 1,
            stability_index: analytics.stability_index
        } : null,

        active_alerts: alerts,

        confidence_level: outcome.confidence_level,
        disclaimer: DISCLAIMER,
        quality_notice: 'Report generated from automated screening data. Clinical judgment should always supersede algorithmic assessments.'
    };
}


// ============================================
// PHASE 5 — TRUST & SAFETY
// ============================================

/**
 * Wrap any response with trust & safety fields.
 * 
 * @param {Object} data - Original response data
 * @param {number|null} qualityScore - Session quality score (0-100)
 * @returns {Object} Wrapped response
 */
function wrapWithTrustFields(data, qualityScore) {
    return {
        ...data,
        confidence_level: qualityScore != null
            ? (qualityScore > 70 ? 'high' : qualityScore > 40 ? 'moderate' : 'low')
            : 'not_assessed',
        disclaimer: DISCLAIMER
    };
}


// ============================================
// PHASE 6 — ENGAGEMENT & RETENTION
// ============================================

/**
 * Check and generate reminders for users with no recent sessions.
 * Rule: If no screening session for 7+ days, create a reminder.
 * 
 * @returns {Array} List of pending reminders
 */
function checkAndGenerateReminders() {
    const users = db.prepare('SELECT id, name, parent_email FROM users').all();
    const reminders = [];

    for (const user of users) {
        const lastSession = db.prepare(`
            SELECT timestamp FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
        `).get(user.id);

        const lastSessionDate = lastSession ? lastSession.timestamp : null;
        let daysSince = null;

        if (lastSessionDate) {
            daysSince = Math.floor((Date.now() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24));
        }

        // Rule: 7+ days since last session (or no session ever)
        if (daysSince === null || daysSince >= 7) {
            const nextReminderDate = new Date();
            nextReminderDate.setDate(nextReminderDate.getDate()); // Today

            // Check if reminder already exists and not sent
            const existing = db.prepare(`
                SELECT id FROM reminders WHERE user_id = ? AND sent = 0
            `).get(user.id);

            if (!existing) {
                db.prepare(`
                    INSERT INTO reminders (user_id, last_session_date, next_reminder_date, sent)
                    VALUES (?, ?, ?, 0)
                `).run(user.id, lastSessionDate || 'never', nextReminderDate.toISOString().split('T')[0], 0);
            }

            reminders.push({
                user_id: user.id,
                name: user.name,
                email: user.parent_email,
                last_session_date: lastSessionDate || 'Never',
                days_since_last: daysSince || 'N/A',
                next_reminder_date: nextReminderDate.toISOString().split('T')[0],
                sent: false,
                message: daysSince
                    ? `${user.name} hasn't had a screening in ${daysSince} days. Consider scheduling a follow-up.`
                    : `${user.name} has never had a screening session. Initial assessment recommended.`
            });
        }
    }

    return reminders;
}

/**
 * Get all pending (unsent) reminders.
 */
function getPendingReminders() {
    const rows = db.prepare(`
        SELECT r.*, u.name, u.parent_email FROM reminders r
        JOIN users u ON r.user_id = u.id
        WHERE r.sent = 0
        ORDER BY r.next_reminder_date ASC
    `).all();

    return rows.map(r => ({
        user_id: r.user_id,
        name: r.name,
        email: r.parent_email,
        last_session_date: r.last_session_date,
        next_reminder_date: r.next_reminder_date,
        sent: r.sent === 1
    }));
}


// ============================================
// PHASE 7 — CLINIC GROWTH (BULK UPLOAD)
// ============================================

/**
 * Parse CSV text and create users.
 * Expected format: name, age, parent_email (with or without header row)
 * 
 * @param {string} csvText - Raw CSV content
 * @returns {Object} { created, errors, total }
 */
function bulkCreateUsers(csvText) {
    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) return { created: [], errors: [], total: 0 };

    // Detect header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') || firstLine.includes('email') || firstLine.includes('age');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const created = [];
    const errors = [];

    const insertStmt = db.prepare(`
        INSERT INTO users (name, age_string, parent_email) VALUES (?, ?, ?)
    `);

    const bulkInsert = db.transaction((lines) => {
        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            try {
                // Parse CSV line (handle quoted fields)
                const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));

                if (parts.length < 1 || !parts[0]) {
                    errors.push({ line: idx + 1, error: 'Missing name', raw: line });
                    continue;
                }

                const name = parts[0];
                const age = parts.length > 1 ? parts[1] : 'Unknown';
                const email = parts.length > 2 ? parts[2] : null;

                // Check for duplicate email
                if (email) {
                    const existing = db.prepare('SELECT id FROM users WHERE parent_email = ?').get(email);
                    if (existing) {
                        errors.push({ line: idx + 1, error: `Email "${email}" already exists (user ID: ${existing.id})`, raw: line });
                        continue;
                    }
                }

                const info = insertStmt.run(name, age, email);
                created.push({ id: info.lastInsertRowid, name, age, email });
            } catch (e) {
                errors.push({ line: idx + 1, error: e.message, raw: line });
            }
        }
    });

    bulkInsert(dataLines);

    return {
        created,
        errors,
        total: dataLines.length,
        success_count: created.length,
        error_count: errors.length
    };
}


// ============================================
// PHASE 2 HELPER — RESOLVE ALERT
// ============================================

/**
 * Resolve (dismiss) an alert by ID.
 */
function resolveAlert(alertId) {
    const result = db.prepare('UPDATE alerts SET resolved = 1 WHERE id = ?').run(alertId);
    return { success: result.changes > 0, alertId };
}

/**
 * Resolve all alerts for a user.
 */
function resolveUserAlerts(userId) {
    const result = db.prepare('UPDATE alerts SET resolved = 1 WHERE user_id = ?').run(userId);
    return { success: true, resolved_count: result.changes };
}


// ============================================
// EXPORTS
// ============================================

export {
    // Phase 1: Daily Caregiver Loop
    getTodayTasks,
    completeTherapyTask,
    generateDailyInsight,

    // Phase 2: Clinician Worklist + Alerts
    generateAlerts,
    getClinicianWorklist,
    resolveAlert,
    resolveUserAlerts,

    // Phase 3: Outcome Measurement
    calculateImprovement,

    // Phase 4: Clinical Report
    generateReportData,

    // Phase 5: Trust & Safety
    wrapWithTrustFields,
    DISCLAIMER,

    // Phase 6: Engagement & Retention
    checkAndGenerateReminders,
    getPendingReminders,

    // Phase 7: Clinic Growth
    bulkCreateUsers
};
