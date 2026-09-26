import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = globalThis.mongooseCache || { conn: null, promise: null };

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

let lastPingTime = 0;
const PING_INTERVAL_MS = 10000;

const DEFAULT_MONGODB_URI = "mongodb+srv://san414706_db_user:sYHC0uMqvY0WQOTy@cluster0.w2yjysh.mongodb.net/sheryians_lms?retryWrites=true&w=majority&appName=Cluster0";

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 4000,
  socketTimeoutMS: 8000,
  maxIdleTimeMS: 10000,
  retryWrites: true,
  w: "majority",
};

export async function connectMongoDB(retries = 2, delayMs = 1000): Promise<boolean> {
  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  if (!uri) {
    console.error("❌ MongoDB connection failed: No connection URI provided.");
    return false;
  }

  // 1. If connection is already established and healthy
  if (mongoose.connection.readyState === 1) {
    if (!cached.conn) {
      cached.conn = mongoose;
    }

    // Run lightweight ping only if connection has been idle for more than PING_INTERVAL_MS
    if (Date.now() - lastPingTime > PING_INTERVAL_MS && mongoose.connection.db) {
      try {
        await mongoose.connection.db.admin().ping();
        lastPingTime = Date.now();
        return true;
      } catch (pingError: any) {
        console.warn("⚠️ Cached MongoDB connection ping failed, discarding stale connection:", pingError?.message || pingError);
        try {
          await mongoose.disconnect();
        } catch {
          // ignore disconnect error
        }
        cached.conn = null;
        cached.promise = null;
      }
    } else {
      return true;
    }
  }

  // 2. If in stale / disconnected state (not connecting and not connected), clear stale references
  if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    cached.conn = null;
    cached.promise = null;
  }

  // 3. Connect with reduced retry loop (1-2 retries) and connection promise reuse
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(uri, MONGO_OPTIONS);
      }
      cached.conn = await cached.promise;
      lastPingTime = Date.now();
      console.log("✅ Successfully connected to MongoDB Atlas!");
      return true;
    } catch (error: any) {
      cached.promise = null;
      cached.conn = null;
      try {
        await mongoose.disconnect();
      } catch {
        // ignore disconnect error
      }

      const sanitizedMsg = error?.message
        ? String(error.message).replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")
        : "Unknown connection error";
      console.error(`❌ MongoDB Atlas connection error (attempt ${attempt}/${retries}):`, sanitizedMsg);

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return false;
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

