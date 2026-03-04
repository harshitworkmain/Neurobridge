import React, { useState, useEffect } from 'react';
import { ClipboardList, Check, X, ChevronRight, ChevronLeft, AlertCircle, Sparkles } from 'lucide-react';

const QUESTIONNAIRE_ITEMS = [
    {
        id: 'q1',
        text: 'Does your child look at you when you call their name?',
        domain: 'Social Attention',
        help: 'Try calling their name in a normal tone from across the room.'
    },
    {
        id: 'q2',
        text: 'Does your child point to show you something interesting (not to ask for it)?',
        domain: 'Joint Attention',
        help: 'For example, pointing at an airplane in the sky.'
    },
    {
        id: 'q3',
        text: 'Does your child engage in pretend play (e.g., feeding a doll)?',
        domain: 'Imaginative Play',
        help: 'Using objects in make-believe ways during play.'
    },
    {
        id: 'q4',
        text: 'Does your child follow where you look when you point at something?',
        domain: 'Joint Attention',
        help: 'Point to an object across the room and see if they look.'
    },
    {
        id: 'q5',
        text: 'Does your child make eye contact with you during interaction?',
        domain: 'Social Attention',
        help: 'Regular eye contact during play and conversation.'
    },
    {
        id: 'q6',
        text: 'Does your child imitate your actions (e.g., clapping, waving)?',
        domain: 'Social Imitation',
        help: 'Try waving or clapping and see if they copy you.'
    },
    {
        id: 'q7',
        text: 'Does your child respond to their name being called within a few seconds?',
        domain: 'Social Attention',
        help: 'Without needing to repeat multiple times.'
    },
    {
        id: 'q8',
        text: 'Does your child show interest in other children?',
        domain: 'Social Engagement',
        help: 'Watching, approaching, or playing near other kids.'
    },
    {
        id: 'q9',
        text: 'Does your child bring objects to you to share interest (not just for help)?',
        domain: 'Joint Attention',
        help: 'Showing you a toy they find interesting.'
    },
    {
        id: 'q10',
        text: 'Does your child use gestures (e.g., waving bye, shaking head) to communicate?',
        domain: 'Communication',
        help: 'Using gestures beyond just reaching or pulling.'
    }
];

/**
 * Behavioral Questionnaire Component
 * M-CHAT inspired caregiver questionnaire for behavioral fusion.
 * 
 * @param {Object} props
 * @param {Function} props.onComplete - Callback with { responses, score }
 * @param {Function} props.onSkip - Callback when skipped
 * @param {boolean} props.compact - Show compact mode (all items visible)
 */
const BehavioralQuestionnaire = ({ onComplete, onSkip, compact = false }) => {
    const [responses, setResponses] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showHelp, setShowHelp] = useState(null);

    const totalItems = QUESTIONNAIRE_ITEMS.length;
    const answeredCount = Object.keys(responses).length;
    const isComplete = answeredCount === totalItems;
    const currentItem = QUESTIONNAIRE_ITEMS[currentIndex];
    const progress = (answeredCount / totalItems) * 100;

    const handleAnswer = (itemId, answer) => {
        setResponses(prev => ({ ...prev, [itemId]: answer }));
        // Auto-advance in step mode
        if (!compact && currentIndex < totalItems - 1) {
            setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
        }
    };

    const handleSubmit = () => {
        if (!isComplete) return;

        // Calculate risk count
        let riskCount = 0;
        for (const item of QUESTIONNAIRE_ITEMS) {
            if (responses[item.id] === 'no') riskCount++;
        }

        onComplete({
            responses,
            score: riskCount / totalItems,
            riskCount,
            totalItems
        });
    };

    // Compact mode: show all items at once
    if (compact) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-5 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-lg">
                            <ClipboardList className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Developmental Questionnaire</h3>
                            <p className="text-sm text-slate-500">Quick caregiver observations to enhance screening accuracy</p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{answeredCount}/{totalItems} answered</p>
                </div>

                <div className="divide-y divide-slate-100">
                    {QUESTIONNAIRE_ITEMS.map((item, idx) => (
                        <div key={item.id} className={`p-4 flex items-center gap-4 transition-colors ${responses[item.id] ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                            <span className="text-xs font-bold text-slate-400 w-6 text-center shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">{item.text}</p>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{item.domain}</span>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => handleAnswer(item.id, 'yes')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${responses[item.id] === 'yes'
                                            ? 'bg-emerald-500 text-white shadow-sm scale-105'
                                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                        }`}
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => handleAnswer(item.id, 'no')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${responses[item.id] === 'no'
                                            ? 'bg-rose-500 text-white shadow-sm scale-105'
                                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                        }`}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    {onSkip && (
                        <button onClick={onSkip} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                            Skip Questionnaire
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!isComplete}
                        className={`px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${isComplete
                                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Submit & Enhance Analysis
                    </button>
                </div>
            </div>
        );
    }

    // Step-by-step mode (default)
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-lg">
                            <ClipboardList className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Developmental Check</h3>
                            <p className="text-xs text-slate-500">Quick parent observations</p>
                        </div>
                    </div>
                    <span className="text-sm font-mono text-slate-500">{currentIndex + 1}/{totalItems}</span>
                </div>
                {/* Progress */}
                <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="p-6">
                <div className="mb-2">
                    <span className="text-[10px] text-violet-600 uppercase tracking-wider font-bold bg-violet-50 px-2 py-0.5 rounded-full">
                        {currentItem.domain}
                    </span>
                </div>
                <p className="text-lg font-medium text-slate-800 mb-2">{currentItem.text}</p>

                <button
                    onClick={() => setShowHelp(showHelp === currentItem.id ? null : currentItem.id)}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-6"
                >
                    <AlertCircle className="w-3 h-3" />
                    {showHelp === currentItem.id ? 'Hide hint' : 'What does this mean?'}
                </button>

                {showHelp === currentItem.id && (
                    <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
                        💡 {currentItem.help}
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => handleAnswer(currentItem.id, 'yes')}
                        className={`flex-1 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${responses[currentItem.id] === 'yes'
                                ? 'bg-emerald-500 text-white shadow-lg scale-[1.02]'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                    >
                        <Check className="w-5 h-5" /> Yes
                    </button>
                    <button
                        onClick={() => handleAnswer(currentItem.id, 'no')}
                        className={`flex-1 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${responses[currentItem.id] === 'no'
                                ? 'bg-rose-500 text-white shadow-lg scale-[1.02]'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                    >
                        <X className="w-5 h-5" /> No
                    </button>
                </div>
            </div>

            <div className="px-6 pb-5 flex justify-between items-center">
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${currentIndex === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ChevronLeft className="w-4 h-4" /> Back
                </button>

                <div className="flex gap-3 items-center">
                    {onSkip && (
                        <button onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-600">
                            Skip
                        </button>
                    )}
                    {isComplete ? (
                        <button
                            onClick={handleSubmit}
                            className="px-5 py-2 bg-violet-600 text-white rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-violet-700 shadow-md transition-all"
                        >
                            <Sparkles className="w-4 h-4" /> Submit
                        </button>
                    ) : currentIndex < totalItems - 1 ? (
                        <button
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                            className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default BehavioralQuestionnaire;
