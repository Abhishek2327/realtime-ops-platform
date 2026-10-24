import express from 'express';
import { connectDB } from './config/db.js';
import healthRouter from './routes/health.js';

// Environment variables are loaded inside db.js via absolute path
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Mount health router
app.use('/api', healthRouter);
app.use('/api/devices', (await import('./routes/devices.js')).default);
app.use('/api/events', (await import('./routes/events.js')).default);
app.use('/api/rules', (await import('./routes/rules.js')).default);
app.use('/api/incidents', (await import('./routes/incidents.js')).default);

// Start server after attempting DB connection
(async () => {
  try {
    const conn = await connectDB();
    // Set flag for health route; safe even if conn is null
    app.locals.dbConnected = conn?.connection?.readyState === 1;
  } catch (e) {
    console.error('Failed to initialize DB:', e);
    app.locals.dbConnected = false;
  } finally {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
})();

