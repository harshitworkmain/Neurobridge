import React from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, Info } from 'lucide-react';

/**
 * Session Quality Banner
 * Displays quality warnings and flags for a screening session.
 * 
 * @param {Object} props
 * @param {Object} props.quality - Quality assessment from backend { quality_score, is_reliable, quality_label, flags }
 * @param {boolean} props.compact - Compact mode for inline display
 */
const SessionQualityBanner = ({ quality, compact = false }) => {
    if (!quality) return null;

    const { quality_score, is_reliable, quality_label, flags } = quality;

    // Color scheme based on quality
    const styles = {
        High: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-800',
            badge: 'bg-emerald-100 text-emerald-700',
            icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />
        },
        Moderate: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-800',
            badge: 'bg-amber-100 text-amber-700',
            icon: <AlertTriangle className="w-5 h-5 text-amber-600" />
        },
        Low: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-800',
            badge: 'bg-red-100 text-red-700',
            icon: <ShieldAlert className="w-5 h-5 text-red-600" />
        }
    };

    const style = styles[quality_label] || styles.Moderate;

    // Compact badge only
    if (compact) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}>
                {quality_label === 'Low' && <AlertTriangle className="w-3 h-3" />}
                {quality_label} Quality
            </span>
        );
    }

    // No flags = good session, minimal display
    if (is_reliable && (!flags || flags.length === 0)) {
        return (
            <div className={`${style.bg} border ${style.border} rounded-xl p-3 flex items-center gap-3`}>
                {style.icon}
                <div>
                    <span className={`font-semibold text-sm ${style.text}`}>
                        Session Quality: {quality_label}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">Score: {quality_score}/100</span>
                </div>
            </div>
        );
    }

    // Show warnings
    return (
        <div className={`${style.bg} border ${style.border} rounded-xl overflow-hidden`}>
            <div className="p-4 flex items-start gap-3">
                {style.icon}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-sm ${style.text}`}>
                            {!is_reliable ? '⚠️ Results May Be Unreliable' : `Session Quality: ${quality_label}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${style.badge}`}>
                            {quality_score}/100
                        </span>
                    </div>

                    {flags && flags.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                            {flags.map((flag, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${flag.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'
                                        }`} />
                                    <div>
                                        <span className={style.text}>{flag.message}</span>
                                        {flag.detail && (
                                            <p className="text-xs text-slate-500 mt-0.5">{flag.detail}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!is_reliable && (
                        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Consider re-screening under optimal conditions for more accurate results.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SessionQualityBanner;
