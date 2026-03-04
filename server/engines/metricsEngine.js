/**
 * NeuroBridge AI — Metrics Intelligence Engine
 * 
 * Structured behavioral biomarker analysis pipeline.
 * Replaces heatmap-based inference with temporal metrics analysis.
 * 
 * Features:
 *   - Temporal feature extraction (variance, trend, saccades)
 *   - Multi-factor risk scoring
 *   - Session quality validation
 *   - Behavioral questionnaire fusion
 *   - Clinician explanation generation
 *   - Triage classification
 * 
 * DISCLAIMER: Decision-support tool only. Not a diagnostic instrument.
 */

// ============================================
// TEMPORAL FEATURE EXTRACTION
// ============================================

/**
 * Compute statistical features from an attention time series.
 * @param {number[]} series - Array of attention scores (0-100)
 * @param {number} fps - Approximate frames per second (default 30)
 * @returns {Object} Temporal features
 */
export function extractTemporalFeatures(series, fps = 30) {
    if (!series || series.length < 10) {
        return {
            mean: 50,
            variance: 0,
            std_dev: 0,
            trend_slope: 0,
            saccade_frequency: 0,
            attention_drops: 0,
            sustained_attention_ratio: 0,
            first_half_mean: 50,
            second_half_mean: 50,
            peak_attention: 50,
            min_attention: 50,
            range: 0
        };
    }

    // Mean
    const mean = series.reduce((a, b) => a + b, 0) / series.length;

    // Variance & Std Dev
    const variance = series.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / series.length;
    const std_dev = Math.sqrt(variance);

    // Trend: compare first half mean vs second half mean
    const mid = Math.floor(series.length / 2);
    const first_half_mean = series.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const second_half_mean = series.slice(mid).reduce((a, b) => a + b, 0) / (series.length - mid);
    const trend_slope = second_half_mean - first_half_mean; // positive = improving

    // Saccade frequency: large attention changes per second
    // A "saccade" = attention change > 25 points between consecutive frames
    const saccadeThreshold = 25;
    let saccadeCount = 0;
    for (let i = 1; i < series.length; i++) {
        if (Math.abs(series[i] - series[i - 1]) > saccadeThreshold) {
            saccadeCount++;
        }
    }
    const durationSec = series.length / fps;
    const saccade_frequency = durationSec > 0 ? saccadeCount / durationSec : 0;

    // Attention drops: frames where attention drops below 30
    const attention_drops = series.filter(v => v < 30).length;

    // Sustained attention: ratio of frames with attention > 60
    const sustained_attention_ratio = series.filter(v => v > 60).length / series.length;

    // Peak / Min / Range
    const peak_attention = Math.max(...series);
    const min_attention = Math.min(...series);
    const range = peak_attention - min_attention;

    return {
        mean: parseFloat(mean.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
        std_dev: parseFloat(std_dev.toFixed(2)),
        trend_slope: parseFloat(trend_slope.toFixed(2)),
        saccade_frequency: parseFloat(saccade_frequency.toFixed(2)),
        attention_drops,
        sustained_attention_ratio: parseFloat(sustained_attention_ratio.toFixed(3)),
        first_half_mean: parseFloat(first_half_mean.toFixed(2)),
        second_half_mean: parseFloat(second_half_mean.toFixed(2)),
        peak_attention: parseFloat(peak_attention.toFixed(2)),
        min_attention: parseFloat(min_attention.toFixed(2)),
        range: parseFloat(range.toFixed(2))
    };
}

// ============================================
// SESSION QUALITY GATE
// ============================================

/**
 * Validate session quality and flag unreliable sessions.
 * @param {Object} metrics - Session metrics from frontend
 * @returns {Object} Quality assessment
 */
export function assessSessionQuality(metrics) {
    const flags = [];
    let qualityScore = 100;

    // 1. Face presence check (< 70% = unreliable)
    const facePresence = (metrics.face_presence != null) ? metrics.face_presence
        : (metrics.total_frames > 0 ? metrics.face_detected_frames / metrics.total_frames : 0);

    if (facePresence < 0.70) {
        flags.push({
            type: 'low_face_presence',
            severity: 'high',
            message: `Face detected in only ${Math.round(facePresence * 100)}% of frames. Results may be unreliable.`,
            detail: 'Ensure child is facing camera with adequate lighting.'
        });
        qualityScore -= 30;
    } else if (facePresence < 0.85) {
        flags.push({
            type: 'moderate_face_presence',
            severity: 'medium',
            message: `Face detected in ${Math.round(facePresence * 100)}% of frames.`,
            detail: 'Session quality is acceptable but could be improved.'
        });
        qualityScore -= 10;
    }

    // 2. Session duration check (< 60 sec = too short)
    const durationSec = (metrics.session_duration != null) ? metrics.session_duration : 15;
    if (durationSec < 10) {
        flags.push({
            type: 'very_short_session',
            severity: 'high',
            message: `Session lasted only ${Math.round(durationSec)} seconds. Minimum 10 seconds recommended.`,
            detail: 'Longer sessions provide more reliable data.'
        });
        qualityScore -= 25;
    } else if (durationSec < 15) {
        flags.push({
            type: 'short_session',
            severity: 'medium',
            message: `Session was ${Math.round(durationSec)} seconds. 15+ seconds recommended.`,
            detail: 'Consider running a longer session for better accuracy.'
        });
        qualityScore -= 10;
    }

    // 3. Multiple faces check (> 5% frames)
    const multiFaceRatio = metrics.total_frames > 0
        ? ((metrics.multi_face_frames != null ? metrics.multi_face_frames : 0)) / metrics.total_frames
        : 0;
    if (multiFaceRatio > 0.05) {
        flags.push({
            type: 'multi_face',
            severity: 'medium',
            message: `Multiple faces detected in ${Math.round(multiFaceRatio * 100)}% of frames.`,
            detail: 'Only the child should be visible to the camera during screening.'
        });
        qualityScore -= 15;
    }

    // 4. Low light check (> 30% frames)
    const lowLightRatio = metrics.total_frames > 0
        ? ((metrics.low_light_frames != null ? metrics.low_light_frames : 0)) / metrics.total_frames
        : 0;
    if (lowLightRatio > 0.30) {
        flags.push({
            type: 'low_light',
            severity: 'medium',
            message: `Low lighting detected in ${Math.round(lowLightRatio * 100)}% of frames.`,
            detail: 'Ensure the room is well-lit for accurate face tracking.'
        });
        qualityScore -= 15;
    }

    // 5. Insufficient data points
    const totalFrames = (metrics.total_frames != null) ? metrics.total_frames : 0;
    if (totalFrames < 100) {
        flags.push({
            type: 'insufficient_data',
            severity: 'medium',
            message: `Only ${totalFrames} frames captured. More data improves accuracy.`,
            detail: 'Try to maintain a stable camera feed throughout the session.'
        });
        qualityScore -= 10;
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));
    const isReliable = qualityScore >= 60 && flags.filter(f => f.severity === 'high').length === 0;

    return {
        quality_score: qualityScore,
        is_reliable: isReliable,
        quality_label: qualityScore >= 80 ? 'High' : qualityScore >= 60 ? 'Moderate' : 'Low',
        flags,
        face_presence: parseFloat((facePresence).toFixed(3)),
        session_duration: durationSec
    };
}

