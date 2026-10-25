// server/src/routes/stream.js
import { Router } from 'express';
import { eventBus } from '../utils/eventBus.js';
import Event from '../models/Event.js';
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
router.get('/', async (req, res) => {
  // Set SSE headers
  console.log('DEBUG request url:', req.originalUrl);
  console.log('DEBUG request headers:', req.headers);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Initial connection comment (clients may ignore it)
  res.write(': connected\n\n');
  // Ensure headers and initial data are flushed immediately
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Helper to send SSE formatted messages (default events only)
  const sendSSE = (payload) => {
    const data = JSON.stringify(payload);
    // Stable id: if payload contains receivedAt and eventId use both, else fallback to Date.now()
    let id = Date.now();
    if (payload && payload.receivedAt && payload.eventId) {
      const ts = new Date(payload.receivedAt).getTime();
      id = `${ts}-${payload.eventId}`;
    }
    res.write(`id: ${id}\n`);
    res.write(`data: ${data}\n\n`);
    console.log('SENT SSE', {id, payload});
    if (typeof res.flush === 'function') { res.flush(); }
  };

  // Set to track IDs already sent (to avoid duplicates between replay and live stream)
  const sentIds = new Set();

  // Live update listener: forward new events to the client
  const busListener = (payload) => {
    const evTime = payload.receivedAt instanceof Date ? payload.receivedAt.getTime() : new Date(payload.receivedAt).getTime();
    const id = `${evTime}-${payload.eventId}`;
    if (sentIds.has(id)) return;
    sentIds.add(id);
    sendSSE(payload);
  };
  eventBus.on('update', busListener);
  const detachLiveListener = () => eventBus.removeListener('update', busListener);

  // Replay past events based on Last-Event-ID header using stable cursor (receivedAt + eventId)
  console.log('DEBUG req.headers', req.headers);
  console.log('DEBUG req.query', req.query);
  // Support various ways the client may provide the Last-Event-ID (header or query param)
  const lastIdHeader =
    req.headers['last-event-id'] ||
    req.query['last-event-id'] ||
    req.query.lastEventId ||
    req.query.lastEventID ||
    (Object.keys(req.query).length ? req.query[Object.keys(req.query)[0]] : undefined);
  console.log('DEBUG lastIdHeader:', lastIdHeader);
  if (lastIdHeader) {
    // Expected format: <timestamp>-<eventId> or legacy just eventId
    let cursorTime = null;
    let cursorEventId = null;
    if (lastIdHeader.includes('-')) {
      const [tsStr, evId] = lastIdHeader.split('-');
      console.log('DEBUG parsed cursor', {cursorTime: Number(tsStr), cursorEventId: evId});
      cursorTime = Number(tsStr);
      cursorEventId = evId;
    } else {
      cursorEventId = lastIdHeader;
    }
    // Simplified query: fetch all events; we'll filter based on cursor after sorting.
    let query = {};
    const pastEvents = await Event.find(query).sort({ receivedAt: 1, eventId: 1 }).lean();
    console.log('DEBUG pastEvents ids:', pastEvents.map(ev => ev.eventId));
    console.log('DEBUG pastEvents count:', pastEvents.length);
    // Defer replay emission to ensure client listener is ready
    await new Promise(r => setTimeout(r, 1500));
    for (const ev of pastEvents) {
      const evTime = new Date(ev.receivedAt).getTime();
      console.log('DEBUG replay sending', {evId: ev.eventId, evTime});
      // Skip events before cursor or same timestamp with non-greater eventId
      if (cursorTime !== null) {
        if (evTime < cursorTime) continue;
        if (evTime === cursorTime && ev.eventId <= (cursorEventId || '')) continue;
      }
      const id = `${evTime}-${ev.eventId}`;
      if (sentIds.has(id)) continue;
      sentIds.add(id);
      sendSSE(ev);
    }
  }


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
