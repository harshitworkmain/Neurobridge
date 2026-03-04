import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import VideoCall from '../components/VideoCall';
import {
    Video, Calendar, Clock, Plus, X, User, FileText, ChevronRight,
    Loader, CheckCircle2, XCircle, AlertTriangle, Phone, ArrowRight,
    Stethoscope, MessageSquare, List, CalendarDays, ChevronLeft
} from 'lucide-react';

import API from '../config/api.js';

const Appointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [formData, setFormData] = useState({
        patient_id: 1,
        clinician_id: 1,
        scheduled_at: '',
        duration_minutes: 30,
        type: 'consultation',
        notes: ''
    });
    const [notesData, setNotesData] = useState({ content: '', follow_up_actions: '' });
    const [saving, setSaving] = useState(false);
    const [sessionNotes, setSessionNotes] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
    const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
    const [activeCall, setActiveCall] = useState(null); // { roomId, appointmentId }

    useEffect(() => {
        loadAppointments();
        loadSessionNotes();
    }, []);

    const loadAppointments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/appointments/user/1`);
            if (res.ok) {
                const data = await res.json();
                setAppointments(data.appointments || []);
            }
        } catch (e) {
            console.error('Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadSessionNotes = async () => {
        try {
            const res = await fetch(`${API}/session-notes/patient/1`);
            if (res.ok) {
                const data = await res.json();
                setSessionNotes(data.notes || []);
            }
        } catch (e) {
            console.error('Notes load error:', e);
        }
    };

    const createAppointment = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${API}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setShowCreateModal(false);
                setFormData({ patient_id: 1, clinician_id: 1, scheduled_at: '', duration_minutes: 30, type: 'consultation', notes: '' });
                await loadAppointments();
            }
        } catch (e) {
            console.error('Create error:', e);
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (appointmentId, status) => {
        try {
            await fetch(`${API}/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            await loadAppointments();
        } catch (e) {
            console.error('Status update error:', e);
        }
    };

    const saveNotes = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch(`${API}/session-notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appointment_id: selectedAppointment.id,
                    clinician_id: selectedAppointment.clinician_id,
                    patient_id: selectedAppointment.patient_id,
                    content: notesData.content,
                    follow_up_actions: notesData.follow_up_actions ? notesData.follow_up_actions.split('\n').filter(Boolean) : []
                })
            });
            setShowNotesModal(false);
            setNotesData({ content: '', follow_up_actions: '' });
            await loadSessionNotes();
        } catch (e) {
            console.error('Notes error:', e);
        } finally {
            setSaving(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            scheduled: 'bg-blue-100 text-blue-700',
            in_progress: 'bg-amber-100 text-amber-700',
            completed: 'bg-emerald-100 text-emerald-700',
            cancelled: 'bg-red-100 text-red-700'
        };
        return (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
                {status?.replace('_', ' ')}
            </span>
        );
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    // Group appointments by date
    const grouped = appointments.reduce((acc, apt) => {
        const day = formatDate(apt.scheduled_at);
        if (!acc[day]) acc[day] = [];
        acc[day].push(apt);
        return acc;
    }, {});

    const upcomingCount = appointments.filter(a => a.status === 'scheduled' && !a.is_past).length;
    const completedCount = appointments.filter(a => a.status === 'completed').length;

    if (loading) return (
        <div className="flex h-[70vh] items-center justify-center">
            <div className="text-center">
                <Loader className="animate-spin text-primary-600 w-10 h-10 mx-auto mb-4" />
                <p className="text-slate-500">Loading appointments...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* WebRTC Video Call Overlay */}
            {activeCall && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl">
                        <VideoCall
                            roomId={activeCall.roomId}
                            userId={1}
                            userName="Alex (Parent)"
                            onEnd={() => {
                                setActiveCall(null);
                                loadAppointments();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Teleconsultation</h1>
                    <p className="text-slate-500 mt-1">Schedule and manage video consultations with your clinician.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Schedule Appointment
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Upcoming</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{upcomingCount}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Completed</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{completedCount}</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Session Notes</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{sessionNotes.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                            <FileText className="w-6 h-6 text-violet-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200 w-fit">
                <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <List className="w-4 h-4" /> List
                </button>
                <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <CalendarDays className="w-4 h-4" /> Calendar
                </button>
            </div>

            {/* Calendar View */}
            {viewMode === 'calendar' && (() => {
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay() + (calendarWeekOffset * 7));
                startOfWeek.setHours(0, 0, 0, 0);

                const weekDays = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(startOfWeek);
                    d.setDate(startOfWeek.getDate() + i);
                    return d;
                });

                const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8AM to 6PM
                const isToday = (d) => d.toDateString() === now.toDateString();

                const getAptsForDayHour = (day, hour) => {
                    return appointments.filter(a => {
                        const d = new Date(a.scheduled_at);
                        return d.toDateString() === day.toDateString() && d.getHours() === hour;
                    });
                };

                const statusColors = {
                    scheduled: 'bg-blue-100 border-blue-300 text-blue-800',
                    in_progress: 'bg-amber-100 border-amber-300 text-amber-800',
                    completed: 'bg-emerald-100 border-emerald-300 text-emerald-800',
                    cancelled: 'bg-red-50 border-red-200 text-red-400 line-through'
                };

                return (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => setCalendarWeekOffset(o => o - 1)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <p className="text-sm font-semibold text-slate-700">
                                {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-1">
                                {calendarWeekOffset !== 0 && (
                                    <button
                                        onClick={() => setCalendarWeekOffset(0)}
                                        className="text-xs text-primary-600 hover:bg-primary-50 px-2 py-1 rounded-lg font-medium transition-colors"
                                    >
                                        Today
                                    </button>
                                )}
                                <button
                                    onClick={() => setCalendarWeekOffset(o => o + 1)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <div className="min-w-[700px]">
                                {/* Day Headers */}
                                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100">
                                    <div className="p-2" />
                                    {weekDays.map((d, i) => (
                                        <div key={i} className={`p-2 text-center border-l border-slate-100 ${isToday(d) ? 'bg-primary-50' : ''}`}>
                                            <p className="text-[10px] text-slate-400 uppercase">{d.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                                            <p className={`text-sm font-bold ${isToday(d) ? 'text-primary-600' : 'text-slate-700'}`}>{d.getDate()}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Time Grid */}
                                {hours.map(hour => (
                                    <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-50 min-h-[48px]">
                                        <div className="p-1 text-[10px] text-slate-400 text-right pr-2 pt-1">
                                            {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                                        </div>
                                        {weekDays.map((day, di) => {
                                            const apts = getAptsForDayHour(day, hour);
                                            return (
                                                <div key={di} className={`border-l border-slate-50 p-0.5 ${isToday(day) ? 'bg-primary-50/30' : ''}`}>
                                                    {apts.map(a => (
                                                        <div
                                                            key={a.id}
                                                            className={`text-[10px] px-1.5 py-1 rounded border mb-0.5 cursor-default ${statusColors[a.status] || 'bg-slate-50 border-slate-200'}`}
                                                            title={`${a.type} — ${a.duration_minutes}min`}
                                                        >
                                                            <p className="font-semibold truncate">{formatTime(a.scheduled_at)}</p>
                                                            <p className="truncate">{a.type}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Appointments List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Video className="w-5 h-5 text-primary-600" />
                        Appointments
                    </h2>
                </div>

                {appointments.length === 0 ? (
                    <div className="p-12 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700">No appointments yet</h3>
                        <p className="text-slate-500 mt-1 mb-4">Schedule your first consultation to get started.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Schedule Now
                        </button>
                    </div>
                ) : (
                    <div>
                        {Object.entries(grouped).map(([day, dayAppointments]) => (
                            <div key={day}>
                                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{day}</p>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {dayAppointments.map(apt => (
                                        <div key={apt.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                {/* Time */}
                                                <div className="w-16 text-center shrink-0">
                                                    <p className="text-lg font-bold text-slate-900">{formatTime(apt.scheduled_at)}</p>
                                                    <p className="text-xs text-slate-400">{apt.duration_minutes}m</p>
                                                </div>

                                                {/* Divider */}
                                                <div className="w-px h-12 bg-slate-200 shrink-0" />

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-semibold text-slate-900 truncate">
                                                            {apt.type === 'consultation' ? 'Consultation' : apt.type === 'follow_up' ? 'Follow-up' : apt.type}
                                                        </p>
                                                        {getStatusBadge(apt.status)}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3.5 h-3.5" />
                                                            {apt.patient_name || 'Patient'} • {apt.clinician_name || 'Clinician'}
                                                        </span>
                                                    </div>
                                                    {apt.notes && (
                                                        <p className="text-xs text-slate-400 mt-1 truncate">{apt.notes}</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {apt.status === 'scheduled' && !apt.is_past && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    updateStatus(apt.id, 'in_progress');
                                                                    setActiveCall({ roomId: `neurobridge-apt-${apt.id}`, appointmentId: apt.id });
                                                                }}
                                                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                                                            >
                                                                <Video className="w-3.5 h-3.5" />
                                                                Join Call
                                                            </button>
                                                            <button
                                                                onClick={() => updateStatus(apt.id, 'cancelled')}
                                                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                                                                title="Cancel"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {apt.status === 'in_progress' && (
                                                        <button
                                                            onClick={() => updateStatus(apt.id, 'completed')}
                                                            className="bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            End Call
                                                        </button>
                                                    )}
                                                    {apt.status === 'completed' && (
                                                        <button
                                                            onClick={() => { setSelectedAppointment(apt); setShowNotesModal(true); }}
                                                            className="bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Add Notes
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Session Notes */}
            {sessionNotes.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-violet-600" />
                            Session Notes
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {sessionNotes.slice(0, 5).map(note => (
                            <div key={note.id} className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Stethoscope className="w-4 h-4 text-primary-500" />
                                    <span className="text-sm font-semibold text-slate-800">{note.clinician_name}</span>
                                    <span className="text-xs text-slate-400">• {new Date(note.appointment_date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{note.content}</p>
                                {note.follow_up_actions && note.follow_up_actions.length > 0 && (
                                    <div className="mt-3 pl-4 border-l-2 border-primary-200">
                                        <p className="text-xs font-semibold text-primary-600 mb-1">Follow-up Actions:</p>
                                        {note.follow_up_actions.map((action, i) => (
                                            <p key={i} className="text-xs text-slate-600">• {action}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Schedule Appointment</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={createAppointment} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={formData.scheduled_at}
                                    onChange={e => setFormData({ ...formData, scheduled_at: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                                    <select
                                        value={formData.duration_minutes}
                                        onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value={15}>15 min</option>
                                        <option value={30}>30 min</option>
                                        <option value={45}>45 min</option>
                                        <option value={60}>60 min</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="consultation">Consultation</option>
                                        <option value="follow_up">Follow-up</option>
                                        <option value="screening_review">Screening Review</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-20 resize-none"
                                    placeholder="Any notes for the clinician..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving || !formData.scheduled_at}
                                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                                {saving ? 'Scheduling...' : 'Schedule Appointment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Session Notes Modal */}
            {showNotesModal && selectedAppointment && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowNotesModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Session Notes</h3>
                            <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={saveNotes} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes</label>
                                <textarea
                                    value={notesData.content}
                                    onChange={e => setNotesData({ ...notesData, content: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-32 resize-none"
                                    placeholder="Observations, assessment, and plan..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Actions (one per line)</label>
                                <textarea
                                    value={notesData.follow_up_actions}
                                    onChange={e => setNotesData({ ...notesData, follow_up_actions: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-20 resize-none"
                                    placeholder="Schedule follow-up in 2 weeks&#10;Increase gaze tracking exercises&#10;..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={saving || !notesData.content}
                                className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Notes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500">
                        <strong>Teleconsultation Notice.</strong> Video calls are peer-to-peer and not recorded. Session notes are stored securely on-device. This is a support tool, not a replacement for in-person clinical evaluation.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Appointments;
