/**
 * NeuroBridge AI — Clinician Intelligence Analytics Engine
 * 
 * Longitudinal clinical decision support:
 *   - Patient trend analytics (linear slope, moving averages)
 *   - Risk forecasting (30-day predicted risk)
 *   - Regression alerts (rule-based)
 *   - Therapy effectiveness tracking
 *   - Cohort intelligence (SQL aggregates)
 *   - Similar patient suggestions
 *   - Clinician performance metrics
 * 
 * All computation is lightweight: linear math + SQL aggregation.
 * No external ML dependencies.
 */

import db from '../db.js';

// ============================================
// MATH UTILITIES
// ============================================

/**
 * Compute linear regression slope over an array of values.
 * Treats indices as x-values (0, 1, 2, ...).
 * @param {number[]} values
 * @returns {number} slope (units per session)
 */
function slope(values) {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return 0;
    return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Compute standard deviation of an array.
 * @param {number[]} values
 * @returns {number}
 */
function stdDev(values) {
    const n = values.length;
    if (n < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    return Math.sqrt(variance);
}

/**
 * Compute arithmetic mean.
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Clamp a number between min and max.
 */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// ============================================
// PHASE A — PATIENT ANALYTICS
// ============================================

/**
 * Update (or insert) patient_analytics for a given user after a new screening.
 * Pulls last N screenings, computes trends, risk forecast, and regression flag.
 * 
 * @param {number} userId
 * @returns {Object} The computed analytics row
 */
function updatePatientAnalytics(userId) {
    const WINDOW = 5; // lookback window for trend computation

    // Fetch recent screenings (newest first → reverse for chronological)
    const rows = db.prepare(`
        SELECT overall_score, engagement, vision_score, timestamp
        FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT ?
    `).all(userId, WINDOW);

    if (rows.length === 0) return null;

    // Chronological order
    const sessions = rows.reverse();

    const risks = sessions.map(r => r.overall_score ?? 0);
    const engagements = sessions.map(r => {
        // engagement is stored as 0-1 ratio in some paths, normalize to 0-100
        const e = r.engagement ?? 0;
        return e <= 1 ? e * 100 : e;
    });
    const visionScores = sessions.map(r => r.vision_score ?? 0);

    const totalSessions = db.prepare(
        'SELECT COUNT(*) as cnt FROM screenings WHERE user_id = ?'
    ).get(userId).cnt;

    // Baseline = first screening risk
    const baselineRow = db.prepare(
        'SELECT overall_score FROM screenings WHERE user_id = ? ORDER BY id ASC LIMIT 1'
    ).get(userId);
    const baselineRisk = baselineRow ? baselineRow.overall_score : risks[0];

    const currentRisk = risks[risks.length - 1];
    const riskSlope = Math.round(slope(risks) * 100) / 100;
    const engSlope = Math.round(slope(engagements) * 100) / 100;
    const gazeVarSlope = Math.round(slope(visionScores) * 100) / 100;
    const improvementRate = Math.round((baselineRisk - currentRisk) * 100) / 100;
    const predicted30d = clamp(Math.round(currentRisk + riskSlope * 3), 0, 100);
    const stabilityIdx = Math.round(stdDev(risks) * 100) / 100;
    const regressionFlag = riskSlope > 5 ? 1 : 0;

    const analytics = {
        user_id: userId,
        total_sessions: totalSessions,
        baseline_risk: baselineRisk,
        current_risk: currentRisk,
        risk_trend_slope: riskSlope,
        engagement_trend: engSlope,
        gaze_variance_trend: gazeVarSlope,
        improvement_rate: improvementRate,
        regression_flag: regressionFlag,
        predicted_risk_30d: predicted30d,
        stability_index: stabilityIdx,
        last_updated: new Date().toISOString()
    };

    // Upsert
    db.prepare(`
        INSERT INTO patient_analytics (
            user_id, total_sessions, baseline_risk, current_risk,
            risk_trend_slope, engagement_trend, gaze_variance_trend,
            improvement_rate, regression_flag, predicted_risk_30d,
            stability_index, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            total_sessions = excluded.total_sessions,
            baseline_risk = excluded.baseline_risk,
            current_risk = excluded.current_risk,
            risk_trend_slope = excluded.risk_trend_slope,
            engagement_trend = excluded.engagement_trend,
            gaze_variance_trend = excluded.gaze_variance_trend,
            improvement_rate = excluded.improvement_rate,
            regression_flag = excluded.regression_flag,
            predicted_risk_30d = excluded.predicted_risk_30d,
            stability_index = excluded.stability_index,
            last_updated = excluded.last_updated
    `).run(
        analytics.user_id, analytics.total_sessions, analytics.baseline_risk,
        analytics.current_risk, analytics.risk_trend_slope, analytics.engagement_trend,
        analytics.gaze_variance_trend, analytics.improvement_rate, analytics.regression_flag,
        analytics.predicted_risk_30d, analytics.stability_index, analytics.last_updated
    );

    return analytics;
}

/**
 * Get full patient analytics with explainability reasons.
 * @param {number} userId
 * @returns {Object|null}
 */
function getPatientAnalytics(userId) {
    const row = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
    if (!row) return null;

    // Generate explainability reasons
    const reasons = [];

    if (row.risk_trend_slope > 3) {
        reasons.push(`Risk increasing trend (+${row.risk_trend_slope.toFixed(1)} per session over last 5 sessions)`);
    } else if (row.risk_trend_slope < -3) {
        reasons.push(`Risk improving trend (${row.risk_trend_slope.toFixed(1)} per session over last 5 sessions)`);
    } else {
        reasons.push(`Risk trend is stable (slope: ${row.risk_trend_slope.toFixed(1)})`);
    }

    if (row.engagement_trend < -5) {
        reasons.push(`Engagement dropped (trend: ${row.engagement_trend.toFixed(1)}% per session)`);
    } else if (row.engagement_trend > 5) {
        reasons.push(`Engagement is improving (trend: +${row.engagement_trend.toFixed(1)}% per session)`);
    }

    if (row.improvement_rate > 10) {
        reasons.push(`Patient showing ${row.improvement_rate.toFixed(0)}% improvement from baseline`);
    } else if (row.improvement_rate < -10) {
        reasons.push(`Patient worsened by ${Math.abs(row.improvement_rate).toFixed(0)}% from baseline`);
    }

    if (row.regression_flag) {
        reasons.push('⚠️ REGRESSION ALERT: Significant upward risk trend detected');
    }

    if (row.stability_index > 15) {
        reasons.push(`High variability across sessions (σ=${row.stability_index.toFixed(1)}), consider more frequent monitoring`);
    }

    if (row.predicted_risk_30d > 70) {
        reasons.push(`30-day risk forecast: HIGH (${row.predicted_risk_30d}). Proactive intervention recommended.`);
    } else if (row.predicted_risk_30d > 40) {
        reasons.push(`30-day risk forecast: MODERATE (${row.predicted_risk_30d}). Continue monitoring.`);
    } else {
        reasons.push(`30-day risk forecast: LOW (${row.predicted_risk_30d}). Positive trajectory.`);
    }

    return {
        ...row,
        risk_category: row.current_risk > 70 ? 'High' : row.current_risk > 40 ? 'Moderate' : 'Low',
        forecast_reason: reasons
    };
}

// ============================================
// PHASE B — THERAPY EFFECTIVENESS
// ============================================

/**
 * Record or update a therapy outcome.
 * @param {Object} params - { user_id, therapy_module, start_date, end_date }
 * @returns {Object} The therapy outcome record
 */
function updateTherapyOutcome({ user_id, therapy_module, start_date, end_date }) {
    // Get screenings in the therapy period
    const beforeScreening = db.prepare(`
        SELECT overall_score, engagement FROM screenings
        WHERE user_id = ? AND timestamp <= ?
        ORDER BY timestamp DESC LIMIT 1
    `).get(user_id, start_date || '1970-01-01');

    const afterScreening = db.prepare(`
        SELECT overall_score, engagement FROM screenings
        WHERE user_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC LIMIT 1
    `).get(user_id, end_date || new Date().toISOString());

    const riskBefore = beforeScreening?.overall_score ?? 50;
    const riskAfter = afterScreening?.overall_score ?? riskBefore;
    const engBefore = (beforeScreening?.engagement ?? 0.5);
    const engAfter = (afterScreening?.engagement ?? engBefore);

    const riskChange = Math.round((riskBefore - riskAfter) * 100) / 100; // positive = improvement
    const engChange = Math.round(((engAfter - engBefore) * (engBefore <= 1 ? 100 : 1)) * 100) / 100;

    let status = 'no_change';
    if (riskChange > 10) status = 'effective';
    else if (riskChange < -5) status = 'ineffective';

    const result = db.prepare(`
        INSERT INTO therapy_outcomes (user_id, therapy_module, start_date, end_date, risk_change, engagement_change, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, therapy_module, start_date, end_date || new Date().toISOString(), riskChange, engChange, status);

    return {
        id: result.lastInsertRowid,
        user_id, therapy_module, start_date, end_date,
        risk_change: riskChange,
        engagement_change: engChange,
        status,
        explanation: status === 'effective'
            ? `Risk reduced by ${riskChange.toFixed(1)} points during ${therapy_module}. Therapy appears effective.`
            : status === 'ineffective'
                ? `Risk increased by ${Math.abs(riskChange).toFixed(1)} points. Consider alternative therapy module.`
                : `Minimal change (${riskChange.toFixed(1)} pts). More sessions may be needed to evaluate.`
    };
}

/**
 * Get aggregated effectiveness stats for a therapy module.
 * @param {string} [therapyModule] - Optional module filter
 * @returns {Object}
 */
function getTherapyEffectiveness(therapyModule) {
    let query, params;

    if (therapyModule) {
        query = `
            SELECT 
                therapy_module,
                COUNT(*) as sample_size,
                AVG(risk_change) as avg_risk_change,
                AVG(engagement_change) as avg_engagement_change,
                SUM(CASE WHEN status = 'effective' THEN 1 ELSE 0 END) as effective_count,
                SUM(CASE WHEN status = 'ineffective' THEN 1 ELSE 0 END) as ineffective_count
            FROM therapy_outcomes
            WHERE therapy_module = ?
            GROUP BY therapy_module
        `;
        params = [therapyModule];
    } else {
        query = `
            SELECT 
                therapy_module,
                COUNT(*) as sample_size,
                AVG(risk_change) as avg_risk_change,
                AVG(engagement_change) as avg_engagement_change,
                SUM(CASE WHEN status = 'effective' THEN 1 ELSE 0 END) as effective_count,
                SUM(CASE WHEN status = 'ineffective' THEN 1 ELSE 0 END) as ineffective_count
            FROM therapy_outcomes
            GROUP BY therapy_module
        `;
        params = [];
    }

    const rows = db.prepare(query).all(...params);

    return rows.map(row => ({
        therapy_module: row.therapy_module,
        sample_size: row.sample_size,
        avg_risk_reduction: Math.round((row.avg_risk_change ?? 0) * 100) / 100,
        avg_engagement_change: Math.round((row.avg_engagement_change ?? 0) * 100) / 100,
        success_rate: row.sample_size > 0
            ? Math.round((row.effective_count / row.sample_size) * 100)
            : 0,
        failure_rate: row.sample_size > 0
            ? Math.round((row.ineffective_count / row.sample_size) * 100)
            : 0,
        recommendation: (row.effective_count / Math.max(row.sample_size, 1)) >= 0.5
            ? 'Recommended' : 'Under Review'
    }));
}

// ============================================
// PHASE C — COHORT INTELLIGENCE
// ============================================

/**
 * Get population-level cohort analytics using SQL aggregation.
 * @returns {Object}
 */
function getCohortAnalytics() {
    // Avg risk reduction per therapy module
    const therapyStats = db.prepare(`
        SELECT 
            therapy_module,
            COUNT(*) as sample_size,
            ROUND(AVG(risk_change), 2) as avg_risk_reduction,
            ROUND(AVG(engagement_change), 2) as avg_engagement_change,
            SUM(CASE WHEN status = 'effective' THEN 1 ELSE 0 END) as effective_count
        FROM therapy_outcomes
        GROUP BY therapy_module
        ORDER BY avg_risk_reduction DESC
    `).all();

    // Improvement by risk group (Low / Moderate / High)
    const riskGroupStats = db.prepare(`
        SELECT 
            CASE 
                WHEN baseline_risk > 70 THEN 'High'
                WHEN baseline_risk > 40 THEN 'Moderate'
                ELSE 'Low'
            END as risk_group,
            COUNT(*) as sample_size,
            ROUND(AVG(improvement_rate), 2) as avg_improvement,
            ROUND(AVG(current_risk), 2) as avg_current_risk,
            SUM(CASE WHEN regression_flag = 1 THEN 1 ELSE 0 END) as regression_count
        FROM patient_analytics
        GROUP BY risk_group
        ORDER BY avg_improvement DESC
    `).all();

    // Overall population stats
    const overall = db.prepare(`
        SELECT 
            COUNT(*) as total_patients,
            ROUND(AVG(improvement_rate), 2) as avg_improvement,
            ROUND(AVG(current_risk), 2) as avg_risk,
            ROUND(AVG(stability_index), 2) as avg_stability,
            SUM(CASE WHEN regression_flag = 1 THEN 1 ELSE 0 END) as total_regressions
        FROM patient_analytics
    `).get();

    return {
        population_summary: {
            total_patients: overall?.total_patients ?? 0,
            avg_improvement_rate: overall?.avg_improvement ?? 0,
            avg_current_risk: overall?.avg_risk ?? 0,
            avg_stability_index: overall?.avg_stability ?? 0,
            regression_rate: overall?.total_patients > 0
                ? Math.round((overall.total_regressions / overall.total_patients) * 100)
                : 0
        },
        therapy_effectiveness: therapyStats.map(t => ({
            module: t.therapy_module,
            sample_size: t.sample_size,
            avg_risk_reduction: t.avg_risk_reduction,
            avg_engagement_change: t.avg_engagement_change,
            success_rate: t.sample_size > 0
                ? Math.round((t.effective_count / t.sample_size) * 100)
                : 0
        })),
        risk_group_outcomes: riskGroupStats.map(g => ({
            risk_group: g.risk_group,
            sample_size: g.sample_size,
            avg_improvement: g.avg_improvement,
            avg_current_risk: g.avg_current_risk,
            regression_rate: g.sample_size > 0
                ? Math.round((g.regression_count / g.sample_size) * 100)
                : 0
        })),
        forecast_reason: [
            `Cohort analysis based on ${overall?.total_patients ?? 0} tracked patients`,
            therapyStats.length > 0
                ? `Top therapy: ${therapyStats[0]?.therapy_module} (avg reduction: ${therapyStats[0]?.avg_risk_reduction})`
                : 'No therapy outcome data yet',
            `Population regression rate: ${overall?.total_patients > 0 ? Math.round((overall.total_regressions / overall.total_patients) * 100) : 0}%`
        ]
    };
}

// ============================================
// PHASE D — SIMILAR PATIENT SUGGESTIONS
// ============================================

/**
 * Find similar patients by bucketing and suggest expected outcomes.
 * @param {number} userId
 * @returns {Object}
 */
function getSimilarPatients(userId) {
    // Get current patient profile
    const patient = db.prepare('SELECT * FROM patient_analytics WHERE user_id = ?').get(userId);
    if (!patient) return { error: 'No analytics data for this patient. Complete a screening first.' };

    const user = db.prepare('SELECT age_string FROM users WHERE id = ?').get(userId);

    // Define buckets
    const riskMin = Math.max(0, patient.baseline_risk - 15);
    const riskMax = Math.min(100, patient.baseline_risk + 15);

    // Query similar patients (excluding self)
    const similar = db.prepare(`
        SELECT 
            COUNT(*) as cohort_size,
            ROUND(AVG(improvement_rate), 2) as avg_improvement,
            ROUND(AVG(current_risk), 2) as avg_current_risk,
            ROUND(AVG(predicted_risk_30d), 2) as avg_predicted_risk,
            ROUND(AVG(stability_index), 2) as avg_stability,
            ROUND(AVG(total_sessions), 1) as avg_sessions
        FROM patient_analytics
        WHERE user_id != ? AND baseline_risk BETWEEN ? AND ?
    `).get(userId, riskMin, riskMax);

    // Top performing therapy modules for similar patients
    const topTherapies = db.prepare(`
        SELECT 
            t.therapy_module,
            COUNT(*) as usage_count,
            ROUND(AVG(t.risk_change), 2) as avg_risk_reduction,
            SUM(CASE WHEN t.status = 'effective' THEN 1 ELSE 0 END) as effective_count
        FROM therapy_outcomes t
        INNER JOIN patient_analytics p ON t.user_id = p.user_id
        WHERE t.user_id != ? AND p.baseline_risk BETWEEN ? AND ?
        GROUP BY t.therapy_module
        ORDER BY avg_risk_reduction DESC
        LIMIT 3
    `).all(userId, riskMin, riskMax);

    const expectedImprovement = similar?.avg_improvement ?? 0;

    return {
        patient_profile: {
            user_id: userId,
            age: user?.age_string ?? 'Unknown',
            baseline_risk: patient.baseline_risk,
            current_risk: patient.current_risk,
            bucket: `Risk ${riskMin}-${riskMax}`
        },
        similar_cohort: {
            cohort_size: similar?.cohort_size ?? 0,
            avg_improvement: expectedImprovement,
            avg_current_risk: similar?.avg_current_risk ?? 0,
            avg_predicted_risk: similar?.avg_predicted_risk ?? 0,
            avg_stability: similar?.avg_stability ?? 0,
            avg_sessions: similar?.avg_sessions ?? 0
        },
        expected_improvement: expectedImprovement,
        recommended_therapies: topTherapies.map(t => ({
            module: t.therapy_module,
            avg_risk_reduction: t.avg_risk_reduction,
            usage_count: t.usage_count,
            success_rate: t.usage_count > 0
                ? Math.round((t.effective_count / t.usage_count) * 100)
                : 0
        })),
        forecast_reason: [
            `Based on ${similar?.cohort_size ?? 0} patients with similar baseline risk (${riskMin}-${riskMax})`,
            expectedImprovement > 0
                ? `Similar patients improved by an average of ${expectedImprovement} points`
                : 'Insufficient similar patient data for improvement prediction',
            topTherapies.length > 0
                ? `Top recommended therapy: ${topTherapies[0].therapy_module}`
                : 'No therapy outcome data for similar cohort yet'
        ]
    };
}

// ============================================
// PHASE E — CLINICIAN PERFORMANCE
// ============================================

/**
 * Compute clinician performance metrics.
 * In the current schema, we map user_id 1 (demo) as the single clinician.
 * This can be extended when multi-clinician support is added.
 * 
 * @param {number} clinicianId
 * @returns {Object}
 */
function getClinicianPerformance(clinicianId) {
    // In demo mode, clinician handles all patients. In production,
    // a clinician_patient_map table would be needed.

    const stats = db.prepare(`
        SELECT 
            COUNT(*) as patients_handled,
            ROUND(AVG(improvement_rate), 2) as avg_risk_reduction,
            ROUND(AVG(CASE WHEN engagement_trend > 0 THEN engagement_trend ELSE 0 END), 2) as avg_engagement_improvement,
            CASE WHEN COUNT(*) > 0 
                THEN ROUND(CAST(SUM(CASE WHEN regression_flag = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*), 4)
                ELSE 0 
            END as regression_rate
        FROM patient_analytics
    `).get();

    // Therapy success rate
    const therapyStats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'effective' THEN 1 ELSE 0 END) as effective
        FROM therapy_outcomes
    `).get();

    const therapySuccessRate = therapyStats?.total > 0
        ? Math.round((therapyStats.effective / therapyStats.total) * 100) / 100
        : 0;

    const avgRiskReduction = Math.max(0, stats?.avg_risk_reduction ?? 0);
    const avgEngImprovement = Math.max(0, stats?.avg_engagement_improvement ?? 0);
    const regressionRate = stats?.regression_rate ?? 0;

    // Normalized score (0-100)
    const effectivenessScore = Math.round(
        0.4 * clamp(avgRiskReduction, 0, 100) +
        0.3 * clamp(avgEngImprovement, 0, 100) +
        0.2 * (therapySuccessRate * 100) +
        0.1 * ((1 - regressionRate) * 100)
    );

    return {
        clinician_id: clinicianId,
        patients_handled: stats?.patients_handled ?? 0,
        avg_risk_reduction: avgRiskReduction,
        avg_engagement_improvement: avgEngImprovement,
        regression_rate: Math.round(regressionRate * 100),
        therapy_success_rate: Math.round(therapySuccessRate * 100),
        effectiveness_score: clamp(effectivenessScore, 0, 100),
        performance_tier: effectivenessScore >= 75 ? 'Excellent'
            : effectivenessScore >= 50 ? 'Good'
                : effectivenessScore >= 25 ? 'Developing'
                    : 'Needs Improvement',
        forecast_reason: [
            `Managing ${stats?.patients_handled ?? 0} patients`,
            `Average risk reduction: ${avgRiskReduction} points`,
            `Therapy success rate: ${Math.round(therapySuccessRate * 100)}%`,
            `Regression rate: ${Math.round(regressionRate * 100)}%`,
            `Composite effectiveness score: ${clamp(effectivenessScore, 0, 100)}/100`
        ]
    };
}

export {
    // Math utilities
    slope,
    stdDev,
    mean,
    // Phase A
    updatePatientAnalytics,
    getPatientAnalytics,
    // Phase B
    updateTherapyOutcome,
    getTherapyEffectiveness,
    // Phase C
    getCohortAnalytics,
    // Phase D
    getSimilarPatients,
    // Phase E
    getClinicianPerformance
};
