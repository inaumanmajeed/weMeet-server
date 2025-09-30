import { createRoom } from '../services/mediasoup.js';
import Recording from '../models/recording.model.js';
import { User } from '../models/user.model.js';
import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import Room from '../models/room.models.js';

export const createRoomController = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;
  const { maxParticipants = 10, roomSettings = {} } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const roomId = crypto
    .createHash('sha256')
    .update(userId + Date.now())
    .digest('hex')
    .substring(0, 10);

  let room = await Room.findOne({ roomId });
  if (room) {
    // If room exists but is inactive, reactivate it
    if (!room.isActive) {
      room.isActive = true;
      room.participants = [userId];
      room.destroyAt = new Date(Date.now() + 50 * 60 * 1000); // 50 minutes from now
      await room.save();
    }
  } else {
    const mediasoupRoom = await createRoom(roomId);

    // Default room settings
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
      destroyAt: new Date(Date.now() + 50 * 60 * 1000), // 50 minutes from now
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

  return res.status(201).json(
    new ApiResponse(201, 'Room created successfully', {
      roomId,
      maxParticipants: room.maxParticipants,
      roomSettings: room.roomSettings,
      expiresAt: room.destroyAt,
    })
  );
});

export const joinRoomController = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;
  const { room, isAdmin } = req;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if room is active
  if (!room.isActive) {
    throw new ApiError(400, 'Room is not active');
  }

  // Check max participants limit
  if (
    room.participants.length >= room.maxParticipants &&
    !room.participants.includes(userId)
  ) {
    throw new ApiError(400, 'Room is full');
  }

  if (isAdmin) {
    return res.status(200).json(
      new ApiResponse(200, 'Room creator is already in the room', {
        roomId: room.roomId,
        participants: room.participants.length,
        maxParticipants: room.maxParticipants,
        roomSettings: room.roomSettings,
        expiresAt: room.destroyAt,
      })
    );
  }

  if (room.participants.includes(userId)) {
    return res.status(200).json(
      new ApiResponse(200, 'Already in room', {
        roomId: room.roomId,
        participants: room.participants.length,
        maxParticipants: room.maxParticipants,
        roomSettings: room.roomSettings,
        expiresAt: room.destroyAt,
      })
    );
  }

  room.participants.push(userId);
  await room.save();

  const recordingDoc = await Recording.findOne({ roomId: room.roomId });
  if (recordingDoc && !recordingDoc.participants.includes(userId)) {
    recordingDoc.participants.push(userId);
    await recordingDoc.save();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Joined room successfully', {
      roomId: room.roomId,
      participants: room.participants.length,
      maxParticipants: room.maxParticipants,
      roomSettings: room.roomSettings,
      expiresAt: room.destroyAt,
    })
  );
});

export const getRoomDetailsController = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { id: userId } = req.user;

  const room = await Room.findOne({ roomId }).populate('participants', 'name email');
  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  // Check if user is a participant or the creator
  const isParticipant =
    room.participants.some((p) => p._id.toString() === userId) ||
    room.createdBy.toString() === userId;

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant of this room');
  }

  return res.status(200).json(
    new ApiResponse(200, 'Room details retrieved successfully', {
      roomId: room.roomId,
      createdBy: room.createdBy,
      participants: room.participants,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    })
  );
});

export const leaveRoomController = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { id: userId } = req.user;

  const room = await Room.findOne({ roomId });

  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  // Check if user is in the room
  if (!room.participants.includes(userId)) {
    throw new ApiError(400, 'You are not in this room');
  }

  // Remove user from participants
  room.participants = room.participants.filter((p) => p.toString() !== userId);

  // If room creator leaves, delete the room
  if (room.createdBy.toString() === userId) {
    await Room.findByIdAndDelete(room._id);
    return res
      .status(200)
      .json(new ApiResponse(200, 'Room deleted as creator left', { roomId }));
  }

  await room.save();

  // Also remove from recording participants
  const recordingDoc = await Recording.findOne({ roomId });
  if (recordingDoc) {
    recordingDoc.participants = recordingDoc.participants.filter(
      (p) => p.toString() !== userId
    );
    await recordingDoc.save();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Left room successfully', {
      roomId: room.roomId,
      participants: room.participants,
    })
  );
});
