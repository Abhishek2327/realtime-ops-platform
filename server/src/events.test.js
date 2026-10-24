// Automated tests for Phase 3: Event ingestion and rule evaluation
// Run with: npm test (node --test)

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import process from 'process';
process.env.NODE_ENV = 'test';
process.env.TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/realtimeops_test';

import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/index.js';
import { connectDB } from '../src/config/db.js';
import Device from '../src/models/Device.js';
import Event from '../src/models/Event.js';
import Rule from '../src/models/Rule.js';
import Incident from '../src/models/Incident.js';

before(async () => {
  await connectDB();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Clean collections before each test
  await Promise.all([
    Device.deleteMany({}),
    Event.deleteMany({}),
    Rule.deleteMany({}),
    Incident.deleteMany({}),
  ]);
});

describe('POST /api/events ingestion', () => {
  test('missing required fields returns 400', async () => {
    const res = await request(app).post('/api/events').send({});
    assert.equal(res.status, 400);
  });

  test('invalid timestamp returns 400', async () => {
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    const payload = { temperature: 80 };
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-1',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: 'invalid-date',
      payload,
    });
    assert.equal(res.status, 400);
  });

  test('invalid payload (non-object) returns 400', async () => {
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-2',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: 'not-an-object',
    });
    assert.equal(res.status, 400);
  });

  test('unknown device returns 404', async () => {
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-3',
      deviceId: 'unknown-device',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: { temperature: 70 },
    });
    assert.equal(res.status, 404);
  });

  test('valid event is stored and updates device lastSeenAt', async () => {
    const now = new Date();
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-4',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: now.toISOString(),
      payload: { temperature: 70 },
    });
    assert.equal(res.status, 201);
    const storedEvent = await Event.findOne({ eventId: 'evt-4' }).lean();
    assert.ok(storedEvent);
    const device = await Device.findOne({ deviceId: 'device-001' }).lean();
    assert.equal(new Date(device.lastSeenAt).getTime(), now.getTime());
  });

  test('older buffered event does not move lastSeenAt backwards', async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 10000);
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    // Newer event
    const resNew = await request(app).post('/api/events').send({
      eventId: 'evt-new',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: now.toISOString(),
      payload: { temperature: 70 },
    });
    assert.equal(resNew.status, 201);
    // Older event
    const resOld = await request(app).post('/api/events').send({
      eventId: 'evt-old',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: older.toISOString(),
      payload: { temperature: 70 },
    });
    assert.equal(resOld.status, 201);
    const device = await Device.findOne({ deviceId: 'device-001' }).lean();
    assert.equal(new Date(device.lastSeenAt).getTime(), now.getTime());
    const evNew = await Event.findOne({ eventId: 'evt-new' }).lean();
    const evOld = await Event.findOne({ eventId: 'evt-old' }).lean();
    assert.equal(new Date(evNew.timestamp).getTime(), now.getTime());
    assert.equal(new Date(evOld.timestamp).getTime(), older.getTime());
  });


  test('temperature threshold rule triggers incident when condition met', async () => {
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'High Temp',
      enabled: true,
      conditionType: 'temperature_threshold',
      threshold: 75,
    });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-temp-high',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: { temperature: 80 },
    });
    assert.equal(res.status, 201);
    const incident = await Incident.findOne({ eventId: res.body._id }).lean();
    assert.ok(incident);
    assert.equal(incident.status, 'open');
    assert.match(incident.title, /High Temp/);
  });

  test('temperature threshold rule does NOT trigger incident when condition not met', async () => {
    await Device.create({ deviceId: 'device-001', name: 'D1', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'High Temp',
      enabled: true,
      conditionType: 'temperature_threshold',
      threshold: 75,
    });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-temp-low',
      deviceId: 'device-001',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: { temperature: 70 },
    });
    assert.equal(res.status, 201);
    const incident = await Incident.findOne({ eventId: res.body._id }).lean();
    assert.equal(incident, null);
  });

  test('event type rule triggers incident', async () => {
    await Device.create({ deviceId: 'device-002', name: 'D2', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'Power Loss',
      enabled: true,
      conditionType: 'event_type',
      eventType: 'power_loss',
    });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-power',
      deviceId: 'device-002',
      type: 'power_loss',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(res.status, 201);
    const incident = await Incident.findOne({ eventId: res.body._id }).lean();
    assert.ok(incident);
    assert.match(incident.title, /Power Loss/);
  });

  test('disabled rule does not trigger incident', async () => {
    await Device.create({ deviceId: 'device-003', name: 'D3', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'Disabled Rule',
      enabled: false,
      conditionType: 'event_type',
      eventType: 'temperature',
    });
    const res = await request(app).post('/api/events').send({
      eventId: 'evt-disabled',
      deviceId: 'device-003',
      type: 'temperature',
      timestamp: new Date().toISOString(),
      payload: { temperature: 100 },
    });
    assert.equal(res.status, 201);
    const incident = await Incident.findOne({ eventId: res.body._id }).lean();
    assert.equal(incident, null);
  });

  test('rule scoped to specific device only triggers for that device', async () => {
    await Device.create({ deviceId: 'device-A', name: 'A', location: 'lab', status: 'offline' });
    await Device.create({ deviceId: 'device-B', name: 'B', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'Device A Rule',
      enabled: true,
      conditionType: 'event_type',
      eventType: 'custom',
      deviceId: 'device-A',
    });
    // Event for device-B should not trigger
    const resB = await request(app).post('/api/events').send({
      eventId: 'evt-B',
      deviceId: 'device-B',
      type: 'custom',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(resB.status, 201);
    const incidentB = await Incident.findOne({ eventId: resB.body._id }).lean();
    assert.equal(incidentB, null);
    // Event for device-A should trigger
    const resA = await request(app).post('/api/events').send({
      eventId: 'evt-A',
      deviceId: 'device-A',
      type: 'custom',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(resA.status, 201);
    const incidentA = await Incident.findOne({ eventId: resA.body._id }).lean();
    assert.ok(incidentA);
  });

  test('incident deduplication prevents multiple active incidents for same rule/device', async () => {
    await Device.create({ deviceId: 'device-dup', name: 'Dup', location: 'lab', status: 'offline' });
    await Rule.create({
      name: 'Dup Rule',
      enabled: true,
      conditionType: 'event_type',
      eventType: 'alert',
    });
    // First event creates incident
    const first = await request(app).post('/api/events').send({
      eventId: 'evt-dup-1',
      deviceId: 'device-dup',
      type: 'alert',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(first.status, 201);
    const inc1 = await Incident.findOne({ eventId: first.body._id }).lean();
    assert.ok(inc1);
    // Second matching event should NOT create a new active incident
    const second = await request(app).post('/api/events').send({
      eventId: 'evt-dup-2',
      deviceId: 'device-dup',
      type: 'alert',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(second.status, 201);
    const activeCount = await Incident.countDocuments({ ruleId: inc1.ruleId, deviceId: 'device-dup', status: { $in: ['open', 'acknowledged'] } });
    assert.equal(activeCount, 1);
    // Resolve the first incident
    await Incident.findByIdAndUpdate(inc1._id, { status: 'resolved' });
    // Third matching event should now create a new incident
    const third = await request(app).post('/api/events').send({
      eventId: 'evt-dup-3',
      deviceId: 'device-dup',
      type: 'alert',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    assert.equal(third.status, 201);
    const activeAfter = await Incident.countDocuments({ ruleId: inc1.ruleId, deviceId: 'device-dup', status: { $in: ['open', 'acknowledged'] } });
    assert.equal(activeAfter, 1);
  });
});
