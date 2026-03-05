// ============================================
// MODERATION ENGINE — ML Content Moderation
// Uses TensorFlow.js Toxicity Model for automatic
// toxic content detection in Community posts/comments
// ============================================

let toxicityModel = null;
let modelLoading = false;
let modelReady = false;

// Toxicity labels the model can detect
const TOXICITY_LABELS = [
    'identity_attack',
    'insult',
    'obscene',
    'severe_toxicity',
    'sexual_explicit',
    'threat',
    'toxicity'
];

// Minimum confidence threshold (0.0 - 1.0)
// Lower = more aggressive filtering, Higher = fewer false positives
const TOXICITY_THRESHOLD = 0.85;

/**
 * Load the toxicity model (lazy — called on first use)
 * Model is ~20MB and loads in ~5-10 seconds on first call
 */
async function loadModel() {
    if (modelReady) return;
    if (modelLoading) {
        // Wait for ongoing load
        while (modelLoading) {
            await new Promise(r => setTimeout(r, 500));
        }
        return;
    }

    modelLoading = true;
    try {
        console.log('🧠 Loading TF.js Toxicity model...');
        const toxicity = await import('@tensorflow-models/toxicity');
        toxicityModel = await toxicity.load(TOXICITY_THRESHOLD, TOXICITY_LABELS);
        modelReady = true;
        console.log('✅ Toxicity model loaded successfully');
    } catch (err) {
        console.error('⚠️ Toxicity model failed to load:', err.message);
        console.log('   ML moderation will fall back to keyword-based filtering');
        modelReady = false;
    } finally {
        modelLoading = false;
    }
}

/**
 * Analyze text for toxic content using ML model
 * @param {string} text - Text to analyze
 * @returns {Object} Analysis result with labels, scores, and verdict
 */
export async function analyzeToxicity(text) {
    if (!text || text.trim().length === 0) {
        return { toxic: false, labels: [], scores: {}, fallback: false };
    }

    // Try ML model first
    if (!modelReady) {
        // Attempt to load the model (non-blocking for first request)
        loadModel().catch(() => { }); // fire-and-forget on first call

        // Fall back to keyword check while model loads
        return keywordFallback(text);
    }

    try {
        const predictions = await toxicityModel.classify([text]);

        const flaggedLabels = [];
        const scores = {};

        for (const prediction of predictions) {
            const label = prediction.label;
            const match = prediction.results[0];

            if (match && match.match === true) {
                flaggedLabels.push(label);
            }

            // Store probability scores for all labels
            if (match && match.probabilities) {
                scores[label] = {
                    probability: Math.round(match.probabilities[1] * 100) / 100,
                    flagged: match.match === true
                };
            }
        }

        const isToxic = flaggedLabels.length > 0;

        return {
            toxic: isToxic,
            labels: flaggedLabels,
            scores,
            severity: calculateSeverity(flaggedLabels),
            fallback: false,
            model: 'tensorflow-toxicity'
        };
    } catch (err) {
        console.warn('ML toxicity check failed, using keyword fallback:', err.message);
        return keywordFallback(text);
    }
}

/**
 * Quick synchronous check — use when you need a fast boolean answer
 * Falls back to keywords if ML model isn't loaded
 */
export function quickToxicityCheck(text) {
    if (!text) return { toxic: false, reason: null };

    const lower = text.toLowerCase();

    // Slurs and severe content (always block)
    const severePatterns = [
        /\b(n[i1]gg[ae3]r|f[a@]gg?[o0]t|r[e3]t[a@]rd)\b/i,
        /\bkill\s+(yourself|urself|u)\b/i,
        /\bgo\s+die\b/i
    ];

    for (const pattern of severePatterns) {
        if (pattern.test(text)) {
            return { toxic: true, reason: 'severe_content', severity: 'high' };
        }
    }

    // Moderate patterns
    const moderateWords = [
        'stupid', 'idiot', 'moron', 'dumb', 'loser',
        'shut up', 'hate you', 'ugly', 'disgusting'
    ];

    for (const word of moderateWords) {
        if (lower.includes(word)) {
            return { toxic: true, reason: 'mild_toxicity', severity: 'medium' };
        }
    }

    return { toxic: false, reason: null };
}

/**
 * Keyword-based fallback when ML model is unavailable
 */
function keywordFallback(text) {
    const check = quickToxicityCheck(text);
    return {
        toxic: check.toxic,
        labels: check.reason ? [check.reason] : [],
        scores: {},
        severity: check.severity || 'none',
        fallback: true,
        model: 'keyword-fallback'
    };
}

/**
 * Calculate severity level from flagged labels
 */
function calculateSeverity(labels) {
    if (labels.includes('severe_toxicity') || labels.includes('threat')) {
        return 'high';
    }
    if (labels.includes('toxicity') || labels.includes('insult') || labels.includes('identity_attack')) {
        return 'medium';
    }
    if (labels.includes('obscene') || labels.includes('sexual_explicit')) {
        return 'medium';
    }
    return labels.length > 0 ? 'low' : 'none';
}

/**
 * Get recommended action based on toxicity analysis
 */
export function getRecommendedAction(analysis) {
    if (!analysis.toxic) return 'allow';

    switch (analysis.severity) {
        case 'high':
            return 'block';       // Don't publish, notify admins
        case 'medium':
            return 'review';      // Publish as 'under_review'
        case 'low':
            return 'flag';        // Publish but flag for moderators
        default:
            return 'allow';
    }
}

/**
 * Get model status for health check endpoint
 */
export function getModelStatus() {
    return {
        loaded: modelReady,
        loading: modelLoading,
        threshold: TOXICITY_THRESHOLD,
        labels: TOXICITY_LABELS
    };
}

/**
 * Preload the model (call during server startup)
 */
export function preloadModel() {
    loadModel().catch(() => { });
}
