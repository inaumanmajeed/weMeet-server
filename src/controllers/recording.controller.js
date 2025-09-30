import { getRoom } from '../services/mediasoup.js';
import { startRecording, stopRecording } from '../services/recordingService.js';

export const startRecordingController = async (req, res) => {
  try {
    const { roomId, type } = req.body;

    const room = getRoom(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    await startRecording(room, type || 'mp4');

    res.json({ success: true, message: 'Recording started' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const stopRecordingController = async (req, res) => {
  try {
    const { roomId } = req.body;

    const result = await stopRecording(roomId);

    res.json({ success: true, message: 'Recording stopped', data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
