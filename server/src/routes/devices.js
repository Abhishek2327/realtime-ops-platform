import { Router } from 'express';
import Device from '../models/Device.js';

const router = Router();

// GET /api/devices - list all devices
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().lean();
    res.json(devices);
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
