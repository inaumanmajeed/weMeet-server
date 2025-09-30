import mongoose from 'mongoose';

const RecordingSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    recordings: [
      {
        recordingId: { type: String, required: true },
        filePath: { type: String, required: true },
        type: { type: String, enum: ['mp3', 'mp4'], required: true },
        startedAt: { type: Date, default: Date.now },
        endedAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Recording', RecordingSchema);
