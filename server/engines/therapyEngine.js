/**
 * NeuroBridge AI - Adaptive Therapy Inference Engine
 * 
 * Evidence-aligned rule-based clinical inference for personalized therapy planning.
 * References: WHO CST, INSAR Guidelines, NDBI, ESDM, PRT, Global Autism Project
 * 
 * DISCLAIMER: This is a decision-support tool, not a diagnostic instrument.
 */

// ============================================
// THERAPY MODULE LIBRARY
// ============================================

const THERAPY_MODULES = {
    social_communication: {
        id: 'social_communication',
        name: 'Social Communication',
        framework: 'NDBI / ESDM / PRT',
        description: 'Naturalistic developmental behavioral interventions focusing on social reciprocity',
        color: 'blue',
        tasks: [
            { id: 'sc1', title: 'Face-to-Face Play', duration: '5 min', description: 'Sit at eye level, follow child\'s lead with animated expressions' },
            { id: 'sc2', title: 'Joint Attention with Toy', duration: '5 min', description: 'Share focus on interesting object, alternate gaze between toy and caregiver' },
            { id: 'sc3', title: 'Name-Response Game', duration: '3 min', description: 'Call child\'s name with enthusiasm, celebrate any response' },
            { id: 'sc4', title: 'Turn-Taking Imitation', duration: '5 min', description: 'Simple back-and-forth games (rolling ball, stacking blocks)' },
            { id: 'sc5', title: 'Emotion Mirroring', duration: '3 min', description: 'Copy child\'s expressions, label emotions gently' }
        ]
    },

    joint_attention: {
        id: 'joint_attention',
        name: 'Joint Attention Training',
        framework: 'JASPER / Pivotal Response',
        description: 'Structured activities to develop shared attention and referencing skills',
        color: 'purple',
        tasks: [
            { id: 'ja1', title: 'Track Moving Object', duration: '3 min', description: 'Slowly move interesting toy, encourage visual tracking' },
            { id: 'ja2', title: 'Follow Pointing', duration: '5 min', description: 'Point to objects of interest, wait for child to look' },
            { id: 'ja3', title: 'Shared Book Pointing', duration: '5 min', description: 'Point to pictures, wait for child\'s gaze shift' },
            { id: 'ja4', title: 'Look Where I Look', duration: '3 min', description: 'Exaggerate head turn toward object, celebrate following' },
            { id: 'ja5', title: 'Show and Share', duration: '5 min', description: 'Encourage child to show you toys they find interesting' }
        ]
    },

    sensory_regulation: {
        id: 'sensory_regulation',
        name: 'Sensory & Regulation',
        framework: 'Occupational Therapy / Sensory Integration',
        description: 'Activities to support self-regulation and sensory processing',
        color: 'teal',
        tasks: [
            { id: 'sr1', title: 'Deep Pressure Breaks', duration: '3 min', description: 'Gentle squeezes, weighted lap pad, or firm hugs if welcomed' },
            { id: 'sr2', title: 'Movement Breaks', duration: '5 min', description: 'Jumping, swinging, or spinning based on child\'s preferences' },
            { id: 'sr3', title: 'Fine Motor Activity', duration: '5 min', description: 'Bead stringing, playdough, or water play' },
            { id: 'sr4', title: 'Calm-Down Corner Time', duration: '5 min', description: 'Quiet space with preferred calming items' },
            { id: 'sr5', title: 'Sensory Exploration', duration: '5 min', description: 'Explore textures, sounds, or visual stimuli at child\'s pace' }
        ]
    },

    communication: {
        id: 'communication',
        name: 'Early Communication',
        framework: 'AAC / PECS Principles',
        description: 'Building functional communication through multiple modalities',
        color: 'amber',
        tasks: [
            { id: 'cm1', title: 'Choice-Based Requests', duration: '5 min', description: 'Offer two items, wait for any communication attempt' },
            { id: 'cm2', title: 'Gesture Prompting', duration: '3 min', description: 'Model pointing, reaching, giving gestures' },
            { id: 'cm3', title: 'Sound Imitation', duration: '5 min', description: 'Copy child\'s sounds, add variations playfully' },
            { id: 'cm4', title: 'Environmental Arrangement', duration: '5 min', description: 'Place desired items in view but out of reach to prompt requests' },
            { id: 'cm5', title: 'Pause and Wait', duration: '3 min', description: 'During routines, pause expectantly to encourage initiation' }
        ]
    },

    parent_mediated: {
        id: 'parent_mediated',
        name: 'Parent-Mediated Interaction',
        framework: 'WHO CST / Hanen / DIR-Floortime',
        description: 'Caregiver coaching strategies for everyday interactions',
        color: 'emerald',
        tasks: [
            { id: 'pm1', title: '15-min Daily Play Routine', duration: '15 min', description: 'Dedicated floor time following child\'s lead completely' },
            { id: 'pm2', title: 'Follow the Child\'s Lead', duration: '10 min', description: 'Join child\'s activity, comment without directing' },
            { id: 'pm3', title: 'Natural Reinforcement', duration: '5 min', description: 'Reinforce eye contact and communication naturally within play' },
            { id: 'pm4', title: 'Routine-Based Interaction', duration: '5 min', description: 'Embed communication opportunities in daily routines' },
            { id: 'pm5', title: 'Responsive Parenting Practice', duration: '5 min', description: 'Immediate, warm response to all communication attempts' }
        ]
    },

    play_skills: {
        id: 'play_skills',
        name: 'Play & Imagination',
        framework: 'Developmental Play Therapy',
        description: 'Expanding play repertoire and symbolic thinking',
        color: 'pink',
        tasks: [
            { id: 'ps1', title: 'Parallel Play', duration: '5 min', description: 'Play alongside child with similar toys' },
            { id: 'ps2', title: 'Symbolic Play Introduction', duration: '5 min', description: 'Model simple pretend actions (feeding doll, car sounds)' },
            { id: 'ps3', title: 'Play Expansion', duration: '5 min', description: 'Add one step to child\'s existing play sequence' },
            { id: 'ps4', title: 'Cause-Effect Toys', duration: '5 min', description: 'Explore toys with predictable outcomes' },
            { id: 'ps5', title: 'Constructive Play', duration: '5 min', description: 'Building, stacking, or creating together' }
        ]
    }
};

