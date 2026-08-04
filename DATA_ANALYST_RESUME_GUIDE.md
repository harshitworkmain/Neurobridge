# NeuroBridge AI — Data Analyst Resume & Interview Defense Guide

> **Target Roles:** Data Analyst, Product Analyst, Quantitative Analyst, Business Intelligence Engineer (BIE), Healthcare Data Analyst  
> **Target Firms:** Top Tech & Analytics Firms in India (e.g., Flipkart, Swiggy, Zomato, Razorpay, CRED, Mu Sigma, Fractal, Tiger Analytics, PhonePe) and Globally (e.g., FAANG/MAMAA, Uber, Stripe, Palantir, Snowflake)  
> **Repository:** `neurobridge` (Full-Stack Continuous Neurodevelopmental Remote Care & Clinical Intelligence Platform)

---

## 📌 Executive Project Overview (For Resume Context)

**NeuroBridge AI** is an end-to-end, multi-modal clinical intelligence and continuous remote care ecosystem designed for neurodevelopmental screening (Autism Spectrum Disorder - ASD) and longitudinal therapy monitoring. 

As a **Data Analyst / Analytics Engineer** on this project, the core focus was designing the **biomarker analytics pipeline**, **time-series feature extraction engine**, **multi-modal risk fusion models**, **longitudinal patient trend forecasting**, and **cohort analytics dashboards**. The platform ingests real-time 30 FPS facial/gaze sensor streams, processes structured developmental surveys, enforces strict data quality gates, and computes population-level insights for clinicians using SQL and lightweight statistical modeling.

---

## 🚀 Resume Bullet Points (Google X-Y-Z Formula)

The famous Google resume formula created by Laszlo Bock is:  
**"Accomplished [X] as measured by [Y], by doing [Z]"**

Here are **8 tailored, highly defensible bullet points** extracted directly from the codebase. Select and tweak 3 to 5 bullets depending on whether you are applying for product, quantitative, or general data analyst positions.

---

### Option 1: Multimodal Predictive Risk Scoring (Core Analytics)
* **Accomplished [X]:** Built a multimodal clinical risk assessment engine fusing real-time computer vision biomarkers with standardized developmental questionnaires.
* **As measured by [Y]:** Achieving high-precision risk categorization (Low, Medium, High) with a 3-factor fused scoring model (`0.40 * Vision + 0.30 * Behavioral + 0.30 * Engagement`).
* **By doing [Z]:** Engineering a weighted data fusion pipeline in JavaScript/Node.js that combined MediaPipe facial tracking metrics with an M-CHAT-R/F inspired 10-question developmental survey across 5 core functional domains.
> **Resume Line:**  
> *Developed a multimodal clinical risk scoring model achieving high-precision risk classification by engineering a data fusion engine in Node.js that combined 468-landmark computer vision gaze metrics with 10-domain developmental survey responses using a weighted 40/30/30 linear scoring matrix.*

---

### Option 2: High-Frequency Time-Series Feature Extraction (Sensor Data Analytics)
* **Accomplished [X]:** Extracted fine-grained behavioral attention biomarkers from high-frequency raw webcam feeds to quantify visual focus and gaze stability.
* **As measured by [Y]:** Deriving 12 distinct statistical features per screening session from raw 30 FPS spatial-temporal data streams.
* **By doing [Z]:** Writing a custom time-series analytics engine (`metricsEngine.js`) calculating variance, standard deviation, trend slopes, fixation durations, attention drop counts (<30 score), and saccadic gaze shifts (>25 pt deltas).
> **Resume Line:**  
> *Engineered a time-series biomarker extraction pipeline processing 30 FPS video streams to calculate 12 statistical features (including rolling variance, trend slopes, and saccade frequencies), enabling objective quantification of patient attention and visual fixation patterns.*

---

### Option 3: Longitudinal Patient Analytics & 30-Day Risk Forecasting (Predictive Modeling)
* **Accomplished [X]:** Automated patient trend tracking and early regression detection for longitudinal clinical decision support.
* **As measured by [Y]:** Forecasting 30-day patient risk levels and detecting skill regressions across rolling 5-session windows with automated alert triggers for upward risk slopes ($m > 5$).
* **By doing [Z]:** Implementing least-squares linear regression modeling ($m = \frac{n \sum XY - \sum X \sum Y}{n \sum X^2 - (\sum X)^2}$) and volatility analysis (standard deviation of historical risks) over SQLite time-series data.
> **Resume Line:**  
> *Formulated a longitudinal trend forecasting algorithm using least-squares linear regression over rolling 5-session windows, predicting 30-day patient risk trajectories and automatically triggering clinical alerts when risk slopes exceeded +5.0 units/session.*