// ============================================
// RISK SCORING MODEL
// ============================================

/**
 * Compute multi-factor risk score from structured metrics.
 * 
 * Model:
 *   VisionScore     = normalize(attention_variance)          — higher variance = higher risk
 *   EngagementScore = 1 - engagement                         — lower engagement = higher risk
 *   StabilityScore  = 1 - face_presence                      — lower presence = higher risk
 *   FixationScore   = 1 - normalize(fixation_avg)            — lower fixation = higher risk
 * 
 *   FinalRisk = 0.30*VisionScore + 0.30*EngagementScore + 0.20*StabilityScore + 0.20*FixationScore
 * 
 * @param {Object} metrics - Structured metrics from frontend + temporal features
 * @returns {Object} Risk assessment with component scores
 */
export function computeRiskScore(metrics) {
    const temporalFeatures = extractTemporalFeatures(metrics.attention_series);
    const noseFeatures = extractTemporalFeatures(metrics.nose_attention_series);
    const irisFeatures = extractTemporalFeatures(metrics.iris_attention_series);

    // Vision Score: based on attention variance (normalized 0-1)
    // High variance in attention = scattered gaze = higher risk
    // Typical variance range: 0 (perfect focus) to ~2500 (max for 0-100 scale)
    const maxExpectedVariance = 1500;
    const visionScore = Math.min(1, temporalFeatures.variance / maxExpectedVariance);

    // Engagement Score: fraction of time with attention > 60
    // Low engagement = higher risk
    const engagement = (metrics.engagement != null) ? metrics.engagement : temporalFeatures.sustained_attention_ratio;
    const engagementRisk = 1 - engagement;

    // Stability Score: based on face presence
    const facePresence = (metrics.face_presence != null) ? metrics.face_presence : 1;
    const stabilityRisk = 1 - facePresence;

    // Fixation Score: based on average fixation duration
    // Typical fixation: 1-3 seconds; lower = more scattered
    const fixationAvg = (metrics.fixation_avg != null) ? metrics.fixation_avg : 1.5;
    const maxFixation = 3.0; // 3 seconds is "good" sustained fixation
    const fixationNormalized = Math.min(1, fixationAvg / maxFixation);
    const fixationRisk = 1 - fixationNormalized;

    // Ensemble risk score (0-100)
    const rawRisk = (
        0.30 * visionScore +
        0.30 * engagementRisk +
        0.20 * stabilityRisk +
        0.20 * fixationRisk
    );
    const finalRiskScore = Math.round(rawRisk * 100);

    // Determine risk level
    let riskLevel;
    if (finalRiskScore > 70) riskLevel = 'High';
    else if (finalRiskScore > 40) riskLevel = 'Medium';
    else riskLevel = 'Low';

    // Saccade-based adjustment: very high saccade frequency adds to risk
    let saccadeAdjustment = 0;
    if (temporalFeatures.saccade_frequency > 3) {
        saccadeAdjustment = Math.min(10, Math.round((temporalFeatures.saccade_frequency - 3) * 3));
    }

    const adjustedRiskScore = Math.min(100, finalRiskScore + saccadeAdjustment);

    return {
        overall_score: adjustedRiskScore,
        risk_level: riskLevel,
        component_scores: {
            vision_risk: parseFloat((visionScore * 100).toFixed(1)),
            engagement_risk: parseFloat((engagementRisk * 100).toFixed(1)),
            stability_risk: parseFloat((stabilityRisk * 100).toFixed(1)),
            fixation_risk: parseFloat((fixationRisk * 100).toFixed(1)),
            saccade_adjustment: saccadeAdjustment
        },
        weights: {
            vision: 0.30,
            engagement: 0.30,
            stability: 0.20,
            fixation: 0.20
        },
        temporal_features: temporalFeatures,
        nose_features: noseFeatures,
        iris_features: irisFeatures
    };
}


