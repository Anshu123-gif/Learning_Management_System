import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEnrollment {
  enrollmentId: string;
  studentId: string;
  studentEmail?: string;
  courseId: string;
  courseTitle: string;
  progressPercent: number;
  completedLectures: string[];
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  enrolledAt: string;
  certificateIssued: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IEnrollmentDocument extends IEnrollment, Document {}

const EnrollmentSchema = new Schema<IEnrollmentDocument>(
  {
    enrollmentId: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    studentEmail: { type: String, default: "" },
    courseId: { type: String, required: true, index: true },
    courseTitle: { type: String, required: true },
    progressPercent: { type: Number, default: 0 },
    completedLectures: { type: [String], default: [] },
    paymentId: { type: String, required: true },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, required: true, unique: true, index: true },
    enrolledAt: { type: String, default: () => new Date().toISOString() },
    certificateIssued: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound index so a student cannot have duplicate enrollments for the same course in MongoDB
EnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const MongoEnrollment: Model<IEnrollmentDocument> =
  mongoose.models.Enrollment || mongoose.model<IEnrollmentDocument>("Enrollment", EnrollmentSchema);
