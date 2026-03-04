import React, { useState, useEffect } from 'react';
import {
    Sun, Moon, Clock, CheckCircle2, Circle, ChevronRight,
    Star, Sparkles, Coffee, Utensils, Brain, Heart,
    Users, Target, MessageCircle, Play, Music, Book, Volume2, VolumeX
} from 'lucide-react';

import API from '../config/api.js';

/**
 * Visual Schedule (A3) — ASD-friendly daily routine visualisation
 *
 * Design principles for children with ASD:
 *  1. Concrete visual blocks — each activity has an icon + colour
 *  2. Time anchors — morning / afternoon / evening sections
 *  3. "Now" indicator — large, obvious marker showing current activity
 *  4. Predictability — consistent layout, no surprises
 *  5. First–Then–Next pattern — always shows what's coming next
 *  6. Sensory-safe colours — pastel tones, no flashing
 */

// Fixed daily routine slots (combine therapy tasks into a natural day)
const ROUTINE_TEMPLATE = [
    { id: 'morning_start', time: '8:00 AM', label: 'Wake Up & Get Ready', icon: Sun, color: 'bg-amber-100 text-amber-700 border-amber-200', period: 'morning', fixed: true },
    { id: 'breakfast', time: '8:30 AM', label: 'Breakfast', icon: Utensils, color: 'bg-orange-100 text-orange-700 border-orange-200', period: 'morning', fixed: true },
    { id: 'therapy_slot_1', time: '9:00 AM', label: 'Therapy Activity 1', icon: Brain, color: 'bg-blue-100 text-blue-700 border-blue-200', period: 'morning', therapySlot: 0 },
    { id: 'therapy_slot_2', time: '9:30 AM', label: 'Therapy Activity 2', icon: Heart, color: 'bg-purple-100 text-purple-700 border-purple-200', period: 'morning', therapySlot: 1 },
    { id: 'free_play', time: '10:00 AM', label: 'Free Play / Break', icon: Star, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', period: 'morning', fixed: true },
    { id: 'therapy_slot_3', time: '10:30 AM', label: 'Therapy Activity 3', icon: Users, color: 'bg-cyan-100 text-cyan-700 border-cyan-200', period: 'morning', therapySlot: 2 },
    { id: 'lunch', time: '12:00 PM', label: 'Lunch', icon: Utensils, color: 'bg-orange-100 text-orange-700 border-orange-200', period: 'afternoon', fixed: true },
    { id: 'quiet_time', time: '12:30 PM', label: 'Quiet Time / Rest', icon: Book, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', period: 'afternoon', fixed: true },
    { id: 'therapy_slot_4', time: '1:30 PM', label: 'Therapy Activity 4', icon: Target, color: 'bg-rose-100 text-rose-700 border-rose-200', period: 'afternoon', therapySlot: 3 },
    { id: 'snack', time: '3:00 PM', label: 'Snack Time', icon: Coffee, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', period: 'afternoon', fixed: true },
    { id: 'therapy_slot_5', time: '3:30 PM', label: 'Therapy Activity 5', icon: Play, color: 'bg-teal-100 text-teal-700 border-teal-200', period: 'afternoon', therapySlot: 4 },
    { id: 'outdoor', time: '4:00 PM', label: 'Outdoor / Physical Activity', icon: Sun, color: 'bg-green-100 text-green-700 border-green-200', period: 'afternoon', fixed: true },
    { id: 'dinner', time: '6:00 PM', label: 'Dinner', icon: Utensils, color: 'bg-orange-100 text-orange-700 border-orange-200', period: 'evening', fixed: true },
    { id: 'wind_down', time: '7:00 PM', label: 'Wind Down / Calm Activity', icon: Music, color: 'bg-violet-100 text-violet-700 border-violet-200', period: 'evening', fixed: true },
    { id: 'bedtime', time: '8:00 PM', label: 'Bedtime Routine', icon: Moon, color: 'bg-slate-100 text-slate-700 border-slate-200', period: 'evening', fixed: true },
];

const PERIOD_LABELS = {
    morning: { label: 'Morning', icon: Sun, gradient: 'from-amber-400 to-orange-400' },
    afternoon: { label: 'Afternoon', icon: Sun, gradient: 'from-sky-400 to-blue-400' },
    evening: { label: 'Evening', icon: Moon, gradient: 'from-indigo-400 to-purple-400' }
};

// Parse time string to minutes since midnight
function parseTime(str) {
    const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
}

const VisualSchedule = ({ onClose }) => {
    const [tasks, setTasks] = useState([]);
    const [completedIds, setCompletedIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Voice readback using Web Speech API
    const speakSchedule = (currentItem, nextItem) => {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        let text = `Right now, it's time for ${currentItem.label}.`;
        if (nextItem) {
            text += ` Coming up next is ${nextItem.label} at ${nextItem.time}.`;
        }
        text += ' You\'re doing great!';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;    // Slightly slower for children
        utterance.pitch = 1.1;    // Slightly higher — more friendly
        utterance.volume = 0.8;   // Not too loud

        // Try to use a friendly voice
        const voices = window.speechSynthesis.getVoices();
        const friendly = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google'));
        if (friendly) utterance.voice = friendly;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    };

    useEffect(() => {
        fetchTodayTasks();
    }, []);

    const fetchTodayTasks = async () => {
        try {
            const res = await fetch(`${API}/therapy/today/1`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data.tasks || []);
                const done = new Set();
                (data.tasks || []).forEach(t => {
                    if (t.status === 'completed') done.add(t.task_id);
                });
                setCompletedIds(done);
            }
        } catch (e) {
            console.error('VisualSchedule fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    // Determine current slot based on time of day
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Build schedule by merging therapy tasks into the template
    const schedule = ROUTINE_TEMPLATE.map(slot => {
        if (slot.therapySlot !== undefined && tasks[slot.therapySlot]) {
            const task = tasks[slot.therapySlot];
            return {
                ...slot,
                label: task.task_name || slot.label,
                description: task.description || '',
                isTherapy: true,
                taskId: task.task_id,
                completed: completedIds.has(task.task_id),
                duration: task.duration_minutes || 15,
                domain: task.domain || '',
                priority: task.priority || 'Medium'
            };
        }
        return { ...slot, isTherapy: false, completed: false };
    });

    // Find current activity index
    let currentIndex = 0;
    for (let i = schedule.length - 1; i >= 0; i--) {
        if (parseTime(schedule[i].time) <= nowMinutes) {
            currentIndex = i;
            break;
        }
    }

    // Group by period
    const periods = {};
    schedule.forEach((item, idx) => {
        if (!periods[item.period]) periods[item.period] = [];
        periods[item.period].push({ ...item, globalIndex: idx });
    });

    const completeTask = async (taskId) => {
        try {
            await fetch(`${API}/therapy/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId, duration_minutes: 5 })
            });
            setCompletedIds(prev => new Set([...prev, taskId]));
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <Sparkles className="w-8 h-8 text-primary-500 animate-pulse mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Building your schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Activity Highlight (First–Then–Next) */}
            <div className="bg-gradient-to-r from-primary-500 to-blue-500 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

                <div className="relative z-10">
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider mb-2">📍 Right Now</p>
                    <div className="flex items-center gap-3 mb-4">
                        {React.createElement(schedule[currentIndex].icon, { className: 'w-8 h-8' })}
                        <div>
                            <h2 className="text-xl font-bold">{schedule[currentIndex].label}</h2>
                            <p className="text-white/70 text-sm">{schedule[currentIndex].time}</p>
                        </div>
                    </div>

                    {currentIndex < schedule.length - 1 && (
                        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                            <ChevronRight className="w-4 h-4 text-white/60" />
                            <div>
                                <p className="text-white/60 text-xs font-medium uppercase">Up Next</p>
                                <p className="text-white/90 text-sm font-medium">
                                    {schedule[currentIndex + 1].label} — {schedule[currentIndex + 1].time}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Voice Readback Button */}
                    {'speechSynthesis' in window && (
                        <button
                            onClick={() => isSpeaking ? stopSpeaking() : speakSchedule(schedule[currentIndex], schedule[currentIndex + 1])}
                            className={`absolute top-4 right-4 p-2.5 rounded-full transition-all ${isSpeaking
                                    ? 'bg-white/30 text-white ring-2 ring-white/40 animate-pulse'
                                    : 'bg-white/15 text-white/80 hover:bg-white/25'
                                }`}
                            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                        >
                            {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Schedule Timeline by Period */}
            {Object.entries(periods).map(([period, items]) => {
                const pInfo = PERIOD_LABELS[period];
                const PeriodIcon = pInfo.icon;

                return (
                    <div key={period}>
                        {/* Period Header */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-8 h-8 bg-gradient-to-br ${pInfo.gradient} rounded-lg flex items-center justify-center`}>
                                <PeriodIcon className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{pInfo.label}</h3>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* Timeline Items */}
                        <div className="ml-4 border-l-2 border-slate-200 space-y-0">
                            {items.map((item) => {
                                const isCurrent = item.globalIndex === currentIndex;
                                const isPast = item.globalIndex < currentIndex;
                                const isDone = item.completed || (item.fixed && isPast);
                                const IconComp = item.icon;

                                return (
                                    <div
                                        key={item.id}
                                        className={`relative pl-8 py-3 transition-all duration-300 ${isCurrent ? 'bg-primary-50/50 rounded-r-xl -ml-0.5 border-l-2 border-primary-400 pl-[30px]' :
                                            isPast ? 'opacity-60' : ''
                                            }`}
                                    >
                                        {/* Timeline dot */}
                                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all ${isCurrent ? 'bg-primary-500 border-primary-300 w-5 h-5 ring-4 ring-primary-100' :
                                            isDone ? 'bg-emerald-500 border-emerald-300' :
                                                'bg-white border-slate-300'
                                            }`} />

                                        {isCurrent && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary-400 animate-ping opacity-30" />
                                        )}

                                        <div className="flex items-center gap-3">
                                            {/* Time */}
                                            <span className={`text-xs font-mono w-16 shrink-0 ${isCurrent ? 'text-primary-600 font-semibold' : 'text-slate-400'
                                                }`}>
                                                {item.time}
                                            </span>

                                            {/* Icon */}
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                isCurrent ? 'bg-primary-100 text-primary-600 border-primary-200' :
                                                    item.color
                                                }`}>
                                                {isDone ? (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                ) : (
                                                    <IconComp className="w-5 h-5" />
                                                )}
                                            </div>

                                            {/* Label */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${isDone ? 'text-slate-500 line-through' :
                                                    isCurrent ? 'text-primary-800 font-semibold' :
                                                        'text-slate-700'
                                                    }`}>
                                                    {item.label}
                                                    {isCurrent && <span className="ml-2 text-xs bg-primary-200 text-primary-700 px-2 py-0.5 rounded-full font-medium animate-pulse">NOW</span>}
                                                </p>
                                                {item.description && (
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                                                )}
                                                {item.isTherapy && item.duration && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <span className="text-xs text-slate-400">{item.duration} min</span>
                                                        {item.domain && (
                                                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.domain}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Status / Action */}
                                            {item.isTherapy && !isDone && (
                                                <button
                                                    onClick={() => completeTask(item.taskId)}
                                                    className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors font-medium border border-primary-200"
                                                >
                                                    ✓ Done
                                                </button>
                                            )}
                                            {isDone && item.isTherapy && (
                                                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Bottom tip */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm text-blue-700 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        <strong>Tip:</strong> Visual schedules help children with ASD understand and predict their day.
                        Consistent routines reduce anxiety and improve transitions between activities.
                    </span>
                </p>
            </div>
        </div>
    );
};

export default VisualSchedule;
