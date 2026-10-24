// server/src/stream.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fetch from 'node-fetch';
import app from '../src/index.js';
import { connectDB } from '../src/config/db.js';
import mongoose from 'mongoose';

let server;
let port;

before(async () => {
  await connectDB();
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('GET /api/stream sends SSE headers and initial comment', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/stream`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.equal(res.headers.get('connection'), 'keep-alive');
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const text = new TextDecoder().decode(value);
  assert.match(text, /^: connected/);
  await reader.cancel();
});

test('SSE receives event after successful POST', async () => {
  const streamRes = await fetch(`http://127.0.0.1:${port}/api/stream`);
  const reader = streamRes.body.getReader();
  await reader.read(); // consume initial comment

  // create device
  const deviceRes = await fetch(`http://127.0.0.1:${port}/api/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'dev-123', name: 'Test', location: 'lab', status: 'offline' }),
  });
  assert.equal(deviceRes.status, 201);

  // post event
  const eventRes = await fetch(`http://127.0.0.1:${port}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: 'evt-123',
      deviceId: 'dev-123',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: { temperature: 80 },
    }),
  });
  assert.equal(eventRes.status, 201);

  const { value } = await reader.read();
  const sseText = new TextDecoder().decode(value);
  assert.match(sseText, /event: event/);
  assert.match(sseText, /"eventId":"evt-123"/);
  await reader.cancel();
});
