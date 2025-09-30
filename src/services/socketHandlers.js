import Room from '../models/room.models.js';
import { User } from '../models/user.model.js';
import jwt from 'jsonwebtoken';

// Store active rooms and their timers
const activeRooms = new Map();
const roomTimers = new Map();

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Invalid token'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
};

// Destroy room after 50 minutes
const scheduleRoomDestruction = (io, roomId) => {
  // Clear existing timer if any
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
  }

  // Set new timer for 50 minutes (50 * 60 * 1000 ms)
  const timer = setTimeout(async () => {
    try {
      // Remove all participants from the room
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        roomSockets.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.leave(roomId);
            socket.emit('room:destroyed', {
              roomId,
              message: 'Room has been automatically destroyed after 50 minutes',
            });
          }
        });
      }

      // Clean up database
      await Room.findOneAndDelete({ roomId });

      // Clean up memory
      activeRooms.delete(roomId);
      roomTimers.delete(roomId);

      console.log(`Room ${roomId} destroyed after 50 minutes`);
    } catch (error) {
      console.error('Error destroying room:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes

  roomTimers.set(roomId, timer);
};

export const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected`);

    // Handle joining a room
    socket.on('room:join', async (data) => {
      try {
        const { roomId } = data;

        // Verify room exists
        const room = await Room.findOne({ roomId }).populate(
          'participants',
          'name email'
        );
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        socket.join(roomId);
        socket.currentRoom = roomId;

        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, new Set());
        }
        activeRooms.get(roomId).add(socket.userId);

        // Schedule room destruction if it's a new room
        if (activeRooms.get(roomId).size === 1) {
          scheduleRoomDestruction(io, roomId);
        }

        // Notify others in the room
        socket.to(roomId).emit('user:joined', {
          userId: socket.userId,
          name: socket.user.name,
          participants: room.participants,
        });

        // Send current participants to the joining user
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const activeParticipants = [];

        if (roomSockets) {
          roomSockets.forEach((socketId) => {
            const participantSocket = io.sockets.sockets.get(socketId);
            if (participantSocket && participantSocket.userId !== socket.userId) {
              activeParticipants.push({
                userId: participantSocket.userId,
                name: participantSocket.user.name,
              });
            }
          });
        }

        socket.emit('room:joined', {
          roomId,
          participants: activeParticipants,
          roomInfo: room,
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle leaving a room
    socket.on('room:leave', async (data) => {
      try {
        const { roomId } = data;

        socket.leave(roomId);
        socket.currentRoom = null;

        // Update active rooms
        if (activeRooms.has(roomId)) {
          activeRooms.get(roomId).delete(socket.userId);

          // If room is empty, clean it up
          if (activeRooms.get(roomId).size === 0) {
            activeRooms.delete(roomId);
            if (roomTimers.has(roomId)) {
              clearTimeout(roomTimers.get(roomId));
              roomTimers.delete(roomId);
            }
          }
        }

        // Notify others in the room
        socket.to(roomId).emit('user:left', {
          userId: socket.userId,
          name: socket.user.name,
        });

        socket.emit('room:left', { roomId });
      } catch (error) {
        console.error('Error leaving room:', error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    // WebRTC Signaling Events
    socket.on('webrtc:offer', (data) => {
      const { roomId, targetUserId, offer } = data;
      socket.to(roomId).emit('webrtc:offer', {
        fromUserId: socket.userId,
        fromname: socket.user.name,
        offer,
        targetUserId,
      });
    });

    socket.on('webrtc:answer', (data) => {
      const { roomId, targetUserId, answer } = data;
      socket.to(roomId).emit('webrtc:answer', {
        fromUserId: socket.userId,
        fromname: socket.user.name,
        answer,
        targetUserId,
      });
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const { roomId, targetUserId, candidate } = data;
      socket.to(roomId).emit('webrtc:ice-candidate', {
        fromUserId: socket.userId,
        candidate,
        targetUserId,
      });
    });

    // Media state events
    socket.on('media:toggle', (data) => {
      const { roomId, type, enabled } = data; // type: 'audio' or 'video'
      socket.to(roomId).emit('user:media-toggle', {
        userId: socket.userId,
        name: socket.user.name,
        type,
        enabled,
      });
    });

    // Screen sharing events
    socket.on('screen:start-share', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user:screen-share-started', {
        userId: socket.userId,
        name: socket.user.name,
      });
    });

    socket.on('screen:stop-share', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user:screen-share-stopped', {
        userId: socket.userId,
        name: socket.user.name,
      });
    });

    // Chat messages
    socket.on('chat:message', (data) => {
      const { roomId, message } = data;
      const chatMessage = {
        userId: socket.userId,
        name: socket.user.name,
        message,
        timestamp: new Date().toISOString(),
      };

      io.to(roomId).emit('chat:message', chatMessage);
    });

    // Handle recording events
    socket.on('recording:start', async (data) => {
      try {
        const { roomId } = data;

        // Verify user is room admin
        const room = await Room.findOne({ roomId });
        if (room.createdBy.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only room creator can start recording' });
          return;
        }

        socket.to(roomId).emit('recording:started', {
          startedBy: socket.user.name,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        socket.emit('error', { message: 'Failed to start recording' });
      }
    });

    socket.on('recording:stop', async (data) => {
      try {
        const { roomId } = data;

        // Verify user is room admin
        const room = await Room.findOne({ roomId });
        if (room.createdBy.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only room creator can stop recording' });
          return;
        }

        socket.to(roomId).emit('recording:stopped', {
          stoppedBy: socket.user.name,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error stopping recording:', error);
        socket.emit('error', { message: 'Failed to stop recording' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.name} disconnected`);

      // Clean up from current room
      if (socket.currentRoom) {
        const roomId = socket.currentRoom;

        // Update active rooms
        if (activeRooms.has(roomId)) {
          activeRooms.get(roomId).delete(socket.userId);

          // If room is empty, clean it up
          if (activeRooms.get(roomId).size === 0) {
            activeRooms.delete(roomId);
            if (roomTimers.has(roomId)) {
              clearTimeout(roomTimers.get(roomId));
              roomTimers.delete(roomId);
            }
          }
        }

        // Notify others in the room
        socket.to(roomId).emit('user:left', {
          userId: socket.userId,
          name: socket.user.name,
        });
      }
    });
  });
};
