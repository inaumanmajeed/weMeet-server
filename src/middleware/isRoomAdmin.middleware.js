import Room from '../models/room.models.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const isRoomAdmin = asyncHandler(async (req, res, next) => {
  const { roomId } = req.query;
  const { id: userId } = req.user;

  const room = await Room.findOne({ roomId });
  if (!room) {
    throw new ApiError(404, 'Meeting expired or invalid meeting ID');
  }

  req.isAdmin = room.createdBy.toString() === userId.toString();
  req.room = room;

  next();
});

const notAllowToJoinRoomIfAlreadyInRoom = asyncHandler(async (req, res, next) => {
  const { room } = req;
  const { id: userId } = req.user;
  if (room.participants.includes(userId)) {
    throw new ApiError(400, 'already in meeting');
  }
  next();
});

const isAllowedToModify = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Not room admin' });
  }

  next();
};

export { isRoomAdmin, isAllowedToModify, notAllowToJoinRoomIfAlreadyInRoom };
