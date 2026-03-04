# NeuroBridge AI - Project Context Document

## Overview
**NeuroBridge AI** is an AI-enabled platform for **Early Autism Screening, Clinician Decision Support, and Longitudinal Outcome Improvement**. It is designed as a cost-effective, clinician-in-the-loop solution that integrates multimodal behavioral and neural data to support early screening, personalized therapy planning, continuous monitoring, and caregiver empowerment across the autism care continuum.

This project was developed for **TATA ELSI x Teliport Hackathon** focusing on pediatric healthcare innovation.

---

## Problem Statement
- Autism diagnosis remains **delayed, subjective, and specialist-constrained**, especially due to limited access to ADOS-trained experts.
- Critical early neurodevelopmental signals (6–12 months) are often missed, leading to delayed intervention and poorer outcomes.
- Post-diagnosis care is **fragmented**, with limited objective progress tracking and high caregiver burden.

---

## Solution Architecture

### Core Components
1. **Multimodal AI-Driven Screening** (Objective & Explainable)
   - **Computer Vision**: Eye-gaze tracking, joint attention analysis, facial micro-expressions via MediaPipe
   - **EEG** (Simulated): Neural response signatures and attention-related biomarkers
   - **Behavioral Inputs**: Caregiver observations and developmental questionnaires
   - **Multimodal Fusion Model**: Generates an explainable screening confidence score with modality-wise evidence

2. **Clinician Decision Support**
   - AI provides structured evidence summaries to support neurologists and ADOS-trained specialists
   - Enables remote review and triaging, significantly scaling specialist reach
   - Designed to reduce subjectivity while preserving clinical judgment

3. **Personalized Therapy & Longitudinal Monitoring**
   - Adaptive therapy plans across speech, motor, social, and learning domains
   - Time-series progress tracking, gap-reduction metrics, and early regression alerts
   - Unified developmental progress reports accessible to caregivers, therapists, and specialists

4. **Caregiver & Community Support Ecosystem**
   - Integrated parent support groups, therapist-moderated forums, and resource libraries
   - Improves therapy adherence, emotional support, and caregiver engagement through shared learning

---

## Technical Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework |
| **Vite 7** | Build tool & Dev Server |
| **Tailwind CSS 4** | Styling |
| **Framer Motion** | Animations |
| **Recharts** | Data visualization (charts/graphs) |
| **Lucide React** | Icon library |
| **React Router DOM** | Client-side routing |
| **@mediapipe/tasks-vision** | Real-time face landmark detection (478 3D points) |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 22** | Runtime |
| **Express 5** | API Server |
| **better-sqlite3** | Local SQLite database |
| **Jimp** | Server-side image processing for heatmap analysis |
| **CORS** | Cross-origin resource sharing |

---

## File Structure

```
neurobridge/
├── server/                     # Backend API
│   ├── index.js               # Express server with API routes
│   ├── db.js                  # SQLite database setup & migrations
│   ├── visionModel.js         # Heatmap analysis algorithm
│   └── neurobridge.db         # SQLite database file
├── src/
│   ├── App.jsx                # Main app with routing
│   ├── main.jsx               # React entry point
│   ├── index.css              # Global styles
│   ├── layouts/
│   │   └── Layout.jsx         # Main layout with navigation
│   ├── pages/
│   │   ├── Home.jsx           # Dashboard/landing page
│   │   ├── Screening.jsx      # **MAIN AI SCREENING PAGE** - Webcam + MediaPipe
│   │   ├── Therapy.jsx        # Personalized therapy plans
│   │   ├── Progress.jsx       # Longitudinal tracking charts
│   │   ├── Community.jsx      # Parent support community
│   │   ├── Clinician.jsx      # Clinician dashboard (password: admin123)
│   │   └── Consent.jsx        # Parental consent flow
│   └── utils/
│       ├── mockApi.js         # API proxy layer
│       └── mockData.js        # Sample data
├── package.json
├── vite.config.js
├── tailwind.config.js
└── node-v22.12.0-linux-x64/   # Local Node.js installation
```

---

## Key Features - Implementation Status

