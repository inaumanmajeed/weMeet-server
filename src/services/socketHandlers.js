import Room from '../models/room.models.js';
import { User } from '../models/user.model.js';
import Recording from '../models/recording.model.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Store active rooms and their timers
const activeRooms = new Map();
const roomTimers = new Map();

const authenticateSocket = async (socket, next) => {
  try {
    console.log('🔐 Authenticating socket connection...');
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('❌ No authentication token provided');
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      console.log('❌ Invalid token - user not found');
      return next(new Error('Invalid token'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    console.log(`✅ Socket authenticated for user: ${user.name} (${user._id})`);
    next();
  } catch (error) {
    console.log('❌ Socket authentication failed:', error.message);
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
    console.log(
      `🔗 User ${socket.user.name} (${socket.userId}) connected to socket`
    );
    console.log(`📊 Total connected sockets: ${io.sockets.sockets.size}`);

    // Handle creating a room
    socket.on('room:create', async (data) => {
      try {
        const { maxParticipants = 10, roomSettings = {} } = data || {};
        const userId = socket.userId;

        const roomId = crypto
          .createHash('sha256')
          .update(userId + Date.now())
          .digest('hex')
          .substring(0, 10);

        let room = await Room.findOne({ roomId });
        if (room) {
          if (!room.isActive) {
            room.isActive = true;
            room.participants = [userId];
            room.destroyAt = new Date(Date.now() + 50 * 60 * 1000);
            await room.save();
          }
        } else {
          const { createRoom } = await import('../services/mediasoup.js');
          const mediasoupRoom = await createRoom(roomId);

          const defaultSettings = {
            audioEnabled: true,
            videoEnabled: true,
            screenShareEnabled: true,
            chatEnabled: true,
            recordingAllowed: false,
            ...roomSettings,
          };

          room = new Room({
            roomId: mediasoupRoom.roomId,
            createdBy: userId,
            participants: [userId],
            maxParticipants,
            roomSettings: defaultSettings,
            destroyAt: new Date(Date.now() + 50 * 60 * 1000),
          });
          await room.save();
        }

        let recordingDoc = await Recording.findOne({ roomId });
        if (!recordingDoc) {
          recordingDoc = new Recording({
            roomId,
            participants: [userId],
            recordings: [],
          });
          await recordingDoc.save();
        }

        console.log(
          `✅ Room ${roomId} created successfully by ${socket.user.name}`
        );
        socket.emit('room:created', {
          roomId,
          maxParticipants: room.maxParticipants,
          roomSettings: room.roomSettings,
          expiresAt: room.destroyAt,
        });
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    // Handle getting room details
    socket.on('room:get-details', async (data) => {
      try {
        const { roomId } = data;
        const userId = socket.userId;

        const room = await Room.findOne({ roomId }).populate(
          'participants',
          'name email avatar'
        );
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if user is a participant or the creator
        const isParticipant =
          room.participants.some((p) => p._id.toString() === userId) ||
          room.createdBy.toString() === userId;

        if (!isParticipant) {
          socket.emit('error', {
            message: 'You are not a participant of this room',
          });
          return;
        }

        socket.emit('room:details', {
          roomId: room.roomId,
          createdBy: room.createdBy,
          participants: room.participants,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
        });
      } catch (error) {
        console.error('Error getting room details:', error);
        socket.emit('error', { message: 'Failed to get room details' });
      }
    });

    // Handle joining a room
    socket.on('room:join', async (data) => {
      try {
        const { roomId } = data;
        console.log(
          `🚪 [room:join EVENT] User ${socket.user.name} (${socket.userId}) attempting to join room ${roomId}`
        );
        console.log(
          `📊 [room:join EVENT] Socket ID: ${socket.id}, Current room: ${socket.currentRoom}`
        );

        // Prevent duplicate joins from the same socket
        if (socket.currentRoom === roomId) {
          console.log(
            `⚠️ Socket already in room ${roomId}, ignoring duplicate join request`
          );
          return;
        }

        // Verify room exists
        let room = await Room.findOne({ roomId }).populate(
          'participants',
          'name email avatar'
        );
        console.log('🚀 ~ setupSocketHandlers ~ room:', room);
        console.log(
          '📊 Room participants before join:',
          room
            ? room.participants.map((p) => ({ id: p._id, name: p.name }))
            : 'No room'
        );

        if (!room) {
          console.log(`❌ Room ${roomId} not found`);
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if room is active
        if (!room.isActive) {
          socket.emit('error', { message: 'Room is not active' });
          return;
        }

        // Check if room is full
        if (
          room.participants.length >= room.maxParticipants &&
          !room.participants.some((p) => p._id.toString() === socket.userId)
        ) {
          socket.emit('error', { message: 'Room is full' });
          return;
        }

        // Add user to database participants if not already present
        const isAlreadyParticipant = room.participants.some(
          (p) => p._id.toString() === socket.userId
        );

        console.log(
          `👤 User ${socket.user.name} is already participant:`,
          isAlreadyParticipant
        );

        if (!isAlreadyParticipant) {
          console.log(`➕ Adding ${socket.user.name} to room participants`);

          // Use $addToSet to prevent duplicates at database level
          await Room.findOneAndUpdate(
            { roomId },
            { $addToSet: { participants: socket.userId } },
            { new: true }
          );

          // Also add to recording participants with $addToSet
          await Recording.findOneAndUpdate(
            { roomId },
            { $addToSet: { participants: socket.userId } },
            { upsert: true, new: true }
          );

          console.log(`✅ Successfully added ${socket.user.name} to room`);
        } else {
          console.log(
            `ℹ️ ${socket.user.name} is already a participant, skipping database update`
          );
        }

        // Always re-populate to get the latest data
        room = await Room.findOne({ roomId }).populate(
          'participants',
          'name email avatar'
        );

        console.log(
          '📊 Room participants after potential add:',
          room.participants.map((p) => ({ id: p._id, name: p.name }))
        );

        // Join socket room if not already in it
        if (socket.currentRoom !== roomId) {
          console.log(`🔌 Adding user to socket room: ${roomId}`);
          console.log(
            `🏠 User current room before join: ${socket.currentRoom}`
          );
          socket.join(roomId);
          socket.currentRoom = roomId;
          console.log(`✅ User successfully joined socket room: ${roomId}`);
        } else {
          console.log(`🔌 User already in socket room: ${roomId}`);
        }

        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, new Set());
        }
        const wasEmpty = activeRooms.get(roomId).size === 0;
        activeRooms.get(roomId).add(socket.userId);
        console.log(
          `👥 Active room ${roomId} now has ${
            activeRooms.get(roomId).size
          } connected users`
        );

        // Schedule room destruction if it's a new room
        if (wasEmpty) {
          console.log(`⏰ Scheduling destruction for new room ${roomId}`);
          scheduleRoomDestruction(io, roomId);
        }

        // Get the socket room to see who's actually connected
        const socketRoom = io.sockets.adapter.rooms.get(roomId);
        console.log(
          `🔌 Socket room ${roomId} has ${
            socketRoom ? socketRoom.size : 0
          } connected sockets`
        );

        // Only notify others if this user was actually added (not a duplicate join)
        if (!isAlreadyParticipant) {
          console.log(
            `📤 Notifying others about ${socket.user.name} joining (new participant)`
          );
          console.log(
            `📊 Sending allParticipants to others:`,
            room.participants.map((p) => ({ id: p._id, name: p.name }))
          );
          socket.to(roomId).emit('user:joined', {
            userId: socket.userId,
            name: socket.user.name,
            allParticipants: room.participants, // Send all participants from database
          });
        } else {
          console.log(
            `📝 ${socket.user.name} rejoined existing room, not notifying others`
          );
        }

        // Send current room info to the joining user
        console.log(`📤 Sending room:joined to ${socket.user.name}`);
        console.log(
          `📊 Sending allParticipants to joining user:`,
          room.participants.map((p) => ({ id: p._id, name: p.name }))
        );
        socket.emit('room:joined', {
          roomId,
          allParticipants: room.participants, // Send all participants from database (including self)
          roomInfo: room,
        });
      } catch (error) {
        console.error(
          `❌ Error joining room ${data.roomId} for user ${socket.user?.name}:`,
          error
        );
        socket.emit('error', {
          message: 'Failed to join room: ' + error.message,
        });
      }
    });

    // Handle leaving a room
    socket.on('room:leave', async (data) => {
      try {
        const { roomId } = data;

        socket.leave(roomId);
        socket.currentRoom = null;

        // Remove user from database participants
        const room = await Room.findOne({ roomId });
        if (room) {
          room.participants = room.participants.filter(
            (p) => p.toString() !== socket.userId
          );
          await room.save();

          // Also remove from recording participants
          const recordingDoc = await Recording.findOne({ roomId });
          if (recordingDoc) {
            recordingDoc.participants = recordingDoc.participants.filter(
              (p) => p.toString() !== socket.userId
            );
            await recordingDoc.save();
          }

          // If room creator leaves, delete the room
          if (room.createdBy.toString() === socket.userId) {
            await Room.findByIdAndDelete(room._id);
            // Notify all participants that room is deleted
            socket.to(roomId).emit('room:deleted', {
              roomId,
              message: 'Room has been deleted as creator left',
            });
          }
        }

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

        // Get updated room info after removing user
        const updatedRoom = await Room.findOne({ roomId }).populate(
          'participants',
          'name email avatar'
        );

        console.log(
          `📊 Room participants after user left:`,
          updatedRoom
            ? updatedRoom.participants.map((p) => ({ id: p._id, name: p.name }))
            : 'Room deleted'
        );

        // Notify others in the room
        console.log(
          `📤 Notifying others that ${socket.user.name} left the room`
        );
        socket.to(roomId).emit('user:left', {
          userId: socket.userId,
          name: socket.user.name,
          allParticipants: updatedRoom ? updatedRoom.participants : [],
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
        const { roomId, type = 'mp4' } = data;

        // Verify room exists and user is room admin
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.createdBy.toString() !== socket.userId) {
          socket.emit('error', {
            message: 'Only room creator can start recording',
          });
          return;
        }

        // Check if recording is already active
        const { isRecordingActive } = await import(
          '../services/recordingService.js'
        );
        if (isRecordingActive(roomId)) {
          socket.emit('error', {
            message: 'Recording already active for this room',
          });
          return;
        }

        // Start recording
        const { startRecording } = await import(
          '../services/recordingService.js'
        );
        const recordingInfo = await startRecording(roomId, type, io);

        // Update room recording status
        room.isRecording = true;
        await room.save();

        // Update recording participants to include starter
        const recordingDoc = await Recording.findOne({ roomId });
        if (recordingDoc) {
          const recordingIndex = recordingDoc.recordings.findIndex(
            (r) => r.recordingId === recordingInfo.recordingId
          );
          if (recordingIndex !== -1) {
            recordingDoc.recordings[recordingIndex].startedBy = socket.userId;
            await recordingDoc.save();
          }
        }

        // Notify all participants
        io.to(roomId).emit('recording:started', {
          recordingId: recordingInfo.recordingId,
          startedBy: socket.user.name,
          startedById: socket.userId,
          timestamp: recordingInfo.startTime.toISOString(),
          type,
        });

        console.log(
          `📹 Recording started by ${socket.user.name} for room ${roomId}`
        );
      } catch (error) {
        console.error('Error starting recording:', error);
        socket.emit('error', {
          message: 'Failed to start recording: ' + error.message,
        });
      }
    });

    socket.on('recording:stop', async (data) => {
      try {
        const { roomId } = data;

        // Verify room exists and user is room admin
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.createdBy.toString() !== socket.userId) {
          socket.emit('error', {
            message: 'Only room creator can stop recording',
          });
          return;
        }

        // Check if recording is active
        const { isRecordingActive, stopRecording } = await import(
          '../services/recordingService.js'
        );
        if (!isRecordingActive(roomId)) {
          socket.emit('error', {
            message: 'No active recording for this room',
          });
          return;
        }

        // Stop recording
        const recordingResult = await stopRecording(roomId);

        // Update room recording status
        room.isRecording = false;
        await room.save();

        // Notify all participants
        io.to(roomId).emit('recording:stopped', {
          recordingId: recordingResult.recordingId,
          stoppedBy: socket.user.name,
          stoppedById: socket.userId,
          timestamp: new Date().toISOString(),
          duration: recordingResult.duration,
          fileSize: recordingResult.fileSize,
          filePath: recordingResult.filePath,
        });

        console.log(
          `🛑 Recording stopped by ${socket.user.name} for room ${roomId}`
        );
      } catch (error) {
        console.error('Error stopping recording:', error);
        socket.emit('error', {
          message: 'Failed to stop recording: ' + error.message,
        });
      }
    });

    // Get recordings for a room
    socket.on('recording:list', async (data) => {
      try {
        const { roomId } = data;

        // Verify room exists and user has access
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if user is participant or creator
        const isParticipant =
          room.participants.includes(socket.userId) ||
          room.createdBy.toString() === socket.userId;

        if (!isParticipant) {
          socket.emit('error', {
            message: 'Access denied: Not a room participant',
          });
          return;
        }

        const { getRoomRecordings } = await import(
          '../services/recordingService.js'
        );
        const recordings = await getRoomRecordings(roomId);

        socket.emit('recording:list-response', {
          roomId,
          recordings: recordings.map((rec) => ({
            recordingId: rec.recordingId,
            status: rec.status,
            startedAt: rec.startedAt,
            endedAt: rec.endedAt,
            duration: rec.duration,
            fileSize: rec.fileSize,
            type: rec.type,
            filePath: rec.filePath,
          })),
        });
      } catch (error) {
        console.error('Error listing recordings:', error);
        socket.emit('error', {
          message: 'Failed to list recordings: ' + error.message,
        });
      }
    });

    // Delete a recording
    socket.on('recording:delete', async (data) => {
      try {
        const { roomId, recordingId } = data;

        // Verify room exists and user is room admin
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.createdBy.toString() !== socket.userId) {
          socket.emit('error', {
            message: 'Only room creator can delete recordings',
          });
          return;
        }

        const { deleteRecording } = await import(
          '../services/recordingService.js'
        );
        const result = await deleteRecording(roomId, recordingId);

        // Notify room participants
        io.to(roomId).emit('recording:deleted', {
          recordingId,
          deletedBy: socket.user.name,
          deletedById: socket.userId,
          timestamp: new Date().toISOString(),
        });

        socket.emit('recording:delete-response', result);
        console.log(
          `🗑️ Recording ${recordingId} deleted by ${socket.user.name} from room ${roomId}`
        );
      } catch (error) {
        console.error('Error deleting recording:', error);
        socket.emit('error', {
          message: 'Failed to delete recording: ' + error.message,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.name} disconnected`);

      // Clean up from current room
      if (socket.currentRoom) {
        const roomId = socket.currentRoom;

        try {
          // Remove user from database participants
          const room = await Room.findOne({ roomId });
          if (room) {
            room.participants = room.participants.filter(
              (p) => p.toString() !== socket.userId
            );
            await room.save();

            // Also remove from recording participants
            const recordingDoc = await Recording.findOne({ roomId });
            if (recordingDoc) {
              recordingDoc.participants = recordingDoc.participants.filter(
                (p) => p.toString() !== socket.userId
              );
              await recordingDoc.save();
            }

            // If room creator disconnects, delete the room
            if (room.createdBy.toString() === socket.userId) {
              await Room.findByIdAndDelete(room._id);
              // Notify all participants that room is deleted
              socket.to(roomId).emit('room:deleted', {
                roomId,
                message: 'Room has been deleted as creator disconnected',
              });
              return; // Don't send user:left if room is deleted
            }
          }

          // Get updated room info after removing user
          const updatedRoom = await Room.findOne({ roomId }).populate(
            'participants',
            'name email avatar'
          );

          // Notify others in the room with updated participant list
          socket.to(roomId).emit('user:left', {
            userId: socket.userId,
            name: socket.user.name,
            allParticipants: updatedRoom ? updatedRoom.participants : [],
          });
        } catch (error) {
          console.error('Error cleaning up database on disconnect:', error);
        }

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
      }
    });
  });
};
