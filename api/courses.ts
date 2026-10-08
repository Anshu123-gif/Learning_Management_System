import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { connectMongoDB } from "../server/db.js";
import { MongoCourse } from "../server/models/Course.js";
import { MongoQuiz } from "../server/models/Quiz.js";
import { MongoUser } from "../server/models/User.js";
import { MongoEnrollment } from "../server/models/Enrollment.js";
import { MongoPayment } from "../server/models/Payment.js";
import {
  updateCourseCurriculumInDb,
  deleteSectionFromDb,
  deleteLectureFromDb,
} from "../server/curriculumService.js";
import { uploadCourseThumbnail, deleteCourseThumbnail } from "../server/thumbnailService.js";
import {
  uploadLectureMaterial,
  deleteLectureMaterial,
  getAuthorizedMaterialAccess,
  getLectureMaterials,
} from "../server/materialService.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

export interface CreateCourseInput {
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | "All Levels" | string;
  thumbnail?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
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
    thumbnailUrl,
    thumbnailPublicId,
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

  // Sanitize thumbnail URL: Ensure raw base64/binary is NEVER persisted directly to MongoDB
  let sanitizedThumbnail = (thumbnailUrl || thumbnail || "").trim();
  if (sanitizedThumbnail.startsWith("data:")) {
    // If base64 URI was accidentally passed, fallback to default placeholder
    sanitizedThumbnail = "";
  }
  if (!sanitizedThumbnail) {
    sanitizedThumbnail = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80";
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
    thumbnail: sanitizedThumbnail,
    thumbnailUrl: sanitizedThumbnail,
    thumbnailPublicId: thumbnailPublicId?.trim() || "",
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
 * Shared service helper for updating course status (approval/rejection) in MongoDB.
 * Enforces admin authority, exact courseId targeting, and validates allowed status values.
 */
export async function updateCourseStatusInDb(
  courseId: string,
  newStatus: "approved" | "rejected",
  rejectionReason?: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId || typeof courseId !== "string") {
    const err: any = new Error("Course ID is required.");
    err.statusCode = 400;
    throw err;
  }

  if (newStatus !== "approved" && newStatus !== "rejected") {
    const err: any = new Error("Invalid status. Allowed values are 'approved' or 'rejected'.");
    err.statusCode = 400;
    throw err;
  }

  const updateFields: any = {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (newStatus === "rejected") {
    updateFields.rejectionReason = rejectionReason || "Course content requires revisions.";
  } else {
    updateFields.rejectionReason = "";
  }

  // Safe lookup logic: First search by custom courseId field.
  // Never use $or with _id because custom course IDs (e.g. course_1790079597513)
  // trigger Mongoose CastError when cast to ObjectId.
  let course = await MongoCourse.findOne({ courseId: courseId });

  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // Update exact document fields safely
  course.status = newStatus;
  course.rejectionReason = updateFields.rejectionReason;
  course.updatedAt = updateFields.updatedAt;

  await course.save();

  console.log(`✅ [Course Status Updated] "${course.title}" (${course.courseId}) -> ${newStatus}`);

  const courseObj: any = course.toObject();

  return {
    success: true,
    message: `Course status successfully updated to "${newStatus}".`,
    course: {
      ...courseObj,
      _id: courseObj.courseId || courseObj._id,
    },
  };
}

/**
 * Shared service helper for safely deleting a course from MongoDB.
 * Enforces ownership: only instructor owner or admin can delete.
 * Enforces safety: blocks deletion if students are enrolled.
 * Cleans up associated quizzes, quiz attempts, and Cloudinary thumbnail.
 */
export async function deleteCourseFromDb(
  courseId: string,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId) {
    const err: any = new Error("Course ID is required.");
    err.statusCode = 400;
    throw err;
  }

  // Lookup course by courseId or ObjectId
  let course = await MongoCourse.findOne({ courseId: courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: Only course instructor owner or admin
  const isTeacherOwner =
    authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
  const isAdmin = authenticatedUserRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You are not authorized to delete this course.");
    err.statusCode = 403;
    throw err;
  }

  const lookupCourseId = course.courseId || courseId;

  // SAFETY CHECKS:
  // Inspect whether the course has active enrollments or completed payments.
  // If so, block deletion to prevent orphaned records.
  const enrollmentCount = await MongoEnrollment.countDocuments({
    $or: [{ courseId: lookupCourseId }, { courseId: courseId }, { courseId: String(course._id) }],
  });

  if (enrollmentCount > 0 || (course.studentsEnrolled && course.studentsEnrolled > 0)) {
    const err: any = new Error(
      "This course cannot be permanently deleted because students are already enrolled."
    );
    err.statusCode = 400;
    throw err;
  }

  const paymentCount = await MongoPayment.countDocuments({
    $or: [{ courseId: lookupCourseId }, { courseId: courseId }, { courseId: String(course._id) }],
    status: "captured",
  });

  if (paymentCount > 0) {
    const err: any = new Error(
      "This course cannot be permanently deleted because students are already enrolled."
    );
    err.statusCode = 400;
    throw err;
  }

  // Clean up associated quizzes from MongoQuiz
  try {
    await MongoQuiz.deleteMany({
      $or: [{ courseId: lookupCourseId }, { courseId: courseId }],
    });
  } catch (qErr) {
    console.warn("Could not delete associated quizzes:", qErr);
  }

  // Clean up Cloudinary thumbnail if exists
  if (course.thumbnailPublicId) {
    try {
      await deleteCourseThumbnail({
        publicId: course.thumbnailPublicId,
        userId: authenticatedUserId,
        userRole: authenticatedUserRole,
      });
    } catch (cldErr) {
      console.warn("Could not delete course thumbnail from Cloudinary:", cldErr);
    }
  }

  // Hard delete the course document from MongoDB
  await MongoCourse.deleteOne({ _id: course._id });

  console.log(`✅ [Course Deleted] "${course.title}" (${lookupCourseId}) by user ${authenticatedUserId}`);

  return {
    success: true,
    message: "Course deleted successfully.",
  };
}

/**
 * Shared service helper for updating course metadata in MongoDB.
 * Enforces ownership: only instructor owner or admin can edit.
 */
export async function updateCourseInDb(
  courseId: string,
  input: Partial<CreateCourseInput>,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId) {
    const err: any = new Error("Course ID is required.");
    err.statusCode = 400;
    throw err;
  }

  let course = await MongoCourse.findOne({ courseId: courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: Only course instructor owner or admin
  const isTeacherOwner =
    authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
  const isAdmin = authenticatedUserRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You are not authorized to edit this course.");
    err.statusCode = 403;
    throw err;
  }

  if (input.title !== undefined && input.title.trim()) course.title = input.title.trim();
  if (input.subtitle !== undefined) course.subtitle = input.subtitle.trim();
  if (input.description !== undefined) course.description = input.description.trim();
  if (input.category !== undefined) course.category = input.category;
  if (input.level !== undefined) course.level = input.level as any;
  if (input.price !== undefined) {
    const numPrice = Number(input.price);
    if (!isNaN(numPrice) && numPrice >= 0) {
      course.price = numPrice;
      course.originalPrice = input.originalPrice !== undefined ? Number(input.originalPrice) : numPrice * 2;
    }
  }
  if (input.language !== undefined) course.language = input.language;
  const newThumb = input.thumbnailUrl || input.thumbnail;
  if (newThumb && !newThumb.startsWith("data:")) {
    course.thumbnail = newThumb;
  }
  if (input.thumbnailPublicId !== undefined) {
    course.thumbnailPublicId = input.thumbnailPublicId;
  }
  if (Array.isArray(input.requirements)) course.requirements = input.requirements;
  if (Array.isArray(input.learningOutcomes)) course.learningOutcomes = input.learningOutcomes;

  course.updatedAt = new Date().toISOString();
  await course.save();

  console.log(`✅ [Course Updated] "${course.title}" (${course.courseId}) by user ${authenticatedUserId}`);

  const courseObj: any = course.toObject();
  return {
    success: true,
    message: "Course updated successfully.",
    course: {
      ...courseObj,
      _id: courseObj.courseId || courseObj._id,
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
  const courseIds = rawCourses.flatMap((c: any) => [c.courseId, String(c._id)].filter(Boolean));

  // Authoritative join with MongoQuiz collection to ensure all section quizzes are present
  const allQuizzes = await MongoQuiz.find({ courseId: { $in: courseIds } }).lean();
  const quizzesByCourseAndSection = new Map<string, any[]>();
  for (const q of allQuizzes) {
    const key = `${q.courseId}_${q.sectionId}`;
    if (!quizzesByCourseAndSection.has(key)) {
      quizzesByCourseAndSection.set(key, []);
    }
    const totalMarks = Array.isArray(q.questions)
      ? q.questions.reduce((sum: number, quest: any) => sum + (Number(quest.marks) || 1), 0)
      : 0;
    quizzesByCourseAndSection.get(key)!.push({
      quizId: q.quizId,
      courseId: q.courseId,
      sectionId: q.sectionId,
      title: q.title,
      description: q.description || "",
      questionsCount: Array.isArray(q.questions) ? q.questions.length : 0,
      totalMarks,
      createdAt: q.createdAt,
    });
  }

  const courses = rawCourses.map((c: any) => {
    const cId = c.courseId || c._id;
    const sections = Array.isArray(c.sections)
      ? c.sections.map((sec: any) => {
          const secId = sec.sectionId || sec._id;
          const candidateKeys = [
            `${cId}_${secId}`,
            `${c.courseId}_${sec._id}`,
            `${c.courseId}_${sec.sectionId}`,
            `${String(c._id)}_${sec._id}`,
            `${String(c._id)}_${sec.sectionId}`,
          ].filter(Boolean);

          const matchedMongoQuizzes: any[] = [];
          for (const k of candidateKeys) {
            const list = quizzesByCourseAndSection.get(k);
            if (list) {
              matchedMongoQuizzes.push(...list);
            }
          }

          // Merge existing sec.quizzes with quizzes from MongoQuiz collection
          const mergedQuizzesMap = new Map<string, any>();
          if (Array.isArray(sec.quizzes)) {
            for (const sq of sec.quizzes) {
              if (sq && sq.quizId) {
                const { correctAnswer: _discard, ...safeSq } = sq;
                mergedQuizzesMap.set(sq.quizId, safeSq);
              }
            }
          }
          for (const mq of matchedMongoQuizzes) {
            const { correctAnswer: _discard, ...safeMq } = mq;
            mergedQuizzesMap.set(mq.quizId, safeMq);
          }

          return {
            ...sec,
            quizzes: Array.from(mergedQuizzesMap.values()),
          };
        })
      : [];

    return {
      ...c,
      _id: cId,
      sections,
    };
  });

  return {
    success: true,
    count: courses.length,
    courses,
  };
}

/**
 * Shared service helper for fetching a single course by ID from MongoDB with full curriculum & quizzes.
 */
export async function getCourseByIdFromDb(courseId: string) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let course = await MongoCourse.findOne({ courseId }).lean();
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId).lean();
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in database.`);
    err.statusCode = 404;
    throw err;
  }

  const finalCourseId = (course as any).courseId || (course as any)._id;
  const courseLookupIds = [finalCourseId, (course as any).courseId, String((course as any)._id), courseId].filter(Boolean);
  const quizzes = await MongoQuiz.find({ courseId: { $in: courseLookupIds } }).lean();

  const quizzesBySection = new Map<string, any[]>();
  for (const q of quizzes) {
    if (!quizzesBySection.has(q.sectionId)) {
      quizzesBySection.set(q.sectionId, []);
    }
    const totalMarks = Array.isArray(q.questions)
      ? q.questions.reduce((sum: number, quest: any) => sum + (Number(quest.marks) || 1), 0)
      : 0;
    quizzesBySection.get(q.sectionId)!.push({
      quizId: q.quizId,
      courseId: q.courseId,
      sectionId: q.sectionId,
      title: q.title,
      description: q.description || "",
      questionsCount: Array.isArray(q.questions) ? q.questions.length : 0,
      totalMarks,
      createdAt: q.createdAt,
    });
  }

  const sections = Array.isArray((course as any).sections)
    ? (course as any).sections.map((sec: any) => {
        const secId = sec.sectionId || sec._id;
        const matchedMongoQuizzes: any[] = [];
        if (sec._id && quizzesBySection.has(sec._id)) {
          matchedMongoQuizzes.push(...quizzesBySection.get(sec._id)!);
        }
        if (sec.sectionId && sec.sectionId !== sec._id && quizzesBySection.has(sec.sectionId)) {
          matchedMongoQuizzes.push(...quizzesBySection.get(sec.sectionId)!);
        }

        const mergedMap = new Map<string, any>();
        if (Array.isArray(sec.quizzes)) {
          for (const sq of sec.quizzes) {
            if (sq?.quizId) {
              const { correctAnswer: _discard, ...safeSq } = sq;
              mergedMap.set(sq.quizId, safeSq);
            }
          }
        }
        for (const mq of matchedMongoQuizzes) {
          const { correctAnswer: _discard, ...safeMq } = mq;
          mergedMap.set(mq.quizId, safeMq);
        }
        return {
          ...sec,
          quizzes: Array.from(mergedMap.values()),
        };
      })
    : [];

  return {
    success: true,
    course: {
      ...course,
      _id: finalCourseId,
      sections,
    },
  };
}

/**
 * Shared service helper for enrolling a student into a free (₹0) course.
 * Authoritative:
 * 1. Checks that caller is authenticated and exists in MongoUser.
 * 2. Fetches course from MongoDB and verifies status === 'approved'.
 * 3. Strictly verifies on the server that price === 0 (rejects paid courses).
 * 4. Idempotently checks if student is already enrolled (returns safe response).
 * 5. Creates MongoEnrollment, updates User.enrolledCourses, and increments studentsEnrolled.
 */
export async function enrollFreeCourseInDb(
  courseId: string,
  authenticatedUserId: string,
  authenticatedUserRole?: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId || typeof courseId !== "string" || !courseId.trim()) {
    const err: any = new Error("Course ID is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!authenticatedUserId || typeof authenticatedUserId !== "string") {
    const err: any = new Error("Authentication required. Please log in to enroll.");
    err.statusCode = 401;
    throw err;
  }

  // Verify that only students can enroll
  if (authenticatedUserRole && authenticatedUserRole !== "student") {
    const err: any = new Error("Forbidden. Only students can enroll in courses.");
    err.statusCode = 403;
    throw err;
  }

  // 1. Verify user exists in MongoDB
  let userDoc = await MongoUser.findOne({ userId: authenticatedUserId });
  if (!userDoc && mongoose.Types.ObjectId.isValid(authenticatedUserId)) {
    userDoc = await MongoUser.findById(authenticatedUserId);
  }

  if (!userDoc) {
    const err: any = new Error("User account not found. Please log in again.");
    err.statusCode = 404;
    throw err;
  }

  if (userDoc.role && userDoc.role !== "student") {
    const err: any = new Error("Forbidden. Only students can enroll in courses.");
    err.statusCode = 403;
    throw err;
  }

  // 2. Fetch course from MongoDB
  let course = await MongoCourse.findOne({ courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in database.`);
    err.statusCode = 404;
    throw err;
  }