### ✅ Fully Implemented
| Feature | Description |
|---------|-------------|
| **Real-time Face Detection** | MediaPipe FaceLandmarker running at ~30fps in browser |
| **Live Attention Index** | Calculated from nose position relative to screen center (0-100 scale) |
| **Gaze Heatmap Generation** | Accumulates gaze points during screening session |
| **Ensemble Risk Scoring** | `Score = 0.45*Vision + 0.35*Attention + 0.20*Motor` |
| **SQLite Data Persistence** | All screening sessions saved with timestamps |
| **Longitudinal Progress Charts** | Recharts-based visualization with trend detection |
| **Regression Alerts** | Backend detects attention score drops and warns |
| **Clinician Dashboard** | View patient roster, detailed reports, toggle raw/summary view |

### 🚧 Simulated/Placeholder
| Feature | Current State |
|---------|--------------|
| **EEG Integration** | Simulated random values (no hardware) |
| **Community Forum** | Static UI with hardcoded posts |
| **Multi-user Auth** | Single demo user (ID: 1) |

---

## AI Model Logic

### Frontend: Real-Time Processing (`Screening.jsx`)
1. **Camera Feed** → MediaPipe `FaceLandmarker` (WASM-based, runs locally)
2. **478 Face Landmarks** extracted per frame
3. **Nose Tip (Landmark #1)** used as gaze proxy
4. **Live Attention Index**: `100 - (distance_from_center * 250)`, clamped 0-100
5. **Heatmap Canvas**: Red dots drawn at nose position each frame

### Backend: Risk Analysis (`server/visionModel.js`)
1. **Heatmap Image** sent as Base64 PNG
2. **Jimp** scans pixels for red/orange "heat" zones
3. **Centroid Calculation**: Find center of mass of hot pixels
4. **Variance Calculation**: Measure spatial spread of gaze
5. **Risk Interpretation**:
   - Low variance (concentrated) → Low risk (sustained attention)
   - High variance (scattered) → High risk (fragmented gaze)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user` | Get current user profile |
| POST | `/api/screenings` | Save screening session with metrics |
| POST | `/api/model_infer` | Analyze heatmap image, return risk score |
| GET | `/api/progress` | Get all screening history with trend analysis |

---

## How to Run Locally

```bash
# Navigate to project
cd /home/harshit/Documents/NN/neurobridge

# Set up Node.js 22 (local installation exists in project)
export PATH=$PWD/node-v22.12.0-linux-x64/bin:$PATH

# Install dependencies (if needed)
npm install

# Start backend server (runs on port 3001)
node server/index.js &

# Start frontend dev server (runs on port 5173)
npm run dev
```

**Access Points:**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Clinician Login: Code is `admin123`

---

## Current Session Notes (Feb 2026)

### Recent Fixes Applied
1. **React Closure Bug Fixed**: Added `isCapturingRef` to prevent stale state in requestAnimationFrame loop
2. **Heatmap Visibility**: Increased opacity from 0.05 to 0.15
3. **Debug Logging**: Added console logs to track AI processing (🎥, 🧠, 📊 emojis)
4. **Canvas Initialization**: Properly size heatmap canvas when camera starts

### Known Constraints
- Requires **HTTPS or localhost** for camera access
- **Node.js 22+** required (older versions fail with Vite 7)
- Backend uses native SQLite bindings (requires rebuild if Node version changes)

---

## Vision Alignment (From Original One-Slider)

The project implements the core vision of:
- ✅ Multimodal data integration (video + behavioral)
- ✅ Accurate, explainable screening insights
- ✅ Clinician-in-the-loop decision support
- ✅ Longitudinal outcome tracking & gap reduction
- ✅ Ethical handling of pediatric data (consent flow)

**Not yet implemented**: Full agent-based orchestration layer, real EEG hardware integration, therapist-moderated live forums.

---

## Repository
- GitHub: `https://github.com/Akshayk1129/Neurobridge`
- Vercel (if deployed): `https://neurobridge.vercel.app` (frontend only)

---

*This document serves as comprehensive context for AI assistants working on this codebase.*
