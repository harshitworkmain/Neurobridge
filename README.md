<div align="center">
  <h1>NeuroBridge AI</h1>
  <p><strong>A Full Remote Autism Care Ecosystem</strong></p>
  <p>AI-powered neurodevelopmental screening, interactive therapy, and clinical intelligence.</p>
</div>

![Landing Page](docs/assets/landing-page.png)

---

NeuroBridge AI has evolved from a screening tool into a **comprehensive Continuous Remote Care Ecosystem**. Designed for caregivers and clinicians, it combines real-time computer vision, interactive therapy games, and clinical intelligence tools into a cohesive web platform to assist in early ASD screening and therapy planning.

## 🌐 Live Deployments

- **Frontend Application:** [https://neurobridge-app.onrender.com](https://neurobridge-app.onrender.com)
- **Backend API:** [https://neurobridge-api.onrender.com](https://neurobridge-api.onrender.com)

*(Note: Initial load may take up to 50 seconds on the free tier of Render).*

---

## ✨ Key Features & Modules

### 🧠 1. AI Screening & Risk Assessment
A robust initial screening tool that uses the device camera to analyze facial and behavioral features.
- **Real-time Face Analysis:** Uses MediaPipe Face Mesh (468 landmarks) to track expressions.
- **Hybrid Gaze Tracking:** Iris and nose-based attention scoring to assess focus and eye contact.
- **Behavioral Questionnaire Fusion:** Multi-modal risk assessment combining AI metrics with standardized questions.
- **Triage Classification:** Provides severity classification with clinical explanations.

![AI Screening](docs/assets/screening-model.png)

### 🎮 2. Therapy Games
An interactive hub with 4 custom-built Phaser games designed specifically for neurodevelopmental therapy.
- **Memory Match:** Visual memory training with OpenMoji emoji cards, animations, and tiered difficulty.
- **Day Builder:** ADL (Activities of Daily Living) sequencing using drag-and-drop mechanics to build daily routines.
- **Emotion Mirror:** Webcam-based emotion matching game that prompts children to mimic expressions.
- **Gaze Garden:** Sustained attention training using a click-and-hold focus mechanic.
- **Caregiver Co-Play:** Includes note-taking functionality during games and game session replays.

![Games Hub](docs/assets/games.png)

### 📊 3. Clinician Intelligence & Analytics
A powerful dashboard designed for clinical professionals to monitor patient progress over time.
- **Patient Trends & Cohort Analytics:** Track engagement, therapy effectiveness, and overall progress.
- **Regression Alerts:** Automatically detects regressions in skills and alerts the clinician.
- **Therapy Goal Management:** Set, track, and update domain-based therapy goals.
- **Recharts-powered Dashboards:** Comprehensive line, area, bar, and radar charts.

![Dashboard Preview](docs/assets/dashboard.png)

![Clinician Worklist](docs/assets/clinician-login-worklist.png)

### 👥 4. Community Platform
A safe, supportive forum for caregivers to share experiences, ask questions, and build a network.
- **ML Content Moderation:** Integration with TensorFlow.js Toxicity model for automated moderation and profanity filtering.
- **"Ask a Clinician" Section:** Dedicated category with clinician verification badges.
- **Community Features:** Pinned posts, bookmarks, likes, nested comments, and post reporting.

![Community Platform](docs/assets/community.png)

### 📹 5. Teleconsultation
Integrated video calls for remote consultations and therapy sessions.
- **WebRTC Video Calls:** Uses Socket.IO for signaling and Metered TURN servers for reliable real-time video.
- **Appointment Management:** Weekly calendar grid views for easy scheduling.
- **Session Notes & Summaries:** Pre-visit clinical snapshots and post-session note keeping.

![Teleconsultation](docs/assets/teleconsult.png)

### 🔔 6. Engagement & Notifications
Proactive tools to keep caregivers and patients engaged.
- **Visual Schedule with Voice Readback:** Daily routines using the Web Speech API.
- **Automated Push Notifications:** Web Push and VAPID powered reminders for therapy and appointments.
- **Email Reports:** Weekly progress email digests using Nodemailer.
- **Automated Scheduler:** Cron jobs for daily reminders, notification cleanup, and streak tracking.

![Therapy Plan](docs/assets/therapy-plan.png)

---

## 🛠️ Architecture & Tech Stack

This project is built with a modern, decoupled architecture capable of seamless scaling:

| Layer           | Technologies                                                                 |
|-----------------|------------------------------------------------------------------------------|
| **Frontend**    | React 19, Vite 7, Tailwind CSS 4, Recharts, Phaser 3, Framer Motion         |
| **Backend**     | Node.js 22, Express 5, Socket.IO, Nodemailer, web-push                      |
| **Database**    | SQLite (via `better-sqlite3`) — *Designed to be PostgreSQL migration-ready* |
| **AI / ML**     | MediaPipe Face Mesh, TensorFlow.js Toxicity Model, Web Speech API           |
| **Testing**     | Playwright (E2E Suites)                                                     |

### Architectural Highlights
- **Sensory-Safe / Calm Mode:** Disables harsh animations, mutes gradients, and reduces cognitive load at the flip of a switch.
- **Age-Adaptive UI:** Automatically scales typography and spacing based on user age profiles.
- **API Versioning Prefix:** Future-proofed under `/api/v1` with a centralized API configuration utility.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/en/) 22.0.0 or higher
- npm 10.0.0 or higher

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/harshitworkmain/Neurobridge.git
   cd Neurobridge
   git checkout neurobridge-v2
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   *(The default variables are sufficient for local development. If you wish to test Email or Push Notifications, you will need to add SMTP credentials and VAPID keys to the `.env` file).*

4. **Start the Backend Server (Port 3001)**
   ```bash
   node server/index.js
   ```

5. **Start the Frontend Application (Port 5173)**
   ```bash
   # Open a new terminal instance
   npm run dev
   ```

6. **View the Application**
   Open your browser and navigate to [http://localhost:5173](http://localhost:5173).

---

## 🛡️ License & Disclaimer

This project is part of academic research. All rights reserved.

> ⚠️ **Disclaimer:** NeuroBridge is a continuous remote care and screening support tool. It is **not** a diagnostic instrument. All screening and assessment results are intended to assist caregivers and should be reviewed by a qualified healthcare professional.
