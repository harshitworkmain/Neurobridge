import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
    Gamepad2, Trophy, Flame, Star, Target, Clock, TrendingUp, ChevronRight,
    Loader, Play, Lock, Zap, Brain, Eye, Smile, ListOrdered, Grid3X3,
    BarChart3, ArrowRight, Sparkles, AlertTriangle, MessageCircle, History
} from 'lucide-react';
import SessionReplayViewer from '../components/SessionReplayViewer';

// Lazy-load Phaser games (E5 - Phaser Lazy Loading)
const PhaserMemoryMatch = lazy(() => import('../components/PhaserMemoryMatch'));
const PhaserDayBuilder = lazy(() => import('../components/PhaserDayBuilder'));
const PhaserGazeGarden = lazy(() => import('../components/PhaserGazeGarden'));
const EmotionMirror = lazy(() => import('../components/EmotionMirror'));

import API from '../config/api.js';

// Game metadata (icons, colors, illustrations)
const GAME_META = {
    gaze_garden: {
        icon: Eye,
        gradient: 'from-emerald-500 to-teal-600',
        bgLight: 'bg-emerald-50',
        textColor: 'text-emerald-600',
        emoji: '🌻'
    },
    emotion_mirror: {
        icon: Smile,
        gradient: 'from-pink-500 to-rose-600',
        bgLight: 'bg-pink-50',
        textColor: 'text-pink-600',
        emoji: '🪞'
    },
    day_builder: {
        icon: ListOrdered,
        gradient: 'from-amber-500 to-orange-600',
        bgLight: 'bg-amber-50',
        textColor: 'text-amber-600',
        emoji: '🏗️'
    },
    memory_match: {
        icon: Grid3X3,
        gradient: 'from-violet-500 to-purple-600',
        bgLight: 'bg-violet-50',
        textColor: 'text-violet-600',
        emoji: '🃏'
    }
};

const getGameMeta = (gameId) => GAME_META[gameId] || {
    icon: Gamepad2, gradient: 'from-slate-500 to-slate-600',
    bgLight: 'bg-slate-50', textColor: 'text-slate-600', emoji: '🎮'
};