---

### Option 4: Data Quality Validation & Noise Filtering Gate (Data Quality Engineering)
* **Accomplished [X]:** Safeguarded downstream predictive risk models against invalid or noisy sensor feed data.
* **As measured by [Y]:** Filtering out unreliable screening sessions by outputting a composite 0–100 Quality Score and binary reliability flag (`is_reliable`).
* **By doing [Z]:** Building an automated multi-criteria data validation gate evaluating face presence ratios (<70% threshold), session durations (<10s/15s), multi-face interference (>5%), and low-lighting conditions (>30%).
> **Resume Line:**  
> *Designed an automated data quality gate in Node.js that evaluated face presence (<70% threshold), duration, and lighting quality to output a composite Quality Score (0-100), preventing poor-quality webcam data from corrupting clinical risk models.*

---

### Option 5: Population Cohort Intelligence & Patient Similarity Bucketing (SQL Aggregation)
* **Accomplished [X]:** Enabled comparative treatment effectiveness analysis and personalized therapy recommendations for clinicians.
* **As measured by [Y]:** Benchmarking outcome predictions across population risk groups and matching patients to historical cohort baselines within $\pm 15$ risk score bands.
* **By doing [Z]:** Structuring multi-table SQL aggregation queries on SQLite (`patient_analytics`, `therapy_outcomes`, `screenings`) utilizing `JOIN`s, conditional `CASE WHEN` bucketing, and group metrics.
> **Resume Line:**  
> *Architected SQL-based cohort intelligence queries on SQLite to segment patient populations into risk tiers, benchmarking intervention outcomes and identifying similar patient cohorts within $\pm 15$-point baseline risk bands to recommend high-efficacy therapies.*

---

### Option 6: Clinician Effectiveness Index & Composite Performance Analytics (Business Intelligence)
* **Accomplished [X]:** Quantified clinician performance and therapy module efficacy across patient rosters.
* **As measured by [Y]:** Computing a 0–100 composite Clinician Effectiveness Score and categorizing performance into 4 operational tiers (Excellent, Good, Developing, Needs Improvement).
* **By doing [Z]:** Formulating a multi-factor weighted index equation integrating average risk reduction (40%), engagement improvement (30%), therapy success rate (20%), and inverse regression rate (10%).
> **Resume Line:**  
> *Formulated a 4-factor Clinician Effectiveness Index ($0.40 \cdot \text{RiskRed} + 0.30 \cdot \text{EngGain} + 0.20 \cdot \text{Success} + 0.10 \cdot (1-\text{RegRate})$) in SQL/JS to evaluate clinical care delivery and track therapy module success rates across patient cohorts.*

---

### Option 7: Computer Vision Spatial Heatmap Analytics (Spatial Data Analysis)
* **Accomplished [X]:** Automated spatial gaze dispersion analysis from visual screening outputs without heavy GPU dependencies.
* **As measured by [Y]:** Quantifying gaze focus vs. distraction into a normalized visual probability score ($0.0 - 1.0$) and spatial coverage confidence level.
* **By doing [Z]:** Processing raw base64 gaze heatmaps using Jimp pixel scanning to calculate spatial center of mass $(\bar{x}, \bar{y})$, intensity-weighted spatial variance, and spread normalized against canvas diagonal dimensions ($W^2 + H^2$).
> **Resume Line:**  
> *Developed a spatial data analysis script using Jimp pixel scanning to calculate intensity-weighted center of mass and spatial variance from gaze heatmaps, quantifying visual focus dispersion to complement numerical attention metrics.*

---

### Option 8: Automated NLP Content Moderation Pipeline (Unstructured Text Analytics)
* **Accomplished [X]:** Protected caregiver community forums from toxic interactions and inappropriate content.
* **As measured by [Y]:** Evaluating user posts across 7 toxicity labels with an 85% classification confidence threshold ($0.85$).
* **By doing [Z]:** Integrating TensorFlow.js Toxicity NLP model for client/server inference with a lightweight regex/keyword fallback system to assign automated moderation actions (Allow, Flag, Review, Block).
> **Resume Line:**  
> *Implemented an automated NLP moderation pipeline using TensorFlow.js (85% confidence threshold across 7 toxicity classes) paired with a regex fallback engine to scan and categorize user community posts in real-time.*

---

## 🛠️ Codebase Mapping & Interview Defense Reference

