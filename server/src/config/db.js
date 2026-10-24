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
  // Use in-memory MongoDB for isolated tests
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  try {
    const conn = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('In-memory MongoDB started for tests');
    return conn;
  } catch (e) {
    console.error('Failed to start in-memory MongoDB for tests:', e);
    return null;
  }
}
// Existing production/standard connection logic
const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Configuration error: MONGODB_URI is not set in .env');
    return null; // Caller will handle missing DB
  }
  try {
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return null; // don't exit, allow server to start without DB
  }
};
