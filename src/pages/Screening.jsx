import React, { useState, useEffect, useRef } from 'react';
import { Camera, Brain, Activity, Play, CheckCircle2, AlertTriangle, Loader2, AlertOctagon, Video, Sparkles, Eye, Info, Shield } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import BehavioralQuestionnaire from '../components/BehavioralQuestionnaire';
import HeatmapViewer from '../components/HeatmapViewer';
import SessionQualityBanner from '../components/SessionQualityBanner';
import { API_BASE } from '../config/api.js';

const Screening = () => {
    // 0: Idle, 1: Requesting Cam, 2: Active, 3: Analysis, 4: Results, 5: Questionnaire
    const [step, setStep] = useState(0);
    const [loadingAI, setLoadingAI] = useState(true);
    const [aiStatus, setAiStatus] = useState('Fetching Models...');
    const [errorMsg, setErrorMsg] = useState('');

    // Real AI State
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const heatmapCanvasRef = useRef(null);
    const [faceLandmarker, setFaceLandmarker] = useState(null);
    const requestRef = useRef(null);

    // Metrics
    const [isCapturing, setIsCapturing] = useState(false);
    const isCapturingRef = useRef(false);
    const [attentionScore, setAttentionScore] = useState(0);
    const [motorVar, setMotorVar] = useState(0);
    const [eegData, setEegData] = useState([]);

    // V2 Enhanced State
    const [analysisResult, setAnalysisResult] = useState(null);
    const [heatmapImage, setHeatmapImage] = useState(null);
    const [questionnaireData, setQuestionnaireData] = useState(null);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    // ============================================
    // PHASE 0: SESSION METRICS FOUNDATION
    // ============================================
    const sessionMetricsRef = useRef({
        attention_series: [],
        nose_attention_series: [],
        iris_attention_series: [],
        face_detected_frames: 0,
        total_frames: 0,
        blink_count: 0,
        fixation_frames: 0,
        multi_face_frames: 0,
        low_light_frames: 0,
        start_time: null,
        movement_x_series: [],
        // Fixation tracking
        last_attention: null,
        fixation_start_frame: null,
        fixation_durations: [],
    });

    const scoresRef = useRef({ attention: [], movement: [] });

    // Initialize MediaPipe
    useEffect(() => {
        const initAI = async () => {
            try {
                setAiStatus('Loading Vision WASM...');
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");

                setAiStatus('Loading Face Model...');
                const landmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "CPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 2 // Detect up to 2 faces for multi-face detection
                });
                setFaceLandmarker(landmarker);
                setAiStatus('Ready');
                setLoadingAI(false);
            } catch (err) {
                console.error("AI Init Error:", err);
                setAiStatus('Offline Mode (AI Failed)');
                setErrorMsg("AI Models failed to load. Basic video will work, but scoring may be limited.");
                setLoadingAI(false);
            }
        };
        initAI();
    }, []);

    // WebCam Stream
    const startCamera = async () => {
        setErrorMsg('');
        setStep(1);
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Browser API 'navigator.mediaDevices' is missing. Check connection context (localhost/HTTPS).");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    setStep(2);
                    setIsCapturing(true);
                    isCapturingRef.current = true;

                    // Reset session metrics
                    sessionMetricsRef.current = {
                        attention_series: [],
                        nose_attention_series: [],
                        iris_attention_series: [],
                        face_detected_frames: 0,
                        total_frames: 0,
                        blink_count: 0,
                        fixation_frames: 0,
                        multi_face_frames: 0,
                        low_light_frames: 0,
                        start_time: performance.now(),
                        movement_x_series: [],
                        last_attention: null,
                        fixation_start_frame: null,
                        fixation_durations: [],
                    };

                    // Initialize Heatmap Canvas
                    if (heatmapCanvasRef.current) {
                        heatmapCanvasRef.current.width = videoRef.current.videoWidth;
                        heatmapCanvasRef.current.height = videoRef.current.videoHeight;
                        const hCtx = heatmapCanvasRef.current.getContext('2d');
                        hCtx.clearRect(0, 0, heatmapCanvasRef.current.width, heatmapCanvasRef.current.height);
                    }

                    console.log("🎥 Camera active. Hybrid gaze tracking started.");
                    requestRef.current = requestAnimationFrame(predictWebcam);
                };
            }
        } catch (err) {
            console.error("Camera Start Error:", err);
            setErrorMsg(`Camera Error: ${err.message || 'Permission Denied'}. Please check browser settings.`);
            setStep(0);
            setIsCapturing(false);
        }
    };

    // Live Metric Ref for graph
    const liveMetricRef = useRef(50);

    // ============================================
    // PHASE 1: HYBRID GAZE MODEL
    // ============================================

    /**
     * Calculate iris-based attention from iris landmarks.
     * Left iris: 468–472, Right iris: 473–477
     * Eye corners: left eye [33, 133], right eye [362, 263]
     */
    const calculateIrisAttention = (landmarks) => {
        try {
            // Left iris center (average of landmarks 468-472)
            const leftIris = [468, 469, 470, 471, 472].map(i => landmarks[i]);
            const leftIrisCenter = {
                x: leftIris.reduce((s, p) => s + p.x, 0) / 5,
                y: leftIris.reduce((s, p) => s + p.y, 0) / 5
            };

            // Right iris center (average of landmarks 473-477)
            const rightIris = [473, 474, 475, 476, 477].map(i => landmarks[i]);
            const rightIrisCenter = {
                x: rightIris.reduce((s, p) => s + p.x, 0) / 5,
                y: rightIris.reduce((s, p) => s + p.y, 0) / 5
            };

            // Left eye corners
            const leftEyeInner = landmarks[133];
            const leftEyeOuter = landmarks[33];
            const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);

            // Right eye corners
            const rightEyeInner = landmarks[362];
            const rightEyeOuter = landmarks[263];
            const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);

            // Gaze ratio: how far iris is from center of eye
            // 0.5 = center (looking straight), 0 or 1 = looking sideways
            let leftGazeRatio = leftEyeWidth > 0
                ? (leftIrisCenter.x - Math.min(leftEyeOuter.x, leftEyeInner.x)) / leftEyeWidth
                : 0.5;
            let rightGazeRatio = rightEyeWidth > 0
                ? (rightIrisCenter.x - Math.min(rightEyeOuter.x, rightEyeInner.x)) / rightEyeWidth
                : 0.5;

            // Average gaze ratio
            const avgGazeRatio = (leftGazeRatio + rightGazeRatio) / 2;

            // Convert to attention score:
            // 0.5 gaze ratio = looking straight = 100 attention
            // Deviation from 0.5 reduces attention
            const gazeDeviation = Math.abs(avgGazeRatio - 0.5) * 2; // normalize to 0-1
            const irisAttention = Math.max(0, Math.min(100, 100 - (gazeDeviation * 150)));

            return irisAttention;
        } catch (e) {
            return null; // Iris landmarks not available
        }
    };

    /**
     * Detect blinks using Eye Aspect Ratio (EAR).
     * Upper eyelid: [159,145] for left, [386,374] for right
     * Width: [33,133] for left, [362,263] for right
     */
    const detectBlink = (landmarks) => {
        try {
            // Left eye EAR
            const leftUpper = landmarks[159];
            const leftLower = landmarks[145];
            const leftOuter = landmarks[33];
            const leftInner = landmarks[133];
            const leftHeight = Math.abs(leftUpper.y - leftLower.y);
            const leftWidth = Math.abs(leftOuter.x - leftInner.x);
            const leftEAR = leftWidth > 0 ? leftHeight / leftWidth : 0.3;

            // Right eye EAR
            const rightUpper = landmarks[386];
            const rightLower = landmarks[374];
            const rightOuter = landmarks[263];
            const rightInner = landmarks[362];
            const rightHeight = Math.abs(rightUpper.y - rightLower.y);
            const rightWidth = Math.abs(rightOuter.x - rightInner.x);
            const rightEAR = rightWidth > 0 ? rightHeight / rightWidth : 0.3;

            const avgEAR = (leftEAR + rightEAR) / 2;
            return avgEAR < 0.06; // Blink threshold
        } catch (e) {
            return false;
        }
    };

    const predictWebcam = () => {
        if (!isCapturingRef.current) return;

        const metrics = sessionMetricsRef.current;
        metrics.total_frames++;

        if (faceLandmarker && videoRef.current && canvasRef.current) {
            if (videoRef.current.readyState >= 2) {
                let startTimeMs = performance.now();
                const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

                const ctx = canvasRef.current.getContext("2d");
                const drawingUtils = new DrawingUtils(ctx);

                // Match canvas dims
                if (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                }

                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Multi-face tracking
                if (results.faceLandmarks && results.faceLandmarks.length > 1) {
                    metrics.multi_face_frames++;
                }

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    metrics.face_detected_frames++;

                    // Log every 60 frames
                    if (metrics.total_frames % 60 === 0) {
                        console.log("🧠 Hybrid Tracking - Frames:", metrics.total_frames,
                            "Face:", metrics.face_detected_frames,
                            "Blinks:", metrics.blink_count);
                    }

                    // Use primary face
                    const landmarks = results.faceLandmarks[0];

                    // Draw face mesh
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#38bdf8", lineWidth: 2 });
                    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#38bdf8", lineWidth: 2 });

                    // Draw iris landmarks (green circles)
                    const irisIndices = [468, 469, 470, 471, 472, 473, 474, 475, 476, 477];
                    for (const idx of irisIndices) {
                        if (landmarks[idx]) {
                            const ix = landmarks[idx].x * canvasRef.current.width;
                            const iy = landmarks[idx].y * canvasRef.current.height;
                            ctx.beginPath();
                            ctx.arc(ix, iy, 2, 0, 2 * Math.PI);
                            ctx.fillStyle = "#00FF88";
                            ctx.fill();
                        }
                    }

                    const noseTip = landmarks[1];

                    // Debug: Green dot at nose
                    const noseX = noseTip.x * canvasRef.current.width;
                    const noseY = noseTip.y * canvasRef.current.height;
                    ctx.beginPath();
                    ctx.arc(noseX, noseY, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = "#00FF00";
                    ctx.fill();

                    // --- NOSE ATTENTION (existing logic) ---
                    const dist = Math.sqrt(Math.pow(noseTip.x - 0.5, 2) + Math.pow(noseTip.y - 0.5, 2));
                    let noseAttention = Math.max(0, Math.min(100, 100 - (dist * 250)));

                    // --- IRIS ATTENTION (new) ---
                    let irisAttention = calculateIrisAttention(landmarks);

                    // --- HYBRID FUSION ---
                    let finalAttention;
                    if (irisAttention !== null) {
                        finalAttention = 0.4 * noseAttention + 0.6 * irisAttention;
                    } else {
                        finalAttention = noseAttention; // Fallback to nose-only
                    }

                    // Store all series
                    metrics.attention_series.push(parseFloat(finalAttention.toFixed(1)));
                    metrics.nose_attention_series.push(parseFloat(noseAttention.toFixed(1)));
                    if (irisAttention !== null) {
                        metrics.iris_attention_series.push(parseFloat(irisAttention.toFixed(1)));
                    }

                    // Update live metric ref for graph
                    liveMetricRef.current = finalAttention;

                    // Legacy data collection
                    const isCentered = noseTip.x > 0.35 && noseTip.x < 0.65 && noseTip.y > 0.3 && noseTip.y < 0.7;
                    scoresRef.current.attention.push(isCentered ? 100 : 40);
                    scoresRef.current.movement.push(noseTip.x);
                    metrics.movement_x_series.push(noseTip.x);

                    // --- FIXATION DETECTION ---
                    const fixationThreshold = 8; // attention change threshold
                    const fixationMinFrames = 15; // ~0.5 sec at 30fps
                    if (metrics.last_attention !== null) {
                        const attChange = Math.abs(finalAttention - metrics.last_attention);
                        if (attChange < fixationThreshold) {
                            // Still fixating
                            if (metrics.fixation_start_frame === null) {
                                metrics.fixation_start_frame = metrics.total_frames;
                            }
                            const fixDuration = metrics.total_frames - metrics.fixation_start_frame;
                            if (fixDuration >= fixationMinFrames) {
                                metrics.fixation_frames++;
                            }
                        } else {
                            // Fixation broken
                            if (metrics.fixation_start_frame !== null) {
                                const dur = metrics.total_frames - metrics.fixation_start_frame;
                                if (dur >= fixationMinFrames) {
                                    metrics.fixation_durations.push(dur / 30); // Convert to seconds
                                }
                            }
                            metrics.fixation_start_frame = null;
                        }
                    }
                    metrics.last_attention = finalAttention;

                    // --- BLINK DETECTION ---
                    if (detectBlink(landmarks)) {
                        metrics.blink_count++;
                    }

                    // --- HEATMAP DRAWING ---
                    if (heatmapCanvasRef.current) {
                        const hCtx = heatmapCanvasRef.current.getContext('2d');
                        if (heatmapCanvasRef.current.width !== videoRef.current.videoWidth) {
                            heatmapCanvasRef.current.width = videoRef.current.videoWidth;
                            heatmapCanvasRef.current.height = videoRef.current.videoHeight;
                        }
                        const x = noseTip.x * heatmapCanvasRef.current.width;
                        const y = noseTip.y * heatmapCanvasRef.current.height;
                        hCtx.beginPath();
                        hCtx.arc(x, y, 20, 0, 2 * Math.PI);
                        hCtx.fillStyle = "rgba(255, 50, 0, 0.15)";
                        hCtx.fill();
                    }
                } else {
                    // No face detected — still track for quality metrics
                    metrics.attention_series.push(0);
                    metrics.nose_attention_series.push(0);
                }
            }
        }

        if (isCapturingRef.current) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    };

    // Graph Update Loop
    useEffect(() => {
        let interval;
        if (step === 2) {
            interval = setInterval(() => {
                setEegData(prev => {
                    const realValue = liveMetricRef.current;
                    const jitter = (Math.random() - 0.5) * 5;
                    const displayValue = Math.max(0, Math.min(100, realValue + jitter));
                    const newData = [...prev, { value: displayValue }];
                    if (newData.length > 50) newData.shift();
                    return newData;
                });
            }, 100);

            const timer = setTimeout(() => stopScreening(), 15000);
            return () => { clearInterval(interval); clearTimeout(timer); };
        }
    }, [step]);

    // ============================================
    // STOP SCREENING & V2 ANALYSIS
    // ============================================

    const stopScreening = async () => {
        setIsCapturing(false);
        isCapturingRef.current = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        setStep(3); // Analysis step

        const metrics = sessionMetricsRef.current;
        const endTime = performance.now();
        const sessionDuration = (endTime - metrics.start_time) / 1000;

        // Calculate legacy scores for display
        const attArr = scoresRef.current.attention;
        const movArr = scoresRef.current.movement;
        const attAvg = attArr.length > 0 ? attArr.reduce((a, b) => a + b, 0) / attArr.length : 50;

        let variance = 0;
        if (movArr.length > 1) {
            const mean = movArr.reduce((a, b) => a + b, 0) / movArr.length;
            variance = movArr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / movArr.length;
        }
        const motScore = Math.min(100, Math.round(variance * 1000));

        setAttentionScore(Math.round(attAvg));
        setMotorVar(motScore);

        console.log("📊 V2 Session Data:", {
            totalFrames: metrics.total_frames,
            faceDetected: metrics.face_detected_frames,
            attentionSeries: metrics.attention_series.length,
            irisSeries: metrics.iris_attention_series.length,
            blinks: metrics.blink_count,
            fixationFrames: metrics.fixation_frames,
            duration: sessionDuration.toFixed(1) + 's'
        });

        // Capture heatmap image (for optional viewing, NOT for inference)
        let heatmapImg = null;
        if (heatmapCanvasRef.current) {
            heatmapImg = heatmapCanvasRef.current.toDataURL("image/png");
            setHeatmapImage(heatmapImg);
        }

        // Calculate derived metrics
        const facePresence = metrics.total_frames > 0
            ? metrics.face_detected_frames / metrics.total_frames
            : 0;

        const engagement = metrics.attention_series.length > 0
            ? metrics.attention_series.filter(v => v > 60).length / metrics.attention_series.length
            : 0;

        const fixationAvg = metrics.fixation_durations.length > 0
            ? metrics.fixation_durations.reduce((a, b) => a + b, 0) / metrics.fixation_durations.length
            : 0;

        try {
            // Send V2 structured metrics to backend
            const response = await fetch('http://localhost:3001/api/screenings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // V2 structured metrics
                    attention_series: metrics.attention_series,
                    nose_attention_series: metrics.nose_attention_series,
                    iris_attention_series: metrics.iris_attention_series,
                    face_presence: facePresence,
                    engagement: engagement,
                    fixation_avg: fixationAvg,
                    session_duration: sessionDuration,
                    face_detected_frames: metrics.face_detected_frames,
                    total_frames: metrics.total_frames,
                    multi_face_frames: metrics.multi_face_frames,
                    low_light_frames: metrics.low_light_frames,
                    blink_count: metrics.blink_count,
                    fixation_frames: metrics.fixation_frames,
                    motor_metric: motScore,
                    // Heatmap stored optionally
                    heatmap_image: heatmapImg
                })
            });

            const result = await response.json();
            console.log("📈 V2 Analysis Result:", result);
            setAnalysisResult(result);
            setSessionId(result.id);

        } catch (e) {
            console.error("V2 Backend Error:", e);
            setErrorMsg("Failed to save session data. Ensure server is running.");
        }

        // Show questionnaire step
        setTimeout(() => setStep(5), 1500);

        // Stop video stream
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
    };

    // ============================================
    // QUESTIONNAIRE COMPLETION
    // ============================================

    const handleQuestionnaireComplete = async (data) => {
        setQuestionnaireData(data);

        // Re-submit with questionnaire responses for fused scoring
        if (sessionId && data.responses) {
            try {
                const metrics = sessionMetricsRef.current;
                const facePresence = metrics.total_frames > 0
                    ? metrics.face_detected_frames / metrics.total_frames : 0;
                const engagement = metrics.attention_series.length > 0
                    ? metrics.attention_series.filter(v => v > 60).length / metrics.attention_series.length : 0;
                const fixationAvg = metrics.fixation_durations.length > 0
                    ? metrics.fixation_durations.reduce((a, b) => a + b, 0) / metrics.fixation_durations.length : 0;
                const sessionDuration = metrics.start_time
                    ? (performance.now() - metrics.start_time) / 1000 : 15;

                const response = await fetch(`${API_BASE}/api/screenings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attention_series: metrics.attention_series,
                        nose_attention_series: metrics.nose_attention_series,
                        iris_attention_series: metrics.iris_attention_series,
                        face_presence: facePresence,
                        engagement: engagement,
                        fixation_avg: fixationAvg,
                        session_duration: sessionDuration,
                        face_detected_frames: metrics.face_detected_frames,
                        total_frames: metrics.total_frames,
                        multi_face_frames: metrics.multi_face_frames,
                        low_light_frames: metrics.low_light_frames,
                        blink_count: metrics.blink_count,
                        fixation_frames: metrics.fixation_frames,
                        motor_metric: motorVar,
                        questionnaire_responses: data.responses
                    })
                });

                const fusedResult = await response.json();
                console.log("🔄 Fused Result:", fusedResult);
                setAnalysisResult(fusedResult);
                setSessionId(fusedResult.id);
            } catch (e) {
                console.error("Fusion Error:", e);
            }
        }

        setStep(4); // Show results
    };

    const handleSkipQuestionnaire = () => {
        setStep(4); // Show results without questionnaire
    };

    // Manual Reset
    const resetSession = () => {
        setStep(0);
        setIsCapturing(false);
        setErrorMsg('');
        setEegData([]);
        setAnalysisResult(null);
        setHeatmapImage(null);
        setQuestionnaireData(null);
        setSessionId(null);
        scoresRef.current = { attention: [], movement: [] };
    };

    // Helper: get triage color classes
    const getTriageStyles = (color) => {
        switch (color) {
            case 'red': return { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-50', border: 'border-red-200' };
            case 'yellow': return { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50', border: 'border-amber-200' };
            case 'green': return { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200' };
            default: return { bg: 'bg-slate-500', text: 'text-slate-500', light: 'bg-slate-50', border: 'border-slate-200' };
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">AI Screening Session</h1>
                    <p className="text-slate-500">
                        Analysis Status: <span className={`font-semibold ${loadingAI ? 'text-amber-600' : 'text-emerald-600'}`}>{aiStatus}</span>
                        {!loadingAI && <span className="ml-2 text-xs text-slate-400">• Hybrid Gaze v2.0</span>}
                    </p>
                </div>

                <div className="flex gap-3">
                    {step === 0 && (
                        <button
                            onClick={startCamera}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-md font-medium flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Video className="w-5 h-5" />
                            {loadingAI ? 'Start Camera (AI Loading...)' : 'Start Camera & AI'}
                        </button>
                    )}

                    {step === 2 && (
                        <button onClick={stopScreening} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-md font-medium animate-pulse flex items-center gap-2">
                            <Activity className="w-5 h-5" /> Stop Assessment
                        </button>
                    )}
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700">
                    <AlertOctagon className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-bold">Error Encountered</p>
                        <p className="text-sm">{errorMsg}</p>
                        <button onClick={resetSession} className="text-xs underline mt-2">Dismiss & Reset</button>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* CAMERA VIEW (Steps 0-3) */}
            {/* ============================================ */}
            {step < 4 && step !== 5 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Viewport */}
                    <div className="lg:col-span-2 bg-black rounded-2xl overflow-hidden aspect-video relative shadow-lg group border border-slate-800">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ${step >= 2 ? 'opacity-100' : 'opacity-30'}`}
                        />

                        {/* LIVE HEATMAP OVERLAY */}
                        <canvas
                            ref={heatmapCanvasRef}
                            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-40 mix-blend-screen pointer-events-none"
                        />

                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full transform scale-x-[-1]"
                        />

                        {/* Overlays */}
                        {step === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                                <div className="bg-white/10 p-6 rounded-full mb-4 backdrop-blur-sm">
                                    <Camera className="w-12 h-12 opacity-80" />
                                </div>
                                <p className="text-lg font-medium">Camera is inactive</p>
                                <p className="text-sm text-slate-400">Click "Start Camera" above to begin screening.</p>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 p-8 text-center">
                                <Loader2 className="w-12 h-12 animate-spin text-primary-500 mb-6" />
                                <h3 className="text-xl font-bold mb-2">Requesting Camera Access...</h3>
                                <p className="text-slate-300">Please look at the permission prompt in your browser's address bar.</p>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary-900/90 text-white z-30">
                                <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
                                <h3 className="text-xl font-bold">Analyzing Session Data...</h3>
                                <p className="text-sm text-slate-300 mt-2">Running hybrid gaze analysis & temporal features</p>
                            </div>
                        )}

                        {/* Live badge */}
                        {step === 2 && (
                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-white text-xs font-medium">Hybrid Gaze • Nose + Iris</span>
                            </div>
                        )}
                    </div>

                    {/* Metrics Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-medium flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary-400" /> Live Attention Index
                                </h3>
                                {step === 2 && <span className="text-xs font-bold text-red-500 animate-pulse">● REC</span>}
                            </div>
                            <div className="h-32 bg-slate-950/50 rounded-lg overflow-hidden border border-slate-800/10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={eegData}>
                                        <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                                        <YAxis domain={[0, 100]} hide />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-1">
                                <span>0 (Distracted)</span>
                                <span>Hybrid Attention (Nose+Iris)</span>
                                <span>100 (Focused)</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Diagnostics</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                    <span className="text-slate-600">AI Model</span>
                                    <span className={`font-mono font-bold ${faceLandmarker ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {faceLandmarker ? 'LOADED' : 'LOADING'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                    <span className="text-slate-600">Camera Feed</span>
                                    <span className={`font-mono font-bold ${step === 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {step === 2 ? 'ACTIVE' : 'OFFLINE'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                    <span className="text-slate-600">Tracking Mode</span>
                                    <span className="font-mono font-bold text-violet-600">HYBRID v2</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">Iris Detection</span>
                                    <span className={`font-mono font-bold ${faceLandmarker ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {faceLandmarker ? 'ACTIVE' : 'PENDING'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================ */}
            {/* QUESTIONNAIRE STEP (Step 5) */}
            {/* ============================================ */}
            {step === 5 && (
                <div className="animate-fade-in max-w-2xl mx-auto">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                        <h2 className="text-xl font-bold text-slate-900">Video Session Complete!</h2>
                        <p className="text-slate-600 mt-1 text-sm">Enhance your results with a quick caregiver questionnaire.</p>
                    </div>

                    <BehavioralQuestionnaire
                        compact={true}
                        onComplete={handleQuestionnaireComplete}
                        onSkip={handleSkipQuestionnaire}
                    />
                </div>
            )}

            {/* ============================================ */}
            {/* RESULTS (Step 4) */}
            {/* ============================================ */}
            {step === 4 && (
                <div className="animate-fade-in-up pb-10">
                    {/* Session Quality Banner */}
                    {analysisResult?.quality && (
                        <div className="mb-6">
                            <SessionQualityBanner quality={analysisResult.quality} />
                        </div>
                    )}

                    {/* Completion Header */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center mb-8">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900">Session Completed</h2>
                        <p className="text-slate-600 mt-2">
                            {analysisResult?.fusion_mode === 'multimodal'
                                ? 'Multimodal analysis complete — vision + behavioral data fused.'
                                : 'Biometric data has been processed and saved.'}
                        </p>
                        {analysisResult?.version === 'v2' && (
                            <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
                                <Sparkles className="w-3 h-3" /> Hybrid Gaze v2.0 Analysis
                            </span>
                        )}
                    </div>

                    {/* AI Analysis Panel */}
                    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl mb-6 border border-slate-700">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                            <Brain className="w-6 h-6 text-purple-400" />
                            <h3 className="text-xl font-bold">NeuroBridge AI Analysis</h3>
                            {analysisResult?.triage && (
                                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase ${analysisResult.triage.color === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    analysisResult.triage.color === 'yellow' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                    {analysisResult.triage.label}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Risk Score */}
                            <div>
                                <h4 className="text-slate-400 text-sm uppercase font-bold mb-3">Overall Risk Assessment</h4>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`text-4xl font-bold ${(analysisResult?.overall_score ?? 0) > 70 ? 'text-red-400' :
                                        (analysisResult?.overall_score ?? 0) > 40 ? 'text-amber-400' : 'text-emerald-400'
                                        }`}>
                                        {analysisResult?.risk_level || 'N/A'}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700">
                                            Score: {analysisResult?.overall_score ?? 'N/A'}/100
                                        </div>
                                        {analysisResult?.quality && (
                                            <div className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700">
                                                Confidence: {analysisResult.quality.quality_label}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Explanations */}
                                {analysisResult?.explanations && analysisResult.explanations.length > 0 && (
                                    <div className="space-y-2">
                                        {analysisResult.explanations.map((exp, i) => (
                                            <div key={i} className={`text-sm p-3 rounded-lg border ${exp.severity === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                                                exp.severity === 'moderate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
                                                    exp.severity === 'warning' ? 'bg-orange-500/10 border-orange-500/20 text-orange-300' :
                                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                                }`}>
                                                <span className="mr-2">{exp.icon}</span>
                                                {exp.text}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Component Scores & Heatmap */}
                            <div className="space-y-4">
                                <h4 className="text-slate-400 text-sm uppercase font-bold">Component Breakdown</h4>

                                {analysisResult?.component_scores && (
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Vision (Gaze Stability)', value: analysisResult.component_scores.vision_risk, color: 'bg-purple-500' },
                                            { label: 'Engagement (Sustained Focus)', value: analysisResult.component_scores.engagement_risk, color: 'bg-blue-500' },
                                            { label: 'Stability (Face Presence)', value: analysisResult.component_scores.stability_risk, color: 'bg-teal-500' },
                                            { label: 'Fixation (Sustained Gaze)', value: analysisResult.component_scores.fixation_risk, color: 'bg-amber-500' }
                                        ].map(item => (
                                            <div key={item.label}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-400">{item.label}</span>
                                                    <span className="text-slate-300 font-mono">{item.value?.toFixed(1) ?? 'N/A'}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                                                        style={{ width: `${Math.min(100, item.value || 0)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Heatmap Button */}
                                <div className="pt-4 border-t border-slate-700">
                                    <HeatmapViewer
                                        localImage={heatmapImage}
                                        screeningId={sessionId}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fusion info + Triage Recommendation */}
                        {analysisResult?.triage && (
                            <div className="mt-6 pt-5 border-t border-slate-800">
                                <div className={`p-4 rounded-xl ${analysisResult.triage.color === 'red' ? 'bg-red-500/10 border border-red-500/20' :
                                    analysisResult.triage.color === 'yellow' ? 'bg-amber-500/10 border border-amber-500/20' :
                                        'bg-emerald-500/10 border border-emerald-500/20'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-bold text-slate-300">Clinical Recommendation</span>
                                    </div>
                                    <p className="text-sm text-slate-400">{analysisResult.triage.recommendation}</p>
                                </div>
                            </div>
                        )}

                        {/* Contribution Weights */}
                        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-4 gap-4 text-center">
                            {[
                                { label: 'Vision', weight: '30%', color: 'bg-purple-500' },
                                { label: 'Engagement', weight: '30%', color: 'bg-blue-500' },
                                { label: 'Stability', weight: '20%', color: 'bg-teal-500' },
                                { label: 'Fixation', weight: '20%', color: 'bg-amber-500' }
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="text-xs text-slate-500 mb-1">{item.label} ({item.weight})</div>
                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color}`} style={{ width: item.weight }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attention Metric</h3>
                            <div className="mt-2 text-5xl font-bold text-primary-600">{attentionScore}%</div>
                            <p className="text-xs text-slate-400 mt-1">Hybrid (Nose + Iris)</p>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Motor Variance</h3>
                            <div className="mt-2 text-5xl font-bold text-indigo-600">{motorVar}</div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Face Presence</h3>
                            <div className="mt-2 text-5xl font-bold text-teal-600">
                                {analysisResult?.quality
                                    ? Math.round(analysisResult.quality.face_presence * 100) + '%'
                                    : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-500 leading-relaxed">
                                <strong className="text-slate-700">Important:</strong> This is a screening support tool, not a diagnostic instrument.
                                Results should be reviewed in conjunction with clinical assessment by a qualified healthcare provider.
                                This system does not replace formal evaluation tools such as ADOS-2.
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-col md:flex-row gap-4">
                        <Link to="/therapy" className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors text-center flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                            <Sparkles className="w-5 h-5 text-purple-400" /> View Adapted Therapy Plan
                        </Link>
                        <button onClick={resetSession} className="px-8 bg-white border border-slate-300 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                            New Session
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Screening;
