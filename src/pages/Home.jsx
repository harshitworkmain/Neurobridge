import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Play, TrendingUp, Calendar, ArrowRight, CheckCircle2, Loader,
    Clock, Target, Sparkles, Circle, AlertTriangle, Brain, Heart,
    Lightbulb, Award, RefreshCw, ChevronRight, Download, Bell,
    Flame, Gamepad2
} from 'lucide-react';

import API from '../config/api.js';

const Home = () => {
    const [user, setUser] = useState(null);
    const [todayData, setTodayData] = useState(null);
    const [outcome, setOutcome] = useState(null);
    const [loading, setLoading] = useState(true);
    const [completingTask, setCompletingTask] = useState(null);
    const [digest, setDigest] = useState(null);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            // Fetch user data
            const userRes = await fetch(`${API}/api/user`);
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData);
            } else {
                setUser({ id: 1, name: 'Alex', age_string: '3 years, 2 months', lastScreeningDate: 'Never' });
            }

            // Fetch today's therapy tasks
            const todayRes = await fetch(`${API}/therapy/today/1`);
            if (todayRes.ok) {
                const data = await todayRes.json();
                setTodayData(data);
            }

            // Fetch outcome data
            const outcomeRes = await fetch(`${API}/patient/outcome/1`);
            if (outcomeRes.ok) {
                const data = await outcomeRes.json();
                if (data.success) setOutcome(data.outcome);
            }
            // Fetch weekly digest
            const digestRes = await fetch(`${API}/digest/weekly/1`);
            if (digestRes.ok) {
                const data = await digestRes.json();
                if (data.success) setDigest(data.digest);
            }
        } catch (e) {
            console.error('Dashboard load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const completeTask = async (taskId, durationMinutes) => {
        setCompletingTask(taskId);
        try {
            const res = await fetch(`${API}/therapy/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId, duration_minutes: durationMinutes })
            });
            if (res.ok) {
                // Refresh today's data
                const todayRes = await fetch(`${API}/therapy/today/1`);
                if (todayRes.ok) {
                    setTodayData(await todayRes.json());
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCompletingTask(null);
        }
    };

    if (loading) return (
        <div className="flex h-[70vh] items-center justify-center">
            <div className="text-center">
                <Loader className="animate-spin text-primary-600 w-10 h-10 mx-auto mb-4" />
                <p className="text-slate-500">Loading your dashboard...</p>
            </div>
        </div>
    );

    const summary = todayData?.completionSummary;
    const completionPct = summary?.completionPercent || 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Welcome back, Sarah</h1>
                    <p className="text-slate-500 mt-1">Here's "{user?.name}'s" daily care overview.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">Last Screening: {user?.lastScreeningDate}</span>
                    <Link to="/screening" className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2">
                        <Play className="w-4 h-4 fill-current" />
                        Start New Screening
                    </Link>
                </div>
            </div>

            {/* Daily Insight Banner */}
            {todayData?.dailyInsight && (
                <div className="bg-gradient-to-r from-primary-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-start gap-4">
                        <div className="bg-white/20 p-2.5 rounded-xl shrink-0">
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white/90 text-sm uppercase tracking-wider mb-1">Today's Insight</h3>
                            <p className="text-lg font-medium leading-relaxed">{todayData.dailyInsight}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Today's Progress */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <Target className="w-7 h-7 text-emerald-500" />
                        <span className="text-2xl font-bold text-slate-900">{completionPct}%</span>
                    </div>
                    <p className="text-sm text-slate-600 font-medium">Today's Completion</p>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
                        <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{summary?.completed || 0} of {summary?.total || 0} tasks</p>
                </div>

                {/* Time Target */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <Clock className="w-7 h-7 text-primary-500 mb-3" />
                    <p className="text-sm text-slate-600 font-medium">Daily Time Target</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary?.totalMinutes || 0} <span className="text-sm font-normal text-slate-400">min</span></p>
                </div>

                {/* Improvement Score */}
                {outcome && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <TrendingUp className="w-7 h-7 text-violet-500 mb-3" />
                        <p className="text-sm text-slate-600 font-medium">Improvement</p>
                        <p className={`text-2xl font-bold mt-1 ${outcome.improvement_score > 0 ? 'text-emerald-600' : outcome.improvement_score < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {outcome.improvement_score > 0 ? '+' : ''}{outcome.improvement_score}
                            <span className="text-sm font-normal text-slate-400 ml-1">pts</span>
                        </p>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center gap-2.5">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
                    <Link to="/progress" className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4" /> View Progress
                    </Link>
                    <a href={`${API}/reports/patient/1`} target="_blank" rel="noopener noreferrer" className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Download Report
                    </a>
                </div>
            </div>

            {/* Today's Therapy Tasks */}
            {todayData && todayData.tasks && todayData.tasks.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Today's Therapy Activities</h2>
                                <p className="text-sm text-slate-500">{summary?.completed || 0} of {summary?.total || 0} completed • {summary?.totalMinutes || 0} min total</p>
                            </div>
                        </div>
                        <Link to="/therapy" className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1 group">
                            Full Plan <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {todayData.tasks.slice(0, 6).map((task) => {
                            const isCompleted = task.status === 'completed';
                            const isLoading = completingTask === task.task_id;

                            return (
                                <div
                                    key={task.task_id}
                                    className={`flex items-center gap-4 px-5 py-4 transition-all duration-300 ${isCompleted ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}
                                >
                                    <button
                                        onClick={() => !isCompleted && completeTask(task.task_id, task.duration_minutes)}
                                        disabled={isCompleted || isLoading}
                                        className="shrink-0 transition-transform hover:scale-110"
                                    >
                                        {isLoading ? (
                                            <Loader className="w-5 h-5 text-primary-500 animate-spin" />
                                        ) : isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-slate-300 hover:text-primary-400 transition-colors cursor-pointer" />
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                            {task.task_name}
                                        </p>
                                        <p className="text-xs text-slate-400 truncate">{task.domain} • {task.description}</p>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        {task.priority === 'High' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold uppercase">High</span>
                                        )}
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-xs">{task.duration_minutes}m</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {todayData.tasks.length > 6 && (
                        <div className="p-3 text-center border-t border-slate-100">
                            <Link to="/therapy" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                                View all {todayData.tasks.length} activities →
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Outcome Summary Cards */}
            {outcome && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
                        <Award className="w-8 h-8 mb-3 opacity-80" />
                        <p className="text-emerald-100 text-sm">Weeks Tracked</p>
                        <p className="text-3xl font-bold">{outcome.weeks_tracked}</p>
                        <p className="text-emerald-200 text-xs mt-1">{outcome.total_sessions} total sessions</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <Heart className="w-8 h-8 text-pink-500 mb-3" />
                        <p className="text-sm text-slate-600">Current Risk Level</p>
                        <p className={`text-2xl font-bold mt-1 ${outcome.risk_level === 'High' ? 'text-red-600' : outcome.risk_level === 'Moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {outcome.risk_level}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Score: {outcome.current_risk}/100 (baseline: {outcome.baseline_risk})</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <Brain className="w-8 h-8 text-violet-500 mb-3" />
                        <p className="text-sm text-slate-600">Confidence Level</p>
                        <p className={`text-2xl font-bold mt-1 ${outcome.confidence_level === 'high' ? 'text-emerald-600' : outcome.confidence_level === 'moderate' ? 'text-amber-600' : 'text-slate-600'}`}>
                            {outcome.confidence_level?.charAt(0).toUpperCase() + outcome.confidence_level?.slice(1)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Based on {outcome.total_sessions} sessions</p>
                    </div>
                </div>
            )}

            {/* Weekly Digest */}
            {digest && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                                <Flame className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Weekly Digest</h2>
                                <p className="text-xs text-slate-400">Your week at a glance</p>
                            </div>
                        </div>
                        <a
                            href={`${API}/export/1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                        >
                            <Download className="w-3.5 h-3.5" /> Export All Data
                        </a>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                        <div className="p-4 text-center">
                            <Gamepad2 className="w-5 h-5 text-primary-500 mx-auto mb-1" />
                            <p className="text-xl font-bold text-slate-900">{digest.games?.total_sessions || 0}</p>
                            <p className="text-[10px] text-slate-400 uppercase">Game Sessions</p>
                            {digest.games?.accuracy_change != null && (
                                <p className={`text-[10px] font-semibold mt-0.5 ${digest.games.accuracy_change > 0 ? 'text-emerald-600' : digest.games.accuracy_change < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {digest.games.accuracy_change > 0 ? '↑' : digest.games.accuracy_change < 0 ? '↓' : '→'} {Math.abs(digest.games.accuracy_change)}% accuracy
                                </p>
                            )}
                        </div>
                        <div className="p-4 text-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                            <p className="text-xl font-bold text-slate-900">{digest.therapy?.completed || 0}/{digest.therapy?.total_tasks || 0}</p>
                            <p className="text-[10px] text-slate-400 uppercase">Tasks Done</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{digest.therapy?.completion_rate || 0}% rate</p>
                        </div>
                        <div className="p-4 text-center">
                            <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                            <p className="text-xl font-bold text-slate-900">{digest.appointments?.upcoming || 0}</p>
                            <p className="text-[10px] text-slate-400 uppercase">Upcoming Visits</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{digest.appointments?.completed || 0} completed</p>
                        </div>
                        <div className="p-4 text-center">
                            <Brain className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                            <p className="text-xl font-bold text-slate-900">{digest.screenings?.count || 0}</p>
                            <p className="text-[10px] text-slate-400 uppercase">Screenings</p>
                            {digest.screenings?.latest && (
                                <p className="text-[10px] text-slate-400 mt-0.5">Latest: {digest.screenings.latest.risk_level}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500">
                        <strong>Screening Support Tool.</strong> This platform is designed to assist caregivers and clinicians. It is not a diagnostic instrument. All results should be reviewed by a qualified healthcare professional.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Home;
