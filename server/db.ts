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

const DEFAULT_MONGODB_URI = "mongodb+srv://san414706_db_user:sYHC0uMqvY0WQOTy@cluster0.w2yjysh.mongodb.net/sheryians_lms?retryWrites=true&w=majority&appName=Cluster0";

// Diagnostic metrics
let lastConnectDurationMs = 0;
let lastConnectionError: string | null = null;
let lastConnectedTimestamp: string | null = null;

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
  family: 4, // Force IPv4 to prevent IPv6 TLS handshake alert 80 failures with Atlas
  retryWrites: true,
  w: "majority",
  autoIndex: false,
};

export async function connectMongoDB(retries = 2, delayMs = 1500): Promise<boolean> {
  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  if (!uri) {
    console.error("❌ MongoDB connection failed: No connection URI provided.");
    lastConnectionError = "No connection URI provided";
    return false;
  }

  // 1. If connection is already established and healthy (readyState === 1: connected)
  if (mongoose.connection.readyState === 1) {
    if (!cached.conn) {
      cached.conn = mongoose;
    }
    return true;
  }

  // 2. If already in the process of connecting (readyState === 2: connecting), await existing promise
  if (mongoose.connection.readyState === 2 && cached.promise) {
    try {
      cached.conn = await cached.promise;
      return true;
    } catch {
      // Fall through to retry logic
    }
  }

  // 3. Clear stale promise if disconnected (readyState === 0)
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  // 4. Retry loop with promise reuse, IPv4 enforcement, and exponential backoff
  for (let attempt = 1; attempt <= retries; attempt++) {
    const startTime = Date.now();
    try {
      if (!cached.promise) {
        cached.promise = mongoose.connect(uri, MONGO_OPTIONS);
      }
      cached.conn = await cached.promise;
      lastConnectDurationMs = Date.now() - startTime;
      lastConnectedTimestamp = new Date().toISOString();
      lastConnectionError = null;
      console.log(`✅ Successfully connected to MongoDB Atlas in ${lastConnectDurationMs}ms!`);
      return true;
    } catch (error: any) {
      cached.promise = null;
      cached.conn = null;
      lastConnectDurationMs = Date.now() - startTime;

      const sanitizedMsg = error?.message
        ? String(error.message).replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")
        : "Unknown connection error";
      lastConnectionError = sanitizedMsg;

      console.error(
        `❌ MongoDB Atlas connection error (attempt ${attempt}/${retries}, duration: ${lastConnectDurationMs}ms, readyState: ${mongoose.connection.readyState}):`,
        sanitizedMsg
      );

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  return false;
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getMongoDiagnostics() {
  const stateNames: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized",
  };

  return {
    uriPresent: Boolean(process.env.MONGODB_URI || DEFAULT_MONGODB_URI),
    readyState: mongoose.connection.readyState,
    readyStateDescription: stateNames[mongoose.connection.readyState] || "unknown",
    cachedConnExists: Boolean(cached?.conn),
    cachedPromiseExists: Boolean(cached?.promise),
    lastConnectDurationMs,
    lastConnectedTimestamp,
    lastConnectionError,
    activeHost: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null,
  };
}

