import mongoose from "mongoose";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";
import { MongoQuiz, IQuizQuestion } from "./models/Quiz.js";
import { MongoQuizAttempt } from "./models/QuizAttempt.js";
import { MongoEnrollment } from "./models/Enrollment.js";

export interface CreateQuizInput {
  courseId: string;
  sectionId: string;
  title: string;
  description?: string;
  questions: Array<{
    questionId?: string;
    question: string;
    options: string[];
    correctAnswer: number;
    marks?: number;
  }>;
}

export interface UpdateQuizInput {
  title?: string;
  description?: string;
  questions?: Array<{
    questionId?: string;
    question: string;
    options: string[];
    correctAnswer: number;
    marks?: number;
  }>;
}

/**
 * Validate question structure according to quiz specifications:
 * - non-empty question string
 * - exactly 4 non-empty options
 * - valid correctAnswer index (0 to 3)
 * - marks > 0
 */
function validateQuestions(
  rawQuestions: any[]
): IQuizQuestion[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    const err: any = new Error("Quiz must contain an array with at least one question.");
    err.statusCode = 400;
    throw err;
  }

  return rawQuestions.map((q, idx) => {
    const questionText = typeof q.question === "string" ? q.question.trim() : "";
    if (!questionText) {
      const err: any = new Error(`Question ${idx + 1} cannot have empty text.`);
      err.statusCode = 400;
      throw err;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      const err: any = new Error(
        `Question ${idx + 1} must have exactly 4 options. Found ${Array.isArray(q.options) ? q.options.length : 0}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const cleanedOptions = q.options.map((opt: any, optIdx: number) => {
      const optStr = typeof opt === "string" ? opt.trim() : String(opt || "").trim();
      if (!optStr) {
        const err: any = new Error(`Question ${idx + 1}, option ${optIdx + 1} cannot be empty.`);
        err.statusCode = 400;
        throw err;
      }
      return optStr;
    });

    const parsedCorrect = Number(q.correctAnswer);
    if (isNaN(parsedCorrect) || parsedCorrect < 0 || parsedCorrect > 3 || !Number.isInteger(parsedCorrect)) {
      const err: any = new Error(
        `Question ${idx + 1} has an invalid correctAnswer (${q.correctAnswer}). It must be an integer index from 0 to 3.`
      );
      err.statusCode = 400;
      throw err;
    }

    const marksNum = Number(q.marks);
    const validMarks = !isNaN(marksNum) && marksNum > 0 ? marksNum : 1;

    const questionId =
      typeof q.questionId === "string" && q.questionId.trim()
        ? q.questionId.trim()
        : `q_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      questionId,
      question: questionText,
      options: cleanedOptions,
      correctAnswer: parsedCorrect,
      marks: validMarks,
    };
  });
}

/**
 * Creates a new Quiz in MongoDB and attaches its summary to the course curriculum section.
 * Enforces ownership: only the course instructor or an admin can create.
 */
