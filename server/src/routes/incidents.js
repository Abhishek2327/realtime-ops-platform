import { Router } from 'express';
import Incident from '../models/Incident.js';

const router = Router();

// GET /api/incidents - list incidents with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      Incident.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Incident.countDocuments(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: incidents,
    });
  } catch (err) {
    console.error('Error fetching incidents:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/incidents/:id - update status, severity, or title
router.patch('/:id', async (req, res) => {
  const { status, severity, title } = req.body;
  const updates = {};
  if (status) updates.status = status;
  if (severity) updates.severity = severity;
  if (title) updates.title = title;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  try {
    const incident = await Incident.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(incident);
  } catch (err) {
    console.error('Error updating incident:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
