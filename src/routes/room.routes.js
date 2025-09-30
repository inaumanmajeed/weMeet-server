import { Router } from 'express';
import {
  createRoomController,
  joinRoomController,
} from '../controllers/room.controller.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';
import { isRoomAdmin } from '../middleware/isRoomAdmin.middleware.js';

const router = Router();

// ====================== { Protected Route } ======================
router.route('/create').get(verifyAccessToken, createRoomController);
router.route('/join').post(verifyAccessToken, isRoomAdmin, joinRoomController);

export default router;
