import { spawn } from 'child_process';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Recording from '../models/recording.model.js';

const activeRecordings = new Map(); // roomId -> ffmpeg process

export async function startRecording(room, type = 'mp4') {
  if (activeRecordings.has(room.roomId)) {
    throw new Error('Recording already running for this room');
  }

  const recordingId = uuidv4();
  const fileName = `${room.roomId}-${recordingId}.${type}`;
  const filePath = path.join('recordings', fileName);

  // ⚠️ For real recording: you must connect producers to a PlainRtpTransport
  const ffmpegArgs = [
    '-protocol_whitelist',
    'file,udp,rtp',
    '-i',
    `rtp://127.0.0.1:5006`, // adjust to your transport port
    '-c',
    'copy',
    filePath,
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stderr.on('data', (data) => {
    console.log('ffmpeg:', data.toString());
  });

  ffmpeg.on('close', (code) => {
    console.log(`ffmpeg exited with code ${code}`);
  });

  activeRecordings.set(room.roomId, { process: ffmpeg, filePath, recordingId, type });
  console.log(`🎥 Recording started for room ${room.roomId} -> ${filePath}`);
}

export async function stopRecording(roomId) {
  const rec = activeRecordings.get(roomId);
  if (!rec) {
    throw new Error('No active recording for this room');
  }

  // kill ffmpeg
  rec.process.kill('SIGINT');

  // save metadata in DB
  let doc = await Recording.findOne({ roomId });
  if (!doc) {
    doc = new Recording({ roomId, participants: [], recordings: [] });
  }

  doc.recordings.push({
    recordingId: rec.recordingId,
    filePath: rec.filePath,
    type: rec.type,
    endedAt: new Date(),
  });

  await doc.save();
  activeRecordings.delete(roomId);

  console.log(`✅ Recording stopped & saved for room ${roomId}`);
  return doc;
}
