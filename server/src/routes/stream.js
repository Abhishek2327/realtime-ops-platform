// server/src/routes/stream.js
import { Router } from 'express';
import { eventBus } from '../utils/eventBus.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env relative to project root (same logic as db.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const router = Router();

/**
 * GET /api/stream – Server‑Sent Events endpoint.
 * Sends an initial comment, then streams updates for events, devices, and incidents.
 * Heartbeat interval is controlled by SSE_HEARTBEAT_MS (ms). If missing/invalid defaults to 15000.
 */
router.get('/', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Initial connection comment (clients may ignore it)
  res.write(': connected\n\n');

  // Helper to send SSE formatted messages
  const sendSSE = (kind, payload) => {
    const data = JSON.stringify(payload);
    // Using event name = kind (event, device, incident)
    res.write(`event: ${kind}\n`);
    // Optionally include an id – using timestamp for simplicity
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${data}\n\n`);
  };

  // Listener for the shared eventBus
  const busListener = ({ kind, data }) => {
    // Guard against missing response (client may have closed)
    if (!res.writableEnded) {
      sendSSE(kind, data);
    }
  };
  eventBus.on('update', busListener);

  // Heartbeat timer – comment lines keep connection alive
  const heartbeatMs = parseInt(process.env.SSE_HEARTBEAT_MS, 10);
  const intervalMs = Number.isNaN(heartbeatMs) || heartbeatMs <= 0 ? 15000 : heartbeatMs;
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, intervalMs);

  // Clean up on client disconnect
  const cleanUp = () => {
    clearInterval(heartbeat);
    eventBus.removeListener('update', busListener);
  };
  req.on('close', cleanUp);
  req.on('error', cleanUp);
});

export default router;
