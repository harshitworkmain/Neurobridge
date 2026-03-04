import { Jimp } from 'jimp';

/**
 * Analyzes a Gaze Heatmap image to determine risk patterns.
 * Logic:
 * - "Low Risk": Gaze is concentrated (Centralized heatmap blobs).
 * - "High Risk": Gaze is scattered/fragmented (Irregular patterns).
 * 
 * @param {string} imageBase64 - Base64 encoded image string (data:image/png;base64,...)
 * @returns {Promise<{vision_probability: number, confidence: number, explanation: string}>}
 */
export async function analyzeHeatmap(imageBase64) {
    try {
        // Remove header if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const image = await Jimp.read(Buffer.from(base64Data, 'base64'));

        const width = image.bitmap.width;
        const height = image.bitmap.height;
        let totalStructureScore = 0;
        let redPixelCount = 0;
        let nonRedPixelCount = 0;

        // Simplified Logic: 
        // 1. Detect "Heat" (Red/Orange zones).
        // 2. Calculate spatial variance of these zones.

        let xE = 0, yE = 0; // Expected values (Centers)
        let totalMass = 0;
        const coordinates = [];

        image.scan(0, 0, width, height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];

            // Heuristic for "Heatmap Red/Orange"
            // Start of spectrum (Red) -> End (Blue)
            // Hot spots are typically Red (255, 0, 0) to Yellow (255, 255, 0)
            // Heuristic for "Heatmap Red/Orange"
            // Start of spectrum (Red) -> End (Blue)
            // Hot spots are typically Red (255, 0, 0) to Yellow (255, 255, 0)
            if (red > 50 && blue < 150 && green < 200) { // Lower threshold for visibility
                const intensity = (red - blue) / 255; // Weight
                xE += x * intensity;
                yE += y * intensity;
                totalMass += intensity;
                redPixelCount++;
                coordinates.push({ x, y, intensity });
            } else {
                nonRedPixelCount++;
            }
        });

        if (totalMass === 0) {
            return {
                vision_probability: 0.1, // No data -> Low risk default or Error
                confidence: 0.5,
                explanation: "No gaze data detected in screening."
            };
        }

        const meanX = xE / totalMass;
        const meanY = yE / totalMass;

        // Calculate Variance (Spread)
        let varianceSum = 0;
        for (const p of coordinates) {
            const distSq = (p.x - meanX) ** 2 + (p.y - meanY) ** 2;
            varianceSum += distSq * p.intensity;
        }

        const variance = varianceSum / totalMass;
        // Normalize variance based on image size (diagonal squared)
        const maxVariance = (width * width + height * height) / 4;
        const normalizedSpread = Math.min(1, variance / (maxVariance * 0.1)); // Sensitivity factor

        // RISK MODEL:
        // High Spread = High Risk (Low Focus) -> Prob -> 1.0
        // Low Spread = Low Risk (Good Focus) -> Prob -> 0.0

        // Sigmoid-like curve check or linear mapping
        let probability = normalizedSpread;

        // Confidence: Based on amount of data collected (red pixels vs total)
        // If too few red pixels, confidence is low.
        const coverage = redPixelCount / (width * height);
        let confidence = Math.min(0.95, Math.max(0.4, coverage * 50)); // Scaling factor

        // Generate Explanation
        let explanation = "";
        if (probability > 0.6) {
            explanation = "Irregular gaze distribution detected (Scattered Focus).";
        } else if (probability < 0.3) {
            explanation = "Highly focused gaze patterns detected (Sustained Attention).";
        } else {
            explanation = "Moderate gaze variability observed.";
        }

        return {
            vision_probability: parseFloat(probability.toFixed(2)),
            confidence: parseFloat(confidence.toFixed(2)),
            explanation
        };

    } catch (e) {
        console.error("Vision Model Verification Error:", e);
        // Fallback
        return {
            vision_probability: 0.5,
            confidence: 0.3,
            explanation: "Model inference failed, using baseline."
        };
    }
}
