import { Router } from 'express';
import Event from '../models/Event.js';
import Device from '../models/Device.js';
import Rule from '../models/Rule.js';
import Incident from '../models/Incident.js';
import evaluateRules from '../services/ruleEngine.js';

const router = Router();

// GET /api/events - list events with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find().sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: events,
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events - ingest a new event
router.post('/', async (req, res) => {
  const { eventId, deviceId, type, timestamp, payload } = req.body;
  // Basic validation
  if (!eventId || !deviceId || !type || !timestamp || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  const eventTime = new Date(timestamp);
  if (isNaN(eventTime.getTime())) {
    return res.status(400).json({ error: 'Invalid timestamp format' });
  }
  try {
    // Verify device exists
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    // Create event (duplicate protection via unique index)
    const newEvent = new Event({
      eventId,
      deviceId,
      type,
      timestamp: eventTime,
      payload,
    });
    await newEvent.save();

    // Update device's lastSeenAt and status (only forward in time)
    if (!device.lastSeenAt || eventTime > device.lastSeenAt) {
      device.lastSeenAt = eventTime;
    }
    device.status = 'online';
    await device.save();

    // Evaluate rules and create incidents as needed
    await evaluateRules({ event: newEvent, device });

    res.status(201).json(newEvent);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.eventId) {
      // Duplicate eventId
      console.warn('Duplicate event ingestion attempt:', eventId);
      return res.status(409).json({ error: 'Duplicate eventId' });
    }
    console.error('Error ingesting event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
