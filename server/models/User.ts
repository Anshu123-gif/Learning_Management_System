import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
  userId: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: "student" | "teacher" | "admin";
  avatar: string;
  bio?: string;
  enrolledCourses: string[];
  wishlist: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    role: { type: String, enum: ["student", "teacher", "admin"], default: "student" },
    avatar: { type: String, default: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80" },
    bio: { type: String, default: "Student at Sheryians Coding School" },
    enrolledCourses: { type: [String], default: [] },
    wishlist: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

// Method to verify candidate password against stored bcrypt hash
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  // Check if password was hashed with bcrypt
  if (this.password.startsWith("$2a$") || this.password.startsWith("$2b$")) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Plaintext match fallback for pre-existing legacy entries
  return this.password === candidatePassword;
};

export const MongoUser: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);
