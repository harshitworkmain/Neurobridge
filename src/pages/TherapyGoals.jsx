import React, { useState, useEffect } from 'react';
import {
    Target, Plus, X, CheckCircle2, Clock, Pause, Play, Trash2,
    ChevronRight, Flame, Star, TrendingUp, AlertTriangle, Award
} from 'lucide-react';

import API from '../config/api.js';

const DOMAINS = [
    { id: 'attention', label: 'Attention', emoji: '👁️', color: 'bg-blue-500' },
    { id: 'social', label: 'Social Skills', emoji: '🤝', color: 'bg-emerald-500' },
    { id: 'communication', label: 'Communication', emoji: '💬', color: 'bg-violet-500' },
    { id: 'motor', label: 'Motor Skills', emoji: '🏃', color: 'bg-orange-500' },
    { id: 'sensory', label: 'Sensory', emoji: '🎧', color: 'bg-pink-500' },
    { id: 'emotional', label: 'Emotional', emoji: '❤️', color: 'bg-rose-500' },
    { id: 'cognitive', label: 'Cognitive', emoji: '🧠', color: 'bg-indigo-500' },
    { id: 'general', label: 'General', emoji: '🌟', color: 'bg-slate-500' },
];

const PRIORITIES = [
    { id: 'high', label: 'High', color: 'text-red-600 bg-red-50' },
    { id: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50' },
    { id: 'low', label: 'Low', color: 'text-slate-500 bg-slate-50' },
];

const TherapyGoals = () => {
    const [goals, setGoals] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('all');
    const [newGoal, setNewGoal] = useState({
        title: '', description: '', domain: 'general', target_metric: '',
        target_value: '', priority: 'medium', due_date: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { loadGoals(); }, []);

    const loadGoals = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/goals/1`);
            if (res.ok) {
                const data = await res.json();
                setGoals(data.goals || []);
                setSummary(data.summary || null);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const createGoal = async (e) => {
        e.preventDefault();
        if (!newGoal.title.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newGoal, user_id: 1, target_value: parseFloat(newGoal.target_value) || 0 })
            });
            if (res.ok) {
                setShowCreateModal(false);
                setNewGoal({ title: '', description: '', domain: 'general', target_metric: '', target_value: '', priority: 'medium', due_date: '' });
                loadGoals();
            }
        } catch (e) { console.error(e); }
        setSubmitting(false);
    };

    const updateGoal = async (goalId, updates) => {
        try {
            const res = await fetch(`${API}/goals/${goalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) loadGoals();
        } catch (e) { console.error(e); }
    };

    const deleteGoal = async (goalId) => {
        if (!confirm('Delete this goal?')) return;
        try {
            await fetch(`${API}/goals/${goalId}`, { method: 'DELETE' });
            loadGoals();
        } catch (e) { console.error(e); }
    };

    const filteredGoals = filter === 'all' ? goals : goals.filter(g => g.status === filter);
    const getDomain = (id) => DOMAINS.find(d => d.id === id) || DOMAINS[DOMAINS.length - 1];

    if (loading) {
        return (
            <div className="animate-fade-in flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-slate-500 mt-3">Loading goals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Therapy Goals</h1>
                    <p className="text-sm text-slate-500 mt-1">Track progress toward developmental milestones</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Goal
                </button>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                        <Target className="w-6 h-6 text-primary-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
                        <p className="text-xs text-slate-400 uppercase">Total Goals</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                        <Flame className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-slate-900">{summary.active}</p>
                        <p className="text-xs text-slate-400 uppercase">Active</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-slate-900">{summary.completed}</p>
                        <p className="text-xs text-slate-400 uppercase">Completed</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                        <Award className="w-6 h-6 text-violet-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-slate-900">
                            {summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%
                        </p>
                        <p className="text-xs text-slate-400 uppercase">Success Rate</p>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'active', 'completed', 'paused'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${goals.length})` : `(${goals.filter(g => g.status === f).length})`}
                    </button>
                ))}
            </div>

            {/* Goals List */}
            {filteredGoals.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-100 shadow-sm text-center">
                    <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <h3 className="text-lg text-slate-500">No goals yet</h3>
                    <p className="text-sm text-slate-400 mt-1">Create therapy goals to track your child's progress</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="w-4 h-4 inline mr-1" /> Create First Goal
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredGoals.map(goal => {
                        const domain = getDomain(goal.domain);
                        const progress = goal.progress_pct || 0;
                        const isComplete = goal.status === 'completed';
                        const isPaused = goal.status === 'paused';

                        return (
                            <div
                                key={goal.id}
                                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isComplete ? 'border-emerald-200 bg-emerald-50/30' : isPaused ? 'border-slate-200 opacity-70' : 'border-slate-100'
                                    }`}
                            >
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Domain Icon */}
                                        <div className={`w-10 h-10 ${domain.color} rounded-xl flex items-center justify-center text-white text-lg shrink-0`}>
                                            {domain.emoji}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={`font-semibold text-slate-900 ${isComplete ? 'line-through text-slate-400' : ''}`}>
                                                    {goal.title}
                                                </h3>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${PRIORITIES.find(p => p.id === goal.priority)?.color || ''
                                                    }`}>
                                                    {goal.priority}
                                                </span>
                                                {isComplete && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase text-emerald-600 bg-emerald-100">
                                                        ✅ Complete
                                                    </span>
                                                )}
                                                {isPaused && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase text-slate-500 bg-slate-100">
                                                        ⏸ Paused
                                                    </span>
                                                )}
                                            </div>
                                            {goal.description && (
                                                <p className="text-sm text-slate-500 mt-1">{goal.description}</p>
                                            )}

                                            {/* Progress Bar */}
                                            {goal.target_value > 0 && (
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                        <span>{goal.target_metric || 'Progress'}</span>
                                                        <span>{goal.current_value}/{goal.target_value} ({progress}%)</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : progress >= 75 ? 'bg-emerald-400' : progress >= 50 ? 'bg-amber-400' : 'bg-primary-500'
                                                                }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Due date & meta */}
                                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${domain.color}`} />
                                                    {domain.label}
                                                </span>
                                                {goal.due_date && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Due {new Date(goal.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {goal.created_by_name && (
                                                    <span>Set by {goal.created_by_name}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {!isComplete && !isPaused && goal.target_value > 0 && (
                                                <button
                                                    onClick={() => updateGoal(goal.id, { current_value: Math.min(goal.target_value, goal.current_value + 1) })}
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Increment progress"
                                                >
                                                    <TrendingUp className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!isComplete && (
                                                <button
                                                    onClick={() => updateGoal(goal.id, { status: isPaused ? 'active' : 'paused' })}
                                                    className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                                                    title={isPaused ? 'Resume' : 'Pause'}
                                                >
                                                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                                </button>
                                            )}
                                            {!isComplete && (
                                                <button
                                                    onClick={() => updateGoal(goal.id, { status: 'completed' })}
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Mark complete"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteGoal(goal.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Goal Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">New Therapy Goal</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={createGoal} className="p-5 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Goal Title *</label>
                                <input
                                    type="text"
                                    value={newGoal.title}
                                    onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                                    placeholder="e.g., Maintain eye contact for 5 seconds"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
                                <textarea
                                    value={newGoal.description}
                                    onChange={e => setNewGoal({ ...newGoal, description: e.target.value })}
                                    placeholder="Additional details about this goal..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-1">Domain</label>
                                    <select
                                        value={newGoal.domain}
                                        onChange={e => setNewGoal({ ...newGoal, domain: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-1">Priority</label>
                                    <select
                                        value={newGoal.priority}
                                        onChange={e => setNewGoal({ ...newGoal, priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-1">Target Metric</label>
                                    <input
                                        type="text"
                                        value={newGoal.target_metric}
                                        onChange={e => setNewGoal({ ...newGoal, target_metric: e.target.value })}
                                        placeholder="e.g., sessions, seconds, count"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-1">Target Value</label>
                                    <input
                                        type="number"
                                        value={newGoal.target_value}
                                        onChange={e => setNewGoal({ ...newGoal, target_value: e.target.value })}
                                        placeholder="e.g., 10"
                                        min="0"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Due Date (optional)</label>
                                <input
                                    type="date"
                                    value={newGoal.due_date}
                                    onChange={e => setNewGoal({ ...newGoal, due_date: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !newGoal.title.trim()}
                                className="w-full bg-primary-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Creating...' : 'Create Goal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TherapyGoals;
