// server/src/simulator/cli.js
/**
 * Simple CLI simulator for device telemetry.
 *
 * Commands:
 *   node src/simulator/cli.js start --device <id> [--interval <ms>] [--abnormal <count>]
 *   node src/simulator/cli.js disconnect
 *   node src/simulator/cli.js reconnect
 *   node src/simulator/cli.js queue
 *
 * The simulator persists its state (including an offline queue) to
 * `simulator_state.json` in the same directory so that disconnect/reconnect
 * can be performed across separate process invocations.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch'; // using node-fetch for compatibility with older Node versions

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = path.resolve(__dirname, 'simulator_state.json');

// Default configuration values
const DEFAULT_INTERVAL = 2000; // ms
const DEFAULT_ABNORMAL_COUNT = 0;

// Helper to load persisted state (or create a fresh one)
async function loadState() {
  try {
    const data = await fs.readFile(STATE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // If file does not exist, start with empty state
    return {
      deviceId: null,
      interval: DEFAULT_INTERVAL,
      abnormalCount: DEFAULT_ABNORMAL_COUNT,
      queue: [],
      stopped: true,
    };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

// Generate a telemetry event payload
function generateEvent({ deviceId, abnormalCount, eventIdx }) {
  const isAbnormal = abnormalCount > 0 && eventIdx % (abnormalCount + 5) === 0; // simple pattern
  const temperature = isAbnormal ? 120 + Math.floor(Math.random() * 10) : 70 + Math.floor(Math.random() * 10);
  return {
    eventId: `evt-${randomUUID()}`,
    deviceId,
    type: 'temperature',
    timestamp: new Date().toISOString(),
    payload: { temperature },
  };
}

// POST event to backend, return true if accepted (201) or duplicate (409)
async function postEvent(event) {
  try {
    const resp = await fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (resp.status === 201 || resp.status === 409) {
      return true;
    }
    // For 400/404 we consider the event invalid – do not retry
    if (resp.status === 400 || resp.status === 404) {
      console.warn(`Event ${event.eventId} rejected (status ${resp.status}); dropping.`);
      return false;
    }
    // Other statuses are treated as transient failures
    console.warn(`Transient error ${resp.status} for event ${event.eventId}`);
    return false;
  } catch (err) {
    console.error('Network error while posting event:', err.message);
    return false;
  }
}

async function flushQueue(state) {
  while (state.queue.length > 0) {
    const event = state.queue[0];
    const ok = await postEvent(event);
    if (ok) {
      // Remove only when server responded 201 or 409
      state.queue.shift();
      await saveState(state);
    } else {
      // Stop flushing on first failure to avoid busy loop
      break;
    }
  }
}

async function startSimulator(args) {
  const deviceId = args.device;
  if (!deviceId) {
    console.error('Device ID is required (--device <id>)');
    process.exit(1);
  }
  const interval = args.interval ? parseInt(args.interval, 10) : DEFAULT_INTERVAL;
  const abnormalCount = args.abnormal ? parseInt(args.abnormal, 10) : DEFAULT_ABNORMAL_COUNT;

  const state = await loadState();
  state.deviceId = deviceId;
  state.interval = interval;
  state.abnormalCount = abnormalCount;
  state.stopped = false;
  await saveState(state);

  console.log(`Simulator started for device ${deviceId}`);

  let eventCounter = 0;
  const timer = setInterval(async () => {
    if (state.stopped) return; // guard if disconnect called while timer still alive
    const event = generateEvent({ deviceId, abnormalCount, eventIdx: eventCounter++ });
    const ok = await postEvent(event);
    if (!ok) {
      // Queue for later retry if not a permanent reject
      state.queue.push(event);
      await saveState(state);
    }
  }, interval);

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdown = async () => {
    clearInterval(timer);
    state.stopped = true;
    await saveState(state);
    console.log('Simulator stopped');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function disconnectSimulator() {
  const state = await loadState();
  state.stopped = true;
  await saveState(state);
  console.log('Simulator disconnected – events will be queued.');
}

async function reconnectSimulator() {
  const state = await loadState();
  if (!state.deviceId) {
    console.error('Simulator has never been started. Use start first.');
    process.exit(1);
  }
  state.stopped = false;
  await saveState(state);
  console.log('Simulator reconnecting – flushing queued events...');
  await flushQueue(state);
}

async function showQueue() {
  const state = await loadState();
  console.log(`Queued events: ${state.queue.length}`);
  if (state.queue.length > 0) {
    console.log(state.queue.map((e) => e.eventId).join('\n'));
  }
}

// Simple argument parser (no external deps)
function parseArgs(argv) {
  const cmd = argv[2];
  const args = {};
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].substring(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return { cmd, args };
}

(async () => {
  const { cmd, args } = parseArgs(process.argv);
  switch (cmd) {
    case 'start':
      await startSimulator(args);
      break;
    case 'disconnect':
      await disconnectSimulator();
      break;
    case 'reconnect':
      await reconnectSimulator();
      break;
    case 'queue':
      await showQueue();
      break;
    default:
      console.log(`Usage:\n  node src/simulator/cli.js start --device <id> [--interval <ms>] [--abnormal <count>]\n  node src/simulator/cli.js disconnect\n  node src/simulator/cli.js reconnect\n  node src/simulator/cli.js queue`);
  }
})();
