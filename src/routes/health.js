import express from 'express';
import ApiResponse from '../utils/ApiResponse.js';

const router = express.Router();

// Health Check Route - Simple endpoint to check if the server is running correctly
router.get('/', (req, res) => {
  new ApiResponse(201, 'Server is running 🚀', null);
});
router.get('/health', (req, res) => {
  new ApiResponse(200, 'Server is healthy 🚀', null);
});
router.get('/ping', (req, res) => {
  new ApiResponse(200, 'pong', null);
});
export default router;
