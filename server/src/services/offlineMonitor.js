import Device from '../models/Device.js';
import Rule from '../models/Rule.js';
import Incident from '../models/Incident.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Scan for devices that have been offline longer than the threshold defined in
 * enabled `device_offline` rules and create incidents accordingly.
 * This function is idempotent – it will not create duplicate active incidents
 * for the same rule/device pair.
 */
export async function runOfflineChecks() {
  try {
    const now = new Date();
    // Find enabled offline rules
    const rules = await Rule.find({ enabled: true, conditionType: 'device_offline' }).lean();
    for (const rule of rules) {
      const thresholdMs = (rule.offlineAfterSeconds || 0) * 1000;
      const cutoff = new Date(now.getTime() - thresholdMs);

      const deviceFilter = {
        lastSeenAt: { $lte: cutoff },
      };
      if (rule.deviceId) deviceFilter.deviceId = rule.deviceId;

      const devices = await Device.find(deviceFilter).lean();
      for (const device of devices) {
        // Update device status to offline if not already
        if (device.status !== 'offline') {
          await Device.updateOne({ _id: device._id }, { $set: { status: 'offline' } });
          const updatedDevice = await Device.findById(device._id).lean();
          eventBus.emit('update', { kind: 'device', data: updatedDevice });
        }
        // Prevent duplicate active incidents
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
            title: `${rule.name} - device offline`,
          },
        };
        const incident = await Incident.findOneAndUpdate(incidentFilter, update, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }).lean();
        eventBus.emit('update', { kind: 'incident', data: incident });
      }
    }
  } catch (err) {
    console.error('Offline detection error:', err);
  }
}
