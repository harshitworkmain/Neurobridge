import React, { useState, useEffect } from 'react';
import {
    FileText, Download, Loader, AlertTriangle, Info,
    TrendingUp, TrendingDown, Activity, Shield, Brain,
    Clock, CheckCircle2, Users, BarChart3, RefreshCw, Eye, Bell
} from 'lucide-react';

import API from '../config/api.js';

const Reports = () => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const userId = 1;

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/reports/patient/${userId}?format=json`);
            if (res.ok) {
                const data = await res.json();
                // API returns { success: true, report: { ... } }
                setReportData(data.report || data);
            } else {
                setError('Could not load report data');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`${API}/reports/patient/${userId}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `neurobridge_report_patient_${userId}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Generating clinical report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-md text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Report Unavailable</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button onClick={fetchReport} className="text-primary-600 font-medium hover:text-primary-700">Try Again →</button>
                </div>
            </div>
        );
    }

    // Map the actual API response structure
    const patient = reportData?.patient;
    const outcome = reportData?.outcome_summary;
    const riskTrend = reportData?.risk_trend_data || [];
    const therapy = reportData?.latest_therapy_plan;
    const forecast = reportData?.forecast;
    const alerts = reportData?.active_alerts || [];
    const explanations = reportData?.ai_explanations;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Clinical Report</h1>
                        <p className="text-slate-500 text-sm">
                            Patient: {patient?.name || 'Unknown'} • Generated: {new Date(reportData?.report_generated_at || Date.now()).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={fetchReport} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={downloadPDF}
                        disabled={downloading}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {downloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {downloading ? 'Generating...' : 'Download PDF Report'}
                    </button>
                </div>
            </div>

            {/* Patient & Outcome Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-primary-500" />
                        Patient Profile
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Name</span>
                            <span className="font-semibold text-slate-900">{patient?.name || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Age</span>
                            <span className="font-semibold text-slate-900">{patient?.age || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Patient ID</span>
                            <span className="font-mono text-slate-600">#NB-{patient?.id || userId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Email</span>
                            <span className="text-slate-600">{patient?.email || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Report Date</span>
                            <span className="font-semibold text-slate-900">{new Date(reportData?.report_generated_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {outcome && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                            <Brain className="w-5 h-5 text-violet-500" />
                            Outcome Summary
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Improvement Score</span>
                                <span className={`font-bold ${outcome.improvement_score > 0 ? 'text-emerald-600' : outcome.improvement_score < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                    {outcome.improvement_score > 0 ? '+' : ''}{outcome.improvement_score} pts
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Current Risk</span>
                                <span className={`font-bold ${outcome.current_risk > 70 ? 'text-red-600' : outcome.current_risk > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {outcome.current_risk}/100
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Risk Level</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${outcome.risk_level === 'High' ? 'bg-red-100 text-red-700' :
                                    outcome.risk_level === 'Moderate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {outcome.risk_level}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Baseline → Current</span>
                                <span className="font-mono text-slate-600">{outcome.baseline_risk} → {outcome.current_risk}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Engagement Change</span>
                                <span className={`font-semibold ${outcome.engagement_change > 0 ? 'text-emerald-600' : outcome.engagement_change < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                    {outcome.engagement_change > 0 ? '+' : ''}{outcome.engagement_change}%
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Sessions • Weeks</span>
                                <span className="text-slate-700">{outcome.total_sessions} sessions • {outcome.weeks_tracked} weeks</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {outcome && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl">
                        <TrendingUp className="w-7 h-7 opacity-80 mb-2" />
                        <p className="text-emerald-100 text-xs uppercase font-bold">Improvement</p>
                        <p className="text-3xl font-bold mt-1">{outcome.improvement_score > 0 ? '+' : ''}{outcome.improvement_score}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 uppercase font-bold">Therapy Effectiveness</p>
                        <p className="text-3xl font-bold text-violet-600 mt-2">{outcome.therapy_effectiveness ?? '—'}%</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 uppercase font-bold">Sessions Recorded</p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{outcome.total_sessions}</p>
                    </div>
                    {forecast && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-xs text-slate-500 uppercase font-bold">30-Day Forecast</p>
                            <p className={`text-3xl font-bold mt-2 ${forecast.predicted_risk_30d > 70 ? 'text-red-600' : forecast.predicted_risk_30d > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {Math.round(forecast.predicted_risk_30d)}/100
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {forecast.regression_flag ? '⚠ Regression detected' : 'Stable trajectory'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Active Alerts */}
            {alerts.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Bell className="w-5 h-5 text-red-500" />
                        Active Alerts ({alerts.length})
                    </h3>
                    <div className="space-y-2">
                        {alerts.map((alert, i) => (
                            <div key={i} className={`p-3 rounded-lg text-sm border flex items-start gap-3 ${alert.severity === 'high' ? 'bg-red-50 border-red-200' :
                                alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${alert.severity === 'high' ? 'text-red-500' : alert.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'}`} />
                                <div>
                                    <span className={`text-xs font-bold uppercase ${alert.severity === 'high' ? 'text-red-700' : alert.severity === 'medium' ? 'text-amber-700' : 'text-blue-700'}`}>
                                        {alert.type?.replace('_', ' ')}
                                    </span>
                                    <p className="text-slate-600 mt-0.5">{alert.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Explanations */}
            {explanations && explanations.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-purple-500" /> AI-Generated Findings
                    </h3>
                    <div className="space-y-2">
                        {explanations.map((exp, i) => (
                            <div key={i} className={`p-3 rounded-lg text-sm border ${exp.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' :
                                exp.severity === 'moderate' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                    exp.severity === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                        'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}>
                                <span className="mr-2">{exp.icon}</span>
                                {exp.text}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risk Trend */}
            {riskTrend.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        Risk Trend History ({riskTrend.length} sessions)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="p-3 font-semibold">Date</th>
                                    <th className="p-3 font-semibold">Risk Score</th>
                                    <th className="p-3 font-semibold">Engagement</th>
                                    <th className="p-3 font-semibold">Change</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {riskTrend.map((entry, i) => {
                                    const prevScore = i > 0 ? riskTrend[i - 1].risk_score : entry.risk_score;
                                    const delta = entry.risk_score - prevScore;
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="p-3 text-slate-700">{new Date(entry.date).toLocaleDateString()}</td>
                                            <td className="p-3">
                                                <span className={`font-bold ${entry.risk_score > 70 ? 'text-red-600' : entry.risk_score > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {entry.risk_score}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-slate-600">{entry.engagement != null ? `${entry.engagement}%` : '—'}</td>
                                            <td className="p-3">
                                                {i > 0 && (
                                                    <span className={`text-sm flex items-center gap-1 ${delta < 0 ? 'text-emerald-600' : delta > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {delta < 0 ? <TrendingDown className="w-3 h-3" /> : delta > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                                                        {delta > 0 ? '+' : ''}{delta}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Therapy Plan Summary */}
            {therapy && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-teal-500" />
                        Active Therapy Plan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs text-slate-500 uppercase font-bold">Daily Time</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">{therapy.total_daily_time}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs text-slate-500 uppercase font-bold">Domains</p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">{therapy.domains?.length || 0} active</p>
                        </div>
                    </div>

                    {therapy.domains && therapy.domains.length > 0 && (
                        <div className="space-y-2">
                            {therapy.domains.map((d, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                    <div className={`w-2 h-2 rounded-full ${d.priority === 'High' ? 'bg-red-500' : d.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    <span className="font-medium text-slate-800 text-sm">{d.name}</span>
                                    <span className="text-xs text-slate-400">{d.task_count} tasks</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${d.priority === 'High' ? 'bg-red-100 text-red-700' :
                                        d.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {d.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Confidence & Disclaimer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl">
                    <Shield className="w-8 h-8 mb-3 opacity-80" />
                    <p className="text-slate-300 text-sm">Confidence Level</p>
                    <p className="text-2xl font-bold mt-1 capitalize">{reportData?.confidence_level || '—'}</p>
                    <p className="text-xs text-slate-400 mt-2">Based on {riskTrend.length} screening session{riskTrend.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-600">
                            <p className="font-medium text-slate-700 mb-1">Medical Disclaimer</p>
                            <p className="text-xs">{reportData?.disclaimer}</p>
                            {reportData?.quality_notice && (
                                <p className="text-xs text-slate-400 mt-2 italic">{reportData.quality_notice}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
