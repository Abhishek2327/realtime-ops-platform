import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastSeenAt: { type: Date },
});

// Index for quick lookup by deviceId
deviceSchema.index({ deviceId: 1 });

export default mongoose.model('Device', deviceSchema);