// ============================================
// BEHAVIORAL QUESTIONNAIRE FUSION
// ============================================

/**
 * M-CHAT-R/F inspired behavioral questionnaire items.
 * 10 yes/no items covering key developmental markers.
 */
export const BEHAVIORAL_QUESTIONNAIRE = [
    {
        id: 'q1',
        text: 'Does your child look at you when you call their name?',
        domain: 'social_attention',
        risk_if: 'no' // 'no' answer indicates risk
    },
    {
        id: 'q2',
        text: 'Does your child point to show you something interesting (not to ask for it)?',
        domain: 'joint_attention',
        risk_if: 'no'
    },
    {
        id: 'q3',
        text: 'Does your child engage in pretend play (e.g., feeding a doll)?',
        domain: 'imaginative_play',
        risk_if: 'no'
    },
    {
        id: 'q4',
        text: 'Does your child follow where you look when you point at something?',
        domain: 'joint_attention',
        risk_if: 'no'
    },
    {
        id: 'q5',
        text: 'Does your child make eye contact with you during interaction?',
        domain: 'social_attention',
        risk_if: 'no'
    },
    {
        id: 'q6',
        text: 'Does your child imitate your actions (e.g., clapping, waving)?',
        domain: 'social_imitation',
        risk_if: 'no'
    },
    {
        id: 'q7',
        text: 'Does your child respond to their name being called within a few seconds?',
        domain: 'social_attention',
        risk_if: 'no'
    },
    {
        id: 'q8',
        text: 'Does your child show interest in other children?',
        domain: 'social_engagement',
        risk_if: 'no'
    },
    {
        id: 'q9',
        text: 'Does your child bring objects to you to share interest (not just for help)?',
        domain: 'joint_attention',
        risk_if: 'no'
    },
    {
        id: 'q10',
        text: 'Does your child use gestures (e.g., waving bye, shaking head) to communicate?',
        domain: 'communication',
        risk_if: 'no'
    }
];

