// ============================================
// EMAIL ENGINE — Automated Email Reports
// Uses Nodemailer to send weekly progress reports,
// appointment reminders, and custom notifications
// ============================================

import nodemailer from 'nodemailer';
import db from '../db.js';

// Email configuration (uses Ethereal in dev, real SMTP in production)
let transporter = null;
let emailReady = false;

/**
 * Initialize email transporter
 * In development: uses Ethereal (fake SMTP — emails viewable at ethereal.email)
 * In production: uses configured SMTP (Gmail, SendGrid, etc.)
 */
export async function initEmailTransporter() {
    try {
        if (process.env.SMTP_HOST) {
            // Production SMTP
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            console.log('📧 Email: Production SMTP configured');
        } else {
            // Development — use Ethereal test account
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('📧 Email: Dev mode (Ethereal) — view at https://ethereal.email');
            console.log(`   User: ${testAccount.user}`);
        }

        emailReady = true;
    } catch (err) {
        console.warn('⚠️ Email initialization failed:', err.message);
        emailReady = false;
    }
}

/**
 * Send a generic email
 */
async function sendEmail({ to, subject, html, text }) {
    if (!emailReady || !transporter) {
        console.warn('Email not initialized — skipping send');
        return { sent: false, reason: 'not_initialized' };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NeuroBridge AI" <noreply@neurobridge.ai>',
            to,
            subject,
            html,
            text: text || subject
        });

        // For Ethereal dev mode, log the preview URL
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 Email preview: ${previewUrl}`);
        }

        return { sent: true, messageId: info.messageId, previewUrl: previewUrl || null };
    } catch (err) {
        console.error('Email send failed:', err.message);
        return { sent: false, error: err.message };
    }
}

/**
 * Generate and send weekly progress report email
 */
export async function sendWeeklyReport(userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || !user.email) return { sent: false, reason: 'no_email' };

    // Gather weekly data
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const screenings = db.prepare(
        'SELECT COUNT(*) as count FROM screenings WHERE user_id = ? AND created_at > ?'
    ).get(userId, oneWeekAgo);

    const gameSessions = db.prepare(
        'SELECT COUNT(*) as count, ROUND(AVG(accuracy_score), 1) as avg_accuracy FROM game_sessions WHERE user_id = ? AND started_at > ?'
    ).get(userId, oneWeekAgo);

    const therapyTasks = db.prepare(
        'SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM therapy_completion WHERE user_id = ? AND date > ?'
    ).get(userId, oneWeekAgo.split('T')[0]);

    const communityPosts = db.prepare(
        'SELECT COUNT(*) as count FROM community_posts WHERE author_id = ? AND created_at > ?'
    ).get(userId, oneWeekAgo);

    const childName = user.display_name || user.name || 'your child';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 8px 0 0; opacity: 0.9; }
            .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px; }
            .metric { background: #f8f9ff; border-radius: 12px; padding: 20px; text-align: center; }
            .metric .number { font-size: 32px; font-weight: 700; color: #667eea; }
            .metric .label { font-size: 13px; color: #64748b; margin-top: 4px; }
            .section { padding: 0 24px 24px; }
            .section h2 { font-size: 18px; color: #1e293b; margin: 0 0 12px; }
            .progress-bar { background: #e2e8f0; border-radius: 8px; height: 12px; overflow: hidden; }
            .progress-fill { height: 100%; border-radius: 8px; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s; }
            .footer { background: #f8f9ff; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
            .cta { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; margin: 16px 0; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧠 Weekly Progress Report</h1>
                <p>NeuroBridge AI — ${childName}'s week in review</p>
            </div>

            <div class="metrics">
                <div class="metric">
                    <div class="number">${screenings?.count || 0}</div>
                    <div class="label">Screenings</div>
                </div>
                <div class="metric">
                    <div class="number">${gameSessions?.count || 0}</div>
                    <div class="label">Game Sessions</div>
                </div>
                <div class="metric">
                    <div class="number">${gameSessions?.avg_accuracy || 0}%</div>
                    <div class="label">Avg Accuracy</div>
                </div>
                <div class="metric">
                    <div class="number">${communityPosts?.count || 0}</div>
                    <div class="label">Community Posts</div>
                </div>
            </div>

            <div class="section">
                <h2>🎯 Therapy Completion</h2>
                <p style="color: #64748b;">${therapyTasks?.completed || 0} of ${therapyTasks?.total || 0} tasks completed this week</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${therapyTasks?.total ? Math.round((therapyTasks.completed / therapyTasks.total) * 100) : 0}%"></div>
                </div>
            </div>

            <div class="section" style="text-align: center;">
                <a href="${process.env.VITE_APP_URL || 'https://neurobridge-app.onrender.com'}" class="cta">
                    View Full Dashboard →
                </a>
            </div>

            <div class="footer">
                <p>This is an automated report from NeuroBridge AI.</p>
                <p>⚕️ NeuroBridge is not a substitute for professional medical advice.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: user.email,
        subject: `📊 ${childName}'s Weekly Progress — NeuroBridge AI`,
        html,
        text: `Weekly Progress Report for ${childName}: ${screenings?.count || 0} screenings, ${gameSessions?.count || 0} game sessions, ${therapyTasks?.completed || 0}/${therapyTasks?.total || 0} therapy tasks completed.`
    });
}

/**
 * Send appointment reminder email
 */
export async function sendAppointmentReminderEmail(userId, appointment) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || !user.email) return { sent: false, reason: 'no_email' };

    const clinician = db.prepare('SELECT name, display_name FROM users WHERE id = ?').get(appointment.clinician_id);
    const clinicianName = clinician?.display_name || clinician?.name || 'your clinician';
    const appointmentTime = new Date(appointment.scheduled_at).toLocaleString();

    const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #667eea;">📅 Appointment Reminder</h2>
        <p>You have an upcoming teleconsultation session:</p>
        <div style="background: #f8f9ff; padding: 20px; border-radius: 12px; margin: 16px 0;">
            <p><strong>Clinician:</strong> ${clinicianName}</p>
            <p><strong>Time:</strong> ${appointmentTime}</p>
            <p><strong>Type:</strong> ${appointment.type || 'Consultation'}</p>
            <p><strong>Duration:</strong> ${appointment.duration_minutes || 30} minutes</p>
        </div>
        <a href="${process.env.VITE_APP_URL || 'https://neurobridge-app.onrender.com'}/appointments" 
           style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            View Appointment →
        </a>
    </div>`;

    return sendEmail({
        to: user.email,
        subject: `📅 Appointment Reminder — ${clinicianName} at ${appointmentTime}`,
        html
    });
}

/**
 * Get email system status
 */
export function getEmailStatus() {
    return {
        ready: emailReady,
        mode: process.env.SMTP_HOST ? 'production' : 'development'
    };
}
