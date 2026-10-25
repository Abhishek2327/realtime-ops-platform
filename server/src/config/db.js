import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Resolve .env file relative to this config file's directory (server root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '..', '.env');
// Load environment variables only from the resolved .env (won't overwrite existing env)
dotenv.config({ path: envPath });

export const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    // Use in‑memory MongoDB for isolated tests
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    // store globally so we can shut it down later
    global.__TEST_MONGOD__ = mongod;
    const uri = mongod.getUri();
    try {
      const conn = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('In‑memory MongoDB started for tests');
      return conn;
    } catch (e) {
      console.error('Failed to start in‑memory MongoDB for tests:', e);
      // Fail fast – do not fall back to production URI
      throw e;
    }
  }
// Production connection – never used in test mode
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Configuration error: MONGODB_URI is not set in .env');
  throw new Error('Missing MONGODB_URI');
}
try {
  const conn = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
} catch (error) {
  console.error('MongoDB connection error:', error);
  throw error;
}
};

// Helper to stop the in‑memory server after tests
export const closeTestDB = async () => {
  if (global.__TEST_MONGOD__) {
    await global.__TEST_MONGOD__.stop();
    delete global.__TEST_MONGOD__;
    console.log('In‑memory MongoDB stopped');
  }
};
