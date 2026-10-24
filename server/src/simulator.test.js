// server/src/simulator.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import app from '../src/index.js';
import { connectDB } from '../src/config/db.js';
import mongoose from 'mongoose';

let server;
let port;
const projectRoot = path.resolve(__dirname, '..');
const statePath = path.join(projectRoot, 'src', 'simulator', 'simulator_state.json');

before(async () => {
  await connectDB();
  server = app.listen(0);
  port = server.address().port;
  try { await fs.unlink(statePath); } catch (_) {}
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  try { await fs.unlink(statePath); } catch (_) {}
});

test('offline queue persists and flushes on reconnect', async () => {
  // start simulator (background)
  spawnSync('node', ['src/simulator/cli.js', 'start', '--device', 'dev-queue', '--interval', '50'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
    timeout: 1000,
  });
  // let it generate some events
  await new Promise(r => setTimeout(r, 200));
  // disconnect to queue events
  execSync('node src/simulator/cli.js disconnect', { cwd: projectRoot, env: { ...process.env, PORT: String(port) } });
  await new Promise(r => setTimeout(r, 100));
  let state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
  assert.ok(state.queue.length > 0, 'Queue should have events after disconnect');
  // reconnect to flush queue
  execSync('node src/simulator/cli.js reconnect', { cwd: projectRoot, env: { ...process.env, PORT: String(port) } });
  await new Promise(r => setTimeout(r, 300));
  state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
  assert.equal(state.queue.length, 0, 'Queue should be empty after reconnect');
});
