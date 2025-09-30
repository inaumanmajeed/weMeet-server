import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 10 },
    recordingEnabled: { type: Boolean, default: false },
    isRecording: { type: Boolean, default: false },
    roomSettings: {
      audioEnabled: { type: Boolean, default: true },
      videoEnabled: { type: Boolean, default: true },
      screenShareEnabled: { type: Boolean, default: true },
      chatEnabled: { type: Boolean, default: true },
      recordingAllowed: { type: Boolean, default: false },
    },
    destroyAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

// Index for efficient queries
roomSchema.index({ roomId: 1 });
roomSchema.index({ createdBy: 1 });
roomSchema.index({ isActive: 1 });

export default mongoose.model('Room', roomSchema);
