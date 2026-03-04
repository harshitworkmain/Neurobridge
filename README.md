# NeuroBridge AI

> AI-powered neurodevelopmental screening & therapy platform for children with ASD

NeuroBridge AI combines real-time computer vision, interactive therapy games, and clinical intelligence tools into a single web platform — designed to assist caregivers and clinicians in early ASD screening and therapy planning.

---

## Features

### 🧠 AI Screening
- **Real-time face analysis** using MediaPipe Face Mesh (468 landmarks)
- **Hybrid gaze tracking** — iris + nose-based attention scoring
- **Behavioral questionnaire** fusion for multi-modal risk assessment
- **Triage classification** with clinical explanations

### 🎮 Therapy Games (4 interactive Phaser games)
- **Memory Match** — Visual memory with OpenMoji emoji cards
- **Day Builder** — ADL sequencing (drag-drop daily routines)
- **Emotion Mirror** — Webcam-based emotion matching
- **Gaze Garden** — Sustained attention training

### 📊 Progress & Analytics
- Recharts-powered dashboards (line, area, bar, radar)
- Clinician Intelligence Mode — patient trends, regression alerts, cohort analytics
- Therapy effectiveness tracking + goal management

### 👥 Community Platform
- Category-based posts with profanity filter
- Medical disclaimer, post verification, moderation queue
- Bookmarks, likes, comments

### 📹 Teleconsultation
- WebRTC video calls with Socket.IO signaling
- Metered TURN server for NAT traversal
- Session notes + pre-visit summaries

### 🔧 Additional
- Visual Schedule with voice readback (Web Speech API)
- Automated scheduler (node-cron) — reminders, digests, cleanup
- Error boundaries on all pages
- API versioning (`/api/v1`) with legacy fallback

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4, Recharts, Phaser 3, Framer Motion |
| **Backend** | Node.js 22, Express 5, Socket.IO |
| **Database** | SQLite (better-sqlite3) — PostgreSQL-ready |
| **AI/ML** | MediaPipe Face Mesh, Web Speech API |
| **Testing** | Playwright (E2E) |

---

## Quick Start

### Prerequisites
- Node.js 22+ 
- npm 10+

### Setup

```bash
# Clone & install
git clone https://github.com/harshitworkmain/Neurobridge.git
cd Neurobridge
git checkout neurobridge-v2
npm install

# Environment (optional — defaults work for dev)
cp .env.example .env

# Start backend (port 3001)
node server/index.js

# Start frontend (port 5173) — in a separate terminal
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
neurobridge/
├── docs/                    # Project documentation
├── server/
│   ├── engines/             # Business logic modules
│   │   ├── analyticsEngine.js
│   │   ├── communityEngine.js
│   │   ├── gameEngine.js
│   │   ├── metricsEngine.js
│   │   ├── screeningEngine.js
│   │   ├── teleconsultEngine.js
│   │   ├── therapyEngine.js
│   │   └── workflowEngine.js
│   ├── routes/              # Express route handlers
│   ├── db.js                # Database schema & seeding
│   ├── index.js             # Server entry (75+ API endpoints)
│   ├── scheduler.js         # Cron jobs
│   └── socketManager.js     # WebRTC signaling
├── src/
│   ├── components/          # 12 React components
│   ├── config/api.js        # Centralized API URL config
│   ├── contexts/            # React contexts
│   ├── layouts/             # Layout wrapper
│   ├── pages/               # 11 page components
│   └── utils/               # Audio cues, fetch retry
├── tests/                   # Playwright E2E tests
├── .env.example             # Environment variable template
└── package.json
```

---

## API

Backend runs on port 3001 with 75+ endpoints. Versioned under `/api/v1` with legacy fallback.

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `/api/auth/*` | Register, login, user profile |
| Screening | `/api/screenings` | AI screening sessions |
| Therapy | `/api/therapy-plan`, `/therapy/*` | Plans, tasks, modules |
| Games | `/api/v1/games/*` | 4 interactive games + sessions |
| Community | `/api/v1/community/*` | Posts, comments, moderation |
| Analytics | `/analytics/*` | Patient trends, cohort data |
| Teleconsult | `/api/v1/appointments/*` | Video call scheduling |

---

## License

This project is part of academic research. All rights reserved.

---

> ⚠️ **Screening Support Tool.** This platform is designed to assist caregivers and clinicians. It is not a diagnostic instrument. All results should be reviewed by a qualified healthcare professional.