/**
 * Score behavioral questionnaire responses.
 * @param {Object} responses - Map of question_id → 'yes'|'no'
 * @returns {Object} Behavioral score and domain breakdown
 */
export function scoreBehavioralQuestionnaire(responses) {
    if (!responses || Object.keys(responses).length === 0) {
        return null; // No questionnaire data
    }

    let riskCount = 0;
    let totalAnswered = 0;
    const domainScores = {};

    for (const item of BEHAVIORAL_QUESTIONNAIRE) {
        const answer = responses[item.id];
        if (answer === undefined || answer === null) continue;

        totalAnswered++;
        const isRisk = (item.risk_if === 'no' && answer === 'no') ||
            (item.risk_if === 'yes' && answer === 'yes');

        if (isRisk) riskCount++;

        // Track per-domain
        if (!domainScores[item.domain]) {
            domainScores[item.domain] = { total: 0, risk: 0 };
        }
        domainScores[item.domain].total++;
        if (isRisk) domainScores[item.domain].risk++;
    }

    if (totalAnswered === 0) return null;

    const behaviorScore = riskCount / totalAnswered; // 0 = no risk, 1 = all risk

    // Domain-level severity
    const domainSeverity = {};
    for (const [domain, counts] of Object.entries(domainScores)) {
        const ratio = counts.risk / counts.total;
        domainSeverity[domain] = {
            risk_ratio: parseFloat(ratio.toFixed(2)),
            severity: ratio > 0.6 ? 'High' : ratio > 0.3 ? 'Moderate' : 'Low'
        };
    }

    return {
        behavior_score: parseFloat(behaviorScore.toFixed(3)),
        risk_count: riskCount,
        total_answered: totalAnswered,
        domain_severity: domainSeverity,
        risk_level: behaviorScore > 0.5 ? 'High' : behaviorScore > 0.25 ? 'Moderate' : 'Low'
    };
}

/**
 * Fuse vision-temporal and behavioral scores into final risk.
 * 
 * FinalRisk = 0.40 * VisionTemporalScore + 0.30 * BehavioralScore + 0.30 * EngagementScore
 * 
 * @param {Object} visionRisk - Risk from computeRiskScore
 * @param {Object|null} behavioralResult - Result from scoreBehavioralQuestionnaire
 * @returns {Object} Fused risk assessment
 */
