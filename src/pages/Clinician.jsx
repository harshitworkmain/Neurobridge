import React, { useState, useEffect } from 'react';
import {
    Lock, Users, ChevronRight, LogOut, Loader, AlertTriangle,
    TrendingDown, TrendingUp, Shield, Brain, Info, Activity,
    Bell, CheckCircle2, AlertCircle, Download, FileText, Eye,
    Clock, ArrowLeft, RefreshCw, XCircle, ChevronDown, Sparkles,
    BarChart3
} from 'lucide-react';

import API from '../config/api.js';

const severityConfig = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

const Clinician = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [authError, setAuthError] = useState('');

    // Dashboard
    const [view, setView] = useState('worklist'); // 'worklist' | 'detail'
    const [worklist, setWorklist] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientOutcome, setPatientOutcome] = useState(null);
    const [patientAlerts, setPatientAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [notes, setNotes] = useState('');
    const [expandedAlertIds, setExpandedAlertIds] = useState(new Set());

    const handleLogin = (e) => {
        e.preventDefault();
        if (accessCode === 'admin123') {
            setIsAuthenticated(true);
            setAuthError('');
            fetchWorklist();
        } else {
            setAuthError('Invalid Access Code');
        }
    };

    const fetchWorklist = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/clinician/worklist`);
            if (res.ok) {
                const data = await res.json();
                setWorklist(data.worklist || []);
            }
        } catch (err) {
            console.error('Worklist fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshWorklist = async () => {
        setRefreshing(true);
        await fetchWorklist();
        setRefreshing(false);
    };

    const selectPatient = async (patient) => {
        setSelectedPatient(patient);
        setView('detail');
        setLoading(true);

        try {
            // Fetch outcome
            const outcomeRes = await fetch(`${API}/patient/outcome/${patient.user_id}`);
            if (outcomeRes.ok) {
                const data = await outcomeRes.json();
                if (data.success) setPatientOutcome(data.outcome);
            }

            // Fetch alerts
            const alertsRes = await fetch(`${API}/alerts/${patient.user_id}`);
            if (alertsRes.ok) {
                const data = await alertsRes.json();
                setPatientAlerts(data.alerts || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const resolveAlert = async (alertId) => {
        try {
            await fetch(`${API}/alerts/${alertId}/resolve`, { method: 'POST' });
            setPatientAlerts(prev => prev.filter(a => a.id !== alertId));
            // Refresh worklist counts
            fetchWorklist();
        } catch (e) {
            console.error(e);
        }
    };

    const resolveAllAlerts = async (userId) => {
        try {
            await fetch(`${API}/alerts/user/${userId}/resolve-all`, { method: 'POST' });
            setPatientAlerts([]);
            fetchWorklist();
        } catch (e) {
            console.error(e);
        }
    };

    const goBack = () => {
        setView('worklist');
        setSelectedPatient(null);
        setPatientOutcome(null);
        setPatientAlerts([]);
        setNotes('');
        fetchWorklist();
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setAccessCode('');
        setView('worklist');
        setSelectedPatient(null);
    };

    // --- LOGIN VIEW ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 w-full max-w-md">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-primary-50 rounded-full text-primary-600">
                            <Lock className="w-8 h-8" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Clinician Access</h2>
                    <p className="text-center text-slate-500 mb-6">Restricted area for authorized providers only.</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Access Code</label>
                            <input
                                type="password"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                placeholder="Enter code (Hint: admin123)"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                            />
                        </div>
                        {authError && <p className="text-red-500 text-sm text-center font-medium">{authError}</p>}
                        <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
                            Secure Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- WORKLIST VIEW ---
    if (view === 'worklist') {
        const highAlerts = worklist.filter(p => p.highest_severity === 'high');
        const mediumAlerts = worklist.filter(p => p.highest_severity === 'medium');
        const normalPatients = worklist.filter(p => p.highest_severity === 'none' || p.highest_severity === 'low');

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Clinician Worklist</h1>
                        <p className="text-slate-500">Priority-sorted patient management • {worklist.length} patients</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refreshWorklist}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors text-sm font-medium">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>

                {/* Alert Summary Banner */}
                {(highAlerts.length > 0 || mediumAlerts.length > 0) && (
                    <div className="bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl p-5 border border-red-100">
                        <div className="flex items-center gap-3 mb-3">
                            <Bell className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-slate-800">Active Alerts</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {highAlerts.length > 0 && (
                                <span className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    {highAlerts.length} High Priority
                                </span>
                            )}
                            {mediumAlerts.length > 0 && (
                                <span className="flex items-center gap-2 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    {mediumAlerts.length} Medium Priority
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center p-12"><Loader className="animate-spin text-primary-600" /></div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Priority</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Patient</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Risk</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Trend</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Alerts</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Improvement</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Last Session</th>
                                    <th className="p-4 font-semibold text-slate-600 text-sm">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {worklist.map((p) => (
                                    <tr key={p.user_id} className="hover:bg-slate-50/70 transition-colors group">
                                        {/* Severity indicator */}
                                        <td className="p-4">
                                            {p.highest_severity !== 'none' ? (
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${severityConfig[p.highest_severity]?.badge || 'bg-slate-100 text-slate-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${severityConfig[p.highest_severity]?.dot || 'bg-slate-400'} ${p.highest_severity === 'high' ? 'animate-pulse' : ''}`} />
                                                    {p.highest_severity}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600">
                                                    <CheckCircle2 className="w-3 h-3" /> OK
                                                </span>
                                            )}
                                        </td>

                                        {/* Patient name */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {p.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-slate-900">{p.name}</span>
                                                    <p className="text-xs text-slate-400">{p.age || '—'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Risk */}
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.risk_level === 'High' ? 'bg-red-100 text-red-700' :
                                                p.risk_level === 'Low' ? 'bg-emerald-100 text-emerald-700' :
                                                    p.risk_level === 'Moderate' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-500'
                                                }`}>
                                                {p.current_risk != null ? `${p.risk_level} (${Math.round(p.current_risk)})` : p.risk_level}
                                            </span>
                                        </td>

                                        {/* Trend */}
                                        <td className="p-4">
                                            <span className={`flex items-center gap-1 text-sm font-medium ${p.trend_direction === 'improving' ? 'text-emerald-600' :
                                                p.trend_direction === 'worsening' ? 'text-red-600' : 'text-slate-400'
                                                }`}>
                                                {p.trend_direction === 'improving' && <TrendingDown className="w-4 h-4" />}
                                                {p.trend_direction === 'worsening' && <TrendingUp className="w-4 h-4" />}
                                                {p.trend_direction === 'stable' && <Activity className="w-4 h-4" />}
                                                {p.trend_direction}
                                            </span>
                                        </td>

                                        {/* Alert count */}
                                        <td className="p-4">
                                            {p.alert_count > 0 ? (
                                                <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                                                    <Bell className="w-4 h-4" />
                                                    {p.alert_count}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
                                        </td>

                                        {/* Improvement */}
                                        <td className="p-4">
                                            {p.improvement_rate != null ? (
                                                <span className={`text-sm font-mono font-semibold ${p.improvement_rate > 0 ? 'text-emerald-600' : p.improvement_rate < 0 ? 'text-red-600' : 'text-slate-400'
                                                    }`}>
                                                    {p.improvement_rate > 0 ? '+' : ''}{Math.round(p.improvement_rate)}%
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
                                        </td>

                                        {/* Last session */}
                                        <td className="p-4 text-sm text-slate-500">
                                            {p.last_session_date
                                                ? new Date(p.last_session_date).toLocaleDateString()
                                                : <span className="text-red-400 font-medium">Never</span>
                                            }
                                        </td>

                                        {/* Action */}
                                        <td className="p-4">
                                            <button
                                                onClick={() => selectPatient(p)}
                                                className="text-primary-600 font-medium text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Review <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-500">
                            <strong>Clinical Decision Support Tool.</strong> This system assists clinical judgment but does not replace formal diagnostic evaluation. All results should be interpreted alongside comprehensive clinical assessment.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- PATIENT DETAIL VIEW ---
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md">
                <button onClick={goBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to Worklist
                </button>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold">
                            {selectedPatient?.name?.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{selectedPatient?.name}</h1>
                            <p className="text-slate-400 text-sm">{selectedPatient?.age} • ID: #NB-{selectedPatient?.user_id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={`${API}/reports/patient/${selectedPatient?.user_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF Report
                        </a>
                        <a
                            href={`${API}/reports/patient/${selectedPatient?.user_id}?format=json`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            JSON
                        </a>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader className="animate-spin text-primary-600" /></div>
            ) : (
                <>
                    {/* Active Alerts */}
                    {patientAlerts.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-red-500" />
                                    Active Alerts ({patientAlerts.length})
                                </h2>
                                <button
                                    onClick={() => resolveAllAlerts(selectedPatient?.user_id)}
                                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Resolve All
                                </button>
                            </div>

                            {patientAlerts.map((alert, i) => {
                                const config = severityConfig[alert.severity] || severityConfig.low;
                                return (
                                    <div key={alert.id || i} className={`${config.bg} ${config.border} border rounded-xl p-4 flex items-start gap-4`}>
                                        <div className={`${config.badge} p-2 rounded-lg shrink-0`}>
                                            {alert.severity === 'high' ? <AlertTriangle className="w-5 h-5" /> :
                                                alert.severity === 'medium' ? <AlertCircle className="w-5 h-5" /> :
                                                    <Info className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold uppercase ${config.text}`}>{alert.severity}</span>
                                                <span className="text-xs text-slate-400">• {alert.type?.replace('_', ' ')}</span>
                                            </div>
                                            <p className={`text-sm ${config.text}`}>{alert.message}</p>
                                            <p className="text-xs text-slate-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => resolveAlert(alert.id)}
                                            className="text-slate-400 hover:text-slate-600 shrink-0"
                                            title="Resolve alert"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Outcome Cards */}
                    {patientOutcome && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-xs text-slate-500 uppercase font-bold">Improvement Score</span>
                                <div className={`text-3xl font-bold mt-2 ${patientOutcome.improvement_score > 0 ? 'text-emerald-600' : patientOutcome.improvement_score < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                    {patientOutcome.improvement_score > 0 ? '+' : ''}{patientOutcome.improvement_score}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Baseline: {patientOutcome.baseline_risk} → Current: {patientOutcome.current_risk}</p>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-xs text-slate-500 uppercase font-bold">Risk Level</span>
                                <div className={`text-2xl font-bold mt-2 ${patientOutcome.risk_level === 'High' ? 'text-red-600' :
                                    patientOutcome.risk_level === 'Moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {patientOutcome.risk_level}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Score: {patientOutcome.current_risk}/100</p>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-xs text-slate-500 uppercase font-bold">Engagement Change</span>
                                <div className={`text-2xl font-bold mt-2 ${patientOutcome.engagement_change > 0 ? 'text-emerald-600' : patientOutcome.engagement_change < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                    {patientOutcome.engagement_change > 0 ? '+' : ''}{patientOutcome.engagement_change}%
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {patientOutcome.regression_flag ? '⚠ Regression detected' : 'No regression'}
                                </p>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-xs text-slate-500 uppercase font-bold">Tracking</span>
                                <div className="text-2xl font-bold mt-2 text-slate-800">
                                    {patientOutcome.weeks_tracked}w
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{patientOutcome.total_sessions} sessions • {patientOutcome.therapy_modules_tried} therapy modules</p>
                            </div>
                        </div>
                    )}

                    {/* Therapy Effectiveness + 30-day Forecast */}
                    {patientOutcome && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-violet-500" />
                                    Therapy Effectiveness
                                </h3>
                                {patientOutcome.therapy_effectiveness != null ? (
                                    <div>
                                        <div className="flex items-end gap-3 mb-3">
                                            <span className="text-4xl font-bold text-violet-600">{patientOutcome.therapy_effectiveness}%</span>
                                            <span className="text-sm text-slate-400 mb-1">modules effective</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-3">
                                            <div
                                                className="bg-gradient-to-r from-violet-500 to-purple-500 h-3 rounded-full transition-all duration-700"
                                                style={{ width: `${patientOutcome.therapy_effectiveness}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">{patientOutcome.effective_modules} of {patientOutcome.therapy_modules_tried} modules rated effective</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400">No therapy outcome data yet.</p>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                    30-Day Risk Forecast
                                </h3>
                                {patientOutcome.predicted_risk_30d != null ? (
                                    <div>
                                        <div className="flex items-end gap-3 mb-3">
                                            <span className={`text-4xl font-bold ${patientOutcome.predicted_risk_30d > 70 ? 'text-red-600' :
                                                patientOutcome.predicted_risk_30d > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {Math.round(patientOutcome.predicted_risk_30d)}
                                            </span>
                                            <span className="text-sm text-slate-400 mb-1">/100 predicted risk</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Current:</span>
                                            <span className="text-sm font-mono font-semibold text-slate-700">{patientOutcome.current_risk}</span>
                                            <span className="text-slate-300">→</span>
                                            <span className="text-xs text-slate-500">30d Forecast:</span>
                                            <span className={`text-sm font-mono font-semibold ${patientOutcome.predicted_risk_30d > patientOutcome.current_risk ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {Math.round(patientOutcome.predicted_risk_30d)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Stability index: {patientOutcome.stability_index?.toFixed(1)} • Confidence: {patientOutcome.confidence_level}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400">Need more sessions for forecast.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Clinical Notes */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="flex items-center gap-2 font-bold text-slate-900 mb-4">
                            <FileText className="w-5 h-5 text-primary-600" /> Clinical Notes
                        </h3>
                        <textarea
                            className="w-full h-32 p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none bg-slate-50"
                            placeholder="Add your observations and clinical notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        ></textarea>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-500">
                                <strong>Clinical Decision Support Tool.</strong> This system assists clinical judgment but does not replace formal diagnostic evaluation. All results should be interpreted alongside comprehensive clinical assessment.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Clinician;
