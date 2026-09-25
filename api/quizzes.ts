import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import {
  createQuizInDb,
  updateQuizInDb,
  getQuizByIdFromDb,
  getQuizzesByCourseFromDb,
  deleteQuizFromDb,
  submitQuizAttemptInDb,
  getQuizAttemptForStudent,
} from "../server/quizService.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

function parseAuthToken(req: VercelRequest): { userId: string; email: string; role: "student" | "teacher" | "admin" } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId || !decoded.role) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function requireAuthUser(req: VercelRequest): { userId: string; email: string; role: "student" | "teacher" | "admin" } {
  const user = parseAuthToken(req);
  if (!user) {
    const err: any = new Error("Authentication required. Please provide a valid Bearer token.");
    err.statusCode = 401;
    throw err;
  }
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Parse path or query params
  // Examples:
  // /api/quizzes -> base
  // /api/quizzes/:quizId
  // /api/quizzes/course/:courseId
  let subPath = "";
  if (req.query?.path) {
    if (Array.isArray(req.query.path)) {
      subPath = req.query.path.join("/");
    } else {
      subPath = req.query.path;
    }
  } else if (req.url) {
    const cleanUrl = req.url.split("?")[0];
    const match = cleanUrl.match(/\/api\/quizzes\/(.+)/);
    if (match && match[1]) {
      subPath = match[1];
    }
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  // 1. POST /api/quizzes/:quizId/submit: Submit student quiz attempt
  if (req.method === "POST" && (subPath.endsWith("/submit") || subPath.includes("submit"))) {
    try {
      const user = requireAuthUser(req);
      let quizId = subPath.replace(/\/submit\/?$/, "");
      if (quizId.startsWith("/")) quizId = quizId.slice(1);
      if (!quizId) {
        quizId = (req.query?.quizId as string) || (req.query?.id as string) || "";
      }
      const { answers } = body || {};
      const result = await submitQuizAttemptInDb(quizId, answers, user.userId, user.role);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/quizzes/submit] POST Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to submit quiz attempt.",
      });
    }
  }

  // 2. POST /api/quizzes: Create a quiz
  if (req.method === "POST") {
    try {
      const user = requireAuthUser(req);
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Only teachers and administrators can create quizzes.",
        });
      }

      const result = await createQuizInDb(body, user.userId, user.role);
      return res.status(201).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/quizzes] POST Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to create quiz.",
      });
    }
  }

  // 2. PUT /api/quizzes/:quizId: Update a quiz
  if (req.method === "PUT") {
    try {
      const user = requireAuthUser(req);
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Only teachers and administrators can edit quizzes.",
        });
      }

      let quizId = (req.query?.quizId as string) || (req.query?.id as string) || "";
      if (!quizId && subPath) {
        quizId = subPath.split("/")[0];
      }
      if (!quizId) {
        quizId = body?.quizId || body?.id || "";
      }

      if (!quizId) {
        return res.status(400).json({
          success: false,
          message: "quizId is required to update a quiz.",
        });
      }

      const result = await updateQuizInDb(quizId, body, user.userId, user.role);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/quizzes] PUT Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to update quiz.",
      });
    }
  }

  // 3. GET /api/quizzes or /api/quizzes/:quizId or /api/quizzes/course/:courseId
  if (req.method === "GET") {
    try {
      const user = parseAuthToken(req);

      // Check course query param or subpath
      const courseIdQuery = (req.query?.courseId as string) || "";
      if (courseIdQuery) {
        const result = await getQuizzesByCourseFromDb(courseIdQuery, user?.userId, user?.role);
        return res.status(200).json(result);
      }

      if (subPath.startsWith("course/")) {
        const targetCourseId = subPath.replace("course/", "");
        const result = await getQuizzesByCourseFromDb(targetCourseId, user?.userId, user?.role);
        return res.status(200).json(result);
      }

      // Check student attempt
      if (subPath.includes("attempt")) {
        const authUser = requireAuthUser(req);
        let quizId = subPath.replace(/\/attempt\/?$/, "");
        if (quizId.startsWith("/")) quizId = quizId.slice(1);
        if (!quizId) {
          quizId = (req.query?.quizId as string) || (req.query?.id as string) || "";
        }
        const attempt = await getQuizAttemptForStudent(quizId, authUser.userId);
        return res.status(200).json({ success: true, attempt });
      }

      // Quiz by ID
      let quizId = (req.query?.quizId as string) || (req.query?.id as string) || "";
      if (!quizId && subPath) {
        quizId = subPath.split("/")[0];
      }

      if (quizId) {
        const result = await getQuizByIdFromDb(quizId, user?.userId, user?.role);
        return res.status(200).json(result);
      }

      return res.status(400).json({
        success: false,
        message: "Please provide a valid quizId or courseId.",
      });
    } catch (err: any) {
      console.error("[Vercel /api/quizzes] GET Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to retrieve quiz.",
      });
    }
  }

  // 4. DELETE /api/quizzes/:quizId: Delete a quiz
  if (req.method === "DELETE") {
    try {
      const user = requireAuthUser(req);
      if (user.role !== "teacher" && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Only teachers and administrators can delete quizzes.",
        });
      }

      let quizId = (req.query?.quizId as string) || (req.query?.id as string) || "";
      if (!quizId && subPath) {
        quizId = subPath.split("/")[0];
      }
      if (!quizId) {
        quizId = body?.quizId || body?.id || "";
      }

      if (!quizId) {
        return res.status(400).json({
          success: false,
          message: "quizId is required to delete a quiz.",
        });
      }

      const result = await deleteQuizFromDb(quizId, user.userId, user.role);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/quizzes] DELETE Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to delete quiz.",
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed.`,
  });
}
