import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, AlertTriangle, ShieldCheck, AlertCircle, Calendar, TrendingDown, Info, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import API from '../config/api.js';

const Progress = () => {
    const [progressData, setProgressData] = useState([]);
    const [trends, setTrends] = useState(null);
    const [outcome, setOutcome] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const res = await fetch(`${API}/api/progress`);
                if (res.ok) {
                    const json = await res.json();
                    setProgressData(json.data || []);
                    setTrends(json.trends || null);
                } else {
                    setProgressData([]);
                }
            } catch (e) {
                console.error('Progress fetch error:', e);
                setProgressData([]);
            }

            // Also fetch outcome data from v3.0 API
            try {
                const outcomeRes = await fetch(`${API}/patient/outcome/1`);
                if (outcomeRes.ok) {
                    const data = await outcomeRes.json();
                    if (data.success) setOutcome(data.outcome);
                }
            } catch (e) { /* ok */ }

            setLoading(false);
        };
        fetchProgress();
    }, []);

    // Compute summary stats
    const latestSession = progressData.length > 0 ? progressData[progressData.length - 1] : null;
    const prevSession = progressData.length > 1 ? progressData[progressData.length - 2] : null;

    const riskDelta = latestSession && prevSession
        ? latestSession.riskScore - prevSession.riskScore
        : null;

    const avgRisk = progressData.length > 0
        ? Math.round(progressData.reduce((a, b) => a + (b.riskScore || 0), 0) / progressData.length)
        : null;

    // Chart data
    const chartData = progressData.map(p => ({
        date: p.date,
        riskScore: p.riskScore || 0,
        attention: p.attention || 0,
        motor: p.motor || 0,
        visionRisk: p.visionRisk || 0,
        engagement: p.engagement || null,
        facePresence: p.facePresence || null,
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Developmental Progress</h1>
                    <p className="text-slate-500">Longitudinal tracking across sessions</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{progressData.length} sessions recorded</span>
                </div>
            </div>

            {/* Outcome Measurement Cards */}
            {outcome && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl">
                        <TrendingUp className="w-7 h-7 opacity-80 mb-2" />
                        <p className="text-emerald-100 text-xs uppercase font-bold">Improvement</p>
                        <p className="text-3xl font-bold mt-1">{outcome.improvement_score > 0 ? '+' : ''}{outcome.improvement_score}</p>
                        <p className="text-xs text-emerald-200 mt-1">Baseline: {outcome.baseline_risk} → {outcome.current_risk}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 uppercase font-bold">Therapy Effectiveness</p>
                        <p className="text-3xl font-bold text-violet-600 mt-2">{outcome.therapy_effectiveness ?? '—'}%</p>
                        <p className="text-xs text-slate-400 mt-1">{outcome.effective_modules} of {outcome.therapy_modules_tried} modules</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 uppercase font-bold">Engagement Change</p>
                        <p className={`text-3xl font-bold mt-2 ${outcome.engagement_change > 0 ? 'text-emerald-600' : outcome.engagement_change < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {outcome.engagement_change > 0 ? '+' : ''}{outcome.engagement_change}%
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{outcome.total_sessions} sessions tracked</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 uppercase font-bold">30-Day Forecast</p>
                        <p className={`text-3xl font-bold mt-2 ${outcome.predicted_risk_30d > 70 ? 'text-red-600' : outcome.predicted_risk_30d > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {outcome.predicted_risk_30d != null ? Math.round(outcome.predicted_risk_30d) : '—'}/100
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{outcome.regression_flag ? '⚠ Regression flagged' : 'Stable'}</p>
                    </div>
                </div>
            )}
            {/* Regression Alert */}
            {trends?.regressionWarning && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <TrendingDown className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-red-900 text-sm">⚠️ Developmental Regression Detected</h3>
                        <p className="text-sm text-red-700 mt-1">{trends.regressionWarning}</p>
                        {trends.regression?.recommendation && (
                            <p className="text-xs text-red-600 mt-2">{trends.regression.recommendation}</p>
                        )}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center p-20 text-slate-500">
                    <Activity className="w-6 h-6 animate-spin mr-3" /> Loading Progress Data...
                </div>
            ) : progressData.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-sm">
                    <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-600 mb-2">No sessions recorded yet</h3>
                    <p className="text-slate-400 text-sm">Complete your first AI screening to start tracking progress.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Latest Risk</span>
                                {latestSession?.triageColor && (
                                    <span className={`w-3 h-3 rounded-full ${latestSession.triageColor === 'red' ? 'bg-red-500' :
                                        latestSession.triageColor === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`} />
                                )}
                            </div>
                            <div className={`text-3xl font-bold ${(latestSession?.riskScore || 0) > 70 ? 'text-red-600' :
                                (latestSession?.riskScore || 0) > 40 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                {latestSession?.riskScore ?? '—'}
                                <span className="text-sm text-slate-400 font-normal ml-1">/100</span>
                            </div>
                            {riskDelta !== null && (
                                <div className={`text-sm mt-1 flex items-center gap-1 ${riskDelta < 0 ? 'text-emerald-600' : riskDelta > 0 ? 'text-red-600' : 'text-slate-400'
                                    }`}>
                                    {riskDelta < 0 ? <TrendingUp className="w-3 h-3 rotate-180" /> : riskDelta > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                                    {riskDelta > 0 ? '+' : ''}{riskDelta} from previous
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-xs text-slate-500 uppercase font-bold">Avg Risk</span>
                            <div className="text-3xl font-bold text-slate-800 mt-2">
                                {avgRisk ?? '—'}
                                <span className="text-sm text-slate-400 font-normal ml-1">/100</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Across {progressData.length} sessions</p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-xs text-slate-500 uppercase font-bold">Attention Trend</span>
                            <div className="text-3xl font-bold mt-2">
                                {trends?.attentionTrend === 'improving' ? (
                                    <span className="text-emerald-600">↗ Improving</span>
                                ) : trends?.attentionTrend === 'declining' ? (
                                    <span className="text-red-600">↘ Declining</span>
                                ) : (
                                    <span className="text-slate-600">→ Stable</span>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="text-xs text-slate-500 uppercase font-bold">Session Quality</span>
                            <div className="mt-2 flex items-center gap-2">
                                {latestSession?.qualityLabel === 'High' ? (
                                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                ) : latestSession?.qualityLabel === 'Low' ? (
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                ) : (
                                    <AlertCircle className="w-6 h-6 text-amber-600" />
                                )}
                                <span className={`text-xl font-bold ${latestSession?.qualityLabel === 'High' ? 'text-emerald-600' :
                                    latestSession?.qualityLabel === 'Low' ? 'text-red-600' : 'text-amber-600'
                                    }`}>
                                    {latestSession?.qualityLabel || 'N/A'}
                                </span>
                            </div>
                            {!latestSession?.isReliable && (
                                <p className="text-[10px] text-red-500 mt-1">Latest session may be unreliable</p>
                            )}
                        </div>
                    </div>

                    {/* Main Chart — Risk Score Over Time */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary-600" />
                            Risk Score Over Time
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Lower is better. Score represents combined developmental risk.</p>

                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        borderColor: '#334155',
                                        color: '#f8fafc',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Area type="monotone" dataKey="riskScore" name="Overall Risk" stroke="#ef4444" fill="url(#colorRisk)" fillOpacity={1} strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} />
                                <Area type="monotone" dataKey="attention" name="Attention" stroke="#3b82f6" fill="url(#colorAttention)" fillOpacity={1} strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
                                <Area type="monotone" dataKey="motor" name="Motor Variance" stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                                <Area type="monotone" dataKey="visionRisk" name="Vision Risk" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* V2 Engagement & Face Presence Chart */}
                    {chartData.some(d => d.engagement !== null) && (
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-violet-600" />
                                Engagement & Face Presence Trends
                            </h3>
                            <p className="text-xs text-slate-400 mb-4">V2 metrics: sustained engagement and face detection quality.</p>

                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontSize: '12px' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="engagement" name="Engagement %" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} connectNulls />
                                    <Line type="monotone" dataKey="facePresence" name="Face Presence %" stroke="#14b8a6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#14b8a6' }} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Session Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900">Session History</h3>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="p-3 font-semibold">Date</th>
                                    <th className="p-3 font-semibold">Risk</th>
                                    <th className="p-3 font-semibold">Triage</th>
                                    <th className="p-3 font-semibold">Attention</th>
                                    <th className="p-3 font-semibold">Quality</th>
                                    <th className="p-3 font-semibold">Mode</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {[...progressData].reverse().map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-700">{s.date}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                                                s.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {s.riskLevel || '—'} ({s.riskScore || 0})
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {s.triageColor ? (
                                                <div className={`w-3 h-3 rounded-full inline-block ${s.triageColor === 'red' ? 'bg-red-500' :
                                                    s.triageColor === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`} />
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="p-3 font-mono text-slate-600">{s.attention || '—'}%</td>
                                        <td className="p-3">
                                            <span className={`text-xs font-bold ${s.qualityLabel === 'High' ? 'text-emerald-600' :
                                                s.qualityLabel === 'Low' ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                {s.qualityLabel || '—'}
                                            </span>
                                            {s.isReliable === false && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${s.fusionMode?.includes('v') ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {s.fusionMode || 'v1'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-500">
                                Progress tracking is for informational purposes. Developmental trajectories vary significantly across individuals. Consult a healthcare provider for clinical interpretation.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Progress;
