import React, { useState, useEffect } from 'react';
import { Shield, Lock, FileCheck, Check, Camera, Mic, Gamepad2, Eye, Users, ToggleLeft, ToggleRight, Download, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import API from '../config/api.js';

const MODULE_CONSENTS = [
    { id: 'screening', label: 'AI Screening — Camera', description: 'Allow webcam access for AI-powered developmental screening. Video is processed locally.', icon: Camera, color: 'text-blue-500' },
    { id: 'teleconsult_camera', label: 'Teleconsult — Camera', description: 'Allow webcam for video consultations with your clinician.', icon: Camera, color: 'text-emerald-500' },
    { id: 'teleconsult_mic', label: 'Teleconsult — Microphone', description: 'Allow microphone access so your clinician can hear you during calls.', icon: Mic, color: 'text-emerald-500' },
    { id: 'games_camera', label: 'Therapy Games — Camera', description: 'Some games use gaze tracking via your camera to measure attention.', icon: Gamepad2, color: 'text-violet-500' },
    { id: 'games_gaze', label: 'Therapy Games — Gaze Data', description: 'Allow collection of gaze movement data during game sessions for progress analytics.', icon: Eye, color: 'text-violet-500' },
    { id: 'community_tos', label: 'Community — Terms of Service', description: 'Agree to community guidelines: respectful communication, no medical advice, and content moderation.', icon: Users, color: 'text-pink-500' },
];

const Consent = () => {
    const [consented, setConsented] = useState(false);
    const [moduleConsents, setModuleConsents] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConsentStatus();
    }, []);

    const loadConsentStatus = async () => {
        try {
            const res = await fetch(`${API}/consent/status/1`);
            if (res.ok) {
                const data = await res.json();
                setModuleConsents(data.consents || {});
            }
        } catch (e) {
            console.error('Failed to load consent status:', e);
        }
        setLoading(false);
    };

    const toggleConsent = async (consentType, currentlyGranted) => {
        const endpoint = currentlyGranted ? 'revoke' : 'grant';
        try {
            const res = await fetch(`${API}/consent/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consent_type: consentType })
            });
            if (res.ok) {
                setModuleConsents(prev => ({
                    ...prev,
                    [consentType]: {
                        given: !currentlyGranted,
                        last_updated: new Date().toISOString()
                    }
                }));
            }
        } catch (e) {
            console.error('Consent toggle error:', e);
        }
    };

    const grantedCount = Object.values(moduleConsents).filter(c => c.given).length;
    const totalCount = MODULE_CONSENTS.length;

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-8">
            <div className="text-center">
                <div className="inline-flex p-4 rounded-full bg-primary-50 text-primary-600 mb-6">
                    <Shield className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Privacy & Consent</h1>
                <p className="text-slate-500 mt-2 text-lg">Your child's data privacy is our highest priority.</p>
            </div>

            {/* Data Practices Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 space-y-6">
                    <div className="flex gap-4">
                        <div className="bg-slate-100 p-2 rounded-lg h-fit shrink-0">
                            <Lock className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Data Encryption & Security</h3>
                            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                                All video and audio data is processed locally whenever possible. Data transmitted to our secure cloud is end-to-end encrypted (AES-256). We comply with HIPAA and GDPR standards for health data protection.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-slate-100 p-2 rounded-lg h-fit shrink-0">
                            <FileCheck className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Purpose of Data Collection</h3>
                            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                                Collected data is used solely for generating developmental screening assessments, therapy game analytics, teleconsultation sessions, and progress reports. Data is never sold to third parties or advertisers.
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900">
                        <strong>Demo Note:</strong> This is a conceptual platform. No actual data is being recorded or processed in this session.
                    </div>
                </div>
            </div>

            {/* Module-Specific Consent Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Module Permissions</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Control exactly what data each module can access</p>
                    </div>
                    <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-medium">
                        {grantedCount}/{totalCount} granted
                    </span>
                </div>

                <div className="divide-y divide-slate-50">
                    {MODULE_CONSENTS.map(mc => {
                        const status = moduleConsents[mc.id];
                        const isGranted = status?.given || false;
                        const Icon = mc.icon;

                        return (
                            <div key={mc.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className={`shrink-0 ${mc.color}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800">{mc.label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{mc.description}</p>
                                    {status?.last_updated && (
                                        <p className="text-[10px] text-slate-300 mt-0.5">
                                            Last updated: {new Date(status.last_updated).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleConsent(mc.id, isGranted)}
                                    disabled={loading}
                                    className="shrink-0"
                                    title={isGranted ? 'Revoke consent' : 'Grant consent'}
                                >
                                    {isGranted ? (
                                        <ToggleRight className="w-8 h-8 text-primary-600" />
                                    ) : (
                                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Data Export Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900">Your Data</h3>
                        <p className="text-sm text-slate-500 mt-1">Download a complete copy of all your NeuroBridge data.</p>
                    </div>
                    <a
                        href={`${API}/export/1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Export Data
                    </a>
                </div>
            </div>

            {/* General Consent */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                    <div className="pt-2 border-t border-slate-100">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className={`mt-0.5 w-5 h-5 rounded border border-slate-300 flex items-center justify-center shrink-0 transition-colors ${consented ? 'bg-primary-600 border-primary-600' : 'bg-white group-hover:border-primary-400'}`}>
                                {consented && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <input type="checkbox" className="hidden" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                            <span className="text-slate-700 text-sm select-none">
                                I confirm that I am the legal guardian of the child and I consent to the processing of data for developmental screening, therapy, teleconsultation, and community participation purposes.
                            </span>
                        </label>
                    </div>

                    <div className="pt-4">
                        <Link to="/" className={`block w-full py-3 rounded-xl text-center font-medium transition-all ${consented ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                            {consented ? 'Confirm & Continue to Dashboard' : 'Please Accept to Continue'}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500">
                        You can change your consent preferences at any time. Revoking consent for a module may limit functionality. For questions about data handling, contact privacy@neurobridge.ai.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Consent;
