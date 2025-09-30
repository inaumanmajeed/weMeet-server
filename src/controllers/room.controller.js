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

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const roomId = crypto.createHash('sha256').update(userId).digest('hex');

  let room = await Room.findOne({ roomId });
  if (!room) {
    const mediasoupRoom = await createRoom(roomId);
    room = new Room({
      roomId: mediasoupRoom.roomId,
      createdBy: userId,
      participants: [userId],
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

  return res
    .status(201)
    .json(new ApiResponse(201, 'Room created successfully', { roomId }));
});

export const joinRoomController = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;
  const { room, isAdmin } = req;

  // validate user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (isAdmin) {
    return res.status(400).json(
      new ApiResponse(400, 'Room creator cannot join their own room again', {
        roomId: room.roomId,
        participants: room.participants,
      })
    );
  }

  // if user already joined
  if (room.participants.includes(userId)) {
    return res.status(200).json(
      new ApiResponse(200, 'Already in room', {
        roomId: room.roomId,
        participants: room.participants,
      })
    );
  }

  // otherwise add user to participants
  room.participants.push(userId);
  await room.save();

  // update recording participants as well
  const recordingDoc = await Recording.findOne({ roomId: room.roomId });
  if (recordingDoc && !recordingDoc.participants.includes(userId)) {
    recordingDoc.participants.push(userId);
    await recordingDoc.save();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Joined room successfully', {
      roomId: room.roomId,
      participants: room.participants,
    })
  );
});
