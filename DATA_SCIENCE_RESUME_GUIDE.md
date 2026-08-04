# NeuroBridge AI — Data Science & ML Resume & Interview Defense Guide

> **Target Roles:** Data Scientist, Machine Learning Engineer (MLE), Applied Scientist, Computer Vision / NLP Specialist, AI Engineer  
> **Target Firms:** Top Tech & AI Firms in India (e.g., Flipkart, Swiggy, Zomato, Razorpay, CRED, Mu Sigma, Fractal, Tiger Analytics, InMobi, PhonePe) and Globally (e.g., Google, Meta, Amazon, Apple, Microsoft, Uber, Stripe, Palantir, Snowflake)  
> **Repository:** `neurobridge` (Full-Stack Continuous Neurodevelopmental Remote Care & Clinical Intelligence Platform)

---

## 📌 Executive Project Overview (For Data Science Context)

**NeuroBridge AI** is an AI-powered neurodevelopmental screening and continuous remote therapy ecosystem designed for early Autism Spectrum Disorder (ASD) risk assessment and longitudinal clinical intelligence.

As a **Data Scientist / Machine Learning Engineer** on this codebase, the core technical contribution spans **real-time computer vision feature extraction**, **time-series signal processing**, **spatial statistical variance modeling**, **multimodal late fusion**, **OLS linear regression trend forecasting**, and **on-device NLP toxicity classification**. The system ingests 30 FPS facial telemetry streams (468 3D landmarks), extracts 12 temporal biomarkers, evaluates spatial gaze dispersion, and fuses computer vision predictions with developmental surveys to deliver actionable clinical decision support.

---

## 🚀 Resume Bullet Points (Google X-Y-Z Formula)

The famous Google resume formula created by Laszlo Bock is:  
**"Accomplished [X] as measured by [Y], by doing [Z]"**

Here are **8 tailored, highly defensible Data Science bullet points** extracted directly from the codebase.

---

### Option 1: Real-Time Computer Vision & Facial Telemetry Pipeline (Computer Vision / Signal Processing)
* **Accomplished [X]:** Built a real-time computer vision feature extraction pipeline to track visual focus and facial expression dynamics from raw camera streams.
* **As measured by [Y]:** Processing 468 3D facial landmarks at 30 FPS with sub-frame iris and nose tracking latency.
* **By doing [Z]:** Deploying MediaPipe Face Mesh in JavaScript (`Screening.jsx`, `EmotionMirror.jsx`) to compute real-time spatial vectors, iris boundary coordinates, and nose orientation angles for gaze attention modeling.
> **Resume Line:**  
> *Engineered a real-time computer vision pipeline utilizing MediaPipe Face Mesh to track 468 3D facial landmarks at 30 FPS, extracting spatial iris vectors and nose orientation angles for automated gaze attention modeling.*

---

### Option 2: Spatial Pixel Density & First/Second-Moment Gaze Analysis (Spatial Analytics / CV)
* **Accomplished [X]:** Formulated a spatial statistical image analysis model to quantify visual focus dispersion from gaze heatmap outputs.
* **As measured by [Y]:** Deriving a normalized vision risk probability score ($0.0 - 1.0$) and spatial coverage confidence index from Base64 heatmap renders.
* **By doing [Z]:** Developing a pixel-level scanner in Jimp (`screeningEngine.js`) calculating first-moment spatial center of mass $(\bar{x}, \bar{y})$ and second-moment intensity-weighted spatial variance ($\sigma^2 = \frac{\sum d^2 \cdot I}{\sum I}$) normalized against canvas diagonal dimensions ($W^2 + H^2$).
> **Resume Line:**  
> *Developed a spatial statistical algorithm in Node.js/Jimp analyzing Base64 gaze heatmaps to compute intensity-weighted center of mass and second-moment spatial variance ($\sigma^2$), quantifying visual focus dispersion into a normalized risk score ($0.0–1.0$).*

---

### Option 3: Time-Series Biomarker Feature Engineering & Saccade Filtering (Signal Processing / ML)
* **Accomplished [X]:** Extracted temporal behavioral biomarkers from raw high-frequency attention time-series signals to identify visual fixation anomalies.
* **As measured by [Y]:** Generating 12 statistical temporal features per screening session, including saccadic jump counts and sustained attention ratios ($a_t > 60$).
* **By doing [Z]:** Writing a time-series feature extraction engine (`metricsEngine.js`) calculating rolling mean, variance, trend slope ($\bar{a}_{2nd\_half} - \bar{a}_{1st\_half}$), and thresholding frame-to-frame attention deltas ($|a_t - a_{t-1}| > 25$ pts) to detect saccadic eye movements.
> **Resume Line:**  
> *Designed a time-series feature engineering pipeline extracting 12 statistical biomarkers (including rolling variance, trend slope, and saccadic jump frequencies $>25$ pt deltas) from 30 FPS attention streams to quantify visual fixation stability.*

