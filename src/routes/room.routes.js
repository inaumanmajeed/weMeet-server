import { Router } from 'express';
import {
  createRoomController,
  joinRoomController,
  getRoomDetailsController,
  leaveRoomController,
} from '../controllers/room.controller.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';
import { isRoomAdmin } from '../middleware/isRoomAdmin.middleware.js';

const router = Router();

// ====================== { Protected Routes } ======================
router.route('/create').post(verifyAccessToken, createRoomController);
router.route('/join').post(verifyAccessToken, isRoomAdmin, joinRoomController);
router.route('/:roomId').get(verifyAccessToken, getRoomDetailsController);
router.route('/:roomId/leave').post(verifyAccessToken, leaveRoomController);

export default router;
