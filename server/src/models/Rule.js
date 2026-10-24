import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  conditionType: {
    type: String,
    enum: ['temperature_threshold', 'event_type', 'device_offline'],
    required: true,
  },
  deviceId: { type: String },
  threshold: { type: Number },
  eventType: { type: String },
  offlineAfterSeconds: { type: Number },
});

// Indexes for common query patterns
ruleSchema.index({ conditionType: 1 });
ruleSchema.index({ deviceId: 1 });

export default mongoose.model('Rule', ruleSchema);