// ============================================
// SEVERITY CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate Social Affect severity based on ADOS-2 domain mapping
 */
function calculateSocialSeverity(data) {
    const { attention_mean, gaze_variance, fixation_duration } = data;

    let score = 0;
    let factors = [];

    // Attention scoring
    if (attention_mean < 40) {
        score += 3;
        factors.push('low sustained attention');
    } else if (attention_mean < 60) {
        score += 2;
        factors.push('moderate attention variability');
    } else {
        score += 1;
    }

    // Gaze variance scoring
    if (gaze_variance > 0.6) {
        score += 3;
        factors.push('high gaze variability');
    } else if (gaze_variance > 0.4) {
        score += 2;
        factors.push('moderate gaze instability');
    } else {
        score += 1;
    }

    // Fixation duration scoring
    if (fixation_duration < 1.5) {
        score += 2;
        factors.push('brief fixation duration');
    } else if (fixation_duration < 2.5) {
        score += 1;
    }

    const severity = score >= 7 ? 'High' : score >= 4 ? 'Moderate' : 'Low';

    return { severity, score, factors };
}

/**
 * Calculate Engagement severity
 */
function calculateEngagementSeverity(data) {
    const { engagement_ratio } = data;

    let factors = [];
    let severity;

    if (engagement_ratio < 40) {
        severity = 'High';
        factors.push('limited engagement with activities');
    } else if (engagement_ratio < 60) {
        severity = 'Moderate';
        factors.push('inconsistent engagement patterns');
    } else {
        severity = 'Low';
    }

    return { severity, score: 100 - engagement_ratio, factors };
}

/**
 * Calculate Regulation/RRB severity
 */
function calculateRegulationSeverity(data) {
    const { motor_variance } = data;

    let factors = [];
    let severity;

    if (motor_variance > 0.6) {
        severity = 'High';
        factors.push('elevated motor variability patterns');
    } else if (motor_variance > 0.4) {
        severity = 'Moderate';
        factors.push('some motor regulation differences');
    } else {
        severity = 'Low';
    }

    return { severity, score: motor_variance * 100, factors };
}

// ============================================
// THERAPY PLAN GENERATION
// ============================================

/**
 * Generate personalized therapy plan based on screening data
 * @param {Object} screeningData - Input from screening session
 * @returns {Object} Complete therapy plan with domains, tasks, and explanations
 */
