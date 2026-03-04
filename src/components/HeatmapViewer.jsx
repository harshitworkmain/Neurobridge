import React, { useState } from 'react';
import { Eye, X, Loader2, Download, ZoomIn } from 'lucide-react';
import { API_BASE } from '../config/api.js';

/**
 * HeatmapViewer — Button-triggered heatmap display.
 * Heatmap is visualization only, NOT used for inference.
 * 
 * Two modes:
 *   1. Local heatmap (from canvas ref) — for current session
 *   2. Remote heatmap (from API) — for historical sessions
 * 
 * @param {Object} props
 * @param {string} props.localImage - Base64 image from heatmap canvas (current session)
 * @param {number} props.screeningId - Screening ID for remote fetch
 * @param {string} props.className - Additional classes
 */
const HeatmapViewer = ({ localImage, screeningId, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [imageData, setImageData] = useState(localImage || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [zoomed, setZoomed] = useState(false);

    const handleOpen = async () => {
        setIsOpen(true);
        setError('');

        // If we have a local image, use it
        if (localImage) {
            setImageData(localImage);
            return;
        }

        // Otherwise fetch from server
        if (screeningId) {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/screenings/${screeningId}/heatmap`);
                if (!res.ok) throw new Error('No heatmap available for this session.');
                const data = await res.json();
                setImageData(data.heatmap_image);
            } catch (e) {
                setError(e.message || 'Failed to load heatmap.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setZoomed(false);
    };

    const handleDownload = () => {
        if (!imageData) return;
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `neurobridge_heatmap_${screeningId || 'session'}.png`;
        link.click();
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={handleOpen}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm 
                    bg-gradient-to-r from-slate-800 to-slate-900 text-white 
                    hover:from-slate-700 hover:to-slate-800
                    shadow-md hover:shadow-lg 
                    transition-all duration-200 active:scale-95 ${className}`}
            >
                <Eye className="w-4 h-4 text-sky-400 group-hover:text-sky-300 transition-colors" />
                View Attention Heatmap
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up z-10">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50">
                            <div>
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-sky-600" />
                                    Gaze Attention Heatmap
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Visualization only — not used in risk inference
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {imageData && (
                                    <>
                                        <button
                                            onClick={() => setZoomed(!zoomed)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                                            title="Toggle zoom"
                                        >
                                            <ZoomIn className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                                            title="Download heatmap"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                                    <p className="text-sm">Loading heatmap data...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Eye className="w-8 h-8 mb-3 opacity-50" />
                                    <p className="text-sm text-slate-500">{error}</p>
                                </div>
                            ) : imageData ? (
                                <div className={`relative bg-black rounded-xl overflow-hidden transition-all duration-300 ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                                    onClick={() => setZoomed(!zoomed)}>
                                    <img
                                        src={imageData}
                                        alt="Gaze Attention Heatmap"
                                        className={`w-full h-auto transition-transform duration-300 ${zoomed ? 'scale-150' : 'scale-100'}`}
                                    />
                                    <div className="absolute bottom-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                                        🔥 Heat = Gaze Concentration
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Eye className="w-8 h-8 mb-3 opacity-50" />
                                    <p className="text-sm">No heatmap data available.</p>
                                </div>
                            )}

                            {/* Legend */}
                            {imageData && (
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-500 opacity-70" />
                                            <span>High Concentration</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-300 opacity-50" />
                                            <span>Moderate</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-slate-700" />
                                            <span>No Gaze</span>
                                        </div>
                                    </div>
                                    <span className="text-slate-400 italic">Visualization only</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HeatmapViewer;
