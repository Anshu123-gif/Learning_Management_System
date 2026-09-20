import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayment {
  paymentId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  courseId: string;
  courseTitle: string;
  amount: number; // in Rupees
  amountPaise: number; // in Paise
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  status: "captured" | "failed" | "refunded";
  emailNotificationSent?: boolean;
  emailSentAt?: Date;
  emailSendingLockedAt?: Date;
  emailSendError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IPaymentDocument extends IPayment, Document {}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    paymentId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, default: "" },
    courseId: { type: String, required: true, index: true },
    courseTitle: { type: String, required: true },
    amount: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, required: true, unique: true, index: true },
    razorpaySignature: { type: String, required: true },
    status: { type: String, enum: ["captured", "failed", "refunded"], default: "captured" },
    emailNotificationSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    emailSendingLockedAt: { type: Date },
    emailSendError: { type: String },
  },
  {
    timestamps: true,
  }
);

export const MongoPayment: Model<IPaymentDocument> =
  mongoose.models.Payment || mongoose.model<IPaymentDocument>("Payment", PaymentSchema);
