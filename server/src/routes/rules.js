import { Router } from 'express';
import Rule from '../models/Rule.js';

const router = Router();

// GET /api/rules - list all rules
router.get('/', async (req, res) => {
  try {
    const rules = await Rule.find().lean();
    res.json(rules);
  } catch (err) {
    console.error('Error fetching rules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rules - create a new rule
router.post('/', async (req, res) => {
  const {
    name,
    enabled = true,
    conditionType,
    deviceId,
    threshold,
    eventType,
    offlineAfterSeconds,
  } = req.body;

  // Basic validation
  if (!name || !conditionType) {
    return res.status(400).json({ error: 'Missing required fields: name, conditionType' });
  }
  const allowedConditions = ['temperature_threshold', 'event_type', 'device_offline'];
  if (!allowedConditions.includes(conditionType)) {
    return res.status(400).json({ error: `conditionType must be one of ${allowedConditions.join(', ')}` });
  }

  try {
    const rule = await Rule.create({
      name,
      enabled,
      conditionType,
      deviceId,
      threshold,
      eventType,
      offlineAfterSeconds,
    });
    res.status(201).json(rule);
  } catch (err) {
    console.error('Error creating rule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
