import mongoose from "mongoose";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";
import { MongoQuiz } from "./models/Quiz.js";

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

  // Preserve and merge existing section quizzes from MongoQuiz collection
  const finalCourseId = course.courseId || courseId;
  const quizzes = await MongoQuiz.find({ courseId: finalCourseId }).lean();
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

  const enrichedSections = sections.map((sec: any) => {
    const secId = sec.sectionId || sec._id;
    const mongoQuizzes = quizzesBySection.get(secId) || [];
    const mergedMap = new Map<string, any>();
    if (Array.isArray(sec.quizzes)) {
      for (const sq of sec.quizzes) {
        if (sq?.quizId) mergedMap.set(sq.quizId, sq);
      }
    }
    for (const mq of mongoQuizzes) {
      mergedMap.set(mq.quizId, mq);
    }
    return {
      ...sec,
      quizzes: Array.from(mergedMap.values()),
    };
  });

  // Sanitize and save sections
  course.sections = enrichedSections;
  course.updatedAt = new Date().toISOString();
  course.markModified("sections");

  await course.save();

  console.log(`✅ [Curriculum Updated] Course "${course.title}" (${course.courseId}) sections: ${enrichedSections.length}`);

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
