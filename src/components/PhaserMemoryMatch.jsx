import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { cueCardFlip, cueMatchFound, cueMismatch, cueGameComplete, cueTransition, warmUp } from '../utils/audioCues';

/**
 * Phaser-based Memory Match Game (A1/E5)
 * A child-friendly card matching game that tracks:
 *  - Accuracy (matches vs attempts)
 *  - Response time between picks
 *  - Completion rate
 *  - Engagement score
 */

// OpenMoji CDN for high-quality emoji SVGs (CC BY-SA 4.0 — hfg-gmuend/openmoji)
const OPENMOJI_CDN = 'https://openmoji.org/data/color/svg';

// Card emoji sets by difficulty level — includes OpenMoji hex codes for SVG loading
const EMOJI_MAP = {
    '🐶': '1F436', '🐱': '1F431', '🐰': '1F430', '🐻': '1F43B',
    '🦊': '1F98A', '🐸': '1F438', '🐵': '1F435', '🐧': '1F427',
    '🦁': '1F981', '🐘': '1F418', '🐬': '1F42C', '🦋': '1F98B',
    '🌻': '1F33B', '🌈': '1F308', '🎨': '1F3A8', '🚀': '1F680'
};

const CARD_SETS = {
    1: ['🐶', '🐱', '🐰', '🐻'], // 4 pairs = 8 cards
    2: ['🐶', '🐱', '🐰', '🐻', '🦊', '🐸'], // 6 pairs = 12 cards
    3: ['🐶', '🐱', '🐰', '🐻', '🦊', '🐸', '🐵', '🐧'], // 8 pairs = 16 cards
    4: ['🐶', '🐱', '🐰', '🐻', '🦊', '🐸', '🐵', '🐧', '🦁', '🐘'], // 10 pairs
};

// Soothing colors for card backs
const CARD_COLORS = [
    0x6366f1, 0x8b5cf6, 0x06b6d4, 0x10b981,
    0xf59e0b, 0xef4444, 0xec4899, 0x14b8a6,
    0x3b82f6, 0xa855f7
];

class MemoryMatchScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MemoryMatch' });
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.attempts = 0;
        this.score = 0;
        this.level = 1;
        this.isLocked = false;
        this.startTime = 0;
        this.lastFlipTime = 0;
        this.responseTimes = [];
        this.gameOver = false;
    }

    init(data) {
        this.level = data.level || 1;
        this.onProgress = data.onProgress || (() => { });
        this.onComplete = data.onComplete || (() => { });
        this.emojiImagesLoaded = false;
        // Warm up audio context on game start
        warmUp();
    }

    preload() {
        // Load OpenMoji SVGs for the current level's card set
        const emojis = CARD_SETS[this.level] || CARD_SETS[1];
        let allLoaded = true;

        emojis.forEach(emoji => {
            const hex = EMOJI_MAP[emoji];
            if (hex && !this.textures.exists(`emoji_${hex}`)) {
                this.load.svg(`emoji_${hex}`, `${OPENMOJI_CDN}/${hex}.svg`, { width: 64, height: 64 });
            }
        });

        this.load.on('complete', () => {
            this.emojiImagesLoaded = true;
        });
        this.load.on('loaderror', () => {
            // Graceful fallback — will use text emojis instead
            this.emojiImagesLoaded = false;
        });
    }

    create() {
        const { width, height } = this.sys.game.config;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x0f172a, 1);
        bg.fillRect(0, 0, width, height);

        // Title
        this.add.text(width / 2, 30, '🧩 Memory Match', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#e2e8f0'
        }).setOrigin(0.5);

        // Level indicator
        this.add.text(width / 2, 58, `Level ${this.level}`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            color: '#94a3b8'
        }).setOrigin(0.5);

        // Score display
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            color: '#38bdf8'
        });

        // Attempts display
        this.attemptsText = this.add.text(width - 20, 20, 'Moves: 0', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            color: '#f59e0b'
        }).setOrigin(1, 0);

        // Setup cards
        const emojis = CARD_SETS[this.level] || CARD_SETS[1];
        this.totalPairs = emojis.length;
        const cardValues = [...emojis, ...emojis];

        // Shuffle
        for (let i = cardValues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
        }

        // Calculate grid
        const totalCards = cardValues.length;
        const cols = totalCards <= 8 ? 4 : (totalCards <= 12 ? 4 : (totalCards <= 16 ? 4 : 5));
        const rows = Math.ceil(totalCards / cols);
        const cardSize = Math.min(80, (width - 80) / cols, (height - 140) / rows);
        const gap = 10;
        const gridWidth = cols * (cardSize + gap) - gap;
        const gridHeight = rows * (cardSize + gap) - gap;
        const startX = (width - gridWidth) / 2 + cardSize / 2;
        const startY = (height - gridHeight) / 2 + 20 + cardSize / 2;

        // Create cards with entrance animation
        cardValues.forEach((value, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (cardSize + gap);
            const y = startY + row * (cardSize + gap);

            const card = this.createCard(x, y, cardSize, value, index);
            card.setScale(0);

            // Staggered entrance animation
            this.tweens.add({
                targets: card,
                scaleX: 1,
                scaleY: 1,
                duration: 300,
                delay: index * 50,
                ease: 'Back.easeOut'
            });
        });

        this.startTime = Date.now();
        this.lastFlipTime = Date.now();

        // Brief preview: show all cards for 2 seconds at start
        this.time.delayedCall(800, () => {
            this.cards.forEach(card => this.showCardFace(card));
        });
        this.time.delayedCall(2800, () => {
            this.cards.forEach(card => {
                if (!card.getData('matched')) {
                    this.hideCardFace(card);
                }
            });
            this.isLocked = false;
        });
        this.isLocked = true;
    }

    createCard(x, y, size, value, index) {
        const container = this.add.container(x, y);

        // Card back
        const back = this.add.graphics();
        const color = CARD_COLORS[index % CARD_COLORS.length];
        back.fillStyle(color, 0.8);
        back.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
        back.lineStyle(2, 0xffffff, 0.2);
        back.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);

        // Question mark on back
        const qMark = this.add.text(0, 0, '?', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: `${Math.floor(size * 0.45)}px`,
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.6);

        // Card face (hidden initially)
        const face = this.add.graphics();
        face.fillStyle(0x1e293b, 1);
        face.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
        face.lineStyle(2, 0x38bdf8, 0.5);
        face.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);
        face.setVisible(false);

        // Card face emoji — use OpenMoji SVG image if loaded, otherwise text fallback
        const hex = EMOJI_MAP[value];
        let emojiDisplay;
        if (this.emojiImagesLoaded && hex && this.textures.exists(`emoji_${hex}`)) {
            emojiDisplay = this.add.image(0, 0, `emoji_${hex}`)
                .setDisplaySize(Math.floor(size * 0.6), Math.floor(size * 0.6))
                .setVisible(false);
        } else {
            emojiDisplay = this.add.text(0, 0, value, {
                fontSize: `${Math.floor(size * 0.5)}px`
            }).setOrigin(0.5).setVisible(false);
        }

        container.add([back, qMark, face, emojiDisplay]);
        container.setSize(size, size);
        container.setInteractive();

        // Store references
        container.setData('value', value);
        container.setData('index', index);
        container.setData('flipped', false);
        container.setData('matched', false);
        container.setData('back', back);
        container.setData('qMark', qMark);
        container.setData('face', face);
        container.setData('emoji', emojiDisplay);

        // Click handler
        container.on('pointerdown', () => this.onCardClick(container));
        container.on('pointerover', () => {
            if (!container.getData('flipped') && !container.getData('matched')) {
                this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
            }
        });
        container.on('pointerout', () => {
            if (!container.getData('flipped') && !container.getData('matched')) {
                this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
            }
        });

        this.cards.push(container);
        return container;
    }

    showCardFace(card) {
        card.getData('back').setVisible(false);
        card.getData('qMark').setVisible(false);
        card.getData('face').setVisible(true);
        card.getData('emoji').setVisible(true);
        card.setData('flipped', true);
    }

    hideCardFace(card) {
        card.getData('back').setVisible(true);
        card.getData('qMark').setVisible(true);
        card.getData('face').setVisible(false);
        card.getData('emoji').setVisible(false);
        card.setData('flipped', false);
    }

    onCardClick(card) {
        if (this.isLocked || card.getData('flipped') || card.getData('matched') || this.gameOver) return;

        // Track response time
        const now = Date.now();
        this.responseTimes.push(now - this.lastFlipTime);
        this.lastFlipTime = now;

        // Flip animation + audio cue
        cueCardFlip();
        this.tweens.add({
            targets: card,
            scaleX: 0,
            duration: 120,
            onComplete: () => {
                this.showCardFace(card);
                this.tweens.add({
                    targets: card,
                    scaleX: 1,
                    duration: 120,
                    ease: 'Back.easeOut'
                });
            }
        });

        this.flippedCards.push(card);

        if (this.flippedCards.length === 2) {
            this.attempts++;
            this.attemptsText.setText(`Moves: ${this.attempts}`);
            this.isLocked = true;

            const [card1, card2] = this.flippedCards;

            if (card1.getData('value') === card2.getData('value')) {
                // Match! Play happy audio cue
                cueMatchFound();
                this.matchedPairs++;
                this.score += 100 + Math.max(0, 50 - this.attempts * 2);
                this.scoreText.setText(`Score: ${this.score}`);

                card1.setData('matched', true);
                card2.setData('matched', true);

                // Match celebration
                [card1, card2].forEach(c => {
                    this.tweens.add({
                        targets: c,
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 200,
                        yoyo: true,
                        ease: 'Bounce.easeOut'
                    });
                });

                // Sparkle effect
                this.createSparkles(card1.x, card1.y);
                this.createSparkles(card2.x, card2.y);

                this.onProgress({
                    matched: this.matchedPairs,
                    total: this.totalPairs,
                    accuracy: this.matchedPairs / this.attempts
                });

                this.flippedCards = [];
                this.isLocked = false;

                // Check win
                if (this.matchedPairs === this.totalPairs) {
                    this.gameOver = true;
                    this.time.delayedCall(500, () => this.handleWin());
                }
            } else {
                // No match — play soft mismatch cue and flip back
                cueMismatch();
                this.time.delayedCall(800, () => {
                    [card1, card2].forEach(c => {
                        this.tweens.add({
                            targets: c,
                            scaleX: 0,
                            duration: 120,
                            onComplete: () => {
                                this.hideCardFace(c);
                                this.tweens.add({ targets: c, scaleX: 1, duration: 120 });
                            }
                        });
                    });
                    this.flippedCards = [];
                    this.isLocked = false;
                });
            }
        }
    }

    createSparkles(x, y) {
        for (let i = 0; i < 6; i++) {
            const sparkle = this.add.text(x, y, '✨', { fontSize: '16px' });
            const angle = (i / 6) * Math.PI * 2;
            this.tweens.add({
                targets: sparkle,
                x: x + Math.cos(angle) * 40,
                y: y + Math.sin(angle) * 40,
                alpha: 0,
                scale: 0.5,
                duration: 500,
                ease: 'Power2',
                onComplete: () => sparkle.destroy()
            });
        }
    }

    handleWin() {
        const { width, height } = this.sys.game.config;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const accuracy = (this.matchedPairs / this.attempts) * 100;
        const avgResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
            : 0;

        // Play celebration audio
        cueGameComplete();

        // Overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setAlpha(0);
        this.tweens.add({ targets: overlay, alpha: 1, duration: 300 });

        // Win text
        const winText = this.add.text(width / 2, height / 2 - 60, '🎉 Amazing!', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#fbbf24'
        }).setOrigin(0.5).setAlpha(0).setScale(0.5);

        this.tweens.add({
            targets: winText,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        const statsText = this.add.text(width / 2, height / 2 + 10,
            `Score: ${this.score}  |  Accuracy: ${accuracy.toFixed(0)}%  |  Time: ${elapsed.toFixed(1)}s`,
            {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '16px',
                color: '#94a3b8'
            }
        ).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: statsText, alpha: 1, duration: 500, delay: 300 });

        // Report completion
        this.onComplete({
            score: this.score,
            accuracy: accuracy,
            duration: elapsed,
            avgResponseTime: avgResponseTime,
            attempts: this.attempts,
            level: this.level,
            matchedPairs: this.matchedPairs,
            totalPairs: this.totalPairs
        });
    }
}


