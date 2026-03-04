import React, { useState, useEffect } from 'react';
import {
    Brain, Heart, Sparkles, Clock, ChevronDown, ChevronRight,
    CheckCircle2, Circle, AlertTriangle, Info, RefreshCw,
    Target, Users, Palette, MessageCircle, Play, Award,
    Lightbulb, BookOpen, ArrowRight, Loader, CalendarDays
} from 'lucide-react';
import VisualSchedule from '../components/VisualSchedule';

import API from '../config/api.js';

// Priority badge colors
const priorityColors = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const domainColors = {
    'Social Communication': 'from-blue-500 to-blue-600',
    'Joint Attention Training': 'from-purple-500 to-purple-600',
    'Early Communication': 'from-teal-500 to-teal-600',
    'Play & Imagination': 'from-amber-500 to-amber-600',
    social_communication: 'from-blue-500 to-blue-600',
    joint_attention: 'from-purple-500 to-purple-600',
    sensory_regulation: 'from-teal-500 to-teal-600',
    communication: 'from-amber-500 to-amber-600',
    parent_mediated: 'from-emerald-500 to-emerald-600',
    play_skills: 'from-pink-500 to-pink-600'
};

const domainIcons = {
    'Social Communication': Users,
    'Joint Attention Training': Target,
    'Early Communication': MessageCircle,
    'Play & Imagination': Play,
    social_communication: Users,
    joint_attention: Target,
    sensory_regulation: Heart,
    communication: MessageCircle,
    parent_mediated: Users,
    play_skills: Play
};

