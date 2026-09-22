import mongoose from "mongoose";
import { configureCloudinary, getCloudinaryConfig, cloudinary } from "./cloudinary.js";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";
import { MongoEnrollment } from "./models/Enrollment.js";

// Allowed video MIME types
export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/ogg",
];

// Maximum allowed video file size: 2GB
export const MAX_VIDEO_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Generate Cloudinary Signed Upload Parameters
 *
 * Requirements:
 * - Allowed only for teacher (who owns course) or admin
 * - Never trust instructorId or role from request body
 * - Generates unique folder: courses/{courseId}/lectures/{lectureId}
 * - Generates unique public_id: video_{timestamp}
 * - Signs the request server-side using Cloudinary API Secret
 * - NEVER exposes CLOUDINARY_API_SECRET in the response
 */
export async function generateCloudinaryUploadSignature(params: {
  courseId: string;
  lectureId: string;
  userId: string;
  userRole: string;
}) {
  const { courseId, lectureId, userId, userRole } = params;

  if (!courseId || !lectureId) {
    const err: any = new Error("courseId and lectureId are required.");
    err.statusCode = 400;
    throw err;
  }

  // 1. Connect to DB and verify course exists
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

  // 2. Teacher can upload only to courses they own. Admin can upload to any.
  if (userRole !== "admin" && course.instructorId !== userId) {
    const err: any = new Error("Forbidden. You can only upload video lectures to courses you created.");
    err.statusCode = 403;
    throw err;
  }

  // 3. Verify Cloudinary configuration
  const config = getCloudinaryConfig();
  if (!config.isConfigured) {
    const err: any = new Error(
      "Cloudinary is not fully configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    err.statusCode = 503;
    throw err;
  }

  configureCloudinary();

  // 4. Construct deterministic, safe folder and public_id
  const folder = `courses/${course.courseId || courseId}/lectures/${lectureId}`;
  const publicId = `video_${Date.now()}`;
  const timestamp = Math.round(Date.now() / 1000);

  // Parameters to sign in alphabetical order as required by Cloudinary
  const paramsToSign: Record<string, any> = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, config.apiSecret);

  console.log(`✅ [Cloudinary] Upload signature generated for course "${courseId}", lecture "${lectureId}" in folder "${folder}"`);

  // Return ONLY public parameters to the frontend (NEVER return apiSecret)
  return {
    success: true,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`,
  };
}

/**
 * Generate Secure Cloudinary Playback URL
 *
 * Requirements:
 * - Student must be enrolled in the course, OR
 * - User must be the course teacher or an admin
 * - Resolves videoPublicId or videoUrl from course lecture in MongoDB
 * - Generates signed/authenticated delivery URL
 * - Does NOT expose API secret
 */
export async function generateCloudinaryPlayUrl(params: {
  courseId: string;
  lectureId: string;
  userId: string;
  userRole: string;
}) {
  const { courseId, lectureId, userId, userRole } = params;

  if (!courseId || !lectureId) {
    const err: any = new Error("courseId and lectureId are required.");
    err.statusCode = 400;
    throw err;
  }

  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  // 1. Safe course lookup
  let course = await MongoCourse.findOne({ courseId }).lean();
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId).lean();
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Authorization Check: Admin, Course Instructor, or Active Enrolled Student
  const isAdmin = userRole === "admin";
  const isInstructor = userRole === "teacher" && course.instructorId === userId;

  if (!isAdmin && !isInstructor) {
    // Check MongoDB enrollment for student
    const actualCourseId = course.courseId || courseId;
    const enrollment = await MongoEnrollment.findOne({
      studentId: userId,
      courseId: actualCourseId,
    }).lean();

    if (!enrollment) {
      const err: any = new Error(
        "Access denied. You must be enrolled in this course to watch this lecture."
      );
      err.statusCode = 403;
      throw err;
    }
  }

  // 3. Find target lecture within course sections
  let foundLecture: any = null;
  if (course.sections && Array.isArray(course.sections)) {
    for (const sec of course.sections) {
      if (sec.lectures && Array.isArray(sec.lectures)) {
        const lec = sec.lectures.find((l: any) => l._id === lectureId);
        if (lec) {
          foundLecture = lec;
          break;
        }
      }
    }
  }

  if (!foundLecture) {
    const err: any = new Error("Lecture not found in this course curriculum.");
    err.statusCode = 404;
    throw err;
  }

  const publicId = foundLecture.videoPublicId || foundLecture.publicId;
  const directVideoUrl = foundLecture.videoUrl;

  if (!publicId && !directVideoUrl) {
    const err: any = new Error("Video is not available for this lecture yet.");
    err.statusCode = 404;
    throw err;
  }

  // 4. Generate Cloudinary Secure / Signed URL if publicId is present
  const config = getCloudinaryConfig();
  let playbackUrl = "";

  if (publicId && config.isConfigured) {
    configureCloudinary();
    // Generates a signed Cloudinary delivery URL with signature token
    playbackUrl = cloudinary.url(publicId, {
      resource_type: "video",
      secure: true,
      sign_url: true,
    });
  } else if (directVideoUrl) {
    playbackUrl = directVideoUrl;
  } else {
    const err: any = new Error("Video is not available for this lecture yet.");
    err.statusCode = 404;
    throw err;
  }

  console.log(`✅ [Cloudinary Playback] Authorized stream for lecture "${lectureId}" in course "${courseId}"`);

  return {
    success: true,
    videoUrl: playbackUrl,
    publicId: publicId || null,
    source: publicId ? "cloudinary" : "direct",
  };
}
