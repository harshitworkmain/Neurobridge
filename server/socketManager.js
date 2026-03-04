import { Server } from 'socket.io';

/**
 * Socket.IO signaling server for WebRTC peer-to-peer video calls.
 * Handles room management, offer/answer exchange, and ICE candidate relay.
 */
export function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            methods: ['GET', 'POST']
        }
    });

    // Track connected users and active rooms
    const rooms = new Map(); // roomId -> Set of { socketId, userId, userName }

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // Join a video call room
        socket.on('join-room', ({ roomId, userId, userName }) => {
            socket.join(roomId);

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Map());
            }
            rooms.get(roomId).set(socket.id, { socketId: socket.id, userId, userName });

            // Notify others in the room
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                userId,
                userName
            });

            // Send the list of existing participants to the joiner
            const participants = [];
            rooms.get(roomId).forEach((p, sid) => {
                if (sid !== socket.id) participants.push(p);
            });
            socket.emit('room-participants', { roomId, participants });

            console.log(`[Socket] ${userName} (${socket.id}) joined room ${roomId}. Total: ${rooms.get(roomId).size}`);
        });

        // WebRTC signaling: relay offer
        socket.on('offer', ({ targetSocketId, offer, roomId }) => {
            io.to(targetSocketId).emit('offer', {
                offer,
                senderSocketId: socket.id,
                roomId
            });
        });

        // WebRTC signaling: relay answer
        socket.on('answer', ({ targetSocketId, answer, roomId }) => {
            io.to(targetSocketId).emit('answer', {
                answer,
                senderSocketId: socket.id,
                roomId
            });
        });

        // WebRTC signaling: relay ICE candidate
        socket.on('ice-candidate', ({ targetSocketId, candidate, roomId }) => {
            io.to(targetSocketId).emit('ice-candidate', {
                candidate,
                senderSocketId: socket.id,
                roomId
            });
        });

        // Leave room
        socket.on('leave-room', ({ roomId }) => {
            handleLeaveRoom(socket, roomId);
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
            // Clean up from all rooms
            rooms.forEach((participants, roomId) => {
                if (participants.has(socket.id)) {
                    handleLeaveRoom(socket, roomId);
                }
            });
        });
    });

    function handleLeaveRoom(socket, roomId) {
        const room = rooms.get(roomId);
        if (!room) return;

        const user = room.get(socket.id);
        room.delete(socket.id);
        socket.leave(roomId);

        // Notify remaining participants
        socket.to(roomId).emit('user-left', {
            socketId: socket.id,
            userId: user?.userId,
            userName: user?.userName
        });

        // Cleanup empty rooms
        if (room.size === 0) {
            rooms.delete(roomId);
        }

        console.log(`[Socket] ${user?.userName || socket.id} left room ${roomId}. Remaining: ${room.size}`);
    }

    return io;
}