  // 3. Verify course is approved and available for enrollment
  if (course.status !== "approved") {
    const err: any = new Error("This course is currently undergoing review and is not available for enrollment.");
    err.statusCode = 403;
    throw err;
  }

  // 4. Server-Side Price Verification: MUST be genuinely free (price === 0)
  const actualPrice = Number(course.price);
  if (isNaN(actualPrice) || actualPrice > 0) {
    const err: any = new Error(
      `This course is a paid course (₹${actualPrice}). Free enrollment is not permitted. Please complete payment through Razorpay.`
    );
    err.statusCode = 400;
    throw err;
  }

  const authoritativeCourseId = String(course.courseId || course._id);
  const candidateCourseIds: string[] = [authoritativeCourseId, String(course.courseId || ""), String(course._id), courseId].filter(Boolean).map(String);

  // 5. Idempotency check: Is student already enrolled?
  const existingEnrollment = await MongoEnrollment.findOne({
    courseId: { $in: candidateCourseIds },
    studentId: userDoc.userId,
  });

  if (existingEnrollment) {
    return {
      success: true,
      alreadyEnrolled: true,
      message: "You are already enrolled in this course.",
      enrollment: existingEnrollment.toObject ? existingEnrollment.toObject() : existingEnrollment,
      courseId: authoritativeCourseId,
      courseTitle: course.title,
    };
  }

