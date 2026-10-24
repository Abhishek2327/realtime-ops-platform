import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', database: dbStatus });
});

export default router;