export async function createQuizInDb(
  input: CreateQuizInput,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  const { courseId, sectionId, title, description, questions } = input || {};

  if (!courseId || typeof courseId !== "string") {
    const err: any = new Error("courseId is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!sectionId || typeof sectionId !== "string") {
    const err: any = new Error("sectionId is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    const err: any = new Error("Quiz title is required.");
    err.statusCode = 400;
    throw err;
  }

  // Validate questions
  const validatedQuestions = validateQuestions(questions);

  // Authoritative course lookup
  let course = await MongoCourse.findOne({ courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in database.`);
    err.statusCode = 404;
    throw err;
  }

  // Teacher ownership check: do NOT trust instructorId from request body
  const isTeacherOwner =
    authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
  const isAdmin = authenticatedUserRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You can only create quizzes for courses you teach.");
    err.statusCode = 403;
    throw err;
  }

  // Check section existence in course
  const currentSections = Array.isArray(course.sections) ? [...course.sections] : [];
  const targetSectionIndex = currentSections.findIndex(
    (s: any) => s._id === sectionId || s.sectionId === sectionId
  );

  if (targetSectionIndex === -1) {
    const err: any = new Error(`Section with ID "${sectionId}" not found in course curriculum.`);
    err.statusCode = 404;
    throw err;
  }

  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanTitle = title.trim();
  const cleanDescription = (description || "").trim();

  // Create Quiz in MongoDB
  const newQuiz = new MongoQuiz({
    quizId,
    courseId: course.courseId || courseId,
    sectionId,
    title: cleanTitle,
    description: cleanDescription,
    questions: validatedQuestions,
  });

  await newQuiz.save();

  // Attach quiz summary to course curriculum section
  const targetSection = { ...currentSections[targetSectionIndex] };
  const existingQuizzes = Array.isArray(targetSection.quizzes) ? [...targetSection.quizzes] : [];

  const totalMarks = validatedQuestions.reduce((sum, q) => sum + q.marks, 0);

  const quizSummary = {
    quizId,
    courseId: course.courseId || courseId,
    sectionId,
    title: cleanTitle,
    description: cleanDescription,
    questionsCount: validatedQuestions.length,
    totalMarks,
    createdAt: new Date().toISOString(),
  };

  // Replace or append
  const quizIndex = existingQuizzes.findIndex((q: any) => q.quizId === quizId);
  if (quizIndex >= 0) {
    existingQuizzes[quizIndex] = quizSummary;
  } else {
    existingQuizzes.push(quizSummary);
  }

  targetSection.quizzes = existingQuizzes;
  currentSections[targetSectionIndex] = targetSection;
  course.sections = currentSections;
  course.updatedAt = new Date().toISOString();
  course.markModified("sections");
  await course.save();

  console.log(`✅ [Quiz Created] "${cleanTitle}" (${quizId}) in course "${course.title}" section "${targetSection.title}"`);

  const createdQuiz = newQuiz.toObject();

  return {
    success: true,
    message: "Quiz created successfully.",
    quiz: {
      ...createdQuiz,
      _id: createdQuiz.quizId || createdQuiz._id,
    },
    course: {
      ...course.toObject(),
      _id: course.courseId || course._id,
    },
  };
}

/**
 * Updates an existing Quiz in MongoDB and updates its summary in the course section.
 * Enforces ownership: only the course instructor or an admin can update.
 */
export async function updateQuizInDb(
  quizId: string,
  input: UpdateQuizInput,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!quizId || typeof quizId !== "string") {
    const err: any = new Error("quizId is required.");
    err.statusCode = 400;
    throw err;
  }

  let quiz = await MongoQuiz.findOne({ quizId });
  if (!quiz && mongoose.Types.ObjectId.isValid(quizId)) {
    quiz = await MongoQuiz.findById(quizId);
  }

  if (!quiz) {
    const err: any = new Error(`Quiz with ID "${quizId}" not found in database.`);
    err.statusCode = 404;
    throw err;
  }

  // Lookup course to verify teacher ownership
  let course = await MongoCourse.findOne({ courseId: quiz.courseId });
  if (!course && mongoose.Types.ObjectId.isValid(quiz.courseId)) {
    course = await MongoCourse.findById(quiz.courseId);
  }

  if (!course) {
    const err: any = new Error(`Associated course "${quiz.courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const isTeacherOwner =
    authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
  const isAdmin = authenticatedUserRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You do not own the course this quiz belongs to.");
    err.statusCode = 403;
    throw err;
  }

  const { title, description, questions } = input || {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      const err: any = new Error("Quiz title cannot be empty.");
      err.statusCode = 400;
      throw err;
    }
    quiz.title = title.trim();
  }

  if (description !== undefined) {
    quiz.description = typeof description === "string" ? description.trim() : "";
  }

  if (questions !== undefined) {
    quiz.questions = validateQuestions(questions);
  }

  await quiz.save();

  // Sync update to course sections
  if (Array.isArray(course.sections)) {
    const currentSections = [...course.sections];
    let updatedCourseSections = false;

    const totalMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);

    for (let i = 0; i < currentSections.length; i++) {
      const sec = { ...currentSections[i] };
      if (Array.isArray(sec.quizzes)) {
        const qIdx = sec.quizzes.findIndex((q: any) => q.quizId === quiz.quizId);
        if (qIdx >= 0) {
          sec.quizzes[qIdx] = {
            ...sec.quizzes[qIdx],
            title: quiz.title,
            description: quiz.description,
            questionsCount: quiz.questions.length,
            totalMarks,
            updatedAt: new Date().toISOString(),
          };
          currentSections[i] = sec;
          updatedCourseSections = true;
        }
      }
    }

    if (updatedCourseSections) {
      course.sections = currentSections;
      course.updatedAt = new Date().toISOString();
      course.markModified("sections");
      await course.save();
    }
  }

  console.log(`✅ [Quiz Updated] "${quiz.title}" (${quiz.quizId})`);

  const updatedQuiz = quiz.toObject();

  return {
    success: true,
    message: "Quiz updated successfully.",
    quiz: {
      ...updatedQuiz,
      _id: updatedQuiz.quizId || updatedQuiz._id,
    },
  };
}

/**
 * Strips correctAnswer from question objects to prevent student answer leaks.
 */
function sanitizeQuizForStudents(quizObj: any): any {
  if (!quizObj) return null;
  const copy = { ...quizObj };
  if (Array.isArray(copy.questions)) {
    copy.questions = copy.questions.map((q: any) => {
      const { correctAnswer, ...safeQuestion } = q;
      return safeQuestion;
    });
  }
  return copy;
}

/**
 * Fetches a single quiz by quizId.
 * Hides correctAnswer if caller is a student or not the course instructor/admin.
 */
export async function getQuizByIdFromDb(
  quizId: string,
  authenticatedUserId?: string,
  authenticatedUserRole?: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let quiz = await MongoQuiz.findOne({ quizId }).lean();
  if (!quiz && mongoose.Types.ObjectId.isValid(quizId)) {
    quiz = await MongoQuiz.findById(quizId).lean();
  }

  if (!quiz) {
    const err: any = new Error(`Quiz with ID "${quizId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Determine if caller is authorized to view correct answers
  let isAuthorizedStaff = false;
  if (authenticatedUserId && authenticatedUserRole) {
    if (authenticatedUserRole === "admin") {
      isAuthorizedStaff = true;
    } else if (authenticatedUserRole === "teacher") {
      const course = await MongoCourse.findOne({ courseId: (quiz as any).courseId }).lean();
      if (course && (course as any).instructorId === authenticatedUserId) {
        isAuthorizedStaff = true;
      }
    }
  }

  const resultQuiz = isAuthorizedStaff ? quiz : sanitizeQuizForStudents(quiz);

  // Check if caller already has a completed attempt
  let existingAttempt = null;
  if (authenticatedUserId) {
    existingAttempt = await MongoQuizAttempt.findOne({
      quizId: (quiz as any).quizId,
      studentId: authenticatedUserId,
      completed: true,
    }).lean();
  }

  return {
    success: true,
    quiz: {
      ...resultQuiz,
      _id: (resultQuiz as any).quizId || (resultQuiz as any)._id,
    },
    attempt: existingAttempt
      ? {
          attemptId: existingAttempt.attemptId,
          score: existingAttempt.score,
          totalMarks: existingAttempt.totalMarks,
          percentage: existingAttempt.percentage,
          completed: existingAttempt.completed,
          attemptedAt: existingAttempt.attemptedAt,
        }
      : null,
  };
}

/**
 * Fetches all quizzes for a specific course.
 * Hides correctAnswer if caller is student or not the course instructor/admin.
 */
export async function getQuizzesByCourseFromDb(
  courseId: string,
  authenticatedUserId?: string,
  authenticatedUserRole?: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  // Check course ownership
  let isAuthorizedStaff = false;
  if (authenticatedUserId && authenticatedUserRole) {
    if (authenticatedUserRole === "admin") {
      isAuthorizedStaff = true;
    } else if (authenticatedUserRole === "teacher") {
      let course = await MongoCourse.findOne({ courseId }).lean();
      if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
        course = await MongoCourse.findById(courseId).lean();
      }
      if (course && (course as any).instructorId === authenticatedUserId) {
        isAuthorizedStaff = true;
      }
    }
  }

  const rawQuizzes = await MongoQuiz.find({ courseId }).sort({ createdAt: 1 }).lean();

  const quizzes = rawQuizzes.map((q: any) => {
    const processed = isAuthorizedStaff ? q : sanitizeQuizForStudents(q);
    return {
      ...processed,
      _id: processed.quizId || processed._id,
    };
  });

  return {
    success: true,
    count: quizzes.length,
    quizzes,
  };
}

/**
 * Deletes a quiz from MongoDB and cleans up its reference in the course curriculum section.
 * Enforces ownership: only course instructor or admin.
 */
export async function deleteQuizFromDb(
  quizId: string,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let quiz = await MongoQuiz.findOne({ quizId });
  if (!quiz && mongoose.Types.ObjectId.isValid(quizId)) {
    quiz = await MongoQuiz.findById(quizId);
  }

  if (!quiz) {
    const err: any = new Error(`Quiz with ID "${quizId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Lookup course
  let course = await MongoCourse.findOne({ courseId: quiz.courseId });
  if (!course && mongoose.Types.ObjectId.isValid(quiz.courseId)) {
    course = await MongoCourse.findById(quiz.courseId);
  }

  if (course) {
    const isTeacherOwner =
      authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
    const isAdmin = authenticatedUserRole === "admin";

    if (!isTeacherOwner && !isAdmin) {
      const err: any = new Error("Forbidden. You do not own the course this quiz belongs to.");
      err.statusCode = 403;
      throw err;
    }

    // Remove from course sections
    if (Array.isArray(course.sections)) {
      const updatedSections = course.sections.map((sec: any) => {
        if (Array.isArray(sec.quizzes)) {
          return {
            ...sec,
            quizzes: sec.quizzes.filter((q: any) => q.quizId !== quiz.quizId),
          };
        }
        return sec;
      });

      course.sections = updatedSections;
      course.updatedAt = new Date().toISOString();
      course.markModified("sections");
      await course.save();
    }
  }

  await MongoQuiz.deleteOne({ quizId: quiz.quizId });

  console.log(`✅ [Quiz Deleted] ${quiz.quizId} from course ${quiz.courseId}`);

  return {
    success: true,
    message: "Quiz deleted successfully.",
  };
}

/**
 * Submits a student's quiz attempt.
 * Evaluates submitted answer indices against server-stored correct answers,
 * calculates score, total marks, percentage, prevents duplicate completed attempts,
 * verifies active enrollment, and saves the attempt to MongoDB.
 */
export async function submitQuizAttemptInDb(
  quizId: string,
  inputAnswers: any,
  authenticatedUserId: string,
  authenticatedUserRole: string
) {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!quizId || typeof quizId !== "string") {
    const err: any = new Error("quizId is required.");
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify quiz exists
  let quiz = await MongoQuiz.findOne({ quizId });
  if (!quiz && mongoose.Types.ObjectId.isValid(quizId)) {
    quiz = await MongoQuiz.findById(quizId);
  }

  if (!quiz) {
    const err: any = new Error(`Quiz with ID "${quizId}" not found in database.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Verify course exists
  let course = await MongoCourse.findOne({ courseId: quiz.courseId });
  if (!course && mongoose.Types.ObjectId.isValid(quiz.courseId)) {
    course = await MongoCourse.findById(quiz.courseId);
  }

  if (!course) {
    const err: any = new Error(`Associated course "${quiz.courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 3. Verify student authorization / enrollment
  const isTeacherOwner =
    authenticatedUserRole === "teacher" && course.instructorId === authenticatedUserId;
  const isAdmin = authenticatedUserRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    // Student role or other: must have active enrollment
    const enrollment = await MongoEnrollment.findOne({
      courseId: quiz.courseId,
      studentId: authenticatedUserId,
    });

    if (!enrollment) {
      const err: any = new Error("Forbidden. You must be actively enrolled in this course to take the quiz.");
      err.statusCode = 403;
      throw err;
    }
  }

  // 4. Duplicate Attempt Policy (Requirement 8):
  // Check if student already completed this quiz
  const existingAttempt = await MongoQuizAttempt.findOne({
    studentId: authenticatedUserId,
    quizId: quiz.quizId,
    completed: true,
  });

  if (existingAttempt) {
    console.log(`ℹ️ [Quiz] Student ${authenticatedUserId} already completed quiz ${quiz.quizId}`);
    return {
      success: true,
      alreadyCompleted: true,
      message: "You have already completed this quiz.",
      result: {
        score: existingAttempt.score,
        totalMarks: existingAttempt.totalMarks,
        percentage: existingAttempt.percentage,
        completed: existingAttempt.completed,
      },
    };
  }

  // 5. Score calculation (Requirement 4 & 7):
  // Never trust any score sent from frontend. Load authoritative quiz from MongoDB.
  // Normalize submitted answers input: { [questionId]: answerIndex }
  const answersMap: Record<string, number> = {};
  if (inputAnswers && typeof inputAnswers === "object") {
    if (Array.isArray(inputAnswers)) {
      for (const item of inputAnswers) {
        if (item && item.questionId) {
          const ansVal = item.answer !== undefined ? item.answer : item.selectedAnswer;
          const parsed = Number(ansVal);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 3 && Number.isInteger(parsed)) {
            answersMap[item.questionId] = parsed;
          }
        }
      }
    } else {
      for (const [qId, ansVal] of Object.entries(inputAnswers)) {
        const parsed = Number(ansVal);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 3 && Number.isInteger(parsed)) {
          answersMap[qId] = parsed;
        }
      }
    }
  }

  let score = 0;
  let totalMarks = 0;
  const cleanSubmittedAnswers: Record<string, number> = {};

  for (const q of quiz.questions) {
    const qMarks = Number(q.marks) || 1;
    totalMarks += qMarks;

    if (answersMap[q.questionId] !== undefined) {
      const studentAnswer = answersMap[q.questionId];
      cleanSubmittedAnswers[q.questionId] = studentAnswer;

      // Authoritative comparison
      if (studentAnswer === q.correctAnswer) {
        score += qMarks;
      }
    }
  }

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

  // 6. Save attempt in MongoDB (Requirement 5)
  // Do NOT store correctAnswer in student's submitted answers
  const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newAttempt = new MongoQuizAttempt({
    attemptId,
    studentId: authenticatedUserId,
    courseId: quiz.courseId,
    quizId: quiz.quizId,
    answers: cleanSubmittedAnswers,
    score,
    totalMarks,
    percentage,
    completed: true,
    attemptedAt: new Date().toISOString(),
  });

  await newAttempt.save();

  console.log(
    `✅ [Quiz Attempt Submitted] Student ${authenticatedUserId} scored ${score}/${totalMarks} (${percentage}%) in quiz "${quiz.title}"`
  );

  return {
    success: true,
    result: {
      score,
      totalMarks,
      percentage,
      completed: true,
    },
  };
}

/**
 * Retrieves the latest attempt for a student on a specific quiz.
 */
export async function getQuizAttemptForStudent(
  quizId: string,
  studentId: string
) {
  const connected = await connectMongoDB();
  if (!connected) return null;

  const attempt = await MongoQuizAttempt.findOne({
    quizId,
    studentId,
    completed: true,
  }).lean();

  if (!attempt) return null;

  return {
    attemptId: attempt.attemptId,
    studentId: attempt.studentId,
    courseId: attempt.courseId,
    quizId: attempt.quizId,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    completed: attempt.completed,
    attemptedAt: attempt.attemptedAt,
  };
}

