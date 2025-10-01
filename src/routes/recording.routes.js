// ⚠️ DEPRECATED: This file contains REST API routes that are no longer used.
// All recording operations have been moved to socket handlers in socketHandlers.js
// This file is kept for reference but should not be imported or used.

import express from 'express';
import {
  startRecordingController,
  stopRecordingController,
} from '../controllers/recording.controller.js';

const router = express.Router();

router.post('/start', startRecordingController);
router.post('/stop', stopRecordingController);

export default router;
