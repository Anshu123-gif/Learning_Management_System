import mongoose from "mongoose";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";

/**
 * Updates the curriculum (sections and lectures) for a course in MongoDB.
 * Ensures only the course instructor or an admin can make modifications.
 */
export async function updateCourseCurriculumInDb(
  courseId: string,
  sections: any[],
  userId: string,
  userRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId) {
    const err: any = new Error("Course ID is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(sections)) {
    const err: any = new Error("Sections must be an array.");
    err.statusCode = 400;
    throw err;
  }

  // Safe lookup: first by courseId, then by ObjectId if valid
  let course = await MongoCourse.findOne({ courseId: courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: Only course instructor or admin
  const isTeacherOwner = userRole === "teacher" && course.instructorId === userId;
  const isAdmin = userRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You are not authorized to edit this course curriculum.");
    err.statusCode = 403;
    throw err;
  }

  // Sanitize and save sections
  course.sections = sections;
  course.updatedAt = new Date().toISOString();
  course.markModified("sections");

  await course.save();

  console.log(`✅ [Curriculum Updated] Course "${course.title}" (${course.courseId}) sections: ${sections.length}`);

  const courseObj: any = course.toObject();

  return {
    success: true,
    message: "Course curriculum updated successfully.",
    course: {
      ...courseObj,
      _id: courseObj.courseId || courseObj._id,
    },
  };
}
