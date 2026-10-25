import Incident from '../models/Incident.js';
import Rule from '../models/Rule.js';
import { eventBus } from '../utils/eventBus.js';
/**
 * Evaluate enabled rules against an incoming event and create incidents.
 * @param {Object} param0
 * @param {import('../models/Event.js').default} param0.event - The persisted Event document.
 * @param {import('../models/Device.js').default} param0.device - The Device document.
 */
export default async function evaluateRules({ event, device }) {
  try {
    // Find enabled rules that either apply globally or to this device
    const ruleFilter = {
      enabled: true,
      $or: [{ deviceId: { $exists: false } }, { deviceId: device.deviceId }],
    };
    const rules = await Rule.find(ruleFilter).lean();

    for (const rule of rules) {
      let matches = false;
      // Temperature threshold rule
      if (rule.conditionType === 'temperature_threshold') {
        const temp = event.payload?.temperature;
        if (typeof temp === 'number' && typeof rule.threshold === 'number') {
          matches = temp > rule.threshold;
        }
      }
      // Event type rule
      else if (rule.conditionType === 'event_type') {
        if (event.type === rule.eventType) {
          matches = true;
        }
      }
      // Device offline rule is evaluated elsewhere (not part of ingestion)

      if (!matches) continue;

      // Prevent duplicate active incidents for same rule/device
      const incidentFilter = {
        ruleId: rule._id,
        deviceId: device.deviceId,
        status: { $in: ['open', 'acknowledged'] },
      };

      const update = {
        $setOnInsert: {
          ruleId: rule._id,
          deviceId: device.deviceId,
          status: 'open',
          severity: 'high',
          title: `${rule.name} triggered by event ${event.eventId}`,
          eventId: event._id,
        },
      };

      // Atomically insert only if not exists
      const incident = await Incident.findOneAndUpdate(incidentFilter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }).lean();
      // Emit SSE update for incident (new or existing)
      eventBus.emit('update', { kind: 'incident', data: incident });
    }
  } catch (err) {
    console.error('Rule evaluation error:', err);
    // Swallow errors to avoid breaking event ingestion
  }
}
