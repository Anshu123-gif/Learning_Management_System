import dns from "dns";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Ensure environment variables from .env files are loaded in all runtime environments
dotenv.config();

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

/**
 * Common MongoDB connection environment variable names in order of preference.
 */
const TARGET_ENV_NAMES = [
  "MONGODB_URI",
  "MONGO_URI",
  "MONGODB_URL",
  "DATABASE_URL",
  "MONGO_URL",
  "MONGODB_CONNECTION_STRING",
  "VITE_MONGODB_URI",
  "VITE_MONGO_URI",
  "VITE_MONGODB_URL",
  "VITE_DATABASE_URL",
];

/**
 * Resolves the MongoDB connection URI from environment variables with
 * broad support for common naming conventions, whitespace tolerance,
 * and quotation trimming.
 */
export function getMongoUri(): string | null {
  // 1. Direct standard lookup on process.env
  for (const key of TARGET_ENV_NAMES) {
    const val = process.env[key];
    if (val && typeof val === "string" && val.trim().length > 0) {
      const sanitized = val.trim().replace(/^["']|["']$/g, "").trim();
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  }

  // 2. Case-insensitive and whitespace-tolerant key lookup across process.env
  const envEntries = Object.entries(process.env);
  for (const [rawKey, rawVal] of envEntries) {
    const cleanKey = rawKey.trim().toUpperCase();
    if (TARGET_ENV_NAMES.includes(cleanKey)) {
      if (rawVal && typeof rawVal === "string" && rawVal.trim().length > 0) {
        const sanitized = rawVal.trim().replace(/^["']|["']$/g, "").trim();
        if (sanitized.length > 0) {
          return sanitized;
        }
      }
    }
  }

  // 3. Fallback heuristic: check if any env var value begins with mongodb:// or mongodb+srv://
  for (const [, rawVal] of envEntries) {
    if (typeof rawVal === "string") {
      const sanitized = rawVal.trim().replace(/^["']|["']$/g, "").trim();
      if (sanitized.startsWith("mongodb://") || sanitized.startsWith("mongodb+srv://")) {
        return sanitized;
      }
    }
  }

  return null;
}

/**
 * Returns the detected environment variable key name (safe for logging, no secrets).
 */
export function getDetectedMongoKey(): string | null {
  for (const key of TARGET_ENV_NAMES) {
    const val = process.env[key];
    if (val && typeof val === "string" && val.trim().length > 0) {
      return key;
    }
  }

  const envEntries = Object.entries(process.env);
  for (const [rawKey, rawVal] of envEntries) {
    const cleanKey = rawKey.trim().toUpperCase();
    if (TARGET_ENV_NAMES.includes(cleanKey)) {
      if (rawVal && typeof rawVal === "string" && rawVal.trim().length > 0) {
        return rawKey.trim();
      }
    }
  }

  for (const [rawKey, rawVal] of envEntries) {
    if (typeof rawVal === "string") {
      const sanitized = rawVal.trim().replace(/^["']|["']$/g, "").trim();
      if (sanitized.startsWith("mongodb://") || sanitized.startsWith("mongodb+srv://")) {
        return rawKey.trim();
      }
    }
  }

  return null;
}

/**
 * Resolves a mongodb+srv:// connection URI to a direct replica set mongodb:// URI.
 * In cloud container environments, OpenSSL 3 and Node.js often trigger TLS alert 80
 * during the initial SRV handshake with MongoDB Atlas free clusters. Converting
 * to the explicit multi-host replica set URI with ssl=true avoids this TLS issue.
 */
async function normalizeMongoUri(rawUri: string): Promise<string> {
  if (!rawUri.startsWith("mongodb+srv://")) {
    return rawUri;
  }

  const match = rawUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/);
  if (!match) {
    return rawUri;
  }

  const [, user, pass, host, dbName, queryStr] = match;

  try {
    const [srvRecords, txtRecords] = await Promise.all([
      dns.promises.resolveSrv(`_mongodb._tcp.${host}`),
      dns.promises.resolveTxt(host).catch(() => []),
    ]);

    if (!srvRecords || srvRecords.length === 0) {
      return rawUri;
    }

    const hostsStr = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
    let replicaSet = "";
    let authSource = "admin";

    if (txtRecords.length > 0) {
      const txtJoined = txtRecords.flat().join("&");
      const params = new URLSearchParams(txtJoined);
      if (params.get("replicaSet")) replicaSet = params.get("replicaSet") || "";
      if (params.get("authSource")) authSource = params.get("authSource") || "admin";
    }

    const queryParams = new URLSearchParams(queryStr || "");
    queryParams.set("ssl", "true");
    if (authSource && !queryParams.has("authSource")) queryParams.set("authSource", authSource);
    if (replicaSet && !queryParams.has("replicaSet")) queryParams.set("replicaSet", replicaSet);

    return `mongodb://${user}:${pass}@${hostsStr}/${dbName || ""}?${queryParams.toString()}`;
  } catch (err: any) {
    console.warn(`[MongoDB] SRV auto-resolution warning (${err?.message || err}). Proceeding with raw URI.`);
    return rawUri;
  }
}

export async function connectMongoDB(retries = 2, delayMs = 1000): Promise<boolean> {
  const rawUri = getMongoUri();
  if (!rawUri || !rawUri.trim()) {
    console.warn("⚠️ MongoDB connection notice: No connection URI found in environment variables (checked MONGODB_URI, MONGO_URI, MONGODB_URL, DATABASE_URL).");
    lastConnectionError = "No connection URI found in environment variables";
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

  const uri = await normalizeMongoUri(rawUri);

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

      console.warn(
        `⚠️ MongoDB Atlas connection notice (attempt ${attempt}/${retries}, duration: ${lastConnectDurationMs}ms, readyState: ${mongoose.connection.readyState}):`,
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

  const detectedUri = getMongoUri();
  const detectedKey = getDetectedMongoKey();

  return {
    uriPresent: Boolean(detectedUri && detectedUri.length > 0),
    detectedKey: detectedKey || null,
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

