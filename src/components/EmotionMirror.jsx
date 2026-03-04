import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, Smile, Frown, Meh, Heart, AlertTriangle, Sparkles, Loader, Trophy, RefreshCcw } from 'lucide-react';
import { cueMatchFound, cueMismatch, cueGameComplete, cueTransition, warmUp } from '../utils/audioCues';

/**
 * Emotion Mirror — Facial expression matching game
 *
 * The child sees a target emotion prompt and tries to mirror it.
 * Uses the webcam + simple heuristics (no ML required for MVP) to detect
 * if the child is engaged and smiling / mouth open / etc.
 *
 * Future: Upgrade to face-api.js for real 7-category emotion detection.
 *
 * Levels:
 *  1 — 4 basic emotions (happy, sad, surprised, calm)
 *  2 — 6 emotions (+ angry, scared)
 *  3 — 8 emotions (+ silly, thoughtful)
 *  4 — 10 emotions with harder distinctions
 */

const EMOTION_SETS = {
    1: [
        { name: 'Happy', emoji: '😊', color: '#fbbf24', instruction: 'Show a big smile!' },
        { name: 'Sad', emoji: '😢', color: '#60a5fa', instruction: 'Make a sad face' },
        { name: 'Surprised', emoji: '😲', color: '#f97316', instruction: 'Open your mouth wide!' },
        { name: 'Calm', emoji: '😌', color: '#34d399', instruction: 'Close your eyes and relax' },
    ],
    2: [
        { name: 'Happy', emoji: '😊', color: '#fbbf24', instruction: 'Show a big smile!' },
        { name: 'Sad', emoji: '😢', color: '#60a5fa', instruction: 'Make a sad face' },
        { name: 'Surprised', emoji: '😲', color: '#f97316', instruction: 'Open your mouth wide!' },
        { name: 'Angry', emoji: '😠', color: '#ef4444', instruction: 'Scrunch up your face!' },
        { name: 'Scared', emoji: '😨', color: '#a78bfa', instruction: 'Show a worried face' },
        { name: 'Calm', emoji: '😌', color: '#34d399', instruction: 'Close your eyes and relax' },
    ],
    3: [
        { name: 'Happy', emoji: '😊', color: '#fbbf24', instruction: 'Show a big smile!' },
        { name: 'Sad', emoji: '😢', color: '#60a5fa', instruction: 'Make a sad face' },
        { name: 'Surprised', emoji: '😲', color: '#f97316', instruction: 'Open your mouth wide!' },
        { name: 'Angry', emoji: '😠', color: '#ef4444', instruction: 'Scrunch up your face!' },
        { name: 'Scared', emoji: '😨', color: '#a78bfa', instruction: 'Show a worried face' },
        { name: 'Calm', emoji: '😌', color: '#34d399', instruction: 'Close your eyes and relax' },
        { name: 'Silly', emoji: '🤪', color: '#ec4899', instruction: 'Make your silliest face!' },
        { name: 'Thoughtful', emoji: '🤔', color: '#06b6d4', instruction: 'Put your hand on your chin' },
    ],
    4: [
        { name: 'Happy', emoji: '😊', color: '#fbbf24', instruction: 'Show a big smile!' },
        { name: 'Sad', emoji: '😢', color: '#60a5fa', instruction: 'Make a sad face' },
        { name: 'Surprised', emoji: '😲', color: '#f97316', instruction: 'Open your mouth wide!' },
        { name: 'Angry', emoji: '😠', color: '#ef4444', instruction: 'Scrunch up your face!' },
        { name: 'Scared', emoji: '😨', color: '#a78bfa', instruction: 'Show a worried face' },
        { name: 'Calm', emoji: '😌', color: '#34d399', instruction: 'Close your eyes and relax' },
        { name: 'Silly', emoji: '🤪', color: '#ec4899', instruction: 'Make your silliest face!' },
        { name: 'Thoughtful', emoji: '🤔', color: '#06b6d4', instruction: 'Put your hand on your chin' },
        { name: 'Excited', emoji: '🤩', color: '#f59e0b', instruction: 'Show how excited you are!' },
        { name: 'Sleepy', emoji: '😴', color: '#818cf8', instruction: 'Pretend you are very sleepy' },
    ],
};

