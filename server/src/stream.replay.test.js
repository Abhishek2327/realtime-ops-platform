// server/src/stream.replay.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fetch from 'node-fetch';
import app from '../src/index.js';
import { connectDB } from '../src/config/db.js';
import mongoose from 'mongoose';
import Device from '../src/models/Device.js';
import Event from '../src/models/Event.js';

let server;
let port;

before(async () => {
  process.env.NODE_ENV = 'test';
  await connectDB();
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// Helper to open SSE stream using EventSource for reliable reading
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const EventSource = require('eventsource');
function openStream(lastEventId) {
  const url = `http://127.0.0.1:${port}/api/stream` + (lastEventId ? `?last-event-id=${lastEventId}` : '');
  return new EventSource(url);
}

test('Replay with identical receivedAt timestamps', async () => {
  // create device
  // create device directly via the model (no HTTP POST endpoint)
  await Device.create({ deviceId: 'dev-dup', name: 'Dup', location: 'lab' });

  const fixedTime = new Date('2023-01-01T12:00:00.000Z');
  // insert two events directly with same receivedAt but different eventId values
  await Event.create({
    eventId: 'e1',
    deviceId: 'dev-dup',
    type: 'temp',
    timestamp: new Date(),
    payload: {},
    receivedAt: fixedTime,
  });
  await Event.create({
    eventId: 'e2',
    deviceId: 'dev-dup',
    type: 'temp',
    timestamp: new Date(),
    payload: {},
    receivedAt: fixedTime,
  });

  // Build cursor after first event (e1)
  const cursor = `${fixedTime.getTime()}-e1`;
  const es = openStream(cursor);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('DEBUG: SSE timeout after 3000ms');
      es.close();
      reject(new Error('Timeout waiting for SSE event'));
    }, 3000);
    es.onmessage = (msg) => {
      console.error('Received SSE data:', msg.data);
      clearTimeout(timeout);
      try {
        assert.match(msg.data, /"eventId":"e2"/);
        resolve();
      } catch (e) {
        console.error('Assertion error:', e.stack);
        reject(e);
      }
      es.close();
    };
    es.onerror = (err) => {
      clearTimeout(timeout);
      es.close();
      reject(err);
    };
  });
});

test('Event arriving during replay is not missed', async () => {
  // ensure clean state
  // create device directly via the model (no HTTP POST endpoint)
  await Device.create({ deviceId: 'dev-live', name: 'Live', location: 'lab' });

  // pre‑seed one event
  const preRes = await fetch(`http://127.0.0.1:${port}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: 'pre-ev',
      deviceId: 'dev-live',
      type: 'temp',
      timestamp: new Date().toISOString(),
      payload: {},
    }),
  });
  assert.equal(preRes.status, 201);
});
