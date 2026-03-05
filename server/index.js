import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import db from './db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initSocketServer } from './socketManager.js';
import { initScheduler } from './scheduler.js';

// Route Imports
import teleconsultRoutes from './routes/teleconsult.js';
import gameRoutes from './routes/games.js';
import communityRoutes from './routes/community.js';
import notificationRoutes from './routes/notifications.js';
import extrasRoutes from './routes/extras.js';
import pushRoutes from './routes/push.js';

// Engine Imports
import { generateTherapyPlan, getTherapyPlanFromScreening, THERAPY_MODULES } from './engines/therapyEngine.js';
import {
    updatePatientAnalytics,
    getPatientAnalytics,
    updateTherapyOutcome,
    getTherapyEffectiveness,
    getCohortAnalytics,
    getSimilarPatients,
    getClinicianPerformance
} from './engines/analyticsEngine.js';
import {
    getTodayTasks,
    completeTherapyTask,
    generateAlerts,
    getClinicianWorklist,
    resolveAlert,
    resolveUserAlerts,
    calculateImprovement,
    generateReportData,
    wrapWithTrustFields,
    DISCLAIMER,
    checkAndGenerateReminders,
    getPendingReminders,
    bulkCreateUsers
} from './engines/workflowEngine.js';
import {
    runFullAnalysis,
    assessSessionQuality,
    computeRiskScore,
    scoreBehavioralQuestionnaire,
    fuseRiskScores,
    generateExplanations,
    classifyTriage,
    detectRegression,
    extractTemporalFeatures,
    BEHAVIORAL_QUESTIONNAIRE
} from './engines/metricsEngine.js';
import { preloadModel, getModelStatus } from './engines/moderationEngine.js';
import { initPushTable } from './engines/pushEngine.js';
import { initEmailTransporter, sendWeeklyReport, getEmailStatus } from './engines/emailEngine.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'neurobridge-insecure-dev-secret';

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Rate Limiting (F4)
import rateLimit from 'express-rate-limit';
const generalLimiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true, legacyHeaders: false, message: { error: true, message: 'Too many requests, please slow down.' } });
const postLimiter = rateLimit({ windowMs: 60000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: true, message: 'Too many write requests.' } });
app.use(generalLimiter);

// ============================================
// MIDDLEWARE & AUTH
// ============================================

// Middleware: Soft Authentication (populates req.user if valid token present)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next(); // Proceed without user (will rely on getUserId fallback)
    }
}

// Middleware: Strict Authentication (blocks if no valid token)
function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
}

// Helper to get User ID with legacy fallback (Demo Mode)
function getUserId(req) {
    return (req.user && req.user.id) ? req.user.id : 1;
}

app.use(authenticateToken);

// ============================================
// AUTH ROUTES (New Phase 8)
// ============================================

