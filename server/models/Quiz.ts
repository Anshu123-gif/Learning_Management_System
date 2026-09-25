import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQuizQuestion {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface IQuiz {
  quizId: string;
  courseId: string;
  sectionId: string;
  title: string;
  description?: string;
  questions: IQuizQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IQuizDocument extends IQuiz, Document {}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    questionId: { type: String, required: true },
    question: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length === 4,
        message: "Question must have exactly 4 options.",
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false }
);

const QuizSchema = new Schema<IQuizDocument>(
  {
    quizId: { type: String, required: true, unique: true, index: true },
    courseId: { type: String, required: true, index: true },
    sectionId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    questions: {
      type: [QuizQuestionSchema],
      required: true,
      validate: {
        validator: (v: any[]) => Array.isArray(v) && v.length > 0,
        message: "Quiz must have at least one question.",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret._id = ret.quizId || ret._id;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret._id = ret.quizId || ret._id;
        return ret;
      },
    },
  }
);

export const MongoQuiz: Model<IQuizDocument> =
  mongoose.models.Quiz || mongoose.model<IQuizDocument>("Quiz", QuizSchema);
