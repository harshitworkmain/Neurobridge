import db from '../db.js';
import crypto from 'crypto';

// ============================================
// TELECONSULTATION ENGINE
// Handles: Appointments, Session Notes, Room Tokens
// ============================================

/**
 * Create a new appointment
 */
export function createAppointment({ patient_id, clinician_id, scheduled_at, duration_minutes, type, notes }) {
    if (!patient_id || !clinician_id || !scheduled_at) {
        throw new Error('patient_id, clinician_id, and scheduled_at are required');
    }

    const meeting_room_id = crypto.randomUUID();

    const stmt = db.prepare(`
    INSERT INTO appointments (patient_id, clinician_id, scheduled_at, duration_minutes, meeting_room_id, type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const info = stmt.run(
        patient_id,
        clinician_id,
        scheduled_at,
        duration_minutes || 30,
        meeting_room_id,
        type || 'consultation',
        notes || null
    );

    // Create notifications for both parties
    createNotification(patient_id, 'appointment_scheduled', 'teleconsult',
        'Appointment Scheduled',
        `You have a ${type || 'consultation'} on ${new Date(scheduled_at).toLocaleString()}`,
        `/appointments`
    );
    createNotification(clinician_id, 'appointment_scheduled', 'teleconsult',
        'New Appointment',
        `Patient appointment scheduled for ${new Date(scheduled_at).toLocaleString()}`,
        `/appointments`
    );

    return {
        id: info.lastInsertRowid,
        meeting_room_id,
        status: 'scheduled'
    };
}

/**
 * Get appointments for a user (patient or clinician)
 */
export function getUserAppointments(userId) {
    const appointments = db.prepare(`
    SELECT 
      a.*,
      p.name as patient_name,
      p.age_string as patient_age,
      c.name as clinician_name,
      c.role as clinician_role
    FROM appointments a
    JOIN users p ON a.patient_id = p.id
    JOIN users c ON a.clinician_id = c.id
    WHERE a.patient_id = ? OR a.clinician_id = ?
    ORDER BY a.scheduled_at ASC
  `).all(userId, userId);

    return appointments.map(a => ({
        ...a,
        is_past: new Date(a.scheduled_at) < new Date(),
        is_today: isToday(new Date(a.scheduled_at))
    }));
}

/**
 * Get clinician-specific appointment schedule
 */
export function getClinicianSchedule(clinicianId) {
    return db.prepare(`
    SELECT 
      a.*,
      p.name as patient_name,
      p.age_string as patient_age
    FROM appointments a
    JOIN users p ON a.patient_id = p.id
    WHERE a.clinician_id = ?
    ORDER BY a.scheduled_at ASC
  `).all(clinicianId);
}

/**
 * Update appointment status
 */
export function updateAppointmentStatus(appointmentId, status) {
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    if (!appointment) throw new Error('Appointment not found');

    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, appointmentId);

    // Notify on status change
    if (status === 'cancelled') {
        createNotification(appointment.patient_id, 'appointment_cancelled', 'teleconsult',
            'Appointment Cancelled',
            `Your appointment on ${new Date(appointment.scheduled_at).toLocaleString()} has been cancelled.`,
            `/appointments`
        );
    } else if (status === 'completed') {
        createNotification(appointment.patient_id, 'appointment_completed', 'teleconsult',
            'Session Complete',
            'Your consultation has ended. Check your session notes.',
            `/appointments`
        );
    }

    return { success: true, id: appointmentId, status };
}

/**
 * Save session notes
 */
export function saveSessionNotes({ appointment_id, clinician_id, patient_id, content, follow_up_actions, linked_screening_id }) {
    if (!appointment_id || !clinician_id || !patient_id) {
        throw new Error('appointment_id, clinician_id, and patient_id are required');
    }

    const stmt = db.prepare(`
    INSERT INTO session_notes (appointment_id, clinician_id, patient_id, content, follow_up_actions, linked_screening_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    const info = stmt.run(
        appointment_id,
        clinician_id,
        patient_id,
        content || '',
        follow_up_actions ? JSON.stringify(follow_up_actions) : null,
        linked_screening_id || null
    );

    // Notify patient
    createNotification(patient_id, 'session_notes_added', 'teleconsult',
        'Session Notes Available',
        'Your clinician has added notes from your recent session.',
        `/session-notes`
    );

    return { id: info.lastInsertRowid, success: true };
}

/**
 * Get session notes for a patient
 */
export function getPatientSessionNotes(patientId) {
    const notes = db.prepare(`
    SELECT 
      sn.*,
      c.name as clinician_name,
      a.scheduled_at as appointment_date,
      a.type as appointment_type
    FROM session_notes sn
    JOIN appointments a ON sn.appointment_id = a.id
    JOIN users c ON sn.clinician_id = c.id
    WHERE sn.patient_id = ?
    ORDER BY sn.created_at DESC
  `).all(patientId);

    return notes.map(n => ({
        ...n,
        follow_up_actions: n.follow_up_actions ? JSON.parse(n.follow_up_actions) : []
    }));
}

/**
 * Generate a meeting room token for WebRTC signaling
 */
export function generateRoomToken(appointmentId, userId) {
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    if (!appointment) throw new Error('Appointment not found');

    // Verify user is participant
    if (appointment.patient_id !== userId && appointment.clinician_id !== userId) {
        throw new Error('User is not a participant in this appointment');
    }

    return {
        meeting_room_id: appointment.meeting_room_id,
        appointment_id: appointmentId,
        user_id: userId,
        role: appointment.clinician_id === userId ? 'clinician' : 'patient',
        patient_name: db.prepare('SELECT name FROM users WHERE id = ?').get(appointment.patient_id)?.name,
        clinician_name: db.prepare('SELECT name FROM users WHERE id = ?').get(appointment.clinician_id)?.name,
        expires_at: new Date(new Date(appointment.scheduled_at).getTime() + (appointment.duration_minutes + 30) * 60000).toISOString()
    };
}

/**
 * Check for missed appointments and generate alerts
 */
export function checkMissedAppointments() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000).toISOString();

    const missed = db.prepare(`
    SELECT * FROM appointments 
    WHERE status = 'scheduled' 
    AND scheduled_at < ?
  `).all(thirtyMinutesAgo);

    for (const appointment of missed) {
        // Check if alert already exists
        const existingAlert = db.prepare(`
      SELECT id FROM alerts 
      WHERE user_id = ? AND type = 'missed_appointment' AND resolved = 0
    `).get(appointment.patient_id);

        if (!existingAlert) {
            try {
                db.prepare(`
          INSERT INTO alerts (user_id, type, severity, message)
          VALUES (?, 'missed_appointment', 'medium', ?)
        `).run(
                    appointment.patient_id,
                    `Missed appointment on ${new Date(appointment.scheduled_at).toLocaleString()}`
                );
            } catch (e) {
                console.warn('Missed appointment alert skipped:', e.message);
            }
        }
    }

    return { missed_count: missed.length };
}

// ============================================
// HELPERS
// ============================================

function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
}

function createNotification(userId, type, sourceModule, title, message, link) {
    try {
        db.prepare(`
      INSERT INTO notifications (user_id, type, source_module, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, sourceModule, title, message, link);
    } catch (e) {
        console.warn('Notification creation failed:', e.message);
    }
}