export function fuseRiskScores(visionRisk, behavioralResult) {
    const visionTemporalScore = visionRisk.overall_score / 100;

    // Engagement from component scores
    const engagementRisk = visionRisk.component_scores.engagement_risk / 100;

    if (!behavioralResult) {
        // No behavioral data — fall back to vision-only scoring
        return {
            fused_score: visionRisk.overall_score,
            risk_level: visionRisk.risk_level,
            fusion_mode: 'vision_only',
            components: {
                vision_temporal: visionRisk.overall_score,
                behavioral: null,
                engagement: Math.round(engagementRisk * 100)
            },
            weights_used: { vision: 1.0, behavioral: 0, engagement: 0 }
        };
    }

    const behavioralScore = behavioralResult.behavior_score;

    const fusedRaw = (
        0.40 * visionTemporalScore +
        0.30 * behavioralScore +
        0.30 * engagementRisk
    );

    const fusedScore = Math.round(fusedRaw * 100);
    let fusedLevel;
    if (fusedScore > 70) fusedLevel = 'High';
    else if (fusedScore > 40) fusedLevel = 'Medium';
    else fusedLevel = 'Low';

    return {
        fused_score: fusedScore,
        risk_level: fusedLevel,
        fusion_mode: 'multimodal',
        components: {
            vision_temporal: visionRisk.overall_score,
            behavioral: Math.round(behavioralScore * 100),
            engagement: Math.round(engagementRisk * 100)
        },
        weights_used: { vision: 0.40, behavioral: 0.30, engagement: 0.30 }
    };
}

// ============================================
// CLINICIAN EXPLANATION GENERATOR
// ============================================

/**
 * Generate human-readable clinical explanations from metrics.
 * @param {Object} riskResult - Result from computeRiskScore
 * @param {Object} qualityResult - Result from assessSessionQuality
 * @param {Object|null} behavioralResult - Result from scoreBehavioralQuestionnaire
 * @returns {string[]} Array of explanation strings
 */
