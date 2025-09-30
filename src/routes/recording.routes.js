import express from 'express';
import {
  startRecordingController,
  stopRecordingController,
} from '../controllers/recording.controller.js';

const router = express.Router();

router.post('/start', startRecordingController);
router.post('/stop', stopRecordingController);

export default router;
