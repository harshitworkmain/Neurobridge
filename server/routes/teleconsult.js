import { Router } from 'express';
import {
    createAppointment,
    getUserAppointments,
    getClinicianSchedule,
    updateAppointmentStatus,
    saveSessionNotes,
    getPatientSessionNotes,
    generateRoomToken,
    checkMissedAppointments
} from '../engines/teleconsultEngine.js';

const router = Router();

// ============================================
// APPOINTMENT ROUTES
// ============================================

// POST /appointments — Create appointment
router.post('/appointments', (req, res) => {
    try {
        const { patient_id, clinician_id, scheduled_at, duration_minutes, type, notes } = req.body;
        const result = createAppointment({ patient_id, clinician_id, scheduled_at, duration_minutes, type, notes });
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /appointments/user/:userId — User's appointments
router.get('/appointments/user/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const appointments = getUserAppointments(userId);
        res.json({ success: true, appointments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /appointments/clinician/:clinicianId — Clinician's schedule
router.get('/appointments/clinician/:clinicianId', (req, res) => {
    try {
        const clinicianId = parseInt(req.params.clinicianId);
        if (isNaN(clinicianId)) return res.status(400).json({ error: 'Invalid clinician ID' });

        const schedule = getClinicianSchedule(clinicianId);
        res.json({ success: true, schedule });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /appointments/:id/status — Update appointment status
router.patch('/appointments/:id/status', (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        if (isNaN(appointmentId)) return res.status(400).json({ error: 'Invalid appointment ID' });

        const { status } = req.body;
        const result = updateAppointmentStatus(appointmentId, status);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// SESSION NOTES ROUTES
// ============================================

// POST /session-notes — Save session notes
router.post('/session-notes', (req, res) => {
    try {
        const { appointment_id, clinician_id, patient_id, content, follow_up_actions, linked_screening_id } = req.body;
        const result = saveSessionNotes({ appointment_id, clinician_id, patient_id, content, follow_up_actions, linked_screening_id });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /session-notes/patient/:patientId — Get all session notes for a patient
router.get('/session-notes/patient/:patientId', (req, res) => {
    try {
        const patientId = parseInt(req.params.patientId);
        if (isNaN(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

        const notes = getPatientSessionNotes(patientId);
        res.json({ success: true, notes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TELECONSULT TOKEN ROUTE
// ============================================

// GET /teleconsult/token — Generate room token for WebRTC signaling
router.get('/teleconsult/token', (req, res) => {
    try {
        const { appointment_id } = req.query;
        if (!appointment_id) return res.status(400).json({ error: 'appointment_id query param required' });

        const userId = (req.user && req.user.id) ? req.user.id : 1;
        const token = generateRoomToken(parseInt(appointment_id), userId);
        res.json({ success: true, ...token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /teleconsult/check-missed — Check for missed appointments (internal/cron)
router.post('/teleconsult/check-missed', (req, res) => {
    try {
        const result = checkMissedAppointments();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
