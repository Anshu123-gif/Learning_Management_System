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

/**
 * Deletes a section and all its lectures/quizzes from a course in MongoDB.
 * Ensures only the course instructor or an admin can delete.
 */
export async function deleteSectionFromDb(
  courseId: string,
  sectionId: string,
  userId: string,
  userRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId || !sectionId) {
    const err: any = new Error("Course ID and Section ID are required.");
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

  // Authorization: Only course instructor or admin
  const isTeacherOwner = userRole === "teacher" && course.instructorId === userId;
  const isAdmin = userRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You are not authorized to delete sections from this course.");
    err.statusCode = 403;
    throw err;
  }

  const cleanSectionId = String(sectionId).trim();
  const secExists = (course.sections || []).some(
    (s: any) => String(s._id || s.sectionId) === cleanSectionId
  );

  if (!secExists) {
    const err: any = new Error(`Section with ID "${sectionId}" not found in course.`);
    err.statusCode = 404;
    throw err;
  }

  // Clean up any quizzes attached to this section from MongoQuiz
  try {
    const finalCourseId = course.courseId || courseId;
    await MongoQuiz.deleteMany({
      $or: [{ courseId: finalCourseId }, { courseId: courseId }],
      sectionId: cleanSectionId,
    });
  } catch (qErr) {
    console.warn("Could not delete quizzes for section:", qErr);
  }

  // Filter out the section and re-order remaining sections
  const filteredSections = (course.sections || [])
    .filter((s: any) => String(s._id || s.sectionId) !== cleanSectionId)
    .map((s: any, idx: number) => ({
      ...s,
      order: idx + 1,
    }));

  course.sections = filteredSections;
  course.updatedAt = new Date().toISOString();
  course.markModified("sections");
  await course.save();

  console.log(`✅ [Section Deleted] Section ${cleanSectionId} from course ${course.title}`);

  const courseObj: any = course.toObject();
  return {
    success: true,
    message: "Section deleted successfully.",
    course: {
      ...courseObj,
      _id: courseObj.courseId || courseObj._id,
    },
  };
}

/**
 * Deletes a single lecture from a section in MongoDB.
 * Ensures only the course instructor or an admin can delete.
 */
export async function deleteLectureFromDb(
  courseId: string,
  sectionId: string,
  lectureId: string,
  userId: string,
  userRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!courseId || !sectionId || !lectureId) {
    const err: any = new Error("Course ID, Section ID, and Lecture ID are required.");
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

  // Authorization: Only course instructor or admin
  const isTeacherOwner = userRole === "teacher" && course.instructorId === userId;
  const isAdmin = userRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You are not authorized to delete lectures from this course.");
    err.statusCode = 403;
    throw err;
  }

  const cleanSectionId = String(sectionId).trim();
  const cleanLectureId = String(lectureId).trim();

  let lectureRemoved = false;
  const updatedSections = (course.sections || []).map((sec: any) => {
    if (String(sec._id || sec.sectionId) === cleanSectionId) {
      const originalCount = (sec.lectures || []).length;
      const filteredLectures = (sec.lectures || []).filter(
        (lec: any) => String(lec._id || lec.lectureId) !== cleanLectureId
      );
      if (filteredLectures.length < originalCount) {
        lectureRemoved = true;
      }
      return {
        ...sec,
        lectures: filteredLectures,
      };
    }
    return sec;
  });

  if (!lectureRemoved) {
    const err: any = new Error(`Lecture with ID "${lectureId}" not found in section "${sectionId}".`);
    err.statusCode = 404;
    throw err;
  }

  course.sections = updatedSections;
  course.updatedAt = new Date().toISOString();
  course.markModified("sections");
  await course.save();

  console.log(`✅ [Lecture Deleted] Lecture ${cleanLectureId} from section ${cleanSectionId}`);

  const courseObj: any = course.toObject();
  return {
    success: true,
    message: "Lecture deleted successfully.",
    course: {
      ...courseObj,
      _id: courseObj.courseId || courseObj._id,
    },
  };
}

