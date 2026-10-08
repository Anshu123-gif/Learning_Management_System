import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  connectMongoDB,
  isMongoConnected,
  getMongoDiagnostics,
  getMongoUri,
} from "../server/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & preflight headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Actively connect if disconnected and URI is available
  if (!isMongoConnected() && getMongoUri()) {
    try {
      await connectMongoDB();
    } catch {
      // Diagnostics will report connection details
    }
  }

  return res.status(200).json({
    status: "online",
    service: "EduPulse / CodeHub LMS Vercel API",
    mongoConnected: isMongoConnected(),
    diagnostics: getMongoDiagnostics(),
    timestamp: new Date().toISOString(),
  });
}
