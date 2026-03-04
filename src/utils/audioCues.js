/**
 * AudioCues — Consistent, gentle audio feedback for NeuroBridge AI
 * 
 * ASD-Specific Design Principles:
 *  - Soft sine/triangle waves (never harsh square waves)
 *  - Low-to-moderate volume (0.08–0.15 gain)
 *  - Short durations (50–400ms) to avoid sensory overload
 *  - Predictable patterns: same action always produces same sound
 *  - Respects user's sensory-safe preference (mutes when enabled)
 *  - Uses Web Audio API — no external audio files needed
 */

let audioContext = null;
let isMuted = false;

/**
 * Lazily initialise AudioContext (must be triggered by user gesture)
 */
function getContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioCues: Web Audio API not available');
            return null;
        }
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

/**
 * Play a single tone
 * @param {number} frequency  Hz
 * @param {number} duration   seconds
 * @param {string} waveType   'sine' | 'triangle' | 'square'
 * @param {number} volume     0–1
 * @param {number} delay      seconds to wait before starting
 */
function playTone(frequency, duration, waveType = 'sine', volume = 0.1, delay = 0) {
    if (isMuted) return;
    const ctx = getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Soft fade-in and fade-out to avoid clicks
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.015);
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay + duration - 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
}

// ─── Public Cue Functions ─────────────────────────────────────

/**
 * Card flip — gentle rising "pip"
 * Used when a card is turned face-up in Memory Match
 */
export function cueCardFlip() {
    playTone(523.25, 0.08, 'sine', 0.08);       // C5, very short
    playTone(659.25, 0.06, 'sine', 0.06, 0.04);  // E5, slight delay
}

/**
 * Match found — happy ascending arpeggio
 * Two-note rising pattern = positive reinforcement
 */
export function cueMatchFound() {
    playTone(523.25, 0.15, 'triangle', 0.10);       // C5
    playTone(659.25, 0.15, 'triangle', 0.10, 0.12);  // E5
    playTone(783.99, 0.20, 'triangle', 0.12, 0.24);  // G5
}

/**
 * No match — gentle descending "nope"
 * Soft, non-punishing feedback  
 */
export function cueMismatch() {
    playTone(392.00, 0.12, 'sine', 0.06);        // G4
    playTone(349.23, 0.15, 'sine', 0.05, 0.10);  // F4 (gently lower)
}

/**
 * Game complete — celebratory chime sequence
 * Ascending major chord arpeggio
 */
export function cueGameComplete() {
    playTone(523.25, 0.20, 'triangle', 0.10);       // C5
    playTone(659.25, 0.20, 'triangle', 0.10, 0.15);  // E5
    playTone(783.99, 0.20, 'triangle', 0.12, 0.30);  // G5
    playTone(1046.50, 0.35, 'triangle', 0.14, 0.45); // C6 (octave up, held longer)
}

/**
 * UI navigation click — barely perceptible tick  
 * For buttons, tab switches, page transitions
 */
export function cueNavigationClick() {
    playTone(880, 0.04, 'sine', 0.05);  // A5, 40ms
}

/**
 * Notification — soft double-ping
 * For alerts, reminders, new messages
 */
export function cueNotification() {
    playTone(880, 0.10, 'sine', 0.08);        // A5
    playTone(880, 0.10, 'sine', 0.08, 0.15);  // A5 again
}

/**
 * Timer/countdown tick — metronome-like  
 * For game countdowns or session timers
 */
export function cueTimerTick() {
    playTone(440, 0.03, 'sine', 0.04);  // A4, 30ms
}

/**
 * Hint revealed — gentle chime
 */
export function cueHint() {
    playTone(698.46, 0.12, 'triangle', 0.08);  // F5
    playTone(880.00, 0.15, 'triangle', 0.08, 0.10);  // A5
}

/**
 * Error / warning — low gentle pulse  
 */
export function cueWarning() {
    playTone(220, 0.20, 'sine', 0.06);        // A3
    playTone(220, 0.20, 'sine', 0.06, 0.25);  // A3 again
}

/**
 * Transition — smooth whoosh-like sweep
 * For page/scene transitions
 */
export function cueTransition() {
    const ctx = getContext();
    if (!ctx || isMuted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.20);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
}

// ─── Control Functions ────────────────────────────────────────

/**
 * Mute all audio cues (respects sensory-safe mode)
 */
export function setMuted(muted) {
    isMuted = muted;
}

/**
 * Check if audio cues are currently muted
 */
export function getMuted() {
    return isMuted;
}

/**
 * Warm up the AudioContext (call on first user interaction)
 */
export function warmUp() {
    getContext();
}

export default {
    cueCardFlip,
    cueMatchFound,
    cueMismatch,
    cueGameComplete,
    cueNavigationClick,
    cueNotification,
    cueTimerTick,
    cueHint,
    cueWarning,
    cueTransition,
    setMuted,
    getMuted,
    warmUp
};
