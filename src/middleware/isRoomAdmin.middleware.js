// middlewares/isRoomAdmin.js
import Room from '../models/room.models.js';
import asyncHandler from '../utils/asyncHandler.js';

const isRoomAdmin = asyncHandler(async (req, res, next) => {
  const { roomId } = req.query;
  const { id: userId } = req.user;

  const room = await Room.findOne({ roomId });
  if (!room) {
    req.isAdmin = false;
    return next();
  }

  req.isAdmin = room.createdBy.toString() === userId.toString();
  req.room = room;

  next();
});

const isAllowedToModify = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Not room admin' });
  }

  next();
};

export { isRoomAdmin, isAllowedToModify };
