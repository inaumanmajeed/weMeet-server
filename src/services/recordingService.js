import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Recording from '../models/recording.model.js';

const activeRecordings = new Map(); // roomId -> ffmpeg process

export { activeRecordings };

// Ensure recordings directory exists
const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

export async function startRecording(roomId, type = 'mp4', io = null) {
  if (activeRecordings.has(roomId)) {
    throw new Error('Recording already running for this room');
  }

  const recordingId = uuidv4();
  const fileName = `${roomId}-${Date.now()}-${recordingId}.${type}`;
  const filePath = path.join(recordingsDir, fileName);
  const relativePath = path.join('recordings', fileName);

  // Create a placeholder video file for demo purposes
  // In a real implementation, you would use mediasoup to record actual streams
  const ffmpegArgs = [
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=10:size=320x240:rate=1',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=1000:duration=10',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-t',
    '10', // 10 second demo recording
    filePath,
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  const startTime = new Date();

  ffmpeg.stderr.on('data', (data) => {
    console.log('ffmpeg:', data.toString());
  });

  ffmpeg.on('close', (code) => {
    console.log(`ffmpeg exited with code ${code}`);
    if (code === 0 && io) {
      // Notify room participants that recording finished processing
      io.to(roomId).emit('recording:file-ready', {
        recordingId,
        fileName,
        message: 'Recording file is ready',
      });
    }
  });

  ffmpeg.on('error', (error) => {
    console.error('ffmpeg error:', error);
    activeRecordings.delete(roomId);
  });

  const recordingData = {
    process: ffmpeg,
    filePath,
    relativePath,
    recordingId,
    type,
    startTime,
  };

  activeRecordings.set(roomId, recordingData);

  // Update database to mark recording as started
  let doc = await Recording.findOne({ roomId });
  if (!doc) {
    doc = new Recording({ roomId, participants: [], recordings: [] });
  }

  doc.recordings.push({
    recordingId,
    filePath: relativePath,
    type,
    startedAt: startTime,
    status: 'recording',
  });

  await doc.save();

  console.log(`🎥 Recording started for room ${roomId} -> ${filePath}`);
  return { recordingId, filePath: relativePath, startTime };
}

export async function stopRecording(roomId) {
  const rec = activeRecordings.get(roomId);
  if (!rec) {
    throw new Error('No active recording for this room');
  }

  const endTime = new Date();
  const duration = Math.floor((endTime - rec.startTime) / 1000); // duration in seconds

  // Gracefully stop ffmpeg
  rec.process.kill('SIGTERM');

  // Wait a bit for graceful shutdown, then force kill if needed
  setTimeout(() => {
    if (!rec.process.killed) {
      rec.process.kill('SIGKILL');
    }
  }, 3000);

  // Update database record
  const doc = await Recording.findOne({ roomId });
  if (doc) {
    const recordingIndex = doc.recordings.findIndex(
      (r) => r.recordingId === rec.recordingId
    );
    if (recordingIndex !== -1) {
      doc.recordings[recordingIndex].endedAt = endTime;
      doc.recordings[recordingIndex].duration = duration;
      doc.recordings[recordingIndex].status = 'completed';

      // Get file size if file exists
      if (fs.existsSync(rec.filePath)) {
        const stats = fs.statSync(rec.filePath);
        doc.recordings[recordingIndex].fileSize = stats.size;
      }

      await doc.save();
    }
  }

  activeRecordings.delete(roomId);

  console.log(
    `✅ Recording stopped & saved for room ${roomId}, duration: ${duration}s`
  );
  return {
    recordingId: rec.recordingId,
    filePath: rec.relativePath,
    duration,
    fileSize: fs.existsSync(rec.filePath) ? fs.statSync(rec.filePath).size : 0,
  };
}

// Get all recordings for a room
export async function getRoomRecordings(roomId) {
  const doc = await Recording.findOne({ roomId });
  return doc ? doc.recordings : [];
}

// Delete a specific recording
export async function deleteRecording(roomId, recordingId) {
  const doc = await Recording.findOne({ roomId });
  if (!doc) {
    throw new Error('Room recordings not found');
  }

  const recordingIndex = doc.recordings.findIndex(
    (r) => r.recordingId === recordingId
  );
  if (recordingIndex === -1) {
    throw new Error('Recording not found');
  }

  const recording = doc.recordings[recordingIndex];
  const fullPath = path.join(process.cwd(), recording.filePath);

  // Delete file from filesystem
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  // Remove from database
  doc.recordings.splice(recordingIndex, 1);
  await doc.save();

  console.log(`🗑️ Recording deleted: ${recordingId}`);
  return { recordingId, deleted: true };
}

// Check if recording is active
export function isRecordingActive(roomId) {
  return activeRecordings.has(roomId);
}

// Get active recording info
export function getActiveRecording(roomId) {
  return activeRecordings.get(roomId) || null;
}