const Therapy = () => {
    const [todayData, setTodayData] = useState(null);
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('today'); // 'today' | 'full' | 'schedule'
    const [screeningDate, setScreeningDate] = useState(null);
    const [expandedDomains, setExpandedDomains] = useState({});
    const [completedTasks, setCompletedTasks] = useState({});
    const [showExplanation, setShowExplanation] = useState(false);
    const [completingTask, setCompletingTask] = useState(null);

    useEffect(() => {
        fetchBothPlans();
    }, []);

    const fetchBothPlans = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch today's tasks from v3.0 API
            const todayRes = await fetch(`${API}/therapy/today/1`);
            if (todayRes.ok) {
                const data = await todayRes.json();
                setTodayData(data);
            }

            // Also fetch full therapy plan for "full plan" view
            try {
                const planRes = await fetch(`${API}/api/therapy-plan`);
                if (planRes.ok) {
                    const planData = await planRes.json();
                    setPlan(planData.plan);
                    setScreeningDate(planData.screeningDate);
                    // Auto-expand high priority
                    const expanded = {};
                    planData.plan.domains.forEach(domain => {
                        if (domain.priority === 'High') expanded[domain.id] = true;
                    });
                    setExpandedDomains(expanded);
                }
            } catch (e) {
                console.error('Full plan fetch:', e);
            }
        } catch (err) {
            setError(err.message);
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
                body: JSON.stringify({ task_id: taskId, duration_minutes: durationMinutes || 5 })
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

    const toggleDomain = (domainId) => {
        setExpandedDomains(prev => ({
            ...prev,
            [domainId]: !prev[domainId]
        }));
    };

    const toggleTask = (domainId, taskId) => {
        setCompletedTasks(prev => ({
            ...prev,
            [`${domainId}-${taskId}`]: !prev[`${domainId}-${taskId}`]
        }));
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading your therapy plan...</p>
                </div>
            </div>
        );
    }

    if (error && !todayData) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">No Screening Data</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <a href="/screening" className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors">
                        <Brain className="w-5 h-5" />
                        Start AI Screening
                    </a>
                </div>
            </div>
        );
    }

    const summary = todayData?.completionSummary;
    const completionPct = summary?.completionPercent || 0;

    // Group tasks by domain for today view
    const groupByDomain = (tasks) => {
        const groups = {};
        tasks.forEach(task => {
            const domain = task.domain || 'General';
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(task);
        });
        return groups;
    };

    const domainGroups = todayData?.tasks ? groupByDomain(todayData.tasks) : {};

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 border-b border-slate-200 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Therapy Plan</h1>
                            <p className="text-slate-500 text-sm">
                                {screeningDate ? `Based on screening from ${screeningDate}` : 'Personalized activities for your child'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="bg-slate-100 rounded-lg p-1 flex">
                        <button
                            onClick={() => setMode('today')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'today' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Today's Tasks
                        </button>
                        <button
                            onClick={() => setMode('full')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'full' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Full Plan
                        </button>
                        <button
                            onClick={() => setMode('schedule')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'schedule' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Schedule
                        </button>
                    </div>
                    <button onClick={fetchBothPlans} className="flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ===== TODAY'S TASKS VIEW ===== */}
            {mode === 'today' && todayData && (
                <>
                    {/* Daily Insight */}
                    {todayData.dailyInsight && (
                        <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100 rounded-2xl p-5">
                            <div className="flex items-start gap-3">
                                <Lightbulb className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-primary-800 text-sm mb-0.5">Today's Insight</h3>
                                    <p className="text-primary-700 text-sm">{todayData.dailyInsight}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-white">
                            <Clock className="w-8 h-8 mb-3 opacity-80" />
                            <p className="text-primary-100 text-sm">Today's Time Target</p>
                            <p className="text-3xl font-bold">{summary?.totalMinutes || 0} min</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <Target className="w-8 h-8 text-emerald-500" />
                                <span className="text-2xl font-bold text-slate-900">{completionPct}%</span>
                            </div>
                            <p className="text-slate-600 text-sm">Today's Completion</p>
                            <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${completionPct}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{summary?.completed || 0} of {summary?.total || 0} tasks</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <Brain className="w-8 h-8 text-purple-500 mb-3" />
                            <p className="text-slate-600 text-sm mb-1">Domains Active</p>
                            <p className="text-2xl font-bold text-slate-900">{Object.keys(domainGroups).length}</p>
                            <p className="text-xs text-slate-400 mt-1">{Object.keys(domainGroups).join(', ')}</p>
                        </div>
                    </div>

                    {/* Task List by Domain */}
                    <div className="space-y-4">
                        {Object.entries(domainGroups).map(([domain, tasks]) => {
                            const IconComponent = domainIcons[domain] || Brain;
                            const gradientClass = domainColors[domain] || 'from-slate-500 to-slate-600';
                            const completedCount = tasks.filter(t => t.status === 'completed').length;
                            const domainPct = Math.round((completedCount / tasks.length) * 100);

                            return (
                                <div key={domain} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Domain Header */}
                                    <div className="flex items-center gap-4 p-5">
                                        <div className={`w-12 h-12 bg-gradient-to-br ${gradientClass} rounded-xl flex items-center justify-center shrink-0`}>
                                            <IconComponent className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-slate-900">{domain}</h3>
                                            <p className="text-sm text-slate-500">{completedCount}/{tasks.length} completed</p>
                                        </div>
                                        <div className="w-16">
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${domainPct}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tasks */}
                                    <div className="divide-y divide-slate-50 border-t border-slate-100">
                                        {tasks.map((task) => {
                                            const isCompleted = task.status === 'completed';
                                            const isLoading = completingTask === task.task_id;

                                            return (
                                                <div
                                                    key={task.task_id}
                                                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${isCompleted ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <button
                                                        onClick={() => !isCompleted && completeTask(task.task_id, task.duration_minutes)}
                                                        disabled={isCompleted || isLoading}
                                                        className="mt-0.5 shrink-0 transition-transform hover:scale-110"
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
                                                        <p className={`font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                            {task.task_name}
                                                        </p>
                                                        <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        {task.priority && (
                                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority] || ''}`}>
                                                                {task.priority}
                                                            </span>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm text-slate-500">{task.duration_minutes}m</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ===== FULL PLAN VIEW ===== */}
            {mode === 'full' && plan && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-white">
                            <Clock className="w-8 h-8 mb-3 opacity-80" />
                            <p className="text-primary-100 text-sm">Recommended Daily Time</p>
                            <p className="text-3xl font-bold">{plan.total_daily_minutes} min</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <Brain className="w-8 h-8 text-purple-500 mb-3" />
                            <p className="text-slate-600 text-sm mb-2">Input Metrics</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-50 rounded-lg px-2 py-1">
                                    <span className="text-slate-500">Attention:</span>
                                    <span className="font-semibold text-slate-700 ml-1">{plan.inputMetrics.attention}%</span>
                                </div>
                                <div className="bg-slate-50 rounded-lg px-2 py-1">
                                    <span className="text-slate-500">Risk:</span>
                                    <span className={`font-semibold ml-1 ${plan.inputMetrics.overallRisk === 'High' ? 'text-red-600' :
                                        (plan.inputMetrics.overallRisk === 'Medium' || plan.inputMetrics.overallRisk === 'Moderate') ? 'text-amber-600' : 'text-emerald-600'
                                        }`}>{plan.inputMetrics.overallRisk}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <Target className="w-8 h-8 text-emerald-500 mb-3" />
                            <p className="text-slate-600 text-sm mb-1">Active Domains</p>
                            <p className="text-2xl font-bold text-slate-900">{plan.domains.length}</p>
                        </div>
                    </div>

                    {/* Why This Plan */}
                    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <button
                            onClick={() => setShowExplanation(!showExplanation)}
                            className="w-full flex items-center justify-between p-5 hover:bg-white/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                <span className="font-semibold text-slate-800">Why This Plan?</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">AI Explanation</span>
                            </div>
                            {showExplanation ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                        </button>

                        {showExplanation && (
                            <div className="px-5 pb-5 border-t border-slate-200">
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line mt-4">{plan.explanation}</p>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {plan.frameworks.map((fw, idx) => (
                                        <span key={idx} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full">{fw}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Domain Cards */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary-500" />
                            Therapy Domains
                            <span className="text-sm font-normal text-slate-500">({plan.domains.length} active)</span>
                        </h2>

                        {plan.domains.map((domain) => {
                            const IconComponent = domainIcons[domain.id] || Brain;
                            const isExpanded = expandedDomains[domain.id];
                            const domainCompletedCount = domain.tasks.filter(t =>
                                completedTasks[`${domain.id}-${t.id}`]
                            ).length;

                            return (
                                <div key={domain.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                                    <button
                                        onClick={() => toggleDomain(domain.id)}
                                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className={`w-12 h-12 bg-gradient-to-br ${domainColors[domain.color] || 'from-slate-500 to-slate-600'} rounded-xl flex items-center justify-center shrink-0`}>
                                            <IconComponent className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-slate-900">{domain.name}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[domain.priority]}`}>
                                                    {domain.priority} Priority
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 truncate">{domain.framework}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-slate-700">{domainCompletedCount}/{domain.tasks.length}</p>
                                                <p className="text-xs text-slate-500">tasks</p>
                                            </div>
                                            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-slate-100">
                                            <div className="px-5 py-3 bg-slate-50/50">
                                                <p className="text-sm text-slate-600">
                                                    <span className="font-medium">Rationale:</span> {domain.reason}
                                                </p>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {domain.tasks.map((task) => {
                                                    const taskKey = `${domain.id}-${task.id}`;
                                                    const isCompleted = completedTasks[taskKey];
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`flex items-start gap-3 px-5 py-4 transition-colors ${isCompleted ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                                                        >
                                                            <button onClick={() => toggleTask(domain.id, task.id)} className="mt-0.5 shrink-0">
                                                                {isCompleted ? (
                                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                                ) : (
                                                                    <Circle className="w-5 h-5 text-slate-300 hover:text-primary-400 transition-colors" />
                                                                )}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</p>
                                                                <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <Clock className="w-4 h-4 text-slate-400" />
                                                                <span className="text-sm text-slate-500">{task.duration}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ===== VISUAL SCHEDULE VIEW ===== */}
            {mode === 'schedule' && (
                <VisualSchedule />
            )}

            {/* No data */}
            {mode === 'full' && !plan && (
                <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
                    <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-600 mb-2">No Full Plan Available</h3>
                    <p className="text-slate-400 text-sm mb-4">Complete an AI screening to generate a comprehensive therapy plan.</p>
                    <a href="/screening" className="text-primary-600 font-medium hover:text-primary-700">Start Screening →</a>
                </div>
            )}

            {/* Celebration Modal */}
            {completionPct === 100 && mode === 'today' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-2xl">
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Award className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Amazing Work! 🎉</h2>
                        <p className="text-slate-600 mb-6">
                            You've completed all therapy activities for today. Consistency is key to progress!
                        </p>
                        <button
                            onClick={() => setMode('full')}
                            className="bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors"
                        >
                            View Full Plan
                        </button>
                    </div>
                </div>
            )}

            {/* Footer Note */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-start gap-4">
                    <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-600">
                        <p className="font-medium text-slate-700 mb-1">Important Notice</p>
                        <p>
                            This plan is generated by NeuroBridge AI as a decision-support tool. It is not a diagnostic
                            instrument or replacement for professional clinical evaluation. Always consult with qualified
                            healthcare providers before implementing therapy interventions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Therapy;