export function generateExplanations(riskResult, qualityResult, behavioralResult) {
    const explanations = [];
    const { temporal_features, component_scores } = riskResult;

    // Attention variance
    if (temporal_features.variance > 800) {
        explanations.push({
            icon: '🔴',
            type: 'gaze_variability',
            severity: 'high',
            text: `High gaze variability detected (σ²=${temporal_features.variance.toFixed(0)}). Attention patterns are significantly scattered, which may indicate difficulty with sustained visual focus.`
        });
    } else if (temporal_features.variance > 400) {
        explanations.push({
            icon: '🟡',
            type: 'gaze_variability',
            severity: 'moderate',
            text: `Moderate gaze variability observed (σ²=${temporal_features.variance.toFixed(0)}). Some fluctuation in attention stability noted.`
        });
    } else {
        explanations.push({
            icon: '🟢',
            type: 'gaze_variability',
            severity: 'low',
            text: `Stable gaze patterns observed (σ²=${temporal_features.variance.toFixed(0)}). Visual attention appears appropriately sustained.`
        });
    }

    // Engagement
    if (component_scores.engagement_risk > 60) {
        explanations.push({
            icon: '🔴',
            type: 'engagement',
            severity: 'high',
            text: `Reduced sustained attention detected. Engagement ratio: ${(100 - component_scores.engagement_risk).toFixed(0)}%. Child spent limited time with focused gaze on the stimulus.`
        });
    } else if (component_scores.engagement_risk > 35) {
        explanations.push({
            icon: '🟡',
            type: 'engagement',
            severity: 'moderate',
            text: `Moderate engagement levels. The child showed intermittent focus during the session.`
        });
    }

    // Face presence
    if (qualityResult.face_presence < 0.70) {
        explanations.push({
            icon: '🔴',
            type: 'face_presence',
            severity: 'high',
            text: `Frequent face loss detected (present ${Math.round(qualityResult.face_presence * 100)}% of session). This may indicate avoidance or environmental factors.`
        });
    }

    // Fixation
    if (component_scores.fixation_risk > 60) {
        explanations.push({
            icon: '🔴',
            type: 'fixation',
            severity: 'high',
            text: `Limited visual fixation observed. Average fixation duration is below typical range, suggesting rapid gaze shifting.`
        });
    } else if (component_scores.fixation_risk > 35) {
        explanations.push({
            icon: '🟡',
            type: 'fixation',
            severity: 'moderate',
            text: `Fixation duration is in the moderate range. Some difficulty maintaining sustained focus on single points.`
        });
    }

    // Saccade frequency
    if (temporal_features.saccade_frequency > 4) {
        explanations.push({
            icon: '🟡',
            type: 'saccade',
            severity: 'moderate',
            text: `Elevated saccadic movement frequency (${temporal_features.saccade_frequency.toFixed(1)}/sec). Rapid gaze shifts may indicate difficulty settling attention.`
        });
    }

    // Trend analysis
    if (temporal_features.trend_slope < -10) {
        explanations.push({
            icon: '🟡',
            type: 'trend',
            severity: 'moderate',
            text: `Declining attention trend observed across the session (Δ${temporal_features.trend_slope.toFixed(1)}). Attention decreased in the second half.`
        });
    } else if (temporal_features.trend_slope > 10) {
        explanations.push({
            icon: '🟢',
            type: 'trend',
            severity: 'positive',
            text: `Improving attention trend observed (Δ+${temporal_features.trend_slope.toFixed(1)}). Child appeared to settle and focus better over time.`
        });
    }

    // Behavioral questionnaire findings
    if (behavioralResult) {
        if (behavioralResult.risk_level === 'High') {
            explanations.push({
                icon: '🔴',
                type: 'behavioral',
                severity: 'high',
                text: `Caregiver questionnaire indicates elevated developmental concerns (${behavioralResult.risk_count}/${behavioralResult.total_answered} risk indicators). Domains: ${Object.entries(behavioralResult.domain_severity).filter(([_, v]) => v.severity !== 'Low').map(([k, _]) => k.replace(/_/g, ' ')).join(', ')}.`
            });
        } else if (behavioralResult.risk_level === 'Moderate') {
            explanations.push({
                icon: '🟡',
                type: 'behavioral',
                severity: 'moderate',
                text: `Caregiver questionnaire shows some areas of concern (${behavioralResult.risk_count}/${behavioralResult.total_answered} risk indicators).`
            });
        } else {
            explanations.push({
                icon: '🟢',
                type: 'behavioral',
                severity: 'low',
                text: `Caregiver responses indicate typical developmental behaviors across domains assessed.`
            });
        }
    }

    // Session quality caveat
    if (!qualityResult.is_reliable) {
        explanations.push({
            icon: '⚠️',
            type: 'quality_warning',
            severity: 'warning',
            text: `Session quality is ${qualityResult.quality_label.toLowerCase()}. Results should be interpreted with caution. Consider re-screening under optimal conditions.`
        });
    }

    return explanations;
}

// ============================================
// TRIAGE CLASSIFICATION
// ============================================

/**
 * Classify patient for triage based on risk score.
 * @param {number} riskScore - 0-100 risk score
 * @returns {Object} Triage classification
 */
export function classifyTriage(riskScore) {
    if (riskScore > 70) {
        return {
            level: 'urgent',
            color: 'red',
            label: 'Priority Review',
            recommendation: 'Recommend specialist consultation within 2 weeks. Share detailed report with developmental pediatrician.'
        };
    } else if (riskScore > 40) {
        return {
            level: 'monitor',
            color: 'yellow',
            label: 'Monitor',
            recommendation: 'Schedule follow-up screening in 4-6 weeks. Implement suggested therapy activities. Watch for progression.'
        };
    } else {
        return {
            level: 'routine',
            color: 'green',
            label: 'Routine',
            recommendation: 'Continue developmental monitoring. Re-screen at next developmental milestone or in 3 months.'
        };
    }
}