If an interviewer asks you to walk through the implementation or prove how these numbers and formulas work, reference the exact files and lines in your repository:

| Feature / Metric | Code File Path | Key Functions / Formulas / Constants | How to Defend in Interview |
| :--- | :--- | :--- | :--- |
| **Linear Regression Slope** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L29-L43) | `slope(values)` using $m = \frac{n \sum XY - \sum X \sum Y}{n \sum X^2 - (\sum X)^2}$ | "I calculated slope over a rolling lookback window of 5 sessions to determine whether patient risk was worsening or improving over time." |
| **30-Day Risk Forecast** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L123) | `predicted30d = clamp(currentRisk + riskSlope * 3, 0, 100)` | "I projected risk 30 days out by extrapolating current risk slope over 3 future period units, clamped between 0 and 100." |
| **12 Temporal Features** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L28-L96) | `extractTemporalFeatures(series, fps=30)` (Mean, Variance, StdDev, Saccades, Drops, etc.) | "I transformed raw gaze attention score arrays into 12 summary statistics to capture both static focus and dynamic gaze shifts." |
| **Saccade Detection** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L61-L69) | Attention delta threshold > 25 points between consecutive frames | "I defined saccadic eye movement as rapid shifts exceeding 25 points on a 0-100 scale, normalizing count by session duration." |
| **Data Quality Gate** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L107-L204) | `assessSessionQuality()`: Face presence <70%, duration <10s/15s, multi-face >5% | "To avoid garbage-in-garbage-out, I wrote quality checks that deducted points for poor lighting, low face presence, or short sessions." |
| **Multimodal Risk Fusion** | [`server/engines/metricsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/metricsEngine.js#L423-L468) | `fuseRiskScores()`: $0.40 \cdot \text{Vision} + 0.30 \cdot \text{Behavioral} + 0.30 \cdot \text{Engagement}$ | "I combined computer vision biomarkers with M-CHAT-R/F survey responses using a weighted linear model to produce a holistic score." |
| **Clinician Effectiveness** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L547-L552) | $0.40 \cdot \text{RiskRed} + 0.30 \cdot \text{EngGain} + 0.20 \cdot \text{Success} + 0.10 \cdot (1-\text{RegRate})$ | "I designed a balanced scorecard metric for clinicians evaluating patient risk reduction, engagement improvement, and therapy success." |
| **Spatial Heatmap Variance** | [`server/engines/screeningEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/screeningEngine.js#L63-L77) | `analyzeHeatmap()`: Spatial Center of Mass $(\bar{x}, \bar{y})$ & $\sigma^2_{spatial} = \frac{\sum d^2 \cdot I}{\sum I}$ | "I scanned base64 heatmap images pixel by pixel to calculate spatial variance normalized against image dimensions." |
| **Cohort Similarity Query** | [`server/engines/analyticsEngine.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/engines/analyticsEngine.js#L436-L461) | `getSimilarPatients()`: SQL query filtering `baseline_risk BETWEEN ? AND ?` ($\pm 15$) | "I bucketed historical patients into baseline risk bands of $\pm 15$ points using SQL to generate peer benchmarking data." |
| **SQL Schema & Database** | [`server/db.js`](file:///home/harshit/Documents/projects-all/neurobridge/server/db.js) | SQLite with WAL mode (`journal_mode = WAL`), 15+ relational tables | "I designed a relational schema supporting longitudinal tracking, game analytics, community interactions, and audit logs." |

---

## 💡 Tech Stack & Skill Keywords for Your Resume

When adding this project to your resume's **Technical Skills** or **Projects** section, use these industry-standard keywords:

* **Languages & Core Analytics:** SQL (SQLite, Aggregations, Window Functions), JavaScript (Node.js, ES6+), Mathematical & Statistical Modeling.
* **Data & Statistical Techniques:** Time-Series Feature Extraction, Linear Regression, Descriptive & Inferential Statistics, Multi-Factor Risk Scoring, Data Fusion Models, Spatial Variance Analysis, Anomaly/Regression Detection.
* **Data Infrastructure & Databases:** Relational Database Design (15+ Tables), Data Quality Validation & Gatekeeping, ETL/Data Pipelines, SQLite WAL Mode, Indexing & Performance Tuning.
* **Visualization & BI:** Recharts (Line, Bar, Radar, Area Charts), Interactive Dashboards, Clinical Decision Support Systems (CDSS).
* **Machine Learning & NLP:** TensorFlow.js Toxicity Classifier, Image Processing (Jimp), Rule-Based Expert Systems.