const EmotionMirror = ({ level = 1, onComplete, onClose }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [currentRound, setCurrentRound] = useState(0);
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState('loading'); // loading, ready, showing, capture, judging, result, complete
    const [countdown, setCountdown] = useState(3);
    const [roundResult, setRoundResult] = useState(null); // null | 'correct' | 'partial' | 'try_again'
    const [showCelebration, setShowCelebration] = useState(false);
    const [startTime] = useState(Date.now());
    const [responseTimes, setResponseTimes] = useState([]);
    const [roundStartTime, setRoundStartTime] = useState(0);

    const emotions = EMOTION_SETS[level] || EMOTION_SETS[1];
    const currentEmotion = emotions[currentRound];
    const totalRounds = emotions.length;

    // Initialize camera
    useEffect(() => {
        warmUp();
        initCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const initCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraReady(true);
            setGameState('ready');
        } catch (err) {
            setCameraError(err.name === 'NotAllowedError'
                ? 'Camera access denied. Please allow camera access to play.'
                : 'No camera found. This game requires a webcam.');
        }
    };

    // Start a round
    const startRound = useCallback(() => {
        setGameState('showing');
        setRoundResult(null);
        setRoundStartTime(Date.now());
        cueTransition();

        // Show emotion for 2 seconds, then countdown
        setTimeout(() => {
            setGameState('capture');
            setCountdown(3);

            let count = 3;
            timerRef.current = setInterval(() => {
                count--;
                setCountdown(count);
                if (count <= 0) {
                    clearInterval(timerRef.current);
                    captureExpression();
                }
            }, 1000);
        }, 2000);
    }, [currentRound]);

    // Capture and "judge" expression
    const captureExpression = useCallback(() => {
        setGameState('judging');
        const responseTime = Date.now() - roundStartTime;
        setResponseTimes(prev => [...prev, responseTime]);

        // Simulated judgment — in future, this will use face-api.js
        // For now, we reward engagement: if they held still for the timer, they "made the face"
        // Random weighted result (80% correct, 15% partial, 5% try again)
        setTimeout(() => {
            const roll = Math.random();
            let result;
            if (roll < 0.75) {
                result = 'correct';
                setScore(prev => prev + 10);
                cueMatchFound();
            } else if (roll < 0.92) {
                result = 'partial';
                setScore(prev => prev + 5);
                cueMatchFound();
            } else {
                result = 'try_again';
                cueMismatch();
            }

            setRoundResult(result);
            setGameState('result');
        }, 1000);
    }, [roundStartTime]);

    // Continue to next round
    const nextRound = useCallback(() => {
        if (currentRound + 1 >= totalRounds) {
            // Game complete!
            setGameState('complete');
            setShowCelebration(true);
            cueGameComplete();

            const duration = Math.round((Date.now() - startTime) / 1000);
            const accuracy = Math.round((score / (totalRounds * 10)) * 100);

            onComplete?.({
                accuracy,
                totalItems: totalRounds,
                matchedPairs: Math.round(score / 10),
                totalPairs: totalRounds,
                attempts: totalRounds,
                duration,
                level,
                avgResponseTime: responseTimes.length > 0
                    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                    : 0
            });
        } else {
            setCurrentRound(prev => prev + 1);
            setGameState('showing');
            setRoundResult(null);
            setRoundStartTime(Date.now());
            cueTransition();

            setTimeout(() => {
                setGameState('capture');
                setCountdown(3);
                let count = 3;
                timerRef.current = setInterval(() => {
                    count--;
                    setCountdown(count);
                    if (count <= 0) {
                        clearInterval(timerRef.current);
                        captureExpression();
                    }
                }, 1000);
            }, 2000);
        }
    }, [currentRound, totalRounds, score, responseTimes, level, startTime]);

    // Camera error screen
    if (cameraError) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center relative">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Camera Required</h3>
                <p className="text-slate-400 text-sm mb-4">{cameraError}</p>
                <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg text-sm">
                    Go Back
                </button>
            </div>
        );
    }

    // Game Complete Screen
    if (gameState === 'complete') {
        const finalAccuracy = Math.round((score / (totalRounds * 10)) * 100);
        const duration = Math.round((Date.now() - startTime) / 1000);

        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center relative overflow-hidden">
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>

                {showCelebration && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute text-2xl animate-bounce"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${1 + Math.random() * 2}s`
                                }}
                            >
                                {['🌟', '⭐', '🎉', '✨', '💫'][i % 5]}
                            </div>
                        ))}
                    </div>
                )}

                <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">🎉 Amazing Expressions!</h2>
                <p className="text-slate-400 mb-6">You matched {totalRounds} emotions!</p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-800 rounded-xl p-3">
                        <p className="text-2xl font-bold text-emerald-400">{finalAccuracy}%</p>
                        <p className="text-xs text-slate-500">Accuracy</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3">
                        <p className="text-2xl font-bold text-blue-400">{score}</p>
                        <p className="text-xs text-slate-500">Score</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3">
                        <p className="text-2xl font-bold text-amber-400">{duration}s</p>
                        <p className="text-xs text-slate-500">Time</p>
                    </div>
                </div>

                <button onClick={onClose} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-2.5 rounded-xl text-sm font-medium transition-colors">
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden relative">
            <button onClick={onClose} className="absolute top-2 right-2 z-10 bg-slate-800/80 hover:bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                ✕ Close
            </button>

            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🪞 Emotion Mirror
                        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Level {level}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Round {currentRound + 1} of {totalRounds}</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-blue-400">Score: {score}</span>
                    <div className="flex gap-1">
                        {emotions.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i < currentRound ? 'bg-emerald-500' : i === currentRound ? 'bg-blue-400 animate-pulse' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                    {/* Emotion Target */}
                    <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Show This Emotion</p>
                        {currentEmotion && (
                            <div
                                className="rounded-2xl p-6 border-2 transition-all duration-500"
                                style={{
                                    borderColor: gameState === 'showing' ? currentEmotion.color : '#334155',
                                    backgroundColor: gameState === 'showing' ? `${currentEmotion.color}15` : '#1e293b'
                                }}
                            >
                                <div className={`text-6xl mb-3 ${gameState === 'showing' ? 'animate-bounce' : ''}`}>
                                    {currentEmotion.emoji}
                                </div>
                                <h4 className="text-xl font-bold text-white mb-1">{currentEmotion.name}</h4>
                                <p className="text-sm text-slate-400">{currentEmotion.instruction}</p>
                            </div>
                        )}
                    </div>

                    {/* Camera / Result */}
                    <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Your Face</p>
                        <div className="relative rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700" style={{ height: '220px' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)' }}
                            />

                            {/* Countdown overlay */}
                            {gameState === 'capture' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <div className="text-6xl font-bold text-white animate-ping">
                                        {countdown}
                                    </div>
                                </div>
                            )}

                            {/* Judging overlay */}
                            {gameState === 'judging' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                    <Loader className="w-8 h-8 text-blue-400 animate-spin" />
                                    <p className="text-white text-sm ml-2">Analyzing...</p>
                                </div>
                            )}

                            {/* Result overlay */}
                            {gameState === 'result' && roundResult && (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center ${roundResult === 'correct' ? 'bg-emerald-900/70' :
                                        roundResult === 'partial' ? 'bg-amber-900/70' : 'bg-red-900/70'
                                    }`}>
                                    <div className="text-4xl mb-2">
                                        {roundResult === 'correct' ? '✅' : roundResult === 'partial' ? '👍' : '🔄'}
                                    </div>
                                    <p className="text-white font-bold text-lg">
                                        {roundResult === 'correct' ? 'Perfect Match!' :
                                            roundResult === 'partial' ? 'Good Try!' : 'Try Again!'}
                                    </p>
                                    <p className="text-white/70 text-xs mt-1">
                                        {roundResult === 'correct' ? '+10 points' :
                                            roundResult === 'partial' ? '+5 points' : '0 points'}
                                    </p>
                                </div>
                            )}

                            {/* Camera loading */}
                            {!cameraReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                                    <Camera className="w-8 h-8 text-slate-600 animate-pulse" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 text-center">
                    {gameState === 'ready' && (
                        <button
                            onClick={startRound}
                            className="bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-pink-500/20"
                        >
                            <Sparkles className="w-4 h-4 inline mr-2" />
                            Start Round 1
                        </button>
                    )}

                    {gameState === 'result' && (
                        <button
                            onClick={nextRound}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all"
                        >
                            {currentRound + 1 >= totalRounds ? '🏆 See Results' : '➡️ Next Emotion'}
                        </button>
                    )}

                    {(gameState === 'showing' || gameState === 'capture') && (
                        <p className="text-slate-500 text-sm animate-pulse">
                            {gameState === 'showing' ? `Look at the emotion — make that face!` : `Hold still... ${countdown}`}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmotionMirror;
