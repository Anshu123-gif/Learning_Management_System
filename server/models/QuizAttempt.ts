import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQuizAttempt {
  attemptId: string;
  studentId: string;
  courseId: string;
  quizId: string;
  answers: Record<string, number>;
  score: number;
  totalMarks: number;
  percentage: number;
  completed: boolean;
  attemptedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IQuizAttemptDocument extends IQuizAttempt, Document {}

const QuizAttemptSchema = new Schema<IQuizAttemptDocument>(
  {
    attemptId: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    quizId: { type: String, required: true, index: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    score: { type: Number, required: true, default: 0 },
    totalMarks: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, default: true },
    attemptedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret._id = ret.attemptId || ret._id;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret._id = ret.attemptId || ret._id;
        return ret;
      },
    },
  }
);

// Compound index for fast lookup of student attempts per quiz
QuizAttemptSchema.index({ studentId: 1, quizId: 1 });

export const MongoQuizAttempt: Model<IQuizAttemptDocument> =
  mongoose.models.QuizAttempt ||
  mongoose.model<IQuizAttemptDocument>("QuizAttempt", QuizAttemptSchema);
