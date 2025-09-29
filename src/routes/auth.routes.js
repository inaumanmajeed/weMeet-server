import { Router } from 'express';

// import controllers of user
import {
  registerUser,
  loginUser,
  logoutUser,
  reassignAccessToken,
} from '../controllers/user.controller.js';
import { verifyAccessToken, verifyRefreshToken } from '../middleware/auth.middleware.js';

const router = Router();

// ====================== { Public Routes } ======================
router.route('/register').post(registerUser);
router.route('/login').post(loginUser);

// ====================== { Protected Routes } ======================
router.route('/logout').get(verifyAccessToken, logoutUser);
router.route('/refresh').get(verifyAccessToken, verifyRefreshToken, reassignAccessToken);

export default router;
