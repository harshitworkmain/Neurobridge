import React, { useState, useEffect } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Clock, Target, Zap,
    TrendingUp, BarChart3, Eye, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';

import API from '../config/api.js';

/**
 * Game Session Replay Viewer (B1)
 * Visualizes a game session's event timeline, metrics, and behavioral data.
 * Shows a timeline scrubber with events plotted along it, plus aggregate stats.
 */
const SessionReplayViewer = ({ sessionId, onClose }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [expandedEvent, setExpandedEvent] = useState(null);

    useEffect(() => {
        loadSession();
    }, [sessionId]);

    // Playback timer
    useEffect(() => {
        if (!isPlaying || !session) return;
        const interval = setInterval(() => {
            setCurrentTime(prev => {
                const next = prev + (100 * playbackSpeed) / 1000;
                if (next >= (session.duration_seconds || 60)) {
                    setIsPlaying(false);
                    return session.duration_seconds || 60;
                }
                return next;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, session]);

    const loadSession = async () => {
        try {
            const res = await fetch(`${API}/games/sessions/1?limit=50`);
            if (res.ok) {
                const data = await res.json();
                // Find the specific session or use the latest
                const s = data.sessions?.find(s => s.id === sessionId) || data.sessions?.[0];
                if (s) {
                    // Parse JSON fields
                    s.events = parseJson(s.raw_events_json, generateSampleEvents(s));
                    s.gazeMetrics = parseJson(s.gaze_metrics_json, generateSampleGaze(s));
                    s.caregiverNotes = parseJson(s.caregiver_notes_json, null);
                    setSession(s);
                }
            }
        } catch (e) {
            console.error('Load session error:', e);
        } finally {
            setLoading(false);
        }
    };

    const parseJson = (str, fallback) => {
        if (!str) return fallback;
        try { return JSON.parse(str); } catch { return fallback; }
    };

    // Generate sample events for visualization when no raw_events exist
    const generateSampleEvents = (s) => {
        const duration = s?.duration_seconds || 60;
        const events = [];
        const types = ['card_flip', 'match_found', 'match_miss', 'hint_used', 'level_up'];
        const count = Math.floor(duration / 3);
        for (let i = 0; i < count; i++) {
            const t = (i / count) * duration;
            const type = types[Math.floor(Math.random() * types.length)];
            events.push({
                time: parseFloat(t.toFixed(1)),
                type,
                detail: type === 'match_found' ? '🎉 Pair matched!' :
                    type === 'match_miss' ? '❌ No match' :
                        type === 'card_flip' ? '🃏 Card flipped' :
                            type === 'hint_used' ? '💡 Hint used' :
                                '⬆️ Level up!'
            });
        }
        return events;
    };

    const generateSampleGaze = (s) => {
        const duration = s?.duration_seconds || 60;
        const points = [];
        for (let t = 0; t < duration; t += 2) {
            points.push({
                time: t,
                focus_score: 0.4 + Math.random() * 0.5,
                x: 0.3 + Math.random() * 0.4,
                y: 0.3 + Math.random() * 0.4
            });
        }
        return points;
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const getEventColor = (type) => {
        const colors = {
            card_flip: 'bg-sky-500',
            match_found: 'bg-emerald-500',
            match_miss: 'bg-red-400',
            hint_used: 'bg-amber-400',
            level_up: 'bg-violet-500'
        };
        return colors[type] || 'bg-slate-400';
    };

    const getEventIcon = (type) => {
        const icons = {
            card_flip: '🃏',
            match_found: '✅',
            match_miss: '❌',
            hint_used: '💡',
            level_up: '⬆️'
        };
        return icons[type] || '•';
    };

    if (loading) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading session data...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No session data available</p>
                <button onClick={onClose} className="mt-4 text-primary-400 text-sm hover:underline">Close</button>
            </div>
        );
    }

    const duration = session.duration_seconds || 60;
    const events = session.events || [];
    const gazeData = session.gazeMetrics || [];
    const progressPct = (currentTime / duration) * 100;

    // Events up to current time
    const visibleEvents = events.filter(e => e.time <= currentTime);
    const currentGaze = gazeData.find(g => g.time <= currentTime && (g.time + 2) > currentTime);

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary-400" />
                        Session Replay
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {session.game_id} — Level {session.level || '?'} — {new Date(session.started_at).toLocaleDateString()}
                    </p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-lg transition-colors">✕</button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-700/50">
                {[
                    { label: 'Accuracy', value: `${(session.accuracy_score || 0).toFixed(0)}%`, icon: Target, color: 'text-emerald-400' },
                    { label: 'Duration', value: formatTime(duration), icon: Clock, color: 'text-sky-400' },
                    { label: 'Avg Response', value: `${(session.avg_response_time_ms || 0).toFixed(0)}ms`, icon: Zap, color: 'text-amber-400' },
                    { label: 'Engagement', value: `${((session.engagement_score || 0) * 10).toFixed(1)}/10`, icon: TrendingUp, color: 'text-violet-400' },
                ].map(stat => (
                    <div key={stat.label} className="text-center bg-slate-800/50 rounded-lg p-3">
                        <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                        <p className="text-lg font-bold text-white">{stat.value}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Timeline Visualization */}
            <div className="p-4">
                {/* Gaze focus graph */}
                <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Attention Focus Over Time
                    </p>
                    <div className="relative h-16 bg-slate-800 rounded-lg overflow-hidden">
                        {/* Gaze focus bars */}
                        {gazeData.map((g, i) => {
                            const left = (g.time / duration) * 100;
                            const width = (2 / duration) * 100;
                            const height = g.focus_score * 100;
                            return (
                                <div
                                    key={i}
                                    className="absolute bottom-0 transition-opacity"
                                    style={{
                                        left: `${left}%`,
                                        width: `${Math.max(width, 1)}%`,
                                        height: `${height}%`,
                                        backgroundColor: g.focus_score > 0.7 ? '#34d399' : g.focus_score > 0.4 ? '#fbbf24' : '#f87171',
                                        opacity: g.time <= currentTime ? 1 : 0.15
                                    }}
                                />
                            );
                        })}
                        {/* Playhead */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white z-10 transition-all"
                            style={{ left: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* Event dots on timeline */}
                <div className="relative h-8 bg-slate-800 rounded-lg mb-2">
                    {events.map((e, i) => (
                        <div
                            key={i}
                            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${getEventColor(e.type)} cursor-pointer transition-all hover:scale-150`}
                            style={{ left: `${(e.time / duration) * 100}%`, opacity: e.time <= currentTime ? 1 : 0.2 }}
                            title={`${formatTime(e.time)}: ${e.detail}`}
                            onClick={() => {
                                setCurrentTime(e.time);
                                setExpandedEvent(expandedEvent === i ? null : i);
                            }}
                        />
                    ))}
                    {/* Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary-400 z-10"
                        style={{ left: `${progressPct}%` }}
                    />
                </div>

                {/* Scrubber */}
                <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={currentTime}
                    onChange={e => setCurrentTime(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary-400 [&::-webkit-slider-thumb]:rounded-full"
                />

                {/* Controls */}
                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500 font-mono">{formatTime(currentTime)}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentTime(Math.max(0, currentTime - 5))} className="text-slate-400 hover:text-white p-1 transition-colors">
                            <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-full transition-colors"
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))} className="text-slate-400 hover:text-white p-1 transition-colors">
                            <SkipForward className="w-4 h-4" />
                        </button>
                        <select
                            value={playbackSpeed}
                            onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="bg-slate-800 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600"
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={4}>4x</option>
                        </select>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Event Log */}
            <div className="border-t border-slate-700 max-h-48 overflow-y-auto">
                <div className="px-4 py-2 bg-slate-800/50 sticky top-0">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> Event Log ({visibleEvents.length}/{events.length})
                    </p>
                </div>
                {visibleEvents.length === 0 ? (
                    <p className="text-center text-slate-600 text-xs py-4">Play timeline to see events</p>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {visibleEvents.slice(-10).reverse().map((e, i) => (
                            <div key={i} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
                                <span className="text-sm">{getEventIcon(e.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-300 truncate">{e.detail}</p>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">{formatTime(e.time)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Caregiver Notes */}
            {session.caregiverNotes && (
                <div className="border-t border-slate-700 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-400 mb-1">📝 Caregiver Notes</p>
                    <p className="text-sm text-slate-300">{typeof session.caregiverNotes === 'string' ? session.caregiverNotes : JSON.stringify(session.caregiverNotes)}</p>
                </div>
            )}
        </div>
    );
};

export default SessionReplayViewer;
