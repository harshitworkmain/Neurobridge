import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { cueMatchFound, cueGameComplete, cueTransition, warmUp } from '../utils/audioCues';

/**
 * Gaze Garden — Phaser-based gaze attention game
 *
 * Target zones appear as "seeds". The child focuses their gaze (or clicks/taps
 * as a proxy for gaze) on the target. Flowers bloom from sustained attention.
 *
 * MVP: Uses click/tap to simulate gaze fixation.
 * Future: Integrate WebGazer.js for real eye tracking.
 *
 * Metrics tracked:
 *  - Fixation duration per target
 *  - Accuracy (hit targets vs misses)
 *  - Attention span (consecutive successful fixations)
 *  - Total engagement time
 *
 * Levels:
 *  1 — 5 flowers with generous timing (4s each)
 *  2 — 7 flowers, 3.5s each
 *  3 — 9 flowers, 3s each, some move
 *  4 — 12 flowers, 2.5s each, more movement
 */

// Flower types 
const FLOWERS = ['🌻', '🌷', '🌹', '🌸', '💐', '🌺', '🌼', '🏵️'];
const COLORS = [0xfbbf24, 0xf472b6, 0xef4444, 0xfda4af, 0xa78bfa, 0xf97316, 0xfacc15, 0xe879f9];

class GazeGardenScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GazeGarden' });
        this.targets = [];
        this.bloomed = 0;
        this.totalTargets = 0;
        this.misses = 0;
        this.score = 0;
        this.startTime = 0;
        this.fixationTimes = [];
        this.currentTarget = null;
        this.holdProgress = 0;
        this.holdTimer = null;
        this.level = 1;
        this.consecutiveHits = 0;
        this.maxConsecutive = 0;
    }

    init(data) {
        this.level = data.level || 1;
        this.onProgress = data.onProgress || (() => { });
        this.onComplete = data.onComplete || (() => { });
        warmUp();
    }

    create() {
        const { width, height } = this.sys.game.config;

        // Beautiful garden background
        const bg = this.add.graphics();
        // Sky gradient
        bg.fillGradientStyle(0x1e3a5f, 0x1e3a5f, 0x0f172a, 0x0f172a, 1);
        bg.fillRect(0, 0, width, height);

        // Ground
        const ground = this.add.graphics();
        ground.fillStyle(0x166534, 0.6);
        ground.fillRoundedRect(0, height - 60, width, 60, 0);
        ground.fillStyle(0x15803d, 0.4);
        ground.fillRoundedRect(0, height - 50, width, 50, 0);

        // Add some grass tufts
        for (let i = 0; i < 30; i++) {
            const gx = Phaser.Math.Between(10, width - 10);
            const gy = height - Phaser.Math.Between(50, 65);
            this.add.text(gx, gy, '🌿', { fontSize: '14px' }).setOrigin(0.5).setAlpha(0.4);
        }

        // Title
        this.add.text(width / 2, 22, '🌻 Gaze Garden', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#e2e8f0'
        }).setOrigin(0.5);

        this.add.text(width / 2, 45, `Level ${this.level} — Focus on the seeds to grow flowers!`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '12px',
            color: '#94a3b8'
        }).setOrigin(0.5);

        // Score & bloom counter
        this.scoreText = this.add.text(15, 12, '🌱 0 bloomed', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#34d399'
        });

        this.streakText = this.add.text(width - 15, 12, '🔥 0 streak', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#f59e0b'
        }).setOrigin(1, 0);

        // Progress bar background
        const pbY = 60;
        this.add.graphics().fillStyle(0x1e293b, 1).fillRoundedRect(20, pbY, width - 40, 8, 4);
        this.progressBar = this.add.graphics();
        this.updateProgressBar(0);

        // Level config
        const config = {
            1: { count: 5, holdTime: 4000, moving: false },
            2: { count: 7, holdTime: 3500, moving: false },
            3: { count: 9, holdTime: 3000, moving: true },
            4: { count: 12, holdTime: 2500, moving: true },
        };

        const cfg = config[this.level] || config[1];
        this.totalTargets = cfg.count;
        this.holdDuration = cfg.holdTime;
        this.shouldMove = cfg.moving;

        // Hold progress ring
        this.holdRing = this.add.graphics().setDepth(10);
        this.holdRingVisible = false;

        // Miss counter (clicks on empty space)
        this.input.on('pointerdown', (pointer) => {
            // Check if clicked on a target
            let hitTarget = false;
            for (const t of this.targets) {
                if (t.active && Phaser.Geom.Circle.Contains(
                    new Phaser.Geom.Circle(t.container.x, t.container.y, 35),
                    pointer.x, pointer.y
                )) {
                    hitTarget = true;
                    break;
                }
            }
            if (!hitTarget && this.currentTarget === null) {
                this.misses++;
                // Visual feedback for miss
                const missX = this.add.text(pointer.x, pointer.y, '✗', {
                    fontSize: '20px', color: '#ef4444'
                }).setOrigin(0.5).setAlpha(0);
                this.tweens.add({
                    targets: missX,
                    alpha: 0.8, y: pointer.y - 20,
                    duration: 300, yoyo: true,
                    hold: 200,
                    onComplete: () => missX.destroy()
                });

                this.consecutiveHits = 0;
                this.streakText.setText(`🔥 ${this.consecutiveHits} streak`);
            }
        });

        this.startTime = Date.now();
        this.spawnNext();
    }

    spawnNext() {
        if (this.bloomed >= this.totalTargets) {
            this.handleWin();
            return;
        }

        const { width, height } = this.sys.game.config;

        // Random position in the garden area
        const x = Phaser.Math.Between(60, width - 60);
        const y = Phaser.Math.Between(90, height - 100);

        const container = this.add.container(x, y);

        // Seed graphic
        const seed = this.add.text(0, 0, '🌱', {
            fontSize: '28px'
        }).setOrigin(0.5);

        // Pulsing glow circle
        const glow = this.add.graphics();
        glow.fillStyle(0x34d399, 0.15);
        glow.fillCircle(0, 0, 30);
        glow.lineStyle(2, 0x34d399, 0.4);
        glow.strokeCircle(0, 0, 30);

        container.add([glow, seed]);
        container.setSize(60, 60);
        container.setInteractive();
        container.setScale(0);

        // Entrance animation
        this.tweens.add({
            targets: container,
            scaleX: 1, scaleY: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        // Pulse animation
        this.tweens.add({
            targets: glow,
            scaleX: 1.2, scaleY: 1.2,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Optional movement for higher levels
        if (this.shouldMove && Math.random() > 0.5) {
            this.tweens.add({
                targets: container,
                x: container.x + Phaser.Math.Between(-40, 40),
                y: container.y + Phaser.Math.Between(-20, 20),
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const target = {
            container, seed, glow, active: true,
            fixStartTime: 0
        };

        // Click/hold to "focus"
        let isHolding = false;
        let holdStart = 0;
        let progressInterval = null;

        container.on('pointerdown', () => {
            if (!target.active) return;
            isHolding = true;
            holdStart = Date.now();
            target.fixStartTime = holdStart;
            cueTransition();

            progressInterval = this.time.addEvent({
                delay: 50,
                callback: () => {
                    if (!isHolding) return;
                    const elapsed = Date.now() - holdStart;
                    const progress = Math.min(elapsed / this.holdDuration, 1);

                    // Draw progress ring
                    this.holdRing.clear();
                    this.holdRing.lineStyle(4, 0x34d399, 1);
                    this.holdRing.beginPath();
                    this.holdRing.arc(
                        container.x, container.y, 35,
                        Phaser.Math.DegToRad(-90),
                        Phaser.Math.DegToRad(-90 + 360 * progress),
                        false
                    );
                    this.holdRing.strokePath();

                    // Seed grows as you hold
                    seed.setScale(1 + progress * 0.5);

                    if (progress >= 1) {
                        this.bloomFlower(target);
                        isHolding = false;
                        if (progressInterval) progressInterval.remove();
                    }
                },
                repeat: -1
            });
        });

        this.input.on('pointerup', () => {
            if (isHolding) {
                isHolding = false;
                if (progressInterval) progressInterval.remove();
                this.holdRing.clear();
                seed.setScale(1);
            }
        });

        this.targets.push(target);
    }

    bloomFlower(target) {
        target.active = false;
        const fixDuration = Date.now() - target.fixStartTime;
        this.fixationTimes.push(fixDuration);

        this.holdRing.clear();

        // Transform seed into flower
        const flowerEmoji = FLOWERS[this.bloomed % FLOWERS.length];
        target.seed.setText(flowerEmoji);
        target.seed.setScale(0.5);

        // Bloom animation
        this.tweens.add({
            targets: target.seed,
            scaleX: 1.5, scaleY: 1.5,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Green sparkle effect
        for (let i = 0; i < 8; i++) {
            const sparkle = this.add.text(
                target.container.x, target.container.y,
                '✨',
                { fontSize: '14px' }
            );
            this.tweens.add({
                targets: sparkle,
                x: target.container.x + Phaser.Math.Between(-40, 40),
                y: target.container.y + Phaser.Math.Between(-40, 40),
                alpha: 0,
                duration: 600,
                delay: i * 50,
                onComplete: () => sparkle.destroy()
            });
        }

        // Remove glow
        target.glow.setAlpha(0);

        this.bloomed++;
        this.consecutiveHits++;
        this.maxConsecutive = Math.max(this.maxConsecutive, this.consecutiveHits);
        this.score += 10 + (this.consecutiveHits * 2); // Bonus for streaks

        this.scoreText.setText(`🌱 ${this.bloomed} bloomed`);
        this.streakText.setText(`🔥 ${this.consecutiveHits} streak`);
        this.updateProgressBar(this.bloomed / this.totalTargets);

        cueMatchFound();

        // Next target after delay
        this.time.delayedCall(800, () => this.spawnNext());
    }

    updateProgressBar(pct) {
        const { width } = this.sys.game.config;
        const pbY = 60;
        const pbWidth = width - 40;
        this.progressBar.clear();
        this.progressBar.fillStyle(0x34d399, 1);
        this.progressBar.fillRoundedRect(20, pbY, pbWidth * pct, 8, 4);
    }

    handleWin() {
        const { width, height } = this.sys.game.config;
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        const accuracy = Math.round((this.bloomed / (this.bloomed + this.misses)) * 100) || 100;
        const avgFixation = this.fixationTimes.length > 0
            ? Math.round(this.fixationTimes.reduce((a, b) => a + b, 0) / this.fixationTimes.length)
            : 0;

        cueGameComplete();

        // Dark overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(100);

        // Celebration
        for (let i = 0; i < 25; i++) {
            const flower = this.add.text(
                Phaser.Math.Between(20, width - 20), -30,
                FLOWERS[Phaser.Math.Between(0, FLOWERS.length - 1)],
                { fontSize: '28px' }
            ).setDepth(101);

            this.tweens.add({
                targets: flower,
                y: height + 30,
                duration: Phaser.Math.Between(2000, 4000),
                delay: Phaser.Math.Between(0, 1500),
                ease: 'Power1'
            });
        }

        this.add.text(width / 2, height / 2 - 60, '🌻 Garden Complete!', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '26px', fontStyle: 'bold', color: '#fbbf24'
        }).setOrigin(0.5).setDepth(102);

        this.add.text(width / 2, height / 2 - 20, `${this.bloomed} flowers bloomed!`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px', color: '#e2e8f0'
        }).setOrigin(0.5).setDepth(102);

        this.add.text(width / 2, height / 2 + 15, `⏱ ${duration}s • 🎯 ${accuracy}% • 🔥 Best streak: ${this.maxConsecutive}`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '12px', color: '#94a3b8'
        }).setOrigin(0.5).setDepth(102);

        this.onComplete({
            accuracy,
            totalItems: this.totalTargets,
            matchedPairs: this.bloomed,
            totalPairs: this.totalTargets,
            attempts: this.bloomed + this.misses,
            duration,
            level: this.level,
            avgResponseTime: avgFixation,
            maxConsecutive: this.maxConsecutive,
            misses: this.misses
        });
    }
}

const PhaserGazeGarden = ({ level = 1, onComplete, onClose }) => {
    const gameRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (gameRef.current) return;

        const config = {
            type: Phaser.AUTO,
            width: 550,
            height: 450,
            parent: containerRef.current,
            backgroundColor: '#0f172a',
            scene: GazeGardenScene,
            physics: { default: false },
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        gameRef.current = new Phaser.Game(config);
        gameRef.current.scene.start('GazeGarden', {
            level,
            onProgress: () => { },
            onComplete: (result) => {
                onComplete?.(result);
            }
        });

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden relative">
            <div ref={containerRef} className="w-full" />
            <button
                onClick={onClose}
                className="absolute top-2 right-2 z-10 bg-slate-800/80 hover:bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
                ✕ Close
            </button>
        </div>
    );
};

export default PhaserGazeGarden;