export function generateTherapyPlan(screeningData) {
    // Normalize input data with defaults and Node 12 compatible checks
    const data = {
        attention_mean: (screeningData.attention_mean != null) ? screeningData.attention_mean : ((screeningData.attentionMetric != null) ? screeningData.attentionMetric : 50),
        engagement_ratio: (screeningData.engagement_ratio != null) ? screeningData.engagement_ratio : ((screeningData.attentionMetric != null) ? screeningData.attentionMetric : 50),
        gaze_variance: (screeningData.gaze_variance != null) ? screeningData.gaze_variance : ((screeningData.visionProbability != null) ? screeningData.visionProbability : 0.3),
        fixation_duration: (screeningData.fixation_duration != null) ? screeningData.fixation_duration : 2.0,
        motor_variance: (screeningData.motor_variance != null) ? screeningData.motor_variance : ((screeningData.motorMetric != null) ? (screeningData.motorMetric / 100) : 0.3),
        session_quality: (screeningData.session_quality != null) ? screeningData.session_quality : ((screeningData.overall_score != null) ? screeningData.overall_score : 70),
        overall_risk: (screeningData.overall_risk != null) ? screeningData.overall_risk : ((screeningData.risk_level != null) ? screeningData.risk_level : 'Moderate'),
        behavioral_data: screeningData.behavioral_data
    };

    // Calculate domain severities
    const socialSeverity = calculateSocialSeverity(data);
    const engagementSeverity = calculateEngagementSeverity(data);
    const regulationSeverity = calculateRegulationSeverity(data);

    // Use a Map to ensure unique domains
    const domainMap = new Map();

    const addDomain = (moduleKey, priority, severity, reason, taskCount) => {
        const existing = domainMap.get(moduleKey);
        const priorityScore = { 'High': 3, 'Medium': 2, 'Low': 1 };

        if (!existing || priorityScore[priority] > priorityScore[existing.priority]) {
            domainMap.set(moduleKey, {
                ...THERAPY_MODULES[moduleKey],
                priority,
                severity,
                reason,
                tasks: THERAPY_MODULES[moduleKey].tasks.slice(0, taskCount)
            });
        }
    };

    const allFactors = [];
    allFactors.push(...socialSeverity.factors, ...engagementSeverity.factors, ...regulationSeverity.factors);

    // 1. Social Communication
    if (socialSeverity.severity === 'High') {
        addDomain('social_communication', 'High', 'High',
            `Reduced sustained attention and ${socialSeverity.factors.join(', ')} indicate focus needed on social communication skills.`, 4);
    } else if (socialSeverity.severity === 'Moderate') {
        addDomain('social_communication', 'Medium', 'Moderate',
            `Moderate attention patterns suggest continued support in social communication.`, 3);
    } else {
        addDomain('social_communication', 'Low', 'Low',
            'Maintenance of social communication skills recommended.', 3);
    }

    // 2. Joint Attention
    if (data.gaze_variance > 0.4 || data.fixation_duration < 1.0) {
        addDomain('joint_attention', 'High', 'High',
            'High gaze variability and short fixation duration suggest joint attention training is critical.', 4);
    } else if (data.gaze_variance > 0.2) {
        addDomain('joint_attention', 'Medium', 'Moderate',
            'Some gaze instability observed; joint attention games recommended.', 3);
    }

    // 3. Engagement / Communication
    if (engagementSeverity.severity === 'High') {
        addDomain('communication', 'High', 'High',
            `Low engagement ratio (${Math.round(data.engagement_ratio)}%) indicates need for high-interest communication activities to boost participation.`, 4);
    } else {
        addDomain('communication', 'Medium', 'Moderate',
            'Early communication support benefits developmental trajectory.', 3);
    }

    // 4. Parent-Mediated (Universal for High/Medium risk)
    if (data.overall_risk === 'High' || data.overall_risk === 'Medium') {
        addDomain('parent_mediated', data.overall_risk === 'High' ? 'High' : 'Medium', data.overall_risk,
            'Caregiver-mediated intervention is the gold standard for early developmental support.', 3);
    }

    // 5. Play Skills (Behavioral data based)
    if (data.behavioral_data && data.behavioral_data.score > 0.3) {
        addDomain('play_skills', 'Medium', 'Moderate',
            'Behavioral questionnaire suggests delays in functional play skills.', 3);
    } else {
        addDomain('play_skills', 'Low', 'Low', 'Play-based learning supports overall development.', 3);
    }

    // 6. Regulation (Motor/Sensory)
    if (regulationSeverity.severity === 'High' || regulationSeverity.severity === 'Moderate') {
        addDomain('sensory_regulation', regulationSeverity.severity === 'High' ? 'High' : 'Medium', regulationSeverity.severity,
            `${regulationSeverity.factors.join(', ').charAt(0).toUpperCase() + regulationSeverity.factors.join(', ').slice(1)} - sensory regulation support recommended.`,
            regulationSeverity.severity === 'High' ? 4 : 3);
    }

    // Convert Map to Array and Sort
    const domains = Array.from(domainMap.values());
    const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
    domains.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Calculate total daily minutes based on risk
    let total_daily_minutes;
    if (data.overall_risk === 'High') {
        total_daily_minutes = 75;
    } else if (data.overall_risk === 'Moderate' || data.overall_risk === 'Medium') {
        total_daily_minutes = 45;
    } else {
        total_daily_minutes = 25;
    }

    // Generate clinical explanation
    const explanation = generateClinicalExplanation(data, socialSeverity, engagementSeverity, regulationSeverity, allFactors);

    // Determine plan type (therapy vs support)
    const planType = data.overall_risk === 'Low' ? 'Developmental Support Plan' : 'Adaptive Therapy Plan';

    // Session quality warning
    const warnings = [];
    if (data.session_quality < 60) {
        warnings.push({
            type: 'session_quality',
            message: 'Low-quality screening session detected. This plan may be less accurate. Consider re-screening in optimal conditions.'
        });
    }

    return {
        planType,
        total_daily_minutes,
        domains,
        explanation,
        warnings,
        generatedAt: new Date().toISOString(),
        inputMetrics: {
            attention: Math.round(data.attention_mean),
            engagement: Math.round(data.engagement_ratio),
            gazeVariance: parseFloat(Number(data.gaze_variance).toFixed(2)),
            motorVariance: parseFloat(Number(data.motor_variance).toFixed(2)),
            overallRisk: data.overall_risk
        },
        frameworks: ['WHO CST', 'NDBI', 'ESDM', 'JASPER', 'DIR-Floortime']
    };
}