  // 6. Create MongoEnrollment
  const enrollmentId = `enr_free_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const firstLectureId = course.sections?.[0]?.lectures?.[0]?._id || "";

  const newEnrollment = new MongoEnrollment({
    enrollmentId,
    studentId: userDoc.userId,
    studentEmail: userDoc.email,
    courseId: authoritativeCourseId,
    courseTitle: course.title,
    progressPercent: 0,
    completedLectures: [],
    lastWatchedLectureId: firstLectureId,
    lastWatchedPositionSeconds: 0,
    paymentId: "free_enrollment",
    razorpayOrderId: "free_order",
    razorpayPaymentId: `free_enr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    enrolledAt: new Date().toISOString(),
    certificateIssued: false,
  });

  await newEnrollment.save();

  // 7. Update User.enrolledCourses
  await MongoUser.updateOne(
    { userId: userDoc.userId },
    { $addToSet: { enrolledCourses: authoritativeCourseId } }
  );

  // 8. Increment Course.studentsEnrolled
  await MongoCourse.updateOne(
    { $or: [{ courseId: course.courseId }, { _id: course._id }] },
    { $inc: { studentsEnrolled: 1 } }
  );

  console.log(`✅ [Free Enrollment] Student ${userDoc.email} (${userDoc.userId}) enrolled in "${course.title}" (${authoritativeCourseId})`);

  return {
    success: true,
    alreadyEnrolled: false,
    message: "Enrolled in free course successfully!",
    enrollment: newEnrollment.toObject(),
    courseId: authoritativeCourseId,
    courseTitle: course.title,
  };
}

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. GET /api/courses or /api/courses/:id
  if (req.method === "GET") {
    try {
      const authHeader = req.headers.authorization;
      const all = req.query?.all as string;
      const myCourses = req.query?.myCourses as string;
      const status = req.query?.status as string;

      const rawUrl = req.url || "";
      const urlWithoutQuery = rawUrl.split("?")[0];

      // Check if accessing a study material: /api/courses/:courseId/sections/:sectionId/lectures/:lectureId/materials/:materialId/access
      const materialAccessMatch = urlWithoutQuery.match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)\/lectures\/([^/]+)\/materials\/([^/]+)\/access/
      );
      if (materialAccessMatch) {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            success: false,
            message: "Authentication required.",
          });
        }
        const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        const [, cId, sId, lId, mId] = materialAccessMatch;
        const result = await getAuthorizedMaterialAccess({
          courseId: cId,
          sectionId: sId,
          lectureId: lId,
          materialId: mId,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(200).json(result);
      }

      // Check if listing lecture materials: /api/courses/:courseId/sections/:sectionId/lectures/:lectureId/materials
      const materialsListMatch = urlWithoutQuery.match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)\/lectures\/([^/]+)\/materials/
      );
      if (materialsListMatch) {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            success: false,
            message: "Authentication required.",
          });
        }
        const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        const [, cId, sId, lId] = materialsListMatch;
        const result = await getLectureMaterials({
          courseId: cId,
          sectionId: sId,
          lectureId: lId,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(200).json(result);
      }

      // Check if querying a single course by id or path
      let singleId = (req.query?.courseId as string) || (req.query?.id as string) || "";
      if (!singleId && req.query?.path) {
        const pathVal = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
        if (pathVal && pathVal !== "all" && pathVal !== "myCourses") {
          singleId = pathVal;
        }
      }

      if (singleId && singleId !== "undefined") {
        const singleResult = await getCourseByIdFromDb(singleId);
        return res.status(200).json(singleResult);
      }

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

  // 2. POST /api/courses (and /api/courses/:id/enroll-free)
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

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore parsing error, pass as-is
        }
      }

      // Check if this is free course enrollment: POST /api/courses/:id/enroll-free
      const pathParam = Array.isArray(req.query?.path)
        ? req.query.path.join("/")
        : (req.query?.path as string) || "";
      const rawUrl = req.url || "";
      const isEnrollFree =
        pathParam.includes("enroll-free") ||
        rawUrl.includes("enroll-free") ||
        req.query?.action === "enroll-free";

      if (isEnrollFree) {
        if (decoded.role !== "student") {
          return res.status(403).json({
            success: false,
            message: "Forbidden. Only students can enroll in courses.",
          });
        }

        let targetCourseId = (req.query?.id as string) || (req.query?.courseId as string) || "";
        if (!targetCourseId && pathParam) {
          const parts = pathParam.split("/");
          targetCourseId = parts[0] !== "enroll-free" ? parts[0] : parts[1] || "";
        }
        if (!targetCourseId && rawUrl) {
          const m = rawUrl.match(/\/api\/courses\/([^/?#]+)\/enroll-free/);
          if (m && m[1]) targetCourseId = m[1];
        }
        if (!targetCourseId && body?.courseId) {
          targetCourseId = body.courseId;
        }

        const result = await enrollFreeCourseInDb(targetCourseId, decoded.userId, decoded.role);
        return res.status(200).json(result);
      }

      // Role check for course creation / thumbnail operations
      if (decoded.role !== "teacher" && decoded.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Access requires one of the following roles: teacher, admin.",
        });
      }

      // Handle material upload: POST /api/courses/:courseId/sections/:sectionId/lectures/:lectureId/materials
      const materialUploadMatch = (req.url || "").split("?")[0].match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)\/lectures\/([^/]+)\/materials/
      );
      if (materialUploadMatch) {
        const [, cId, sId, lId] = materialUploadMatch;
        const result = await uploadLectureMaterial({
          courseId: cId,
          sectionId: sId,
          lectureId: lId,
          title: body?.title,
          fileName: body?.fileName,
          fileData: body?.fileData,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(201).json(result);
      }

      // Handle thumbnail actions if routed via /api/courses/upload-thumbnail or /api/courses?path=upload-thumbnail
      const isUploadThumbnail =
        pathParam === "upload-thumbnail" || rawUrl.includes("/upload-thumbnail");
      const isDeleteThumbnail =
        pathParam === "delete-thumbnail" || rawUrl.includes("/delete-thumbnail");

      if (isUploadThumbnail) {
        const result = await uploadCourseThumbnail({
          image: body?.image,
          fileName: body?.fileName,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(200).json(result);
      }

      if (isDeleteThumbnail) {
        const result = await deleteCourseThumbnail({
          publicId: body?.publicId,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(200).json(result);
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

  // 3. PATCH /api/courses: Admin Course Status Approval/Rejection
  if (req.method === "PATCH") {
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
      } catch {
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

      // Enforce strict admin role
      if (decoded.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden. Only administrators can update course review status.",
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

      // Robust extraction of courseId from query params, vercel path rewrites, or body:
      // 1. req.query?.id (e.g. /api/courses?id=course_xxx)
      // 2. req.query?.path (e.g. from vercel.json rewrite /api/courses/:path* -> /api/courses?path=:path*)
      //    Matches cases like "course_123/status", "course_123", or array ["course_123", "status"]
      // 3. raw req.url segment (e.g. /api/courses/course_123/status)
      // 4. body?.courseId or body?.id
      let courseId = (req.query?.id as string) || "";
      
      if (!courseId && req.query?.path) {
        if (Array.isArray(req.query.path)) {
          courseId = req.query.path[0];
        } else if (typeof req.query.path === "string") {
          courseId = req.query.path.split("/")[0];
        }
      }

      if (!courseId && req.url) {
        const urlWithoutQuery = req.url.split("?")[0];
        const match = urlWithoutQuery.match(/\/api\/courses\/([^/]+)/);
        if (match && match[1] && match[1] !== "status") {
          courseId = match[1];
        }
      }

      if (!courseId) {
        courseId = body?.courseId || body?.id || "";
      }

      const { status, rejectionReason } = body || {};

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Course ID is required to update course review status.",
        });
      }

      const result = await updateCourseStatusInDb(courseId, status, rejectionReason);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/courses] PATCH Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to update course status in MongoDB.",
      });
    }
  }

  // 4. PUT /api/courses: Update Course Curriculum (sections, lectures, videoKeys)
  if (req.method === "PUT") {
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
      } catch {
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

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }

      let courseId = (req.query?.id as string) || (req.query?.courseId as string) || "";
      if (!courseId && req.query?.path) {
        if (Array.isArray(req.query.path)) {
          courseId = req.query.path[0];
        } else if (typeof req.query.path === "string") {
          courseId = req.query.path.split("/")[0];
        }
      }

      if (!courseId && req.url) {
        const urlWithoutQuery = req.url.split("?")[0];
        const match = urlWithoutQuery.match(/\/api\/courses\/([^/]+)/);
        if (match && match[1] && match[1] !== "curriculum") {
          courseId = match[1];
        }
      }

      if (!courseId) {
        courseId = body?.courseId || body?.id || "";
      }

      const isCurriculumUpdate =
        req.url?.includes("/curriculum") ||
        (Array.isArray(req.query?.path) && req.query.path.includes("curriculum")) ||
        (Array.isArray(body?.sections) && body.sections.length > 0 && !body.title);

      if (isCurriculumUpdate) {
        const sections = body?.sections || [];
        const result = await updateCourseCurriculumInDb(courseId, sections, decoded.userId, decoded.role);
        return res.status(200).json(result);
      } else {
        // Update course metadata (title, price, description, etc.)
        const result = await updateCourseInDb(courseId, body, decoded.userId, decoded.role);
        return res.status(200).json(result);
      }
    } catch (err: any) {
      console.error("[Vercel /api/courses] PUT Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to update course in MongoDB.",
      });
    }
  }

  // 5. DELETE /api/courses: Course, Section, or Lecture deletion
  if (req.method === "DELETE") {
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
      } catch {
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

      const urlWithoutQuery = (req.url || "").split("?")[0];

      // Check if deleting a study material: /api/courses/:courseId/sections/:sectionId/lectures/:lectureId/materials/:materialId
      const materialDeleteMatch = urlWithoutQuery.match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)\/lectures\/([^/]+)\/materials\/([^/]+)/
      );
      if (materialDeleteMatch) {
        const [, cId, sId, lId, mId] = materialDeleteMatch;
        const result = await deleteLectureMaterial({
          courseId: cId,
          sectionId: sId,
          lectureId: lId,
          materialId: mId,
          userId: decoded.userId,
          userRole: decoded.role,
        });
        return res.status(200).json(result);
      }

      // Check if deleting a lecture: /api/courses/:courseId/sections/:sectionId/lectures/:lectureId
      const lectureMatch = urlWithoutQuery.match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)\/lectures\/([^/]+)/
      );
      if (lectureMatch) {
        const [, cId, sId, lId] = lectureMatch;
        const result = await deleteLectureFromDb(cId, sId, lId, decoded.userId, decoded.role);
        return res.status(200).json(result);
      }

      // Check if deleting a section: /api/courses/:courseId/sections/:sectionId
      const sectionMatch = urlWithoutQuery.match(
        /\/api\/courses\/([^/]+)\/sections\/([^/]+)/
      );
      if (sectionMatch) {
        const [, cId, sId] = sectionMatch;
        const result = await deleteSectionFromDb(cId, sId, decoded.userId, decoded.role);
        return res.status(200).json(result);
      }

      // Deleting a course: /api/courses/:courseId
      let courseId = (req.query?.id as string) || (req.query?.courseId as string) || "";
      if (!courseId && req.query?.path) {
        if (Array.isArray(req.query.path)) {
          courseId = req.query.path[0];
        } else if (typeof req.query.path === "string") {
          courseId = req.query.path.split("/")[0];
        }
      }

      if (!courseId) {
        const match = urlWithoutQuery.match(/\/api\/courses\/([^/]+)/);
        if (match && match[1]) {
          courseId = match[1];
        }
      }

      if (!courseId) {
        let body = req.body;
        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {}
        }
        courseId = body?.courseId || body?.id || "";
      }

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Course ID is required to delete course.",
        });
      }

      const result = await deleteCourseFromDb(courseId, decoded.userId, decoded.role);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Vercel /api/courses] DELETE Error:", err);
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to delete content from MongoDB.",
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed.`,
  });
}
