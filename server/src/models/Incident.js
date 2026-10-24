import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', required: true },
  deviceId: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'resolved'],
    default: 'open',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  title: { type: String, required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
}, {
  timestamps: true, // adds createdAt and updatedAt
});

// Indexes for common queries
incidentSchema.index({ deviceId: 1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ severity: 1 });

export default mongoose.model('Incident', incidentSchema);