// ============================================
// REGRESSION DETECTION (Multi-Session)
// ============================================

/**
 * Detect regression across multiple screening sessions.
 * @param {Object[]} sessions - Array of past screening rows (newest first)
 * @returns {Object|null} Regression alert or null
 */
export function detectRegression(sessions) {
    if (!sessions || sessions.length < 3) return null;

    // Check last 3 sessions for declining trend
    const recent3 = sessions.slice(0, 3); // Newest first
    const scores = recent3.map(s => s.overall_score);

    // Check if each session is worse than the previous
    const isConsistentDecline = scores[0] > scores[1] && scores[1] > scores[2];
    // Alternative: check if latest is significantly worse than average of previous
    const avgPrevious = (scores[1] + scores[2]) / 2;
    const delta = scores[0] - avgPrevious;

    if (isConsistentDecline || delta > 15) {
        return {
            type: 'regression',
            severity: delta > 25 ? 'high' : 'moderate',
            message: `Risk score has increased across the last ${recent3.length} sessions (${scores.reverse().join(' → ')}). This may indicate developmental regression.`,
            recommendation: 'Consider scheduling a follow-up assessment and discussing with the care team.',
            delta: Math.round(delta),
            sessions: recent3.map(s => ({
                id: s.id,
                date: s.timestamp,
                score: s.overall_score,
                risk: s.risk_level
            }))
        };
    }

    // Check attention-specific regression
    const attentionScores = recent3.map(s => s.attention_metric).filter(v => v != null);
    if (attentionScores.length >= 3) {
        const attAvg = (attentionScores[1] + attentionScores[2]) / 2;
        const attDelta = attentionScores[0] - attAvg;
        if (attDelta < -15) {
            return {
                type: 'attention_regression',
                severity: 'moderate',
                message: `Attention scores have declined by ${Math.abs(Math.round(attDelta))}% compared to recent sessions.`,
                recommendation: 'Monitor attention patterns in daily activities. Consider environmental adjustments.',
                delta: Math.round(attDelta)
            };
        }
    }

    return null;
}

// ============================================
// FULL ANALYSIS PIPELINE
// ============================================

/**
 * Run the complete analysis pipeline on session data.
 * @param {Object} sessionData - Full session data from frontend
 * @returns {Object} Complete analysis result
 */
export function runFullAnalysis(sessionData) {
    // 1. Quality Assessment
    const quality = assessSessionQuality(sessionData);

    // 2. Risk Scoring (from structured metrics)
    const riskResult = computeRiskScore(sessionData);

    // 3. Behavioral Fusion (if questionnaire data provided)
    const behavioralResult = sessionData.questionnaire_responses
        ? scoreBehavioralQuestionnaire(sessionData.questionnaire_responses)
        : null;

    // 4. Fused Score
    const fusedResult = fuseRiskScores(riskResult, behavioralResult);

    // 5. Explanations
    const explanations = generateExplanations(riskResult, quality, behavioralResult);

    // 6. Triage
    const triage = classifyTriage(fusedResult.fused_score);

    return {
        // Core scores
        overall_score: fusedResult.fused_score,
        risk_level: fusedResult.risk_level,
        fusion_mode: fusedResult.fusion_mode,

        // Component breakdown
        component_scores: riskResult.component_scores,
        fusion_components: fusedResult.components,
        weights: fusedResult.weights_used,

        // Temporal analysis
        temporal_features: riskResult.temporal_features,
        nose_features: riskResult.nose_features,
        iris_features: riskResult.iris_features,

        // Quality
        quality,

        // Behavioral
        behavioral: behavioralResult,

        // Clinical
        explanations,
        triage,

        // Metadata
        analysis_version: '2.0',
        analyzed_at: new Date().toISOString()
    };
}
