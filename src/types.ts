export type UserRole = "student" | "teacher" | "admin";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  bio?: string;
  enrolledCourses: string[]; // Course IDs
  wishlist: string[];
  earnings?: number; // For teachers
  phone?: string;
  createdAt: string;
}

export interface Resource {
  title: string;
  url: string;
  fileType: "pdf" | "zip" | "doc" | "code";
  sizeMb: number;
}

export interface Lecture {
  _id: string;
  sectionId: string;
  title: string;
  durationMinutes: number;
  videoUrl: string; // S3 Key or signed URL
  s3Key: string;
  isPreviewFree: boolean;
  resources: Resource[];
  description?: string;
}

export interface Section {
  _id: string;
  courseId: string;
  title: string;
  order: number;
  lectures: Lecture[];
}

export type CourseStatus = "draft" | "pending" | "approved" | "rejected";
export type CourseLevel = "Beginner" | "Intermediate" | "Advanced" | "All Levels";

export interface Course {
  _id: string;
  title: string;
  subtitle: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar: string;
  instructorTitle: string;
  category: string;
  level: CourseLevel;
  thumbnail: string;
  price: number;
  originalPrice: number;
  status: CourseStatus;
  rejectionReason?: string;
  rating: number;
  ratingsCount: number;
  studentsEnrolled: number;
  sections: Section[];
  requirements: string[];
  learningOutcomes: string[];
  language: string;
  updatedAt: string;
}

export interface QuizQuestion {
  _id: string;
  questionText: string;
  questionType: "mcq" | "true_false" | "short_answer";
  options?: string[]; // for mcq
  correctAnswer: string | number; // index or boolean string
  explanation?: string;
  points: number;
}

export interface Quiz {
  _id: string;
  courseId: string;
  lectureId?: string;
  title: string;
  description: string;
  passingScore: number; // percentage e.g. 60
  durationMinutes: number;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  _id: string;
  studentId: string;
  quizId: string;
  courseId: string;
  score: number; // percentage
  passed: boolean;
  answers: {
    questionId: string;
    selectedAnswer: string | number;
    isCorrect: boolean;
  }[];
  attemptedAt: string;
}

export interface AssignmentSubmission {
  _id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submissionText?: string;
  fileUrl?: string;
  grade?: number; // 0 - 100
  feedback?: string;
  submittedAt: string;
  status: "submitted" | "graded";
}

export interface Assignment {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  submissions: AssignmentSubmission[];
}

export interface Enrollment {
  _id: string;
  studentId: string;
  courseId: string;
  progressPercent: number;
  completedLectures: string[]; // Lecture IDs
  lastWatchedLectureId?: string;
  lastWatchedPositionSeconds?: number;
  paymentId: string;
  enrolledAt: string;
  certificateIssued: boolean;
  certificateId?: string;
}

export interface Certificate {
  _id: string;
  verificationId: string; // e.g. EDUPULSE-2026-98172
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
  gradeAchieved: number;
  certificateUrl?: string;
}

export interface ForumReply {
  _id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  content: string;
  createdAt: string;
  upvotes: number;
  isInstructorResponse?: boolean;
}

export interface DiscussionThread {
  _id: string;
  courseId: string;
  lectureId?: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  title: string;
  question: string;
  createdAt: string;
  replies: ForumReply[];
  upvotes: number;
  isResolved: boolean;
}

export interface PaymentTransaction {
  _id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  status: "captured" | "failed" | "refunded";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  source?: string;
}

// Razorpay SDK Type Declarations
export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentFailureResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayPaymentSuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayPaymentFailureResponse) => void) => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

