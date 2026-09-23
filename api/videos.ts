import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import {
  generateCloudinaryUploadSignature,
  generateCloudinaryPlayUrl,
} from "../server/videoService.js";
import { connectMongoDB } from "../server/db.js";
import { MongoEnrollment } from "../server/models/Enrollment.js";
import { MongoCourse } from "../server/models/Course.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

function verifyUser(req: VercelRequest): { userId: string; email: string; role: "student" | "teacher" | "admin" } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: any = new Error("Authentication required. Please provide a valid Bearer token.");
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId || !decoded.role) {
      const err: any = new Error("Invalid session token payload.");
      err.statusCode = 401;
      throw err;
    }
    return decoded;
  } catch {
    const err: any = new Error("Invalid or expired session token.");
    err.statusCode = 401;
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Determine subpath:
  // e.g. /api/videos/upload-signature or /api/videos/play-url
  // rewrites: /api/videos/:path* -> /api/videos?path=:path*
  let subPath = "";
  if (req.query?.path) {
    if (Array.isArray(req.query.path)) {
      subPath = req.query.path.join("/");
    } else {
      subPath = req.query.path;
    }
  } else if (req.url) {
    const cleanUrl = req.url.split("?")[0];
    const match = cleanUrl.match(/\/api\/videos\/(.+)/);
    if (match && match[1]) {
      subPath = match[1];
    }
  }

  // 1. POST /api/videos/upload-signature: Cloudinary upload signature for direct browser upload
  if (
    req.method === "POST" &&
    (subPath === "upload-signature" ||
      subPath.includes("upload-signature") ||
      subPath === "upload-url" ||
      subPath.includes("upload-url"))
  ) {
    try {
      const user = verifyUser(req);

      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Only teachers and admins can upload course videos.",
        });
      }

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }

      const { courseId, lectureId } = body || {};

      const result = await generateCloudinaryUploadSignature({
        courseId,
        lectureId,
        userId: user.userId,
        userRole: user.role,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/videos/upload-signature] Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to generate Cloudinary upload signature.",
      });
    }
  }

  // 2. GET /api/videos/play-url: Authorized secure playback URL for Cloudinary stream
  if (req.method === "GET" && (subPath === "play-url" || subPath.includes("play-url"))) {
    try {
      const user = verifyUser(req);

      const courseId = (req.query?.courseId as string) || "";
      const lectureId = (req.query?.lectureId as string) || "";

      const result = await generateCloudinaryPlayUrl({
        courseId,
        lectureId,
        userId: user.userId,
        userRole: user.role,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/videos/play-url] Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to generate video stream URL.",
      });
    }
  }

  // 3. POST /api/videos/progress: Save watch position and completion for authenticated student
  if (req.method === "POST" && (subPath === "progress" || subPath.includes("progress"))) {
    try {
      const user = verifyUser(req);
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }
      const { courseId, lectureId, positionSeconds, completed } = body || {};
      if (!courseId || !lectureId) {
        return res.status(400).json({ success: false, message: "courseId and lectureId are required." });
      }

      await connectMongoDB();
      const enrollment = await MongoEnrollment.findOne({ courseId, studentId: user.userId });
      if (enrollment) {
        enrollment.lastWatchedLectureId = lectureId;
        const pos = Math.max(0, Math.round(Number(positionSeconds) || 0));
        enrollment.lastWatchedPositionSeconds = pos;
        if (!enrollment.lecturePositions) {
          enrollment.lecturePositions = new Map() as any;
        }
        (enrollment as any).set(`lecturePositions.${lectureId}`, pos);

        if (completed && !enrollment.completedLectures.includes(lectureId)) {
          enrollment.completedLectures.push(lectureId);
          try {
            const course = await MongoCourse.findOne({ courseId }).lean();
            if (course && Array.isArray((course as any).sections)) {
              const totalLectures = (course as any).sections.flatMap((s: any) => s.lectures || []).length || 1;
              enrollment.progressPercent = Math.min(100, Math.round((enrollment.completedLectures.length / totalLectures) * 100));
            }
          } catch {}
        }
        await enrollment.save();
        return res.status(200).json({
          success: true,
          lastWatchedLectureId: enrollment.lastWatchedLectureId,
          lastWatchedPositionSeconds: enrollment.lastWatchedPositionSeconds,
          completedLectures: enrollment.completedLectures,
          progressPercent: enrollment.progressPercent,
        });
      }

      return res.status(200).json({ success: true, savedLocally: true });
    } catch (err: any) {
      console.error("[Vercel /api/videos/progress] Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to persist video progress.",
      });
    }
  }

  return res.status(404).json({
    success: false,
    message: `Unknown video endpoint: /api/videos/${subPath}`,
  });
}