/**
 * Generate clinical explanation text
 */
function generateClinicalExplanation(data, social, engagement, regulation, factors) {
    const uniqueFactors = [...new Set(factors)];
    let explanation = '';

    if (social.severity === 'High') {
        explanation += `Analysis indicates reduced sustained attention (${Math.round(data.attention_mean)}%) and ${uniqueFactors.includes('high gaze variability') ? 'elevated gaze variability' : 'attention differences'}, suggesting focus on Social Affect domain (ADOS-2). `;
    } else if (social.severity === 'Moderate') {
        explanation += `Moderate attention patterns observed. `;
    }

    if (engagement.severity !== 'Low') {
        explanation += `Engagement levels suggest benefit from parent-mediated intervention strategies aligned with WHO Caregiver Skills Training. `;
    }

    if (regulation.severity !== 'Low') {
        explanation += `Motor variability patterns indicate sensory regulation support may be helpful. `;
    }

    explanation += `\n\nThis plan emphasizes naturalistic, play-based approaches (NDBI principles) designed for home implementation. Activities follow the child's lead and prioritize joyful interaction over compliance. All strategies are neurodiversity-affirming and evidence-aligned.`;

    return explanation;
}

/**
 * Get therapy plan from latest screening
 */
export function getTherapyPlanFromScreening(screeningRow) {
    // Check if we have V2 structured data
    let v2Metrics = {};
    if (screeningRow.component_scores_json) {
        try {
            const components = JSON.parse(screeningRow.component_scores_json);
            const temporal = screeningRow.temporal_features_json ? JSON.parse(screeningRow.temporal_features_json) : {};

            v2Metrics = {
                attention_mean: components.engagement_risk != null ? (100 - components.engagement_risk) : 50,
                engagement_ratio: components.engagement_risk != null ? (100 - components.engagement_risk) : 50,
                gaze_variance: temporal.variance != null ? Math.min(1, temporal.variance / 1500) : (components.vision_risk / 100),
                fixation_duration: components.fixation_risk != null ? (3.0 * (1 - components.fixation_risk / 100)) : 1.5,
                motor_variance: (screeningRow.motor_metric || 30) / 100, // Still utilizing motor metric if available
                behavioral_data: screeningRow.behavioral_score != null ? { score: screeningRow.behavioral_score } : null
            };
        } catch (e) { console.error('Error parsing V2 metrics for therapy:', e); }
    }

    return generateTherapyPlan({
        ...v2Metrics,
        // Fallbacks for V1
        attention_mean: v2Metrics.attention_mean || screeningRow.attention_metric,
        engagement_ratio: v2Metrics.engagement_ratio || screeningRow.attention_metric,
        gaze_variance: v2Metrics.gaze_variance || screeningRow.vision_probability || 0.3,
        fixation_duration: v2Metrics.fixation_duration || 2.0,
        motor_variance: (v2Metrics.motor_variance != null) ? v2Metrics.motor_variance : ((screeningRow.motor_metric || 30) / 100),
        session_quality: screeningRow.quality_score || screeningRow.overall_score,
        overall_risk: screeningRow.risk_level
    });
}

export { THERAPY_MODULES };
