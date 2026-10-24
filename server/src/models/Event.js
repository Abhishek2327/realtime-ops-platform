import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  deviceId: { type: String, required: true },
  type: { type: String, required: true },
  timestamp: { type: Date, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  receivedAt: { type: Date, default: Date.now },
});

// Index for fast lookups by deviceId and timestamp
eventSchema.index({ deviceId: 1, timestamp: -1 });

eventSchema.index({ eventId: 1 }, { unique: true });

export default mongoose.model('Event', eventSchema);
