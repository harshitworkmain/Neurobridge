import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
    Users, Loader, AlertTriangle, Maximize2, Minimize2, Clock
} from 'lucide-react';
import { WS_URL } from '../config/api';

const SOCKET_URL = WS_URL;

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Metered Open Relay TURN servers (free tier — 20 GB/month)
        // Enables connections behind corporate firewalls / symmetric NATs
        {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'e8dd65bea7a3e04945669cbe',
            credential: '97fBhIdD4/qLoYhq'
        },
        {
            urls: 'turn:a.relay.metered.ca:80?transport=tcp',
            username: 'e8dd65bea7a3e04945669cbe',
            credential: '97fBhIdD4/qLoYhq'
        },
        {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'e8dd65bea7a3e04945669cbe',
            credential: '97fBhIdD4/qLoYhq'
        },
        {
            urls: 'turns:a.relay.metered.ca:443?transport=tcp',
            username: 'e8dd65bea7a3e04945669cbe',
            credential: '97fBhIdD4/qLoYhq'
        }
    ]
};

const VideoCall = ({ roomId, userId = 1, userName = 'Alex (Parent)', onEnd }) => {
    const [status, setStatus] = useState('connecting'); // connecting, waiting, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [remoteName, setRemoteName] = useState('');
    const [error, setError] = useState(null);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const socketRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const timerRef = useRef(null);
    const containerRef = useRef(null);

    // Initialize call
    useEffect(() => {
        const init = async () => {
            try {
                // Get local media
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, facingMode: 'user' },
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Connect socket
                const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
                socketRef.current = socket;

                socket.on('connect', () => {
                    console.log('[VideoCall] Socket connected:', socket.id);
                    socket.emit('join-room', { roomId, userId, userName });
                    setStatus('waiting');
                });

                socket.on('room-participants', ({ participants }) => {
                    if (participants.length > 0) {
                        // Someone is already in the room, create offer
                        const peer = participants[0];
                        setRemoteName(peer.userName || 'Remote');
                        createPeerConnection(socket, peer.socketId, true);
                    }
                });

                socket.on('user-joined', ({ socketId, userName: remName }) => {
                    setRemoteName(remName || 'Remote');
                    createPeerConnection(socket, socketId, true);
                });

                socket.on('offer', async ({ offer, senderSocketId }) => {
                    createPeerConnection(socket, senderSocketId, false);
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pcRef.current.createAnswer();
                    await pcRef.current.setLocalDescription(answer);
                    socket.emit('answer', { targetSocketId: senderSocketId, answer, roomId });
                });

                socket.on('answer', async ({ answer }) => {
                    if (pcRef.current) {
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                });

                socket.on('ice-candidate', ({ candidate }) => {
                    if (pcRef.current && candidate) {
                        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                    }
                });

                socket.on('user-left', () => {
                    setStatus('ended');
                    cleanupPeerConnection();
                });

                socket.on('connect_error', (err) => {
                    setError('Could not connect to signaling server');
                    console.error('[VideoCall] Socket error:', err);
                });

            } catch (err) {
                if (err.name === 'NotAllowedError') {
                    setError('Camera/microphone access denied. Please allow access and try again.');
                } else if (err.name === 'NotFoundError') {
                    setError('No camera or microphone found.');
                } else {
                    setError(`Media error: ${err.message}`);
                }
                console.error('[VideoCall] Init error:', err);
            }
        };

        init();

        return () => {
            cleanup();
        };
    }, [roomId]);

    const createPeerConnection = useCallback((socket, targetSocketId, isInitiator) => {
        if (pcRef.current) pcRef.current.close();

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        // Handle remote stream
        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setStatus('connected');
                startTimer();
            }
        };

        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    targetSocketId,
                    candidate: event.candidate,
                    roomId
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                setStatus('ended');
            }
        };

        // Create offer if initiator
        if (isInitiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    socket.emit('offer', {
                        targetSocketId,
                        offer: pc.localDescription,
                        roomId
                    });
                })
                .catch(console.error);
        }
    }, [roomId]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallDuration(0);
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen share, restore camera
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(t => t.stop());
            }
            const videoTrack = localStreamRef.current?.getVideoTracks()[0];
            if (videoTrack && pcRef.current) {
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack);
            }
            setIsScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];

                if (pcRef.current) {
                    const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                }

                screenTrack.onended = () => {
                    toggleScreenShare();
                };

                setIsScreenSharing(true);
            } catch (err) {
                console.error('Screen share error:', err);
            }
        }
    };

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            containerRef.current?.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    };

    const cleanupPeerConnection = () => {
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const cleanup = () => {
        cleanupPeerConnection();
        if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); }
        if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); }
        if (socketRef.current) {
            socketRef.current.emit('leave-room', { roomId });
            socketRef.current.disconnect();
        }
    };

    const endCall = () => {
        cleanup();
        setStatus('ended');
        onEnd?.();
    };

    // Error state
    if (error) {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
                <p className="text-slate-400 text-sm mb-4">{error}</p>
                <button onClick={onEnd} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                    Go Back
                </button>
            </div>
        );
    }

    // Ended state
    if (status === 'ended') {
        return (
            <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <PhoneOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Call Ended</h3>
                <p className="text-slate-400 text-sm mb-2">Duration: {formatDuration(callDuration)}</p>
                <button onClick={onEnd} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors mt-4">
                    Return to Appointments
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="bg-slate-900 rounded-2xl overflow-hidden relative">
            {/* Remote Video (main) */}
            <div className="relative aspect-video bg-slate-800">
                {status === 'connected' ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        {status === 'connecting' ? (
                            <>
                                <Loader className="w-8 h-8 text-primary-400 animate-spin" />
                                <p className="text-slate-400 text-sm">Connecting...</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                                    <Users className="w-8 h-8 text-slate-500" />
                                </div>
                                <p className="text-slate-400 text-sm">Waiting for clinician to join...</p>
                                <p className="text-slate-500 text-xs">Room: {roomId}</p>
                            </>
                        )}
                    </div>
                )}

                {/* Call info overlay */}
                {status === 'connected' && (
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <Clock className="w-3.5 h-3.5 text-white" />
                            <span className="text-white text-sm font-mono">{formatDuration(callDuration)}</span>
                        </div>
                        {remoteName && (
                            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                                <span className="text-white text-sm">{remoteName}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Local video (PiP) */}
                <div className="absolute bottom-4 right-4 w-40 h-28 bg-slate-700 rounded-lg overflow-hidden border-2 border-slate-600 shadow-lg">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                            <VideoOff className="w-6 h-6 text-slate-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="p-4 bg-slate-900 flex items-center justify-center gap-3">
                <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>

                <button
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                    {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </button>

                <button
                    onClick={toggleFullscreen}
                    className="p-3 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>

                <button
                    onClick={endCall}
                    className="p-3 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2"
                    title="End call"
                >
                    <PhoneOff className="w-5 h-5" />
                    <span className="text-sm font-medium">End</span>
                </button>
            </div>
        </div>
    );
};

export default VideoCall;
