import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Gamepad2, Users, ArrowRight, ArrowLeft, Check, Sparkles, Eye, Heart } from 'lucide-react';

const steps = [
    {
        icon: Brain,
        emoji: '🧠',
        title: 'Welcome to NeuroBridge AI',
        subtitle: 'Your child\'s personalized autism care ecosystem',
        description: 'NeuroBridge combines AI-powered screening, adaptive therapy games, teleconsultation, and community support — all in one platform designed specifically for your family.',
        color: 'from-primary-500 to-blue-600',
        features: [
            { icon: Eye, text: 'AI-powered developmental screening' },
            { icon: Gamepad2, text: 'Therapeutic games that adapt to your child' },
            { icon: Heart, text: 'Safe community of families like yours' },
        ]
    },
    {
        icon: Brain,
        emoji: '📋',
        title: 'Start with a Screening',
        subtitle: 'Quick, camera-based developmental assessment',
        description: 'Our AI screening uses your device\'s camera to analyze gaze patterns, engagement, and behavioral markers. It takes just 3–5 minutes and provides clinician-reviewed insights.',
        color: 'from-emerald-500 to-teal-600',
        action: { label: 'Go to Screening', path: '/screening' },
        tips: [
            '🔒 Camera data stays on your device',
            '⏱️ Takes only 3–5 minutes',
            '📊 Results feed into your child\'s progress profile'
        ]
    },
    {
        icon: Gamepad2,
        emoji: '🎮',
        title: 'Explore Therapy Games',
        subtitle: 'Fun activities that build real skills',
        description: 'Our therapy games target attention, emotion recognition, sequencing, and memory. They adapt to your child\'s level and progress data flows to your clinician automatically.',
        color: 'from-violet-500 to-purple-600',
        action: { label: 'Browse Games', path: '/games' },
        tips: [
            '🌟 Games adjust difficulty based on performance',
            '🔥 Streak tracking keeps motivation high',
            '👨‍⚕️ Your clinician sees game insights in their dashboard'
        ]
    },
    {
        icon: Users,
        emoji: '💬',
        title: 'Join the Community',
        subtitle: 'You\'re not alone on this journey',
        description: 'Connect with other parents, therapists, and researchers in a safe, moderated space. Share wins, ask questions, and find support from people who understand.',
        color: 'from-pink-500 to-rose-600',
        action: { label: 'Visit Community', path: '/community' },
        tips: [
            '🛡️ All content is moderated for safety',
            '⚕️ "Ask a Clinician" category for medical questions',
            '🎉 Celebrate therapy wins with other families'
        ]
    }
];

const OnboardingFlow = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const navigate = useNavigate();
    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;
    const Icon = step.icon;

    const handleComplete = () => {
        onComplete();
    };

    const handleAction = (path) => {
        onComplete();
        navigate(path);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 pt-5">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-primary-600' : i < currentStep ? 'w-4 bg-primary-300' : 'w-4 bg-slate-200'
                                }`}
                        />
                    ))}
                </div>

                {/* Header */}
                <div className={`bg-gradient-to-r ${step.color} mx-5 mt-4 rounded-2xl p-6 text-white text-center relative overflow-hidden`}>
                    <div className="absolute -right-4 -top-4 text-8xl opacity-10">{step.emoji}</div>
                    <div className="relative z-10">
                        <div className="text-5xl mb-3">{step.emoji}</div>
                        <h2 className="text-2xl font-bold">{step.title}</h2>
                        <p className="text-white/80 text-sm mt-1">{step.subtitle}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">{step.description}</p>

                    {/* Features list */}
                    {step.features && (
                        <div className="space-y-2 mb-4">
                            {step.features.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl">
                                    <f.icon className="w-5 h-5 text-primary-600 shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{f.text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tips */}
                    {step.tips && (
                        <div className="space-y-1.5 mb-4">
                            {step.tips.map((tip, i) => (
                                <p key={i} className="text-xs text-slate-500 dark:text-slate-400">{tip}</p>
                            ))}
                        </div>
                    )}

                    {/* Action button if present */}
                    {step.action && (
                        <button
                            onClick={() => handleAction(step.action.path)}
                            className={`w-full bg-gradient-to-r ${step.color} text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mb-3`}
                        >
                            <Sparkles className="w-4 h-4" />
                            {step.action.label}
                        </button>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-2">
                        {currentStep > 0 ? (
                            <button
                                onClick={() => setCurrentStep(s => s - 1)}
                                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Skip tour
                            </button>
                        )}

                        {isLast ? (
                            <button
                                onClick={handleComplete}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Get Started
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentStep(s => s + 1)}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
                            >
                                Next <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingFlow;