const GameHub = () => {
    const [games, setGames] = useState([]);
    const [progress, setProgress] = useState({ played: [], unplayed: [] });
    const [analytics, setAnalytics] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState(null);
    const [showPlayModal, setShowPlayModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [caregiverNotes, setCaregiverNotes] = useState('');
    const [showPhaserGame, setShowPhaserGame] = useState(null); // { gameId, level }
    const [showReplay, setShowReplay] = useState(null); // sessionId

    // Simulated game form state
    const [gameResult, setGameResult] = useState({
        accuracy_score: 0.75,
        completion_rate: 0.9,
        duration_seconds: 120,
        error_count: 2,
        level: 1
    });

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [gamesRes, progressRes, analyticsRes, recsRes] = await Promise.all([
                fetch(`${API}/games`),
                fetch(`${API}/games/progress/1`),
                fetch(`${API}/games/analytics/1`),
                fetch(`${API}/games/recommendations/1`)
            ]);

            if (gamesRes.ok) {
                const data = await gamesRes.json();
                setGames(data.games || []);
            }
            if (progressRes.ok) {
                const data = await progressRes.json();
                setProgress({ played: data.played || [], unplayed: data.unplayed || [] });
            }
            if (analyticsRes.ok) {
                const data = await analyticsRes.json();
                setAnalytics(data);
            }
            if (recsRes.ok) {
                const data = await recsRes.json();
                setRecommendations(data.recommendations || []);
            }
        } catch (e) {
            console.error('Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const startGame = (game) => {
        const prog = progress.played.find(p => p.game_id === game.id);
        setGameResult({
            ...gameResult,
            level: prog?.current_level || 1
        });
        setSelectedGame(game);
        setShowPlayModal(true);
    };

    const saveSession = async () => {
        if (!selectedGame) return;
        setSubmitting(true);
        try {
            await fetch(`${API}/games/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: selectedGame.id,
                    ...gameResult,
                    caregiver_notes: caregiverNotes || undefined
                })
            });
            setShowPlayModal(false);
            setCaregiverNotes('');
            await loadAll();
        } catch (e) {
            console.error('Save error:', e);
        } finally {
            setSubmitting(false);
        }
    };

    const getProgressForGame = (gameId) => {
        return progress.played.find(p => p.game_id === gameId) || null;
    };

    const maxStreak = Math.max(0, ...progress.played.map(p => p.streak_days || 0));

    const handlePhaserComplete = async (result) => {
        try {
            await fetch(`${API}/games/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: showPhaserGame?.gameId || 'memory_match',
                    accuracy_score: result.accuracy / 100,
                    completion_rate: result.matchedPairs / result.totalPairs,
                    duration_seconds: result.duration,
                    error_count: result.attempts - result.matchedPairs,
                    level: result.level,
                    avg_response_time_ms: result.avgResponseTime
                })
            });
            await loadAll();
        } catch (e) {
            console.error('Save Phaser session error:', e);
        }
    };

    if (loading) return (
        <div className="flex h-[70vh] items-center justify-center">
            <div className="text-center">
                <Loader className="animate-spin text-primary-600 w-10 h-10 mx-auto mb-4" />
                <p className="text-slate-500">Loading games...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">🎮 Therapy Games</h1>
                <p className="text-slate-500 mt-1">Fun activities designed to build cognitive and social skills.</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                            <Gamepad2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{analytics?.overall?.total_sessions || 0}</p>
                            <p className="text-xs text-slate-500">Sessions</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Flame className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{maxStreak}</p>
                            <p className="text-xs text-slate-500">Day Streak</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{Math.round((analytics?.overall?.avg_accuracy || 0) * 100)}%</p>
                            <p className="text-xs text-slate-500">Avg Accuracy</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{analytics?.overall?.total_play_time_minutes || 0}</p>
                            <p className="text-xs text-slate-500">Minutes Played</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-primary-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-start gap-4">
                        <div className="bg-white/20 p-2.5 rounded-xl shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-white/90 text-sm uppercase tracking-wider mb-1">Recommended For You</h3>
                            <p className="text-lg font-medium leading-relaxed">{recommendations[0].reason}</p>
                            <button
                                onClick={() => {
                                    const game = games.find(g => g.id === recommendations[0].game_id);
                                    if (game) startGame(game);
                                }}
                                className="mt-3 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Play {recommendations[0].game_name}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Cards Grid */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 mb-4">All Games</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {games.map(game => {
                        const meta = getGameMeta(game.id);
                        const prog = getProgressForGame(game.id);
                        const Icon = meta.icon;
                        const levelLabel = prog ? `Level ${prog.current_level}/${game.max_level}` : 'Not started';

                        return (
                            <div key={game.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                                {/* Game Header */}
                                <div className={`bg-gradient-to-r ${meta.gradient} p-5 text-white relative overflow-hidden`}>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-20 select-none">{meta.emoji}</div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs uppercase tracking-wider font-semibold opacity-80">{game.category}</span>
                                        </div>
                                        <h3 className="text-xl font-bold">{game.name}</h3>
                                        <p className="text-sm text-white/80 mt-1">{game.description}</p>
                                    </div>
                                </div>

                                {/* Game Stats */}
                                <div className="p-5">
                                    {prog ? (
                                        <>
                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-slate-900">{prog.current_level}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase">Level</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-slate-900">{prog.total_sessions}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase">Sessions</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-slate-900">{Math.round((prog.avg_accuracy || 0) * 100)}%</p>
                                                    <p className="text-[10px] text-slate-400 uppercase">Accuracy</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-bold text-slate-900">{prog.streak_days || 0}🔥</p>
                                                    <p className="text-[10px] text-slate-400 uppercase">Streak</p>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                    <span>{levelLabel}</span>
                                                    <span>Best: {Math.round((prog.best_accuracy || 0) * 100)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full bg-gradient-to-r ${meta.gradient} transition-all duration-500`}
                                                        style={{ width: `${(prog.current_level / game.max_level) * 100}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Badges */}
                                            {prog.badges_json && JSON.parse(prog.badges_json).length > 0 && (
                                                <div className="flex items-center gap-1 mb-4">
                                                    {JSON.parse(prog.badges_json).map((badge, i) => (
                                                        <span key={i} className="text-sm" title={badge.type}>
                                                            {badge.type === 'first_game' ? '🏅' : badge.type === 'streak_5' ? '🔥' : '⭐'}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-sm text-slate-500 mb-1">Ages {game.min_age}–{game.max_age}</p>
                                            <p className="text-xs text-slate-400">Target: {game.target_skill}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => startGame(game)}
                                        className={`w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${prog
                                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                            : `bg-gradient-to-r ${meta.gradient} text-white hover:opacity-90`
                                            }`}
                                    >
                                        <Play className="w-4 h-4" />
                                        {prog ? 'Play Again' : 'Start Playing'}
                                    </button>

                                    <div className="flex gap-2 mt-2">
                                        {['memory_match', 'day_builder', 'gaze_garden', 'emotion_mirror'].includes(game.id) && (
                                            <button
                                                onClick={() => setShowPhaserGame({ gameId: game.id, level: prog?.current_level || 1 })}
                                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${meta.bgLight} hover:opacity-80 ${meta.textColor}`}
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Play Interactive
                                            </button>
                                        )}
                                        {prog && (
                                            <button
                                                onClick={() => setShowReplay(prog.game_id)}
                                                className="flex-1 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                                View Replay
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Category Performance */}
            {analytics?.by_category && analytics.by_category.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary-600" />
                            Performance by Category
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {analytics.by_category.map(cat => (
                            <div key={cat.category} className="px-5 py-4 flex items-center gap-4">
                                <div className={`w-10 h-10 ${getGameMeta(games.find(g => g.category === cat.category)?.id)?.bgLight || 'bg-slate-50'} rounded-xl flex items-center justify-center`}>
                                    {React.createElement(getGameMeta(games.find(g => g.category === cat.category)?.id)?.icon || Gamepad2, { className: `w-5 h-5 ${getGameMeta(games.find(g => g.category === cat.category)?.id)?.textColor || 'text-slate-600'}` })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 capitalize">{cat.category.replace('_', ' ')}</p>
                                    <p className="text-xs text-slate-400">{cat.sessions} sessions • {Math.round(cat.total_time / 60)}min total</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-slate-900">{Math.round((cat.avg_accuracy || 0) * 100)}%</p>
                                    <p className="text-xs text-slate-400">accuracy</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Play / Submit Session Modal */}
            {showPlayModal && selectedGame && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowPlayModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className={`bg-gradient-to-r ${getGameMeta(selectedGame.id).gradient} p-5 rounded-t-2xl text-white`}>
                            <div className="flex items-center gap-3">
                                <div className="text-4xl">{getGameMeta(selectedGame.id).emoji}</div>
                                <div>
                                    <h3 className="text-xl font-bold">{selectedGame.name}</h3>
                                    <p className="text-white/80 text-sm">{selectedGame.description}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700">
                                    <strong>Demo Mode:</strong> In the full version, this would launch an interactive Phaser game. For now, adjust the simulated results below and submit.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Accuracy</label>
                                    <input
                                        type="range" min="0" max="100" step="5"
                                        value={Math.round(gameResult.accuracy_score * 100)}
                                        onChange={e => setGameResult({ ...gameResult, accuracy_score: parseInt(e.target.value) / 100 })}
                                        className="w-full accent-primary-600"
                                    />
                                    <p className="text-center text-sm font-bold text-slate-900">{Math.round(gameResult.accuracy_score * 100)}%</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Duration (sec)</label>
                                    <input
                                        type="number" min="10" max="600"
                                        value={gameResult.duration_seconds}
                                        onChange={e => setGameResult({ ...gameResult, duration_seconds: parseInt(e.target.value) || 60 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
                                    <input
                                        type="number" min="1" max={selectedGame.max_level}
                                        value={gameResult.level}
                                        onChange={e => setGameResult({ ...gameResult, level: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Errors</label>
                                    <input
                                        type="number" min="0" max="20"
                                        value={gameResult.error_count}
                                        onChange={e => setGameResult({ ...gameResult, error_count: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            {/* Caregiver Co-Play Notes (A5) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    Caregiver Notes <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={caregiverNotes}
                                    onChange={e => setCaregiverNotes(e.target.value)}
                                    placeholder="How did your child respond? Any observations during play...
• Maintained eye contact longer than usual
• Needed verbal prompts to stay focused
• Laughed when matching pairs"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">These observations help your clinician understand your child's engagement during play.</p>
                            </div>

                            <button
                                onClick={saveSession}
                                disabled={submitting}
                                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                                {submitting ? 'Saving Session...' : 'Submit Game Session'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phaser Game Overlay */}
            {showPhaserGame && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl">
                        <Suspense fallback={
                            <div className="bg-slate-900 rounded-2xl p-8 text-center">
                                <Loader className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
                                <p className="text-slate-400 text-sm">Loading game engine...</p>
                            </div>
                        }>
                            {showPhaserGame.gameId === 'memory_match' && (
                                <PhaserMemoryMatch
                                    level={showPhaserGame.level}
                                    onComplete={handlePhaserComplete}
                                    onClose={() => setShowPhaserGame(null)}
                                />
                            )}
                            {showPhaserGame.gameId === 'day_builder' && (
                                <PhaserDayBuilder
                                    level={showPhaserGame.level}
                                    onComplete={handlePhaserComplete}
                                    onClose={() => setShowPhaserGame(null)}
                                />
                            )}
                            {showPhaserGame.gameId === 'gaze_garden' && (
                                <PhaserGazeGarden
                                    level={showPhaserGame.level}
                                    onComplete={handlePhaserComplete}
                                    onClose={() => setShowPhaserGame(null)}
                                />
                            )}
                            {showPhaserGame.gameId === 'emotion_mirror' && (
                                <EmotionMirror
                                    level={showPhaserGame.level}
                                    onComplete={handlePhaserComplete}
                                    onClose={() => setShowPhaserGame(null)}
                                />
                            )}
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Session Replay Overlay */}
            {showReplay && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl">
                        <SessionReplayViewer
                            sessionId={showReplay}
                            onClose={() => setShowReplay(null)}
                        />
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500">
                        <strong>Therapy Games.</strong> These games are designed to support development, not diagnose conditions. Game performance data feeds into your clinician's analytics dashboard for holistic progress tracking.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GameHub;