const PhaserMemoryMatch = ({ level = 1, onComplete, onClose }) => {
    const gameContainerRef = useRef(null);
    const gameRef = useRef(null);
    const [progress, setProgress] = useState({ matched: 0, total: 0, accuracy: 0 });
    const [completed, setCompleted] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!gameContainerRef.current) return;

        let game;
        try {
            const config = {
                type: Phaser.CANVAS,
                parent: gameContainerRef.current,
                width: 600,
                height: 500,
                backgroundColor: '#0f172a',
                scene: MemoryMatchScene,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH
                },
                render: {
                    pixelArt: false,
                    antialias: true
                },
                banner: false
            };

            game = new Phaser.Game(config);
            gameRef.current = game;

            // Pass callbacks to scene
            game.scene.start('MemoryMatch', {
                level,
                onProgress: (p) => setProgress(p),
                onComplete: (r) => {
                    setResult(r);
                    setCompleted(true);
                }
            });
        } catch (err) {
            console.error('Phaser init error:', err);
        }

        return () => {
            try {
                if (game) game.destroy(true);
            } catch (e) { /* ignore cleanup errors */ }
            gameRef.current = null;
        };
    }, [level]);

    const handleSaveAndClose = () => {
        if (result && onComplete) {
            onComplete(result);
        }
        onClose?.();
    };

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-800 flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <span className="text-lg">🧩</span>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Memory Match</h3>
                        <p className="text-xs text-slate-400">Level {level} — Find all matching pairs</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!completed && progress.total > 0 && (
                        <span className="text-xs text-slate-400">
                            {progress.matched}/{progress.total} pairs
                        </span>
                    )}
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Phaser Canvas */}
            <div ref={gameContainerRef} className="w-full" style={{ minHeight: '500px' }} />

            {/* Results footer */}
            {completed && result && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
                    <div className="flex gap-4 text-sm">
                        <span className="text-amber-400">Score: {result.score}</span>
                        <span className="text-emerald-400">Accuracy: {result.accuracy.toFixed(0)}%</span>
                        <span className="text-sky-400">Time: {result.duration.toFixed(1)}s</span>
                    </div>
                    <button
                        onClick={handleSaveAndClose}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        Save & Continue
                    </button>
                </div>
            )}
        </div>
    );
};

export default PhaserMemoryMatch;