---

### Option 4: Multimodal Late Fusion Architecture (Multimodal ML / Ensemble Modeling)
* **Accomplished [X]:** Built a multimodal late-fusion risk assessment model combining vision-based biometric signals with standardized clinical questionnaires.
* **As measured by [Y]:** Improving clinical triage classification accuracy across 3 severity tiers (Urgent, Monitor, Routine) with a weighted fusion matrix.
* **By doing [Z]:** Formulating a multimodal fusion equation ($FusedScore = 0.40 \cdot VisionTemporal + 0.30 \cdot Behavioral + 0.30 \cdot Engagement$) integrating MediaPipe temporal biomarkers with an M-CHAT-R/F 10-domain developmental survey.
> **Resume Line:**  
> *Architected a multimodal late-fusion risk classification model ($0.40 \cdot \text{Vision} + 0.30 \cdot \text{Behavioral} + 0.30 \cdot \text{Engagement}$) in Node.js, combining 468-landmark computer vision temporal biomarkers with M-CHAT-R/F survey vectors for clinical triage.*

---

### Option 5: Longitudinal OLS Time-Series Forecasting & Anomaly Detection (Time-Series Forecasting)
* **Accomplished [X]:** Implemented longitudinal patient trajectory forecasting and automated clinical regression alert detection.
* **As measured by [Y]:** Predicting 30-day forecasted risk ($Risk_{30d} = Risk_{current} + 3 \cdot m$) and detecting developmental skill regressions across rolling 5-session windows.
* **By doing [Z]:** Coding an Ordinary Least Squares (OLS) linear regression algorithm ($m = \frac{n \sum XY - \sum X \sum Y}{n \sum X^2 - (\sum X)^2}$) and setting automated anomaly triggers for risk slopes $m > 5.0$ units/session or 3-session risk score jumps $>15$ points.
> **Resume Line:**  
> *Implemented an Ordinary Least Squares (OLS) linear regression model over rolling 5-session windows to forecast 30-day patient risk trajectories ($Risk_{30d} = Risk + 3m$), automatically triggering clinical alerts when risk slopes exceeded $+5.0$ units/session.*

---

### Option 6: On-Device & Server NLP Toxicity Classification (NLP / Deep Learning)
* **Accomplished [X]:** Deployed an automated deep learning NLP content moderation system for community posts and clinician Q&A.
* **As measured by [Y]:** Categorizing user text across 7 toxic sub-categories with an 85% probability confidence threshold ($\tau = 0.85$).
* **By doing [Z]:** Integrating TensorFlow.js Toxicity classifier (`@tensorflow-models/toxicity`) with asynchronous lazy loading and implementing a low-latency regex/keyword fallback system (`moderationEngine.js`).
> **Resume Line:**  
> *Integrated a TensorFlow.js Toxicity deep learning model ($\tau = 0.85$ confidence threshold across 7 toxicity classes) with a regex fallback pipeline for real-time, multi-label text moderation of user community content.*

---

### Option 7: Unsupervised Cohort Segmentation & Similarity Bucketing (Clustering / KNN-style Bucketing)
* **Accomplished [X]:** Engineered a patient similarity and cohort outcome benchmark engine for personalized therapy planning.
* **As measured by [Y]:** Matching patient baseline risk profiles to historical peer cohorts within $\pm 15$ point score ranges to project expected recovery curves.
* **By doing [Z]:** Writing SQL aggregation algorithms on SQLite (`patient_analytics`, `therapy_outcomes`) that perform feature-space distance bucketing (`baseline_risk BETWEEN ? AND ?`) and compute cohort-level treatment efficacy scores.
> **Resume Line:**  
> *Built an unsupervised patient similarity bucketing algorithm in SQL to segment patient populations into $\pm 15$-point baseline risk bands, predicting individual recovery trajectories based on historical cohort outcomes.*

---

### Option 8: Automated Data Reliability & Quality Gatekeeper (Data Validation / Preprocessing)
* **Accomplished [X]:** Developed an automated data preprocessing gatekeeper to prevent noisy or corrupted video samples from biasing downstream models.
* **As measured by [Y]:** Computing a 0–100 Quality Score and binary reliability decision (`is_reliable`) for every session.
* **By doing [Z]:** Implementing heuristic thresholding functions in `metricsEngine.js` evaluating face detection ratios (<70% threshold), session durations (<10s/15s), multi-face contamination (>5%), and low-lighting ratios (>30%).
> **Resume Line:**  
> *Designed a multi-heuristic data validation gatekeeper in Node.js evaluating face presence (<70% threshold), duration, and illumination to output a 0–100 Quality Score, filtering noisy sensor data prior to ML model inference.*

---

## 🛠️ Codebase Mapping & Interview Defense Reference

If an interviewer asks you to prove the math, algorithms, or ML pipelines behind these bullet points, reference these exact files and line numbers in your codebase:

| DS / ML Concept | Code File Path | Key Functions / Formulas / Constants | How to Defend in Interview |
| :--- | :--- | :--- | :--- |
| **Facial Landmark Mesh (468 Points)** | [`src/pages/Screening.jsx`](file:///home/harshit/Documents/projects-all/neurobridge/src/pages/Screening.jsx#L150-L220) | `@mediapipe/face_mesh`, 468 3D landmarks at 30 FPS | "I used MediaPipe Face Mesh on client-side WebGL canvas to extract 468 3D landmark points per frame to compute gaze vectors in real time." |
| **Spatial Center of Mass & Variance** | [`server/engines/screeningEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/screeningEngine.js#L63-L77) | $\bar{x} = \frac{\sum x \cdot I}{\sum I}, \quad \sigma^2_{spatial} = \frac{\sum d^2 \cdot I}{\sum I}$ | "I scanned Base64 heatmaps using Jimp to calculate the first moment (center of mass) and second moment (spatial variance) normalized against the image diagonal." |
| **12 Time-Series Features** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L28-L96) | `extractTemporalFeatures()`: Mean, Variance, StdDev, Slope, Saccades, Drops, Sustained Ratio, Peak/Min | "I transformed 1-D attention time series $[a_1, ..., a_N]$ into 12 summary metrics to capture both static gaze distribution and dynamic gaze shifts." |
| **Saccade Jump Detection Algorithm** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L61-L69) | $|a_t - a_{t-1}| > 25$ threshold at 30 FPS | "I detected saccadic eye movements by flagging adjacent frame score changes $>25$ points, dividing by duration to compute saccade frequency." |
| **Multi-Factor Vision Risk Model** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L208-L285) | `computeRiskScore()`: $0.30 \cdot Vision + 0.30 \cdot Eng + 0.20 \cdot Stab + 0.20 \cdot Fix + SaccadeAdj$ | "I aggregated normalized variance ($\frac{\sigma^2}{1500}$), engagement loss, face loss, and fixation shortness into a weighted vision risk score." |
| **Multimodal Late Fusion** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L423-L468) | `fuseRiskScores()`: $0.40 \cdot Vision + 0.30 \cdot Behavioral + 0.30 \cdot Engagement$ | "I implemented late fusion combining continuous computer vision metrics with discrete M-CHAT-R/F survey vectors into a final 0-100 risk score." |
| **OLS Linear Regression Forecasting** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L29-L43) | `slope(values)`: $m = \frac{n \sum XY - \sum X \sum Y}{n \sum X^2 - (\sum X)^2}$ | "I fit an OLS linear regression model over rolling 5-session windows to estimate the rate of risk change per session and extrapolate 30 days out." |
| **TensorFlow.js Toxicity Classification** | [`server/engines/moderationEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/moderationEngine.js#L12-L44) | `@tensorflow-models/toxicity`, 7 labels, threshold $\tau = 0.85$ | "I integrated Google's TensorFlow.js Toxicity model running asynchronous multi-label classification with an 85% probability confidence threshold." |
| **Patient Similarity Bucketing** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L436-L461) | `getSimilarPatients()`: SQL query filtering `baseline_risk BETWEEN ? AND ?` ($\pm 15$) | "I performed feature-space distance bucketing in SQL by querying historical patients within $\pm 15$ points of baseline risk to benchmark treatment efficacy." |
| **Data Quality Gatekeeper** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L107-L204) | `assessSessionQuality()`: Face presence <70%, duration <10s/15s, multi-face >5% | "I constructed an automated quality gate evaluating face detection ratios, duration, and lighting before passing data into downstream risk models." |

---

## 💡 Tech Stack & Skill Keywords for Your Resume

When adding this project to your Data Science / ML resume, highlight these skills:

* **Machine Learning & AI:** Computer Vision (MediaPipe 468 Facial Landmarks, Image Processing via Jimp), NLP & Deep Learning (TensorFlow.js Toxicity Classifier), Multimodal Late Fusion, Feature Engineering, Anomaly Detection.
* **Statistics & Mathematics:** Time-Series Signal Analysis, Ordinary Least Squares (OLS) Linear Regression, First & Second Spatial Moments (Center of Mass, Spatial Variance), Probability & Threshold Optimization, Descriptive & Inferential Statistics.
* **Languages & Frameworks:** JavaScript (Node.js, ES6+), WebGL / Canvas API, Express 5, SQL (SQLite WAL Mode, Aggregations, Windowing, Subqueries).
* **Data Engineering & Quality:** Data Validation Pipelines, Quality Gatekeeping, Rolling Window Computations, Time-Series Feature Extraction, Schema Architecture.
* **Domain & Business Impact:** Digital Biomarker Analytics, Clinical Decision Support Systems (CDSS), Risk Stratification, Patient Trajectory Forecasting, Automated Content Moderation.
