import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { cueMatchFound, cueMismatch, cueGameComplete, cueCardFlip, warmUp } from '../utils/audioCues';

/**
 * Day Builder — Phaser-based daily routine ordering game
 *
 * Children drag activity cards into the correct chronological order.
 * Targets: ADL (Activities of Daily Living) skills, sequencing, time concepts.
 *
 * Levels:
 *  1 — 4 activities (morning routine)
 *  2 — 6 activities (morning + afternoon)
 *  3 — 8 activities (full day)
 *  4 — 10 activities (full day + extras)
 */

// Activity sets by level
const ACTIVITY_SETS = {
    1: [
        { label: 'Wake Up', emoji: '☀️', color: 0xfbbf24 },
        { label: 'Brush Teeth', emoji: '🪥', color: 0x60a5fa },
        { label: 'Eat Breakfast', emoji: '🥣', color: 0xf97316 },
        { label: 'Get Dressed', emoji: '👕', color: 0xa78bfa },
    ],
    2: [
        { label: 'Wake Up', emoji: '☀️', color: 0xfbbf24 },
        { label: 'Brush Teeth', emoji: '🪥', color: 0x60a5fa },
        { label: 'Eat Breakfast', emoji: '🥣', color: 0xf97316 },
        { label: 'Go to School', emoji: '🏫', color: 0x34d399 },
        { label: 'Eat Lunch', emoji: '🍕', color: 0xfb923c },
        { label: 'Play Outside', emoji: '⚽', color: 0x4ade80 },
    ],
    3: [
        { label: 'Wake Up', emoji: '☀️', color: 0xfbbf24 },
        { label: 'Brush Teeth', emoji: '🪥', color: 0x60a5fa },
        { label: 'Eat Breakfast', emoji: '🥣', color: 0xf97316 },
        { label: 'Go to School', emoji: '🏫', color: 0x34d399 },
        { label: 'Eat Lunch', emoji: '🍕', color: 0xfb923c },
        { label: 'Play Outside', emoji: '⚽', color: 0x4ade80 },
        { label: 'Eat Dinner', emoji: '🍽️', color: 0xf59e0b },
        { label: 'Go to Bed', emoji: '🌙', color: 0x818cf8 },
    ],
    4: [
        { label: 'Wake Up', emoji: '☀️', color: 0xfbbf24 },
        { label: 'Brush Teeth', emoji: '🪥', color: 0x60a5fa },
        { label: 'Eat Breakfast', emoji: '🥣', color: 0xf97316 },
        { label: 'Go to School', emoji: '🏫', color: 0x34d399 },
        { label: 'Snack Time', emoji: '🍎', color: 0xef4444 },
        { label: 'Eat Lunch', emoji: '🍕', color: 0xfb923c },
        { label: 'Therapy', emoji: '🧩', color: 0x8b5cf6 },
        { label: 'Play Outside', emoji: '⚽', color: 0x4ade80 },
        { label: 'Eat Dinner', emoji: '🍽️', color: 0xf59e0b },
        { label: 'Go to Bed', emoji: '🌙', color: 0x818cf8 },
    ],
};

class DayBuilderScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DayBuilder' });
        this.slots = [];
        this.cards = [];
        this.correctOrder = [];
        this.attempts = 0;
        this.score = 0;
        this.hintsUsed = 0;
        this.startTime = 0;
        this.level = 1;
    }

    init(data) {
        this.level = data.level || 1;
        this.onProgress = data.onProgress || (() => { });
        this.onComplete = data.onComplete || (() => { });
        warmUp();
    }

    create() {
        const { width, height } = this.sys.game.config;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x0f172a, 1);
        bg.fillRect(0, 0, width, height);

        // Title
        this.add.text(width / 2, 25, '🏗️ Day Builder', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#e2e8f0'
        }).setOrigin(0.5);

        this.add.text(width / 2, 50, `Level ${this.level} — Put activities in order!`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#94a3b8'
        }).setOrigin(0.5);

        // Score display
        this.scoreText = this.add.text(20, 15, 'Score: 0', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            color: '#38bdf8'
        });

        // Attempts display
        this.attemptsText = this.add.text(width - 20, 15, 'Moves: 0', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            color: '#f59e0b'
        }).setOrigin(1, 0);

        // Get activities for this level  
        const activities = ACTIVITY_SETS[this.level] || ACTIVITY_SETS[1];
        this.correctOrder = activities.map(a => a.label);
        const totalItems = activities.length;

        // Shuffle activities for the player
        const shuffled = [...activities];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Layout
        const slotWidth = Math.min(120, (width - 60) / 2);
        const slotHeight = 42;
        const gap = 6;
        const slotsPerCol = Math.ceil(totalItems / 2);

        // Create drop slots (left side — numbered target positions)
        const slotStartX = 30;
        const slotStartY = 80;

        for (let i = 0; i < totalItems; i++) {
            const col = Math.floor(i / slotsPerCol);
            const row = i % slotsPerCol;
            const x = slotStartX + col * (slotWidth + 30);
            const y = slotStartY + row * (slotHeight + gap);

            const slotBg = this.add.graphics();
            slotBg.fillStyle(0x1e293b, 1);
            slotBg.fillRoundedRect(x, y, slotWidth, slotHeight, 8);
            slotBg.lineStyle(2, 0x334155, 0.8);
            slotBg.strokeRoundedRect(x, y, slotWidth, slotHeight, 8);

            const numLabel = this.add.text(x + 14, y + slotHeight / 2, `${i + 1}`, {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#475569'
            }).setOrigin(0.5);

            this.slots.push({
                x, y, width: slotWidth, height: slotHeight,
                index: i, card: null, bg: slotBg, numLabel
            });
        }

        // Create draggable cards (shuffled, starting at bottom)
        const cardArea = totalItems <= 6 ? height - 130 : height - 90;
        const cardsPerRow = Math.min(5, totalItems);
        const cardWidth = Math.min(110, (width - 40) / cardsPerRow);
        const cardStartX = (width - cardsPerRow * (cardWidth + 8) + 8) / 2;

        shuffled.forEach((activity, i) => {
            const row = Math.floor(i / cardsPerRow);
            const col = i % cardsPerRow;
            const cx = cardStartX + col * (cardWidth + 8) + cardWidth / 2;
            const cy = cardArea + row * 50;

            const container = this.add.container(cx, cy);

            // Card background
            const cardBg = this.add.graphics();
            cardBg.fillStyle(activity.color, 0.85);
            cardBg.fillRoundedRect(-cardWidth / 2, -18, cardWidth, 36, 8);
            cardBg.lineStyle(2, 0xffffff, 0.3);
            cardBg.strokeRoundedRect(-cardWidth / 2, -18, cardWidth, 36, 8);

            // Emoji + Label
            const label = this.add.text(0, 0, `${activity.emoji} ${activity.label}`, {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);

            container.add([cardBg, label]);
            container.setSize(cardWidth, 36);
            container.setInteractive({ draggable: true });

            container.setData('activity', activity.label);
            container.setData('originalX', cx);
            container.setData('originalY', cy);
            container.setData('placed', false);
            container.setData('slotIndex', -1);

            // Drag events
            this.input.setDraggable(container);

            this.cards.push(container);
        });

        // Drag handlers
        this.input.on('dragstart', (pointer, gameObject) => {
            gameObject.setDepth(100);
            cueCardFlip();

            // Remove from slot if placed
            const slotIdx = gameObject.getData('slotIndex');
            if (slotIdx >= 0) {
                this.slots[slotIdx].card = null;
                gameObject.setData('placed', false);
                gameObject.setData('slotIndex', -1);
            }
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragend', (pointer, gameObject) => {
            gameObject.setDepth(0);

            // Check if dropped on a slot
            let placed = false;
            for (const slot of this.slots) {
                if (slot.card) continue; // Already occupied

                if (pointer.x >= slot.x && pointer.x <= slot.x + slot.width &&
                    pointer.y >= slot.y && pointer.y <= slot.y + slot.height) {
                    // Place in slot
                    slot.card = gameObject;
                    gameObject.setData('placed', true);
                    gameObject.setData('slotIndex', slot.index);

                    this.tweens.add({
                        targets: gameObject,
                        x: slot.x + slot.width / 2,
                        y: slot.y + slot.height / 2,
                        duration: 200,
                        ease: 'Power2'
                    });

                    placed = true;
                    this.attempts++;
                    this.attemptsText.setText(`Moves: ${this.attempts}`);
                    break;
                }
            }

            if (!placed) {
                // Return to original position
                this.tweens.add({
                    targets: gameObject,
                    x: gameObject.getData('originalX'),
                    y: gameObject.getData('originalY'),
                    duration: 200,
                    ease: 'Power2'
                });
            }

            // Check if all slots are filled
            this.checkCompletion();
        });

        this.startTime = Date.now();

        // Hint button
        const hintBtn = this.add.text(width / 2, height - 15, '💡 Hint', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '12px',
            color: '#fbbf24',
            backgroundColor: '#1e293b',
            padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setInteractive();

        hintBtn.on('pointerdown', () => {
            this.showHint();
        });
    }

    showHint() {
        this.hintsUsed++;
        // Find first empty slot and show which activity should go there
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i].card) {
                const correctActivity = this.correctOrder[i];
                const hintText = this.add.text(
                    this.slots[i].x + this.slots[i].width / 2,
                    this.slots[i].y + this.slots[i].height / 2,
                    correctActivity,
                    {
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: '10px',
                        color: '#fbbf24',
                        fontStyle: 'italic'
                    }
                ).setOrigin(0.5).setAlpha(0);

                this.tweens.add({
                    targets: hintText,
                    alpha: 0.8,
                    duration: 300,
                    yoyo: true,
                    hold: 1500,
                    onComplete: () => hintText.destroy()
                });
                break;
            }
        }
    }

    checkCompletion() {
        const allFilled = this.slots.every(s => s.card !== null);
        if (!allFilled) return;

        // Check correctness
        let correct = 0;
        for (let i = 0; i < this.slots.length; i++) {
            const cardActivity = this.slots[i].card?.getData('activity');
            if (cardActivity === this.correctOrder[i]) {
                correct++;
                // Green glow for correct
                this.slots[i].bg.clear();
                this.slots[i].bg.fillStyle(0x059669, 0.3);
                this.slots[i].bg.fillRoundedRect(
                    this.slots[i].x, this.slots[i].y,
                    this.slots[i].width, this.slots[i].height, 8
                );
                this.slots[i].bg.lineStyle(2, 0x10b981, 1);
                this.slots[i].bg.strokeRoundedRect(
                    this.slots[i].x, this.slots[i].y,
                    this.slots[i].width, this.slots[i].height, 8
                );
            } else {
                // Red outline for incorrect
                this.slots[i].bg.clear();
                this.slots[i].bg.fillStyle(0x7f1d1d, 0.3);
                this.slots[i].bg.fillRoundedRect(
                    this.slots[i].x, this.slots[i].y,
                    this.slots[i].width, this.slots[i].height, 8
                );
                this.slots[i].bg.lineStyle(2, 0xef4444, 0.8);
                this.slots[i].bg.strokeRoundedRect(
                    this.slots[i].x, this.slots[i].y,
                    this.slots[i].width, this.slots[i].height, 8
                );
            }
        }

        const accuracy = Math.round((correct / this.slots.length) * 100);
        this.score = accuracy;
        this.scoreText.setText(`Score: ${this.score}%`);

        if (correct === this.slots.length) {
            // Perfect! All correct
            cueGameComplete();
            this.handleWin();
        } else {
            cueMismatch();
            // Reset incorrect ones after a delay
            this.time.delayedCall(1500, () => {
                for (let i = 0; i < this.slots.length; i++) {
                    const cardActivity = this.slots[i].card?.getData('activity');
                    if (cardActivity !== this.correctOrder[i] && this.slots[i].card) {
                        const card = this.slots[i].card;
                        this.slots[i].card = null;
                        card.setData('placed', false);
                        card.setData('slotIndex', -1);

                        this.tweens.add({
                            targets: card,
                            x: card.getData('originalX'),
                            y: card.getData('originalY'),
                            duration: 300,
                            ease: 'Power2'
                        });
                    }
                    // Reset slot appearance
                    this.slots[i].bg.clear();
                    this.slots[i].bg.fillStyle(this.slots[i].card ? 0x059669 : 0x1e293b, this.slots[i].card ? 0.3 : 1);
                    this.slots[i].bg.fillRoundedRect(
                        this.slots[i].x, this.slots[i].y,
                        this.slots[i].width, this.slots[i].height, 8
                    );
                    this.slots[i].bg.lineStyle(2, this.slots[i].card ? 0x10b981 : 0x334155, 0.8);
                    this.slots[i].bg.strokeRoundedRect(
                        this.slots[i].x, this.slots[i].y,
                        this.slots[i].width, this.slots[i].height, 8
                    );
                }
            });
        }
    }

    handleWin() {
        const { width, height } = this.sys.game.config;
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        const accuracy = 100;
        const totalItems = this.correctOrder.length;

        // Celebration overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(200);

        // Sparkle emoji rain
        for (let i = 0; i < 20; i++) {
            const sparkle = this.add.text(
                Phaser.Math.Between(20, width - 20),
                -30,
                ['🌟', '⭐', '✨', '🎉', '🏆'][Phaser.Math.Between(0, 4)],
                { fontSize: '24px' }
            ).setDepth(201);

            this.tweens.add({
                targets: sparkle,
                y: height + 30,
                x: sparkle.x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(1500, 3000),
                delay: Phaser.Math.Between(0, 1000),
                ease: 'Power1',
                onComplete: () => sparkle.destroy()
            });
        }

        // Victory text
        this.add.text(width / 2, height / 2 - 60, '🎉 Perfect Day!', {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#fbbf24'
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 - 20, `All ${totalItems} activities in order!`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            color: '#e2e8f0'
        }).setOrigin(0.5).setDepth(202);

        this.add.text(width / 2, height / 2 + 15, `⏱ ${duration}s  •  📝 ${this.attempts} moves  •  💡 ${this.hintsUsed} hints`, {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#94a3b8'
        }).setOrigin(0.5).setDepth(202);

        // Callback
        this.onComplete({
            accuracy,
            totalItems,
            attempts: this.attempts,
            hintsUsed: this.hintsUsed,
            duration,
            level: this.level,
            matchedPairs: totalItems,
            totalPairs: totalItems
        });
    }
}

const PhaserDayBuilder = ({ level = 1, onComplete, onClose }) => {
    const gameRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (gameRef.current) return;

        const config = {
            type: Phaser.AUTO,
            width: 550,
            height: level <= 2 ? 420 : 500,
            parent: containerRef.current,
            backgroundColor: '#0f172a',
            scene: DayBuilderScene,
            physics: { default: false },
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        gameRef.current = new Phaser.Game(config);
        gameRef.current.scene.start('DayBuilder', {
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

export default PhaserDayBuilder;
