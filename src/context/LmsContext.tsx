import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Course,
  Section,
  Lecture,
  Enrollment,
  Quiz,
  QuizAttempt,
  Assignment,
  DiscussionThread,
  Certificate,
  PaymentTransaction,
} from "../types";
import {
  INITIAL_COURSES,
  INITIAL_ENROLLMENTS,
  INITIAL_QUIZZES,
  INITIAL_ASSIGNMENTS,
  INITIAL_DISCUSSIONS,
  INITIAL_CERTIFICATES,
  INITIAL_PAYMENTS,
} from "../data/mockLmsData";
import { useAuth } from "./AuthContext";

interface LmsContextType {
  courses: Course[];
  enrollments: Enrollment[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  assignments: Assignment[];
  discussions: DiscussionThread[];
  certificates: Certificate[];
  payments: PaymentTransaction[];
  
  // Course actions
  getCourseById: (courseId: string) => Course | undefined;
  approveCourse: (courseId: string) => Promise<{ success: boolean; course?: Course; message?: string }>;
  rejectCourse: (courseId: string, reason?: string) => Promise<{ success: boolean; course?: Course; message?: string }>;
  createCourse: (newCourse: Partial<Course>) => Promise<{ success: boolean; course?: Course; message?: string }>;
  addCourse: (newCourse: Partial<Course>) => Promise<{ success: boolean; course?: Course; message?: string }>;
  addSectionToCourse: (courseId: string, title: string) => Section;
  addLectureToSection: (courseId: string, sectionId: string, lectureData: Partial<Lecture>) => Lecture;
  saveCourseCurriculum: (courseId: string, sections: Section[]) => Promise<{ success: boolean; course?: Course; message?: string }>;
  
  // Learning & Progress
  getEnrollmentForCourse: (courseId: string) => Enrollment | undefined;
  isEnrolled: (courseId: string) => boolean;
  enrollInCourse: (courseId: string, paymentDetails?: { razorpayOrderId: string; razorpayPaymentId: string; amount: number }) => void;
  markLectureComplete: (courseId: string, lectureId: string) => void;
  saveVideoProgress: (courseId: string, lectureId: string, seconds: number) => void;
  
  // Quizzes & Exams
  getQuizForCourse: (courseId: string) => Quiz | undefined;
  submitQuizAttempt: (courseId: string, quizId: string, selectedAnswers: { questionId: string; answer: string | number }[]) => QuizAttempt;
  getAttemptsForQuiz: (quizId: string) => QuizAttempt[];
  
  // Certificates
  getCertificateForCourse: (courseId: string) => Certificate | undefined;
  generateCertificate: (courseId: string) => Certificate | null;
  
  // Discussions
  getCourseDiscussions: (courseId: string) => DiscussionThread[];
  addDiscussionThread: (courseId: string, lectureId: string | undefined, title: string, question: string) => void;
  addDiscussionReply: (threadId: string, content: string) => void;
  toggleUpvoteDiscussion: (threadId: string) => void;
  toggleResolveDiscussion: (threadId: string) => void;

  // Assignment Submissions
  submitAssignment: (assignmentId: string, text: string) => void;
  gradeAssignmentSubmission: (assignmentId: string, submissionId: string, grade: number, feedback: string) => void;

  // Refunds
  refundPayment: (paymentId: string) => void;
  processRefund: (paymentId: string) => void;
}

const LmsContext = createContext<LmsContextType | undefined>(undefined);

export const LmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem("edupulse_courses");
    const rawList: Course[] = saved ? JSON.parse(saved) : INITIAL_COURSES;
    // If not teacher or admin, do not initialize with pending or rejected courses
    const isTeacherOrAdmin = currentUser?.role === "teacher" || currentUser?.role === "admin";
    if (!isTeacherOrAdmin) {
      return rawList.filter((c) => c.status === "approved");
    }
    return rawList;
  });

  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => {
    const saved = localStorage.getItem("edupulse_enrollments");
    return saved ? JSON.parse(saved) : INITIAL_ENROLLMENTS;
  });

  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    const saved = localStorage.getItem("edupulse_quizzes");
    return saved ? JSON.parse(saved) : INITIAL_QUIZZES;
  });

  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(() => {
    const saved = localStorage.getItem("edupulse_quiz_attempts");
    return saved ? JSON.parse(saved) : [];
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem("edupulse_assignments");
    return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
  });

  const [discussions, setDiscussions] = useState<DiscussionThread[]>(() => {
    const saved = localStorage.getItem("edupulse_discussions");
    return saved ? JSON.parse(saved) : INITIAL_DISCUSSIONS;
  });

  const [certificates, setCertificates] = useState<Certificate[]>(() => {
    const saved = localStorage.getItem("edupulse_certificates");
    return saved ? JSON.parse(saved) : INITIAL_CERTIFICATES;
  });

  const [payments, setPayments] = useState<PaymentTransaction[]>(() => {
    const saved = localStorage.getItem("edupulse_payments");
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem("edupulse_courses", JSON.stringify(courses));
  }, [courses]);
  useEffect(() => {
    localStorage.setItem("edupulse_enrollments", JSON.stringify(enrollments));
  }, [enrollments]);
  useEffect(() => {
    localStorage.setItem("edupulse_quizzes", JSON.stringify(quizzes));
  }, [quizzes]);
  useEffect(() => {
    localStorage.setItem("edupulse_quiz_attempts", JSON.stringify(quizAttempts));
  }, [quizAttempts]);
  useEffect(() => {
    localStorage.setItem("edupulse_assignments", JSON.stringify(assignments));
  }, [assignments]);
  useEffect(() => {
    localStorage.setItem("edupulse_discussions", JSON.stringify(discussions));
  }, [discussions]);
  useEffect(() => {
    localStorage.setItem("edupulse_certificates", JSON.stringify(certificates));
  }, [certificates]);
  useEffect(() => {
    localStorage.setItem("edupulse_payments", JSON.stringify(payments));
  }, [payments]);

  // Fetch courses from MongoDB on mount
  // For students and public visitors: MongoDB approved courses are the authoritative source of truth.
  // We do NOT merge pending/draft/rejected localStorage courses into public/student view.
  const fetchMongoCourses = async () => {
    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      // If teacher/admin, request all courses so they see their drafts & pending
      const isTeacherOrAdmin = currentUser?.role === "teacher" || currentUser?.role === "admin";
      const url = isTeacherOrAdmin
        ? "/api/courses?all=true"
        : "/api/courses";

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
          const mongoCourses: Course[] = data.courses;
          setCourses((prev) => {
            const mongoIds = new Set(mongoCourses.map((c) => c._id));
            if (!isTeacherOrAdmin) {
              // Public / Student: MongoDB approved courses are the ONLY source of truth.
              // Strictly exclude any pending/rejected courses that might linger in localStorage.
              const validPrev = prev.filter((c) => !mongoIds.has(c._id) && c.status === "approved");
              return [...mongoCourses, ...validPrev];
            } else {
              // Teacher / Admin: Keep non-conflicting courses while giving MongoDB priority
              const remainingPrev = prev.filter((c) => !mongoIds.has(c._id));
              return [...mongoCourses, ...remainingPrev];
            }
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch courses from backend API:", err);
    }
  };

  useEffect(() => {
    fetchMongoCourses();
  }, [currentUser]);

  const getCourseById = (courseId: string) => {
    return courses.find((c) => c._id === courseId);
  };

  const approveCourse = async (courseId: string) => {
    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/courses/${courseId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "approved" }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        // Update frontend state ONLY after backend successfully persists to MongoDB
        setCourses((prev) =>
          prev.map((c) => (c._id === courseId ? { ...c, status: "approved" as const, rejectionReason: "" } : c))
        );
        return {
          success: true,
          course: data.course,
          message: data.message || "Course approved successfully.",
        };
      } else {
        const errorMsg = data.message || `Approval failed with status ${res.status}.`;
        console.error("Backend course approval failed:", errorMsg);
        return {
          success: false,
          message: errorMsg,
        };
      }
    } catch (err: any) {
      console.error("Error approving course on backend:", err);
      return {
        success: false,
        message: err.message || "Network error. Failed to reach course approval service.",
      };
    }
  };

  const rejectCourse = async (courseId: string, reason: string = "Course content requires revisions.") => {
    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/courses/${courseId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "rejected", rejectionReason: reason }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        // Update frontend state ONLY after backend successfully persists to MongoDB
        setCourses((prev) =>
          prev.map((c) =>
            c._id === courseId
              ? { ...c, status: "rejected" as const, rejectionReason: reason }
              : c
          )
        );
        return {
          success: true,
          course: data.course,
          message: data.message || "Course rejected.",
        };
      } else {
        const errorMsg = data.message || `Rejection failed with status ${res.status}.`;
        console.error("Backend course rejection failed:", errorMsg);
        return {
          success: false,
          message: errorMsg,
        };
      }
    } catch (err: any) {
      console.error("Error rejecting course on backend:", err);
      return {
        success: false,
        message: err.message || "Network error. Failed to reach course rejection service.",
      };
    }
  };

  const createCourse = async (newCourse: Partial<Course>) => {
    // 1. Send authoritative creation request to MongoDB backend
    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/courses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: newCourse.title || "Untitled Course",
          subtitle: newCourse.subtitle || "",
          description: newCourse.description || "",
          category: newCourse.category || "Web Development",
          level: newCourse.level || "Beginner",
          thumbnail: newCourse.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
          price: newCourse.price ?? 999,
          originalPrice: (newCourse.price ?? 999) * 2,
          requirements: newCourse.requirements,
          learningOutcomes: newCourse.learningOutcomes,
          sections: newCourse.sections,
          language: newCourse.language || "English",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.course) {
          const createdMongoCourse: Course = data.course;
          setCourses((prev) => [createdMongoCourse, ...prev.filter((c) => c._id !== createdMongoCourse._id)]);
          return { success: true, course: createdMongoCourse, message: data.message };
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn("MongoDB course creation returned error:", errorData.message);
        return { success: false, message: errorData.message || "Failed to create course in MongoDB." };
      }
    } catch (err: any) {
      console.warn("Network error during /api/courses POST:", err);
      return { success: false, message: err.message || "Network error while connecting to server." };
    }

    // 2. Fallback local state creation if offline or demo mode
    const courseId = `course_${Date.now()}`;
    const course: Course = {
      _id: courseId,
      title: newCourse.title || "Untitled Course",
      subtitle: newCourse.subtitle || "",
      description: newCourse.description || "",
      instructorId: currentUser?._id || "usr_teacher_1",
      instructorName: currentUser?.name || "Dr. Priya Patel",
      instructorAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
      instructorTitle: currentUser?.bio?.slice(0, 40) || "Instructor",
      category: newCourse.category || "Web Development",
      level: newCourse.level || "Beginner",
      thumbnail: newCourse.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
      price: newCourse.price ?? 999,
      originalPrice: (newCourse.price ?? 999) * 2,
      status: "pending", // Requires admin approval workflow
      rating: 0,
      ratingsCount: 0,
      studentsEnrolled: 0,
      language: "English",
      updatedAt: new Date().toISOString().split("T")[0],
      requirements: newCourse.requirements || ["Basic computer literacy"],
      learningOutcomes: newCourse.learningOutcomes || ["Build end-to-end applications"],
      sections: newCourse.sections || [
        {
          _id: `sec_${Date.now()}_1`,
          courseId,
          title: "Section 1: Course Kickoff",
          order: 1,
          lectures: [
            {
              _id: `lec_${Date.now()}_1_1`,
              sectionId: `sec_${Date.now()}_1`,
              title: "1. Overview & Setup",
              durationMinutes: 10,
              videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
              s3Key: `courses/${courseId}/01-intro.mp4`,
              isPreviewFree: true,
              resources: [],
            },
          ],
        },
      ],
    };

    setCourses((prev) => [course, ...prev]);
    return { success: true, course, message: "Course created locally." };
  };

  const addCourse = createCourse;

  const addSectionToCourse = (courseId: string, title: string): Section => {
    const sectionId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newSection: Section = {
      _id: sectionId,
      courseId,
      title: title || "New Section",
      order: 1,
      lectures: [],
    };

    setCourses((prev) =>
      prev.map((c) => {
        if (c._id !== courseId) return c;
        const currentSections = c.sections || [];
        newSection = {
          ...newSection,
          order: currentSections.length + 1,
        };
        return {
          ...c,
          sections: [...currentSections, newSection],
        };
      })
    );

    return newSection;
  };

  const addLectureToSection = (
    courseId: string,
    sectionId: string,
    lectureData: Partial<Lecture>
  ): Lecture => {
    const newLecture: Lecture = {
      _id: `lec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sectionId,
      title: lectureData.title || "Untitled Lecture",
      durationMinutes: lectureData.durationMinutes || 15,
      videoUrl:
        lectureData.videoUrl ||
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      s3Key:
        lectureData.s3Key ||
        `courses/${courseId}/lectures/${Date.now()}.mp4`,
      isPreviewFree: lectureData.isPreviewFree ?? false,
      resources: lectureData.resources || [],
      description: lectureData.description || "",
    };

    setCourses((prev) =>
      prev.map((c) => {
        if (c._id !== courseId) return c;
        return {
          ...c,
          sections: c.sections.map((sec) => {
            if (sec._id !== sectionId) return sec;
            return {
              ...sec,
              lectures: [...sec.lectures, newLecture],
            };
          }),
        };
      })
    );

    return newLecture;
  };

  const saveCourseCurriculum = async (
    courseId: string,
    sections: Section[]
  ): Promise<{ success: boolean; course?: Course; message?: string }> => {
    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/courses/${courseId}/curriculum`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ sections }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.course) {
        const updatedCourse = data.course;
        setCourses((prev) =>
          prev.map((c) => (c._id === courseId ? { ...c, ...updatedCourse } : c))
        );
        return { success: true, course: updatedCourse, message: data.message };
      } else {
        // Fallback: update local state so user experience is not completely blocked
        setCourses((prev) =>
          prev.map((c) => (c._id === courseId ? { ...c, sections } : c))
        );
        return {
          success: res.ok,
          message: data.message || "Failed to update curriculum on backend.",
        };
      }
    } catch (err: any) {
      console.warn("Curriculum update error:", err);
      // Fallback local update
      setCourses((prev) =>
        prev.map((c) => (c._id === courseId ? { ...c, sections } : c))
      );
      return { success: true, message: "Curriculum saved locally." };
    }
  };

  const getEnrollmentForCourse = (courseId: string) => {
    if (!currentUser) return undefined;
    return enrollments.find(
      (e) => e.courseId === courseId && e.studentId === currentUser._id
    );
  };

  const isEnrolled = (courseId: string) => {
    return Boolean(getEnrollmentForCourse(courseId));
  };

  const enrollInCourse = (
    courseId: string,
    paymentDetails?: { razorpayOrderId: string; razorpayPaymentId: string; amount: number }
  ) => {
    if (!currentUser) return;
    const course = getCourseById(courseId);
    if (!course) return;

    const existing = getEnrollmentForCourse(courseId);
    if (existing) return;

    const paymentId = paymentDetails?.razorpayPaymentId || `pay_sim_${Date.now()}`;

    // Record Payment
    if (paymentDetails) {
      const newPayment: PaymentTransaction = {
        _id: `pay_${Date.now()}`,
        studentId: currentUser._id,
        studentName: currentUser.name,
        courseId,
        courseTitle: course.title,
        amount: paymentDetails.amount,
        currency: "INR",
        razorpayOrderId: paymentDetails.razorpayOrderId,
        razorpayPaymentId: paymentDetails.razorpayPaymentId,
        status: "captured",
        createdAt: new Date().toISOString(),
      };
      setPayments((prev) => [newPayment, ...prev]);
    }

    // First lecture
    const firstLectureId = course.sections[0]?.lectures[0]?._id;

    const newEnrollment: Enrollment = {
      _id: `enr_${Date.now()}`,
      studentId: currentUser._id,
      courseId,
      progressPercent: 0,
      completedLectures: [],
      lastWatchedLectureId: firstLectureId,
      lastWatchedPositionSeconds: 0,
      paymentId,
      enrolledAt: new Date().toISOString(),
      certificateIssued: false,
    };

    setEnrollments((prev) => [...prev, newEnrollment]);

    // Update course enrolled count
    setCourses((prev) =>
      prev.map((c) =>
        c._id === courseId ? { ...c, studentsEnrolled: c.studentsEnrolled + 1 } : c
      )
    );
  };

  const markLectureComplete = (courseId: string, lectureId: string) => {
    if (!currentUser) return;
    const course = getCourseById(courseId);
    if (!course) return;

    const totalLectures = course.sections.flatMap((s) => s.lectures);
    const totalCount = totalLectures.length || 1;

    setEnrollments((prev) =>
      prev.map((e) => {
        if (e.courseId !== courseId || e.studentId !== currentUser._id) return e;

        const completedSet = new Set(e.completedLectures);
        completedSet.add(lectureId);
        const completedArray = Array.from(completedSet);
        const newPercent = Math.round((completedArray.length / totalCount) * 100);

        return {
          ...e,
          completedLectures: completedArray,
          progressPercent: newPercent,
          lastWatchedLectureId: lectureId,
        };
      })
    );
  };

  const saveVideoProgress = (courseId: string, lectureId: string, seconds: number) => {
    if (!currentUser) return;
    setEnrollments((prev) =>
      prev.map((e) => {
        if (e.courseId !== courseId || e.studentId !== currentUser._id) return e;
        return {
          ...e,
          lastWatchedLectureId: lectureId,
          lastWatchedPositionSeconds: Math.round(seconds),
        };
      })
    );
  };

  const getQuizForCourse = (courseId: string) => {
    return quizzes.find((q) => q.courseId === courseId);
  };

  const submitQuizAttempt = (
    courseId: string,
    quizId: string,
    selectedAnswers: { questionId: string; answer: string | number }[]
  ): QuizAttempt => {
    const quiz = quizzes.find((q) => q._id === quizId);
    if (!quiz) throw new Error("Quiz not found");

    let earnedPoints = 0;
    let totalPoints = 0;

    const evaluatedAnswers = selectedAnswers.map((sel) => {
      const q = quiz.questions.find((quest) => quest._id === sel.questionId);
      totalPoints += q?.points || 25;
      const isCorrect = q ? String(q.correctAnswer) === String(sel.answer) : false;
      if (isCorrect) {
        earnedPoints += q?.points || 25;
      }
      return {
        questionId: sel.questionId,
        selectedAnswer: sel.answer,
        isCorrect,
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= quiz.passingScore;

    const attempt: QuizAttempt = {
      _id: `attempt_${Date.now()}`,
      studentId: currentUser?._id || "usr_student_1",
      quizId,
      courseId,
      score,
      passed,
      answers: evaluatedAnswers,
      attemptedAt: new Date().toISOString(),
    };

    setQuizAttempts((prev) => [attempt, ...prev]);

    // Check certificate qualification
    const enrollment = getEnrollmentForCourse(courseId);
    if (enrollment && enrollment.progressPercent === 100 && passed) {
      generateCertificate(courseId);
    }

    return attempt;
  };

  const getAttemptsForQuiz = (quizId: string) => {
    if (!currentUser) return [];
    return quizAttempts.filter(
      (a) => a.quizId === quizId && a.studentId === currentUser._id
    );
  };

  const getCertificateForCourse = (courseId: string) => {
    if (!currentUser) return undefined;
    return certificates.find(
      (c) => c.courseId === courseId && c.studentId === currentUser._id
    );
  };

  const generateCertificate = (courseId: string): Certificate | null => {
    if (!currentUser) return null;
    const course = getCourseById(courseId);
    if (!course) return null;

    const existing = getCertificateForCourse(courseId);
    if (existing) return existing;

    const verificationId = `EDUPULSE-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newCert: Certificate = {
      _id: `cert_${Date.now()}`,
      verificationId,
      studentId: currentUser._id,
      studentName: currentUser.name,
      courseId,
      courseTitle: course.title,
      instructorName: course.instructorName,
      issuedAt: new Date().toISOString().split("T")[0],
      gradeAchieved: 95,
    };

    setCertificates((prev) => [newCert, ...prev]);

    // Update enrollment status
    setEnrollments((prev) =>
      prev.map((e) =>
        e.courseId === courseId && e.studentId === currentUser._id
          ? { ...e, certificateIssued: true, certificateId: newCert._id }
          : e
      )
    );

    return newCert;
  };

  const getCourseDiscussions = (courseId: string) => {
    return discussions.filter((d) => d.courseId === courseId);
  };

  const addDiscussionThread = (
    courseId: string,
    lectureId: string | undefined,
    title: string,
    question: string
  ) => {
    if (!currentUser) return;
    const newThread: DiscussionThread = {
      _id: `disc_${Date.now()}`,
      courseId,
      lectureId,
      studentId: currentUser._id,
      studentName: currentUser.name,
      studentAvatar: currentUser.avatar,
      title,
      question,
      createdAt: new Date().toISOString(),
      replies: [],
      upvotes: 1,
      isResolved: false,
    };
    setDiscussions((prev) => [newThread, ...prev]);
  };

  const addDiscussionReply = (threadId: string, content: string) => {
    if (!currentUser) return;
    setDiscussions((prev) =>
      prev.map((d) => {
        if (d._id !== threadId) return d;
        const newReply = {
          _id: `rep_${Date.now()}`,
          authorId: currentUser._id,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          authorAvatar: currentUser.avatar,
          content,
          createdAt: new Date().toISOString(),
          upvotes: 0,
          isInstructorResponse: currentUser.role === "teacher",
        };
        return {
          ...d,
          replies: [...d.replies, newReply],
        };
      })
    );
  };

  const toggleUpvoteDiscussion = (threadId: string) => {
    setDiscussions((prev) =>
      prev.map((d) => (d._id === threadId ? { ...d, upvotes: d.upvotes + 1 } : d))
    );
  };

  const toggleResolveDiscussion = (threadId: string) => {
    setDiscussions((prev) =>
      prev.map((d) => (d._id === threadId ? { ...d, isResolved: !d.isResolved } : d))
    );
  };

  const submitAssignment = (assignmentId: string, text: string) => {
    if (!currentUser) return;
    setAssignments((prev) =>
      prev.map((a) => {
        if (a._id !== assignmentId) return a;
        const newSub = {
          _id: `sub_${Date.now()}`,
          assignmentId,
          studentId: currentUser._id,
          studentName: currentUser.name,
          submissionText: text,
          submittedAt: new Date().toISOString(),
          status: "submitted" as const,
        };
        return {
          ...a,
          submissions: [...a.submissions.filter((s) => s.studentId !== currentUser._id), newSub],
        };
      })
    );
  };

  const gradeAssignmentSubmission = (
    assignmentId: string,
    submissionId: string,
    grade: number,
    feedback: string
  ) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a._id !== assignmentId) return a;
        return {
          ...a,
          submissions: a.submissions.map((s) =>
            s._id === submissionId
              ? { ...s, grade, feedback, status: "graded" as const }
              : s
          ),
        };
      })
    );
  };

  const refundPayment = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((p) => (p._id === paymentId ? { ...p, status: "refunded" as const } : p))
    );
  };

  const processRefund = refundPayment;

  return (
    <LmsContext.Provider
      value={{
        courses,
        enrollments,
        quizzes,
        quizAttempts,
        assignments,
        discussions,
        certificates,
        payments,
        getCourseById,
        approveCourse,
        rejectCourse,
        createCourse,
        addCourse,
        addSectionToCourse,
        addLectureToSection,
        saveCourseCurriculum,
        getEnrollmentForCourse,
        isEnrolled,
        enrollInCourse,
        markLectureComplete,
        saveVideoProgress,
        getQuizForCourse,
        submitQuizAttempt,
        getAttemptsForQuiz,
        getCertificateForCourse,
        generateCertificate,
        getCourseDiscussions,
        addDiscussionThread,
        addDiscussionReply,
        toggleUpvoteDiscussion,
        toggleResolveDiscussion,
        submitAssignment,
        gradeAssignmentSubmission,
        refundPayment,
        processRefund,
      }}
    >
      {children}
    </LmsContext.Provider>
  );
};

export const useLms = () => {
  const context = useContext(LmsContext);
  if (!context) {
    throw new Error("useLms must be used within an LmsProvider");
  }
  return context;
};
