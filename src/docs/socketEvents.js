// Socket.IO events documentation for client implementation

/*
=== CLIENT SOCKET EVENTS TO EMIT ===

1. Authentication:
   - Send token in socket connection: 
     socket = io(serverURL, { 
       auth: { token: 'your-jwt-token' }
     });

2. Room Management:
   - Join room: socket.emit('room:join', { roomId })
   - Leave room: socket.emit('room:leave', { roomId })

3. WebRTC Signaling:
   - Send offer: socket.emit('webrtc:offer', { roomId, targetUserId, offer })
   - Send answer: socket.emit('webrtc:answer', { roomId, targetUserId, answer })
   - Send ICE candidate: socket.emit('webrtc:ice-candidate', { roomId, targetUserId, candidate })

4. Media Control:
   - Toggle audio/video: socket.emit('media:toggle', { roomId, type: 'audio'|'video', enabled: boolean })
   - Start screen share: socket.emit('screen:start-share', { roomId })
   - Stop screen share: socket.emit('screen:stop-share', { roomId })

5. Chat:
   - Send message: socket.emit('chat:message', { roomId, message })

6. Recording (Admin only):
   - Start recording: socket.emit('recording:start', { roomId })
   - Stop recording: socket.emit('recording:stop', { roomId })

=== CLIENT SOCKET EVENTS TO LISTEN ===

1. Room Events:
   - socket.on('room:joined', (data) => { roomId, participants, roomInfo })
   - socket.on('room:left', (data) => { roomId })
   - socket.on('room:destroyed', (data) => { roomId, message })
   - socket.on('user:joined', (data) => { userId, name, participants })
   - socket.on('user:left', (data) => { userId, name })

2. WebRTC Signaling:
   - socket.on('webrtc:offer', (data) => { fromUserId, fromUsername, offer, targetUserId })
   - socket.on('webrtc:answer', (data) => { fromUserId, fromUsername, answer, targetUserId })
   - socket.on('webrtc:ice-candidate', (data) => { fromUserId, candidate, targetUserId })

3. Media Events:
   - socket.on('user:media-toggle', (data) => { userId, name, type, enabled })
   - socket.on('user:screen-share-started', (data) => { userId, name })
   - socket.on('user:screen-share-stopped', (data) => { userId, name })

4. Chat:
   - socket.on('chat:message', (data) => { userId, name, message, timestamp })

5. Recording:
   - socket.on('recording:started', (data) => { startedBy, timestamp })
   - socket.on('recording:stopped', (data) => { stoppedBy, timestamp })

6. Errors:
   - socket.on('error', (data) => { message })

=== REST API ENDPOINTS (Still Available) ===

1. POST /api/room/create
   - Body: { maxParticipants?, roomSettings? }
   - Response: { roomId, maxParticipants, roomSettings, expiresAt }

2. POST /api/room/join
   - Body: { roomId }
   - Response: { roomId, participants, maxParticipants, roomSettings, expiresAt }

3. GET /api/room/:roomId
   - Response: { roomId, createdBy, participants, createdAt, updatedAt }

4. POST /api/room/:roomId/leave
   - Response: { roomId, participants }

=== USAGE FLOW ===

1. Create room via REST API
2. Connect to socket with JWT token
3. Join room via socket
4. Handle WebRTC signaling via sockets
5. Real-time media controls via sockets
6. Chat via sockets
7. Leave room gracefully or handle disconnection

*/

export default {};
