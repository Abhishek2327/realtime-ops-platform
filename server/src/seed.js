import { connectDB } from './config/db.js';
import Device from './models/Device.js';
import Rule from './models/Rule.js';

const seed = async () => {
  await connectDB();

  // Clear existing demo data (optional)
  await Device.deleteMany({});
  await Rule.deleteMany({});

  const devices = [
    { deviceId: 'dev-001', name: 'Temperature Sensor A', location: 'Warehouse 1', status: 'online' },
    { deviceId: 'dev-002', name: 'Pressure Sensor B', location: 'Warehouse 2', status: 'offline' },
    { deviceId: 'dev-003', name: 'Humidity Sensor C', location: 'Warehouse 3', status: 'online' },
  ];

  await Device.insertMany(devices);

  const rules = [
    {
      name: 'High Temperature Alert',
      enabled: true,
      conditionType: 'temperature_threshold',
      deviceId: 'dev-001',
      threshold: 30,
    },
    {
      name: 'Pressure Event Trigger',
      enabled: true,
      conditionType: 'event_type',
      eventType: 'pressure_spike',
    },
    {
      name: 'Device Offline Timeout',
      enabled: true,
      conditionType: 'device_offline',
      deviceId: 'dev-002',
      offlineAfterSeconds: 300,
    },
  ];

  await Rule.insertMany(rules);

  console.log('Seed data inserted successfully');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