app.post('/api/auth/register', (req, res) => {
    try {
        const { name, email, password, age_string } = req.body;
        if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

        const hash = bcrypt.hashSync(password, 8);

        const stmt = db.prepare('INSERT INTO users (name, parent_email, password_hash, age_string) VALUES (?, ?, ?, ?)');
        const info = stmt.run(name, email, hash, age_string || 'Unknown');

        const token = jwt.sign({ id: info.lastInsertRowid, name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: info.lastInsertRowid, name, email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        // Looking up by email or name for now (demo flexibility)
        const user = db.prepare('SELECT * FROM users WHERE parent_email = ? OR name = ?').get(email, email);

        if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
            // Demo fallback: if user 1 exists but has no password, allow "demo" password
            if (user && user.id === 1 && !user.password_hash && password === 'demo') {
                const token = jwt.sign({ id: 1, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({
                    success: true,
                    token,
                    user: { id: 1, name: user.name }
                });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.parent_email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// USER ROUTES
// ============================================

// Get current user profile
app.get('/api/user', (req, res) => {
    try {
        const userId = getUserId(req);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const lastScreening = db.prepare('SELECT timestamp FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            ...user,
            password_hash: undefined, // Don't send hash
            lastScreeningDate: lastScreening ? new Date(lastScreening.timestamp).toLocaleDateString() : 'Never',
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SCREENING ENDPOINTS
// ============================================

app.post('/api/screenings', (req, res) => {
    const body = req.body;

    // Detect V2 (structured metrics) vs V1 (legacy) format
    const isV2 = Array.isArray(body.attention_series) && body.attention_series.length > 0;

    if (isV2) {
        return handleV2Screening(body, res, req);
    } else {
        return handleV1Screening(body, res, req);
    }
});

/**
 * V2 Screening: Structured metrics pipeline
 */
function handleV2Screening(body, res, req) {
    try {
        // Validation (Data Integrity)
        if (!body.attention_series || !Array.isArray(body.attention_series)) {
            return res.status(400).json({ error: 'Invalid attention_series format' });
        }
        if (body.session_duration == null) {
            return res.status(400).json({ error: 'Missing session_duration' });
        }

        // Run the full analysis pipeline
        const analysis = runFullAnalysis(body);
        const userId = getUserId(req);

        // Store in database
        const stmt = db.prepare(`
            INSERT INTO screenings (
                user_id,
                overall_score,
                risk_level,
                vision_score,
                vision_probability,
                eeg_score,
                attention_metric,
                motor_metric,
                session_duration,
                face_presence,
                engagement,
                fixation_avg,
                quality_score,
                quality_label,
                is_reliable,
                fusion_mode,
                behavioral_score,
                component_scores_json,
                temporal_features_json,
                explanations_json,
                triage_level,
                triage_color,
                heatmap_image,
                attention_series_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            userId,
            analysis.overall_score,
            analysis.risk_level,
            analysis.component_scores.vision_risk,
            analysis.component_scores.vision_risk / 100,
            null, // eeg_score (not used in V2)
            analysis.temporal_features.mean,
            (body.motor_metric != null ? body.motor_metric : null),
            analysis.quality.session_duration,
            analysis.quality.face_presence,
            (body.engagement != null ? body.engagement : analysis.temporal_features.sustained_attention_ratio),
            (body.fixation_avg != null ? body.fixation_avg : null),
            analysis.quality.quality_score,
            analysis.quality.quality_label,
            analysis.quality.is_reliable ? 1 : 0,
            analysis.fusion_mode,
            analysis.behavioral ? analysis.behavioral.behavior_score : null,
            JSON.stringify(analysis.component_scores),
            JSON.stringify(analysis.temporal_features),
            JSON.stringify(analysis.explanations),
            analysis.triage.level,
            analysis.triage.color,
            body.heatmap_image || null,
            JSON.stringify(body.attention_series.slice(-300)) // Store last 300 points max
        );

        // Also store questionnaire responses if provided
        if (body.questionnaire_responses && analysis.behavioral) {
            const qStmt = db.prepare(`
                INSERT INTO questionnaire_responses (
                    user_id, screening_id, responses_json, behavior_score, risk_level, domain_severity_json
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);
            qStmt.run(
                userId,
                info.lastInsertRowid,
                JSON.stringify(body.questionnaire_responses),
                analysis.behavioral.behavior_score,
                analysis.behavioral.risk_level,
                JSON.stringify(analysis.behavioral.domain_severity)
            );
        }

        // Check for regression across sessions
        const recentSessions = db.prepare(`
            SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 5
        `).all(userId);
        const regression = detectRegression(recentSessions);

        // Trigger patient analytics update (Phase 9 — Clinician Intelligence)
        try { updatePatientAnalytics(userId); } catch (e) { console.warn('Analytics update skipped:', e.message); }

        // Trigger alert generation (Phase 10 — Product Workflow)
        try { generateAlerts(userId); } catch (e) { console.warn('Alert generation skipped:', e.message); }

        res.json({
            success: true,
            id: info.lastInsertRowid,
            version: 'v2',
            ...analysis,
            regression
        });
    } catch (error) {
        console.error('V2 Screening Error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * V1 Screening: Legacy compatibility (nose-only mode)
 */
function handleV1Screening(body, res, req) {
    const {
        visionScore,
        eegScore,
        attentionMetric,
        motorMetric,
        visionProbability
    } = body;

    const vProbScore = (visionProbability || 0) * 100;
    const riskFromVision = vProbScore;
    const riskFromAtt = 100 - (attentionMetric || 50);
    const riskFromMotor = Math.min(100, (motorMetric || 0));

    const finalScore = Math.round(
        (riskFromVision * 0.45) +
        (riskFromAtt * 0.35) +
        (riskFromMotor * 0.20)
    );

    let riskLevel = 'Low';
    if (finalScore > 40) riskLevel = 'Medium';
    if (finalScore > 70) riskLevel = 'High';

    try {
        const userId = getUserId(req);
        const stmt = db.prepare(`
            INSERT INTO screenings (
                user_id, overall_score, risk_level, vision_score, vision_probability,
                eeg_score, attention_metric, motor_metric, fusion_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
            userId, finalScore, riskLevel, vProbScore, visionProbability,
            eegScore, attentionMetric, motorMetric, 'legacy_v1'
        );

        res.json({
            success: true,
            id: info.lastInsertRowid,
            version: 'v1',
            riskLevel,
            overallScore: finalScore,
            breakdown: {
                vision: riskFromVision,
                attention: riskFromAtt,
                motor: riskFromMotor
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// ============================================
// HEATMAP ENDPOINT (On-demand retrieval)
// ============================================

app.get('/api/screenings/:id/heatmap', (req, res) => {
    try {
        const row = db.prepare('SELECT heatmap_image FROM screenings WHERE id = ?').get(req.params.id);
        if (!row || !row.heatmap_image) {
            return res.status(404).json({ error: 'No heatmap available for this session.' });
        }
        res.json({ heatmap_image: row.heatmap_image });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// BEHAVIORAL QUESTIONNAIRE ENDPOINTS
// ============================================

// Get questionnaire structure
app.get('/api/questionnaire', (req, res) => {
    res.json({ items: BEHAVIORAL_QUESTIONNAIRE });
});

// Score questionnaire (standalone)
app.post('/api/questionnaire/score', (req, res) => {
    try {
        const { responses } = req.body;
        const result = scoreBehavioralQuestionnaire(responses);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// MODEL INFERENCE (Legacy)
// ============================================

app.post('/api/model_infer', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data required' });

        // Lazy load screeningEngine
        const { analyzeHeatmap } = await import('./engines/screeningEngine.js');
        const result = await analyzeHeatmap(image);
        res.json(result);
    } catch (error) {
        console.error("Model Inference Error:", error);
        res.status(500).json({ error: "Inference Failed - legacy endpoint requires Node 14+" });
    }
});

// ============================================
// PROGRESS & LONGITUDINAL TRACKING
// ============================================

app.get('/api/progress', (req, res) => {
    try {
        const userId = getUserId(req);
        const rows = db.prepare(`
            SELECT * FROM screenings WHERE user_id = ? ORDER BY timestamp ASC
        `).all(userId);

        // Regression detection
        const reversedRows = [...rows].reverse(); // newest first
        const regression = detectRegression(reversedRows);

        // Trend Analysis
        let regressionWarning = regression ? regression.message : null;
        let attentionTrend = "Stable";

        if (rows.length >= 3) {
            const last = rows[rows.length - 1];
            const prev3 = rows.slice(Math.max(0, rows.length - 4), rows.length - 1);
            if (prev3.length > 0) {
                const avgPrevAtt = prev3.reduce((a, b) => a + (b.attention_metric || 50), 0) / prev3.length;
                const delta = (last.attention_metric || 50) - avgPrevAtt;
                if (delta < -15) attentionTrend = "declining";
                else if (delta > 10) attentionTrend = "improving";
            }
        }

        // Transform for frontend
        const data = rows.map(row => ({
            id: row.id,
            date: new Date(row.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            timestamp: row.timestamp,
            riskScore: row.overall_score,
            attention: row.attention_metric,
            motor: row.motor_metric,
            visionRisk: row.vision_probability ? Math.round(row.vision_probability * 100) : 0,
            riskLevel: row.risk_level,
            // V2 fields
            qualityLabel: row.quality_label || null,
            isReliable: row.is_reliable !== 0,
            fusionMode: row.fusion_mode || 'legacy_v1',
            engagement: row.engagement ? Math.round(row.engagement * 100) : null,
            facePresence: row.face_presence ? Math.round(row.face_presence * 100) : null,
            triageColor: row.triage_color || null,
            triageLevel: row.triage_level || null,
            hasHeatmap: !!row.heatmap_image,
            explanations: row.explanations_json ? JSON.parse(row.explanations_json) : null,
            componentScores: row.component_scores_json ? JSON.parse(row.component_scores_json) : null
        }));

        res.json({
            data,
            trends: {
                regressionWarning,
                attentionTrend,
                regression
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET SINGLE SCREENING DETAIL (for clinician)
// ============================================

app.get('/api/screenings/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        const row = db.prepare('SELECT * FROM screenings WHERE id = ? AND user_id = ?').get(req.params.id, userId);
        if (!row) return res.status(404).json({ error: 'Screening not found' });

        // Parse JSON fields
        const result = {
            ...row,
            component_scores: row.component_scores_json ? JSON.parse(row.component_scores_json) : null,
            temporal_features: row.temporal_features_json ? JSON.parse(row.temporal_features_json) : null,
            explanations: row.explanations_json ? JSON.parse(row.explanations_json) : null,
            attention_series: row.attention_series_json ? JSON.parse(row.attention_series_json) : null,
            has_heatmap: !!row.heatmap_image
        };

        // Remove raw JSON fields and heavy data
        delete result.component_scores_json;
        delete result.temporal_features_json;
        delete result.explanations_json;
        delete result.attention_series_json;
        delete result.heatmap_image; // Don't send unless requested

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CLINICIAN: PATIENT LIST WITH TRIAGE
// ============================================

app.get('/api/patients', (req, res) => {
    try {
        // Get all users with their latest screening data
        const users = db.prepare('SELECT * FROM users').all();

        const patients = users.map(user => {
            const latestScreening = db.prepare(`
                SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
            `).get(user.id);

            const screeningCount = db.prepare(
                'SELECT COUNT(*) as count FROM screenings WHERE user_id = ?'
            ).get(user.id);

            return {
                id: user.id,
                name: user.name,
                age: user.age_string,
                lastScreening: latestScreening
                    ? new Date(latestScreening.timestamp).toLocaleDateString()
                    : 'Never',
                risk: (latestScreening && latestScreening.risk_level) || 'Unknown',
                riskScore: (latestScreening && latestScreening.overall_score) || 0,
                triageColor: (latestScreening && latestScreening.triage_color) || 'gray',
                triageLevel: (latestScreening && latestScreening.triage_level) || 'none',
                qualityLabel: (latestScreening && latestScreening.quality_label) || null,
                isReliable: latestScreening ? latestScreening.is_reliable !== 0 : true,
                fusionMode: (latestScreening && latestScreening.fusion_mode) || null,
                screeningCount: screeningCount.count,
                latestExplanations: (latestScreening && latestScreening.explanations_json)
                    ? JSON.parse(latestScreening.explanations_json)
                    : null,
                latestComponentScores: (latestScreening && latestScreening.component_scores_json)
                    ? JSON.parse(latestScreening.component_scores_json)
                    : null
            };
        });

        // Sort by risk score descending
        patients.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CONSENT AUDIT
// ============================================

app.post('/api/consent', (req, res) => {
    try {
        const { user_id, consent_type, consent_given } = req.body;
        const actualUserId = user_id || getUserId(req);

        const stmt = db.prepare(`
            INSERT INTO consent_audit (user_id, consent_type, consent_given, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
            actualUserId,
            consent_type || 'screening',
            consent_given ? 1 : 0,
            req.ip,
            req.get('User-Agent')
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ADAPTIVE THERAPY PLAN ENDPOINTS
// ============================================

app.get('/api/therapy-plan', (req, res) => {
    try {
        const userId = getUserId(req);
        const latestScreening = db.prepare(`
            SELECT * FROM screenings WHERE user_id = ? ORDER BY id DESC LIMIT 1
        `).get(userId);

        if (!latestScreening) {
            return res.status(404).json({
                error: 'No screening data found',
                message: 'Complete an AI screening session first to generate a personalized therapy plan.'
            });
        }

        const plan = getTherapyPlanFromScreening(latestScreening);

        res.json({
            success: true,
            screeningId: latestScreening.id,
            screeningDate: new Date(latestScreening.timestamp).toLocaleDateString(),
            plan
        });
    } catch (error) {
        console.error('Therapy Plan Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/therapy-plan/generate', (req, res) => {
    try {
        const inputData = req.body;
        const plan = generateTherapyPlan(inputData);
        res.json({ success: true, plan });
    } catch (error) {
        console.error('Therapy Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/therapy-modules', (req, res) => {
    res.json({ modules: THERAPY_MODULES });
});

app.post('/api/therapy-progress', (req, res) => {
    try {
        const { date, completedTasks, totalTasks, domains } = req.body;
        console.log('Therapy Progress:', { date, completedTasks, totalTasks });
        // In a full implementation, we would save this to a 'therapy_logs' table
        // For now, logging and success is sufficient for the MVP requirements
        res.json({
            success: true,
            message: 'Progress saved',
            completionPercent: Math.round((completedTasks / totalTasks) * 100)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CLINICIAN INTELLIGENCE — ANALYTICS ENDPOINTS (Phase 9)
// ============================================

// GET /analytics/patient/:userId — Full patient longitudinal analytics
app.get('/analytics/patient/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        // Ensure analytics are fresh
        updatePatientAnalytics(userId);
        const analytics = getPatientAnalytics(userId);

        if (!analytics) {
            return res.status(404).json({
                error: 'No analytics data',
                message: 'This patient needs at least one completed screening session.'
            });
        }

        res.json({ success: true, analytics });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /analytics/patient/:userId/similar — Similar patient outcomes & recommendations
app.get('/analytics/patient/:userId/similar', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const result = getSimilarPatients(userId);
        if (result.error) return res.status(404).json(result);

        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /analytics/cohort — Population-level cohort intelligence
app.get('/analytics/cohort', (req, res) => {
    try {
        const cohort = getCohortAnalytics();
        res.json({ success: true, ...cohort });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /analytics/clinician/:clinicianId — Clinician performance metrics
app.get('/analytics/clinician/:clinicianId', (req, res) => {
    try {
        const clinicianId = parseInt(req.params.clinicianId);
        if (isNaN(clinicianId)) return res.status(400).json({ error: 'Invalid clinician ID' });

        const performance = getClinicianPerformance(clinicianId);
        res.json({ success: true, performance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /analytics/therapy/update — Record therapy outcome
app.post('/analytics/therapy/update', (req, res) => {
    try {
        const { user_id, therapy_module, start_date, end_date } = req.body;
        if (!therapy_module) return res.status(400).json({ error: 'therapy_module is required' });

        const actualUserId = user_id || getUserId(req);
        const result = updateTherapyOutcome({
            user_id: actualUserId,
            therapy_module,
            start_date,
            end_date
        });

        res.json({ success: true, outcome: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /analytics/therapy/effectiveness — Aggregated therapy effectiveness stats
app.get('/analytics/therapy/effectiveness', (req, res) => {
    try {
        const module = req.query.module || null;
        const stats = getTherapyEffectiveness(module);
        res.json({ success: true, effectiveness: stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 1 — DAILY CAREGIVER VALUE LOOP
// ============================================

// GET /therapy/today/:userId — Today's therapy tasks + daily insight
app.get('/therapy/today/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const result = getTodayTasks(userId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /therapy/complete — Mark a therapy task as completed
app.post('/therapy/complete', (req, res) => {
    try {
        const { task_id, duration_minutes } = req.body;
        if (!task_id) return res.status(400).json({ error: 'task_id is required' });

        const userId = getUserId(req);
        const result = completeTherapyTask({
            user_id: userId,
            task_id,
            duration_minutes: duration_minutes || 0
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 2 — CLINICIAN WORKLIST + ALERTS
// ============================================

// GET /clinician/worklist — Prioritized patient worklist with alerts
app.get('/clinician/worklist', (req, res) => {
    try {
        // Generate alerts for all patients first
        const users = db.prepare('SELECT id FROM users').all();
        for (const u of users) {
            try { generateAlerts(u.id); } catch (e) { /* skip */ }
        }

        const worklist = getClinicianWorklist();
        res.json({ success: true, worklist, disclaimer: DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /alerts/:userId — Get active alerts for a patient
app.get('/alerts/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const alerts = db.prepare(`
            SELECT * FROM alerts WHERE user_id = ? AND resolved = 0
            ORDER BY created_at DESC
        `).all(userId);

        res.json({ success: true, alerts, disclaimer: DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /alerts/:alertId/resolve — Resolve a single alert
app.post('/alerts/:alertId/resolve', (req, res) => {
    try {
        const alertId = parseInt(req.params.alertId);
        if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert ID' });

        const result = resolveAlert(alertId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /alerts/user/:userId/resolve-all — Resolve all alerts for a patient
app.post('/alerts/user/:userId/resolve-all', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const result = resolveUserAlerts(userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 3 — OUTCOME MEASUREMENT
// ============================================

// GET /patient/outcome/:userId — Full outcome summary
app.get('/patient/outcome/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const outcome = calculateImprovement(userId);
        if (outcome.error) return res.status(404).json(outcome);

        res.json({ success: true, outcome });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 4 — ONE-CLICK CLINICAL REPORT (PDF)
// ============================================

// GET /reports/patient/:userId — Generate PDF clinical report
app.get('/reports/patient/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const reportData = generateReportData(userId);
        if (reportData.error) return res.status(404).json(reportData);

        // Check if JSON format requested
        if (req.query.format === 'json') {
            return res.json({ success: true, report: reportData });
        }

        // Generate PDF using PDFKit
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=NeuroBridge_Report_Patient_${userId}.pdf`);
        doc.pipe(res);

        // --- PDF Content ---

        // Header
        doc.fontSize(22).font('Helvetica-Bold').text('NeuroBridge AI', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Clinical Progress Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);
        doc.strokeColor('#4A90D9').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Patient Info
        doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Patient Information');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Name: ${reportData.patient.name}`);
        doc.text(`Age: ${reportData.patient.age || 'N/A'}`);
        doc.text(`Contact: ${reportData.patient.email || 'N/A'}`);
        doc.moveDown(1);

        // Outcome Summary
        doc.fontSize(14).font('Helvetica-Bold').text('Outcome Summary');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        const o = reportData.outcome_summary;
        doc.text(`Improvement Score: ${o.improvement_score > 0 ? '+' : ''}${o.improvement_score} points`);
        doc.text(`Baseline Risk: ${o.baseline_risk}  →  Current Risk: ${o.current_risk} (${o.risk_level})`);
        doc.text(`Engagement Change: ${o.engagement_change > 0 ? '+' : ''}${o.engagement_change}`);
        doc.text(`Therapy Effectiveness: ${o.therapy_effectiveness != null ? o.therapy_effectiveness + '%' : 'Not yet assessed'}`);
        doc.text(`Weeks Tracked: ${o.weeks_tracked}  |  Total Sessions: ${o.total_sessions}`);
        doc.moveDown(1);

        // Risk Trend Data
        if (reportData.risk_trend_data && reportData.risk_trend_data.length > 0) {
            doc.fontSize(14).font('Helvetica-Bold').text('Risk Score History');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica');
            for (const entry of reportData.risk_trend_data.slice(-10)) {
                const date = new Date(entry.date).toLocaleDateString();
                doc.text(`  ${date}  —  Risk: ${entry.risk_score}  |  Engagement: ${entry.engagement != null ? (entry.engagement <= 1 ? Math.round(entry.engagement * 100) + '%' : Math.round(entry.engagement) + '%') : 'N/A'}`);
            }
            doc.moveDown(1);
        }

        // Therapy Plan
        if (reportData.latest_therapy_plan) {
            doc.fontSize(14).font('Helvetica-Bold').text('Current Therapy Plan');
            doc.moveDown(0.3);
            doc.fontSize(10).font('Helvetica');
            for (const domain of reportData.latest_therapy_plan.domains) {
                doc.text(`  • ${domain.name} — Priority: ${domain.priority}, Severity: ${domain.severity}, Tasks: ${domain.task_count}`);
            }
            doc.moveDown(1);
        }

        // AI Explanations
        if (reportData.ai_explanations && reportData.ai_explanations.length > 0) {
            doc.fontSize(14).font('Helvetica-Bold').text('AI Analysis Explanations');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica');
            for (const exp of reportData.ai_explanations) {
                doc.text(`  • ${exp}`);
            }
            doc.moveDown(1);
        }

        // Forecast
        if (reportData.forecast) {
            doc.fontSize(14).font('Helvetica-Bold').text('Risk Forecast');
            doc.moveDown(0.3);
            doc.fontSize(10).font('Helvetica');
            doc.text(`30-Day Predicted Risk: ${reportData.forecast.predicted_risk_30d}`);
            doc.text(`Trend Slope: ${reportData.forecast.risk_trend_slope}`);
            doc.text(`Regression Alert: ${reportData.forecast.regression_flag ? 'YES' : 'No'}`);
            doc.text(`Stability Index: ${reportData.forecast.stability_index}`);
            doc.moveDown(1);
        }

        // Disclaimer
        doc.moveDown(1);
        doc.strokeColor('#ccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor('#999').font('Helvetica-Oblique');
        doc.text(DISCLAIMER, { align: 'center' });
        doc.text(reportData.quality_notice, { align: 'center' });
        doc.text(`Confidence Level: ${reportData.confidence_level}`, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Report Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 6 — ENGAGEMENT & RETENTION
// ============================================

// GET /reminders/pending — Get all pending reminders
app.get('/reminders/pending', (req, res) => {
    try {
        // Auto-check and generate new reminders
        checkAndGenerateReminders();
        const reminders = getPendingReminders();
        res.json({ success: true, reminders, disclaimer: DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /reminders/:userId/dismiss — Mark reminder as sent
app.post('/reminders/:userId/dismiss', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        db.prepare('UPDATE reminders SET sent = 1 WHERE user_id = ? AND sent = 0').run(userId);
        res.json({ success: true, message: 'Reminder dismissed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PHASE 7 — CLINIC GROWTH (BULK UPLOAD)
// ============================================

// POST /clinic/bulk-upload — Create multiple patients from CSV
app.post('/clinic/bulk-upload', (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv || typeof csv !== 'string') {
            return res.status(400).json({ error: 'CSV data required in request body as { "csv": "name,age,email\n..." }' });
        }

        const result = bulkCreateUsers(csv);
        res.json({
            success: true,
            ...result,
            disclaimer: DISCLAIMER
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// NEW MODULE ROUTES (v5.3 — API Versioning)
// ============================================

// Versioned routes — /api/v1 prefix
app.use('/api/v1', teleconsultRoutes);
app.use('/api/v1', gameRoutes);
app.use('/api/v1', communityRoutes);
app.use('/api/v1', notificationRoutes);
app.use('/api/v1', extrasRoutes);
app.use('/api/v1', pushRoutes);

// Legacy routes (backward compatibility — will be deprecated in v6)
app.use(teleconsultRoutes);
app.use(gameRoutes);
app.use(communityRoutes);
app.use(notificationRoutes);
app.use(extrasRoutes);
app.use(pushRoutes);

// ============================================
// MODERATION STATUS
// ============================================

app.get('/api/v1/moderation/status', (req, res) => {
    res.json({ success: true, moderation: getModelStatus() });
});

// GET /api/v1/email/status — Email system status
app.get('/api/v1/email/status', (req, res) => {
    res.json({ success: true, email: getEmailStatus() });
});

// POST /api/v1/email/weekly-report — Send weekly report for current user
app.post('/api/v1/email/weekly-report', async (req, res) => {
    try {
        const userId = (req.user && req.user.id) ? req.user.id : 1;
        const result = await sendWeeklyReport(userId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CENTRALIZED ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({
        error: true,
        message: err.message || 'Internal server error',
        code: err.code || 'UNKNOWN_ERROR'
    });
});

// ============================================
// SERVER START
// ============================================

const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(PORT, () => {
    console.log(`NeuroBridge AI Backend v5.6 running on http://localhost:${PORT}`);
    console.log('API Versioning: ENABLED (/api/v1 + legacy fallback)');
    console.log('Clinician Intelligence Mode: ENABLED');
    console.log('Product Workflow Engine: ENABLED (Phases 1-7)');
    console.log('Teleconsultation Module: ENABLED');
    console.log('WebRTC Signaling (Socket.IO): ENABLED');
    console.log('Therapy Games Module: ENABLED (4 interactive games)');
    console.log('Community Platform Module: ENABLED (+ ML Toxicity Filter)');
    console.log('Notification Center: ENABLED');
    console.log('Push Notifications: ENABLED (Web Push + VAPID)');
    console.log('Email Reports: ENABLED (Nodemailer)');

    // Initialize push subscriptions table
    initPushTable();

    // Initialize email transporter
    initEmailTransporter();

    // Initialize cron-based scheduler
    initScheduler();

    // Preload ML toxicity model in background
    preloadModel();
});
