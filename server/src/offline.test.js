// Automated tests for Phase 3.2: Device Offline Detection
// Run with: npm test (node --test)

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Device from './models/Device.js';
import Rule from './models/Rule.js';
import Incident from './models/Incident.js';
import { runOfflineChecks } from './services/offlineMonitor.js';
import request from 'supertest';
import app from './index.js';

before(async () => {
  await connectDB();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    Device.deleteMany({}),
    Rule.deleteMany({}),
    Incident.deleteMany({}),
  ]);
});

describe('Device offline detection', () => {
  test('creates incident when device is offline beyond threshold', async () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    await Device.create({
      deviceId: 'dev-001',
      name: 'Device 1',
      location: 'lab',
      status: 'online',
      lastSeenAt: twoMinutesAgo,
    });
    await Rule.create({
      name: 'Offline Rule',
      enabled: true,
      conditionType: 'device_offline',
      offlineAfterSeconds: 60,
    });
    await runOfflineChecks();
    const device = await Device.findOne({ deviceId: 'dev-001' }).lean();
    assert.equal(device.status, 'offline');
    const incident = await Incident.findOne({ deviceId: 'dev-001' }).lean();
    assert.ok(incident);
    assert.equal(incident.status, 'open');
  });

  test('does not create duplicate active incidents for same rule/device', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 60 * 1000);
    await Device.create({
      deviceId: 'dev-dup',
      name: 'Dup Device',
      location: 'lab',
      status: 'online',
      lastSeenAt: past,
    });
    await Rule.create({
      name: 'Dup Offline Rule',
      enabled: true,
      conditionType: 'device_offline',
      offlineAfterSeconds: 30,
    });
    await runOfflineChecks();
    const inc1 = await Incident.findOne({ deviceId: 'dev-dup' }).lean();
    assert.ok(inc1);
    await runOfflineChecks();
    const activeCount = await Incident.countDocuments({
      deviceId: 'dev-dup',
      status: { $in: ['open', 'acknowledged'] },
    });
    assert.equal(activeCount, 1);
  });

  test('status becomes online when device sends a newer event after being marked offline', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 60 * 1000);
    await Device.create({
      deviceId: 'dev-reconnect',
      name: 'Reconnect Device',
      location: 'lab',
      status: 'online',
      lastSeenAt: past,
    });
    await Rule.create({
      name: 'Reconnect Rule',
      enabled: true,
      conditionType: 'device_offline',
      offlineAfterSeconds: 60,
    });
    await runOfflineChecks();
    const offlineDevice = await Device.findOne({ deviceId: 'dev-reconnect' }).lean();
    assert.equal(offlineDevice.status, 'offline');
    const newer = new Date();
    const res = await request(app)
      .post('/api/events')
      .send({
        eventId: 'evt-reconnect',
        deviceId: 'dev-reconnect',
        type: 'heartbeat',
        timestamp: newer.toISOString(),
        payload: {},
      });
    assert.equal(res.status, 201);
    const afterDevice = await Device.findOne({ deviceId: 'dev-reconnect' }).lean();
    assert.equal(afterDevice.status, 'online');
    assert.ok(new Date(afterDevice.lastSeenAt).getTime() >= newer.getTime());
  });
});
