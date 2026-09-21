import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { connectMongoDB } from "../server/db.js";
import { MongoCourse } from "../server/models/Course.js";
import { MongoUser } from "../server/models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

export interface CreateCourseInput {
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | "All Levels" | string;
  thumbnail?: string;
  price: number | string;
  originalPrice?: number | string;
  requirements?: string[];
  learningOutcomes?: string[];
  sections?: any[];
  language?: string;
}

/**
 * Shared service helper for creating a course in MongoDB.
 * Shared between Vercel Serverless (/api/courses.ts) and Express server (server.ts).
 */
export async function createCourseInDb(input: CreateCourseInput, authenticatedUserId: string) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  const {
    title,
    subtitle,
    description,
    category,
    level,
    thumbnail,
    price,
    originalPrice,
    requirements,
    learningOutcomes,
    sections,
    language,
  } = input || {};

  // 1. Validate required fields
  if (!title || typeof title !== "string" || !title.trim()) {
    const err: any = new Error("Course title is required.");
    err.statusCode = 400;
    throw err;
  }

  const numericPrice = Number(price);
  if (isNaN(numericPrice) || numericPrice < 0) {
    const err: any = new Error("Valid non-negative price is required.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch authoritative user from MongoDB using authenticatedUserId
  const userDoc = await MongoUser.findOne({ userId: authenticatedUserId }).lean();

  const instructorName = userDoc?.name || "Faculty Member";
  const instructorAvatar =
    userDoc?.avatar ||
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80";
  const instructorTitle = userDoc?.bio?.slice(0, 50) || "Instructor & Faculty";

  // 3. Construct course with authoritative teacher identity & pending status
  const courseId = `course_${Date.now()}`;
  const newCourse = new MongoCourse({
    courseId,
    title: title.trim(),
    subtitle: (subtitle || "").trim(),
    description: (description || "").trim(),
    instructorId: authenticatedUserId, // Guaranteed from token
    instructorName,                     // Authoritative from DB
    instructorAvatar,                   // Authoritative from DB
    instructorTitle,
    category: category || "Web Development",
    level: ["Beginner", "Intermediate", "Advanced", "All Levels"].includes(level as any)
      ? level
      : "Beginner",
    thumbnail:
      thumbnail ||
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
    price: numericPrice,
    originalPrice: originalPrice ? Number(originalPrice) : numericPrice * 2,
    status: "pending", // Newly created courses must NOT be automatically approved
    rating: 0,
    ratingsCount: 0,
    studentsEnrolled: 0,
    language: language || "English",
    requirements:
      Array.isArray(requirements) && requirements.length > 0
        ? requirements
        : ["Basic computer literacy"],
    learningOutcomes:
      Array.isArray(learningOutcomes) && learningOutcomes.length > 0
        ? learningOutcomes
        : ["Build production-ready applications"],
    sections:
      Array.isArray(sections) && sections.length > 0
        ? sections
        : [
            {
              _id: `sec_${Date.now()}_1`,
              courseId,
              title: "Section 1: Course Overview",
              order: 1,
              lectures: [],
            },
          ],
  });

  await newCourse.save();
  console.log(
    `✅ [Course Created] "${newCourse.title}" (${newCourse.courseId}) by ${instructorName} [status: ${newCourse.status}]`
  );

  return {
    success: true,
    message: "Course created successfully in MongoDB and submitted for review.",
    course: {
      ...newCourse.toObject(),
      _id: newCourse.courseId,
    },
  };
}

/**
 * Shared service helper for querying courses from MongoDB.
 * Shared between Vercel Serverless (/api/courses.ts) and Express server (server.ts).
 */
export async function getCoursesFromDb(filterOptions: {
  authHeader?: string;
  all?: boolean | string;
  myCourses?: boolean | string;
  status?: string;
}) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  // Default: Public course catalog returns only approved courses
  const query: any = { status: "approved" };

  // If an auth token is provided and caller wants to inspect their drafts/pending:
  const authHeader = filterOptions.authHeader;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded) {
        const isTeacher = decoded.role === "teacher";
        const isAdmin = decoded.role === "admin";
        const isTeacherOrAdmin = isTeacher || isAdmin;

        if (isTeacherOrAdmin) {
          const wantsAll = filterOptions.all === true || filterOptions.all === "true";
          const wantsMyCourses = filterOptions.myCourses === true || filterOptions.myCourses === "true";

          if (isAdmin) {
            // Admin can inspect specific status or remove status filter completely when asking for all
            if (filterOptions.status && typeof filterOptions.status === "string") {
              query.status = filterOptions.status;
            } else if (wantsAll) {
              delete query.status; // Admin sees all courses across all instructors and statuses
            }
          } else if (isTeacher) {
            // Teacher: When requesting all=true or myCourses=true, ALWAYS strictly constrain to their own courses
            if (wantsAll || wantsMyCourses) {
              delete query.status; // Allow teacher to see their own pending/draft/approved/rejected courses
              query.instructorId = decoded.userId; // NEVER trust client input; strictly use JWT userId
            } else if (filterOptions.status && typeof filterOptions.status === "string") {
              query.status = filterOptions.status;
              query.instructorId = decoded.userId;
            }
          }
        }
      }
    } catch {
      // Fallback gracefully to public approved catalog
    }
  }

  const rawCourses = await MongoCourse.find(query).sort({ createdAt: -1 }).lean();
  const courses = rawCourses.map((c: any) => ({
    ...c,
    _id: c.courseId || c._id,
  }));

  return {
    success: true,
    count: courses.length,
    courses,
  };
}

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. GET /api/courses
  if (req.method === "GET") {
    try {
      const authHeader = req.headers.authorization;
      const all = req.query?.all as string;
      const myCourses = req.query?.myCourses as string;
      const status = req.query?.status as string;

      const result = await getCoursesFromDb({
        authHeader,
        all,
        myCourses,
        status,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/courses] GET Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to retrieve courses.",
      });
    }
  }

  // 2. POST /api/courses
  if (req.method === "POST") {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Authentication required. Please provide a valid Bearer token.",
        });
      }

      const token = authHeader.split(" ")[1];
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired session token.",
        });
      }

      if (!decoded || !decoded.userId || !decoded.role) {
        return res.status(401).json({
          success: false,
          message: "Invalid session token payload.",
        });
      }

      if (decoded.role !== "teacher" && decoded.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Access requires one of the following roles: teacher, admin.",
        });
      }

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore parsing error, pass as-is
        }
      }

      const result = await createCourseInDb(body, decoded.userId);
      return res.status(201).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/courses] POST Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to create course in MongoDB.",
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed.`,
  });
}
