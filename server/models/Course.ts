import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICourse {
  courseId: string;
  title: string;
  subtitle?: string;
  description?: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  instructorTitle?: string;
  category?: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  thumbnail?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  price: number;
  originalPrice?: number;
  status: "draft" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  rating?: number;
  ratingsCount?: number;
  studentsEnrolled?: number;
  language?: string;
  requirements?: string[];
  learningOutcomes?: string[];
  sections?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ICourseDocument extends ICourse, Document {}

const CourseSchema = new Schema<ICourseDocument>(
  {
    courseId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    instructorId: { type: String, required: true, index: true },
    instructorName: { type: String, required: true, trim: true },
    instructorAvatar: {
      type: String,
      default: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    },
    instructorTitle: { type: String, default: "Instructor" },
    category: { type: String, default: "Web Development" },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "All Levels"],
      default: "Beginner",
    },
    thumbnail: {
      type: String,
      default: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    thumbnailPublicId: {
      type: String,
      default: "",
    },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    studentsEnrolled: { type: Number, default: 0 },
    language: { type: String, default: "English" },
    requirements: { type: [String], default: ["Basic computer literacy"] },
    learningOutcomes: { type: [String], default: ["Build end-to-end applications"] },
    sections: { type: [Schema.Types.Mixed as any], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret._id = ret.courseId || ret._id;
        ret.thumbnailUrl = ret.thumbnailUrl || ret.thumbnail;
        ret.thumbnail = ret.thumbnail || ret.thumbnailUrl;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret._id = ret.courseId || ret._id;
        ret.thumbnailUrl = ret.thumbnailUrl || ret.thumbnail;
        ret.thumbnail = ret.thumbnail || ret.thumbnailUrl;
        return ret;
      },
    },
  }
);

export const MongoCourse: Model<ICourseDocument> =
  mongoose.models.Course || mongoose.model<ICourseDocument>("Course", CourseSchema);
