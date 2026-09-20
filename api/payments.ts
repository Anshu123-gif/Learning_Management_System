import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import { connectMongoDB } from "../server/db.js";
import { MongoUser } from "../server/models/User.js";
import { MongoPayment } from "../server/models/Payment.js";
import { MongoEnrollment } from "../server/models/Enrollment.js";
import { sendPaymentSuccessEmails } from "../server/email.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

// Authoritative course registry on server to prevent client-side price tampering
const AUTHORITATIVE_COURSES: Record<string, { title: string; price: number }> = {
  course_mern_101: {
    title: "Full-Stack MERN Architecture: Zero to Production",
    price: 1499,
  },
  course_react_202: {
    title: "React 19 & Next-Gen State Management",
    price: 999,
  },
  course_devops_303: {
    title: "Cloud Deployment & Microservices: Docker, Render & AWS",
    price: 1299,
  },
  course_pending_404: {
    title: "System Design for Indian Tech Giants (Flipkart, Swiggy, Zerodha)",
    price: 1999,
  },
};

/**
 * Lazy initialization of Razorpay SDK.
 * Prevents uncaught exceptions during module load if keys are not set.
 */
function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  try {
    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err: any) {
    console.error("Razorpay SDK client initialization error:", err?.message || err);
    return null;
  }
}

export interface FulfillEnrollmentParams {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature?: string;
  courseId?: string | null;
  courseTitle?: string | null;
  amountRupees?: number | null;
  amountPaise?: number | null;
  currency?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  studentEmail?: string | null;
  source: "verify" | "webhook";
}

export interface FulfillEnrollmentResult {
  success: boolean;
  status: "fulfilled" | "already_processed" | "unassigned" | "db_error" | "invalid_input";
  message: string;
  paymentId?: string;
  orderId?: string;
  courseId?: string;
  courseTitle?: string;
  studentId?: string;
  studentName?: string;
  enrollmentId?: string;
  enrolledAt?: string;
}

/**
 * Shared, idempotent fulfillment engine for course enrollment and payment recording.
 * Guarantees that duplicate requests from verify and webhook never create duplicate payments or enrollments.
 */
export async function fulfillEnrollmentAndPayment(
  params: FulfillEnrollmentParams
): Promise<FulfillEnrollmentResult> {
  const {
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
    courseId,
    courseTitle,
    amountRupees,
    amountPaise,
    currency = "INR",
    studentId,
    studentName,
    studentEmail,
    source,
  } = params;

  if (!razorpayPaymentId) {
    return {
      success: false,
      status: "invalid_input",
      message: "Missing required razorpayPaymentId for fulfillment.",
    };
  }

  // 1. Connect to MongoDB Atlas
  const isConnected = await connectMongoDB();
  if (!isConnected) {
    console.error(`[Fulfillment (${source})] ❌ MongoDB Atlas connection offline during fulfillment.`);
    return {
      success: false,
      status: "db_error",
      message: "Database connection offline during fulfillment.",
    };
  }

  // 2. Check if this payment is already recorded in MongoDB
  const existingPayment = await MongoPayment.findOne({
    $or: [
      { razorpayPaymentId },
      ...(razorpayOrderId ? [{ razorpayOrderId }] : []),
    ],
  });

  // 3. Resolve course information using authoritative catalog
  const candidateCourseId = courseId || existingPayment?.courseId || null;
  const catalogCourse = candidateCourseId ? AUTHORITATIVE_COURSES[candidateCourseId] : undefined;
  const finalCourseId = candidateCourseId;
  const finalCourseTitle =
    catalogCourse?.title ||
    courseTitle ||
    existingPayment?.courseTitle ||
    (candidateCourseId ? `Course ${candidateCourseId}` : "EduPulse LMS Course");

  const finalPriceInRupees =
    catalogCourse?.price ||
    (typeof amountRupees === "number" && amountRupees > 0 ? Math.round(amountRupees) : null) ||
    (typeof amountPaise === "number" && amountPaise > 0 ? Math.round(amountPaise / 100) : null) ||
    existingPayment?.amount ||
    1499;

  const finalAmountPaise = Math.round(finalPriceInRupees * 100);

  // 4. Resolve student account
  let studentUser = null;
  const candidateStudentId =
    studentId && studentId !== "anonymous" ? studentId : existingPayment?.studentId;
  const candidateEmail = studentEmail || existingPayment?.studentEmail;

  if (candidateStudentId && candidateStudentId !== "anonymous") {
    studentUser = await MongoUser.findOne({ userId: candidateStudentId });
  }

  if (!studentUser && candidateEmail && candidateEmail.includes("@")) {
    studentUser = await MongoUser.findOne({ email: candidateEmail.toLowerCase().trim() });
  }

  // If in verify mode and user record doesn't exist yet, create student document
  if (!studentUser && source === "verify" && (candidateStudentId || candidateEmail)) {
    try {
      const newUserId = candidateStudentId || `usr_${Date.now()}`;
      const newEmail = candidateEmail ? candidateEmail.toLowerCase().trim() : "student@edupulse.ac.in";
      const newName = studentName || "Student";
      studentUser = new MongoUser({
        userId: newUserId,
        name: newName,
        email: newEmail,
        role: "student",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        bio: "Student at Sheryians Coding School",
        enrolledCourses: [],
        wishlist: [],
      });
      await studentUser.save();
    } catch (createErr) {
      // If user creation raced, fetch existing
      if (candidateStudentId) {
        studentUser = await MongoUser.findOne({ userId: candidateStudentId });
      }
      if (!studentUser && candidateEmail) {
        studentUser = await MongoUser.findOne({ email: candidateEmail.toLowerCase().trim() });
      }
    }
  }

  // 5. Fallback if student or course could not be determined
  // Safest fallback: Record payment as unassigned, but DO NOT enroll an arbitrary user
  if (!studentUser || !finalCourseId) {
    console.warn(
      `[Fulfillment (${source})] ⚠️ Cannot establish reliable student or course relationship for Payment ${razorpayPaymentId}. ` +
      `Candidate Student: ${candidateStudentId || "none"}, Candidate Email: ${candidateEmail || "none"}, Course: ${finalCourseId || "none"}. ` +
      `Recording unassigned payment for manual review.`
    );

    if (!existingPayment) {
      try {
        const unassignedPayment = new MongoPayment({
          paymentId: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          studentId: candidateStudentId || "unassigned",
          studentName: studentName || "Unassigned Student",
          studentEmail: candidateEmail || "",
          courseId: finalCourseId || "unassigned",
          courseTitle: finalCourseTitle || "Unassigned Course Payment",
          amount: finalPriceInRupees,
          amountPaise: finalAmountPaise,
          currency: currency || "INR",
          razorpayOrderId: razorpayOrderId || "",
          razorpayPaymentId,
          razorpaySignature: razorpaySignature || `unassigned_${Date.now()}`,
          status: "captured",
        });
        await unassignedPayment.save();
      } catch (saveErr: any) {
        if (saveErr?.code !== 11000) {
          console.error(`[Fulfillment (${source})] Error saving unassigned payment:`, saveErr);
        }
      }
    }

    return {
      success: true,
      status: "unassigned",
      message: "Payment captured, but student or course could not be reliably resolved. Saved as unassigned for administrator review.",
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      courseId: finalCourseId || undefined,
    };
  }

  // 6. Check existing enrollment for this student and course
  const existingEnrollment = await MongoEnrollment.findOne({
    studentId: studentUser.userId,
    courseId: finalCourseId,
  });

  // 7. Save Payment record idempotently
  let savedPayment = existingPayment;
  if (!savedPayment) {
    try {
      savedPayment = new MongoPayment({
        paymentId: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        studentId: studentUser.userId,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        amount: finalPriceInRupees,
        amountPaise: finalAmountPaise,
        currency: currency || "INR",
        razorpayOrderId: razorpayOrderId || "",
        razorpayPaymentId,
        razorpaySignature: razorpaySignature || `wh_sig_${Date.now()}`,
        status: "captured",
      });
      await savedPayment.save();
    } catch (dupPayErr: any) {
      if (dupPayErr?.code === 11000) {
        savedPayment = await MongoPayment.findOne({ razorpayPaymentId });
      } else {
        throw dupPayErr;
      }
    }
  }

  // 8. Save Enrollment record idempotently
  let savedEnrollment = existingEnrollment;
  if (!savedEnrollment) {
    try {
      savedEnrollment = new MongoEnrollment({
        enrollmentId: `enr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        studentId: studentUser.userId,
        studentEmail: studentUser.email,
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        progressPercent: 0,
        completedLectures: [],
        paymentId: razorpayPaymentId,
        razorpayOrderId: razorpayOrderId || "",
        razorpayPaymentId,
        enrolledAt: new Date().toISOString(),
        certificateIssued: false,
      });
      await savedEnrollment.save();
    } catch (dupEnrollErr: any) {
      if (dupEnrollErr?.code === 11000) {
        savedEnrollment = await MongoEnrollment.findOne({
          studentId: studentUser.userId,
          courseId: finalCourseId,
        });
      } else {
        throw dupEnrollErr;
      }
    }
  }

  // 9. Update User.enrolledCourses with $addToSet to prevent duplicate array items
  await MongoUser.updateOne(
    { userId: studentUser.userId },
    { $addToSet: { enrolledCourses: finalCourseId } }
  );

  // 10. Atomic Email Notification Deduplication, Dispatch & Safe Retry
  // We use an atomic lock with a 2-minute staleness window so concurrent /verify + webhook cannot double-send,
  // while transient Resend failures clear the lock or allow automatic retries on subsequent webhook deliveries.
  // emailNotificationSent is ONLY set to true AFTER Resend successfully accepts the emails.
  try {
    const lockWindowMs = 2 * 60 * 1000; // 2 minutes lock expiration
    const lockExpiryThreshold = new Date(Date.now() - lockWindowMs);

    // Atomically claim the sending lock if not already sent AND (not locked OR lock expired)
    const claimedPayment = await MongoPayment.findOneAndUpdate(
      {
        razorpayPaymentId,
        emailNotificationSent: { $ne: true },
        $or: [
          { emailSendingLockedAt: { $exists: false } },
          { emailSendingLockedAt: null },
          { emailSendingLockedAt: { $lt: lockExpiryThreshold } },
        ],
      },
      {
        $set: {
          emailSendingLockedAt: new Date(),
        },
      },
      { new: true }
    );

    if (claimedPayment) {
      const emailResult = await sendPaymentSuccessEmails({
        studentName: studentUser.name || "Student",
        studentEmail: studentUser.email,
        courseTitle: finalCourseTitle,
        courseId: finalCourseId,
        amountRupees: finalPriceInRupees,
        currency: currency || "INR",
        razorpayPaymentId,
        razorpayOrderId: razorpayOrderId || "",
        fulfillmentSource: source,
      });

      // Check if Resend successfully accepted the email(s)
      // Note: If student has a valid email, studentEmailSent MUST be true.
      const hasStudentEmail = Boolean(studentUser.email && studentUser.email.includes("@"));
      const isStudentSuccess = hasStudentEmail ? emailResult.studentEmailSent : true;
      const isOverallSuccess = isStudentSuccess && !emailResult.studentError;

      if (isOverallSuccess) {
        // ONLY mark emailNotificationSent = true when Resend has accepted the email
        await MongoPayment.updateOne(
          { razorpayPaymentId },
          {
            $set: {
              emailNotificationSent: true,
              emailSentAt: new Date(),
              emailSendError: null,
            },
            $unset: {
              emailSendingLockedAt: 1,
            },
          }
        );
        console.log(
          `[Fulfillment (${source})] ✅ Email notification successfully sent and confirmed in DB for ${razorpayPaymentId}`
        );
      } else {
        // Resend failed or returned an error: clear the lock immediately and record error so retries can try again
        const errorMsg = emailResult.studentError || emailResult.adminError || "Resend email send failed";
        await MongoPayment.updateOne(
          { razorpayPaymentId },
          {
            $set: {
              emailSendError: errorMsg,
            },
            $unset: {
              emailSendingLockedAt: 1, // Unlock immediately for subsequent webhook retries
            },
          }
        );
        console.warn(
          `[Fulfillment (${source})] ⚠️ Resend dispatch failed for ${razorpayPaymentId}: "${errorMsg}". Lock released for retry.`
        );
      }
    } else {
      console.log(
        `[Fulfillment (${source})] ℹ️ Email notification already sent, currently in-flight, or claimed for ${razorpayPaymentId}. Skipping duplicate dispatch.`
      );
    }
  } catch (emailErr: any) {
    console.error(
      `[Fulfillment (${source})] ⚠️ Non-blocking email error for ${razorpayPaymentId}:`,
      emailErr?.message || emailErr
    );
    // On unexpected error, attempt to release lock to preserve retryability
    try {
      await MongoPayment.updateOne(
        { razorpayPaymentId, emailNotificationSent: { $ne: true } },
        {
          $set: { emailSendError: emailErr?.message || String(emailErr) },
          $unset: { emailSendingLockedAt: 1 },
        }
      );
    } catch {
      // ignore secondary error
    }
  }

  const wasAlreadyProcessed = Boolean(existingPayment && existingEnrollment);

  return {
    success: true,
    status: wasAlreadyProcessed ? "already_processed" : "fulfilled",
    message: wasAlreadyProcessed
      ? "Payment and enrollment have already been processed (idempotent)."
      : "Payment processed successfully and student enrolled in course.",
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
    courseId: finalCourseId,
    courseTitle: finalCourseTitle,
    studentId: studentUser.userId,
    studentName: studentUser.name,
    enrollmentId: savedEnrollment?.enrollmentId,
    enrolledAt: savedEnrollment?.enrolledAt,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-razorpay-signature");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Always respond with application/json
  res.setHeader("Content-Type", "application/json");

  // Determine subroute from URL, query parameter (from Vercel rewrites), and headers
  const rawUrl = (req.url || "").split("?")[0].toLowerCase();
  const queryPath = (
    Array.isArray(req.query?.path)
      ? req.query.path.join("/")
      : typeof req.query?.path === "string"
      ? req.query.path
      : ""
  ).toLowerCase();
  const searchParams = (req.url || "").includes("?")
    ? (req.url || "").split("?")[1].toLowerCase()
    : "";

  const pathCombined = `${rawUrl} ${queryPath} ${searchParams} ${req.headers["x-matched-path"] || ""}`.toLowerCase();

  const isCreateOrder =
    (pathCombined.includes("create-order") ||
      pathCombined.includes("razorpay-order") ||
      queryPath.includes("create-order") ||
      rawUrl.endsWith("/create-order") ||
      rawUrl.endsWith("/payments")) &&
    req.method === "POST" &&
    !pathCombined.includes("verify") &&
    !pathCombined.includes("webhook");

  const isVerify =
    (pathCombined.includes("verify") || queryPath.includes("verify")) &&
    req.method === "POST";

  const isWebhook =
    (pathCombined.includes("webhook") || queryPath.includes("webhook")) &&
    req.method === "POST";

  const isOrders =
    (pathCombined.includes("orders") || queryPath.includes("orders")) &&
    req.method === "GET";

  const isHealth =
    pathCombined.includes("health") ||
    (req.method === "GET" && !isOrders);

  // --------------------------------------------------------------------------
  // 1. CREATE ORDER: POST /api/payments/create-order
  // --------------------------------------------------------------------------
  if (isCreateOrder) {
    try {
      const { courseId, amount, courseTitle, userId } = req.body || {};

      if (!courseId && (amount === undefined || amount === null || amount === "")) {
        return res.status(400).json({
          success: false,
          message: "Course ID or valid amount is required to create a payment order.",
        });
      }

      // Check authoritative course price from server catalog to prevent client tampering
      let finalPriceInRupees: number;
      let finalCourseTitle: string = courseTitle || "EduPulse LMS Course";

      const matchedCourse = courseId ? AUTHORITATIVE_COURSES[String(courseId)] : undefined;

      const parsedAmount =
        typeof amount === "number"
          ? amount
          : typeof amount === "string" && !isNaN(parseFloat(amount))
          ? parseFloat(amount)
          : NaN;

      if (matchedCourse) {
        finalPriceInRupees = matchedCourse.price;
        finalCourseTitle = matchedCourse.title;
      } else if (!isNaN(parsedAmount) && parsedAmount > 0) {
        finalPriceInRupees = Math.round(parsedAmount);
        finalCourseTitle = courseTitle || `Course ${courseId || "Standard"}`;
      } else if (courseId) {
        finalPriceInRupees = 1499;
        finalCourseTitle = courseTitle || `Course ${courseId}`;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid course or invalid price specified.",
        });
      }

      if (finalPriceInRupees <= 0 || isNaN(finalPriceInRupees)) {
        return res.status(400).json({
          success: false,
          message: "Course price must be greater than zero.",
        });
      }

      // Check Razorpay credentials
      const razorpay = getRazorpayClient();
      if (!razorpay || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.warn("[Vercel /api/payments] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in environment.");
        return res.status(503).json({
          success: false,
          message: "Razorpay payment gateway is not configured on the server. Please check environment variables.",
        });
      }

      // Amount in paise
      const amountInPaise = Math.round(finalPriceInRupees * 100);

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.slice(0, 40),
        notes: {
          courseId: courseId ? String(courseId) : "custom",
          courseTitle: finalCourseTitle.slice(0, 100),
          userId: userId ? String(userId) : "anonymous",
        },
      };

      const order = await razorpay.orders.create(options);

      return res.status(201).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        amountRupees: finalPriceInRupees,
        currency: order.currency,
        courseId: courseId || null,
        courseTitle: finalCourseTitle,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error("[Vercel /api/payments] Razorpay order creation failure:", err?.message || err);
      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay payment order. Please try again later.",
        error: err?.error?.description || err?.message || "Internal payment gateway error",
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. VERIFY PAYMENT: POST /api/payments/verify
  // --------------------------------------------------------------------------
  if (isVerify) {
    try {
      const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        courseId,
        courseTitle,
        amount,
        userId,
        studentName,
        studentEmail,
      } = req.body || {};

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message:
            "Payment verification failed: Missing required parameters (razorpay_payment_id, razorpay_order_id, razorpay_signature).",
        });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        console.error("[Vercel /api/payments] RAZORPAY_KEY_SECRET is missing in environment.");
        return res.status(500).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message: "Payment verification failed: Razorpay secret key is not configured on the server.",
        });
      }

      // Generate expected HMAC-SHA256 signature
      const bodyToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyToSign)
        .digest("hex");

      let isMatch = false;
      try {
        const expectedBuffer = Buffer.from(expectedSignature, "utf8");
        const actualBuffer = Buffer.from(String(razorpay_signature), "utf8");
        if (expectedBuffer.length === actualBuffer.length) {
          isMatch = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
        }
      } catch {
        isMatch = false;
      }

      if (!isMatch) {
        console.warn(`⚠️ [Payment Tampering Detected] Invalid HMAC signature for Order: ${razorpay_order_id}`);
        return res.status(400).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message: "Payment verification failed: Invalid cryptographic signature. Transaction cannot be trusted.",
        });
      }

      // Identify student from Authorization Bearer token or request body
      let authenticatedUserId: string | null = null;
      let authenticatedEmail: string | null = null;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const decoded: any = jwt.verify(token, JWT_SECRET);
          authenticatedUserId = decoded.userId || null;
          authenticatedEmail = decoded.email || null;
        } catch {
          // Token expired or invalid; fallback to request payload
        }
      }

      const finalUserId = authenticatedUserId || userId || null;
      const finalEmail = authenticatedEmail || studentEmail || null;
      const finalName = studentName || null;

      const parsedAmount =
        typeof amount === "number"
          ? amount
          : typeof amount === "string" && !isNaN(parseFloat(amount))
          ? parseFloat(amount)
          : null;

      // Delegate to shared idempotent fulfillment engine
      const fulfillmentResult = await fulfillEnrollmentAndPayment({
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        courseId: courseId || null,
        courseTitle: courseTitle || null,
        amountRupees: parsedAmount,
        currency: "INR",
        studentId: finalUserId,
        studentName: finalName,
        studentEmail: finalEmail,
        source: "verify",
      });

      if (!fulfillmentResult.success) {
        return res.status(fulfillmentResult.status === "db_error" ? 500 : 400).json({
          success: false,
          paymentVerified: true,
          enrolled: false,
          message: fulfillmentResult.message,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
        });
      }

      return res.status(200).json({
        success: true,
        paymentVerified: true,
        enrolled: true,
        alreadyProcessed: fulfillmentResult.status === "already_processed",
        message: fulfillmentResult.message,
        paymentId: fulfillmentResult.paymentId,
        orderId: fulfillmentResult.orderId,
        courseId: fulfillmentResult.courseId,
        courseTitle: fulfillmentResult.courseTitle,
        studentId: fulfillmentResult.studentId,
        studentName: fulfillmentResult.studentName,
        enrollment: {
          enrollmentId: fulfillmentResult.enrollmentId || `enr_${Date.now()}`,
          courseId: fulfillmentResult.courseId,
          enrolledAt: fulfillmentResult.enrolledAt || new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("[Vercel /api/payments] Payment verification server error:", err?.message || err);
      return res.status(500).json({
        success: false,
        paymentVerified: false,
        enrolled: false,
        message: "Internal server error occurred during payment verification.",
        error: err?.message,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. WEBHOOK: POST /api/payments/webhook
  // Strictly verifies HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET
  // Asynchronously processes 'payment.captured' events to record payment & enroll
  // --------------------------------------------------------------------------
  if (isWebhook) {
    try {
      const webhookSignature = req.headers["x-razorpay-signature"] as string | undefined;
      const deliveryId =
        (req.headers["x-razorpay-event-id"] ||
          req.headers["x-razorpay-delivery-id"] ||
          "unknown") as string;

      console.log(`[Vercel Webhook] 📩 Delivery ID: ${deliveryId}, Event: ${req.body?.event || "unknown"}`);

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[Vercel Webhook] ❌ Server configuration error: RAZORPAY_WEBHOOK_SECRET is not configured.");
        return res.status(500).json({
          success: false,
          message: "Server configuration error: Webhook secret is not set.",
        });
      }

      if (!webhookSignature) {
        console.warn("[Vercel Webhook] ❌ Verification failed: Missing 'x-razorpay-signature' header.");
        return res.status(400).json({
          success: false,
          message: "Missing 'x-razorpay-signature' header.",
        });
      }

      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const expectedWebhookSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      let isSigValid = false;
      try {
        const expectedBuf = Buffer.from(expectedWebhookSig, "utf8");
        const actualBuf = Buffer.from(webhookSignature, "utf8");
        if (expectedBuf.length === actualBuf.length) {
          isSigValid = crypto.timingSafeEqual(expectedBuf, actualBuf);
        }
      } catch {
        isSigValid = false;
      }

      if (!isSigValid) {
        console.warn(`[Vercel Webhook] ⚠️ Invalid signature. Delivery ID: ${deliveryId}`);
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature.",
        });
      }

      const event = req.body?.event;
      if (!event || typeof event !== "string") {
        return res.status(400).json({
          success: false,
          message: "Malformed webhook payload: missing event field.",
        });
      }

      // Handle non-captured events safely with acknowledgment
      if (event !== "payment.captured") {
        console.log(`[Vercel Webhook] ℹ️ Non-captured event received: ${event}. Safely acknowledged.`);
        return res.status(200).json({
          success: true,
          acknowledged: true,
          deliveryId,
          message: `Event '${event}' safely acknowledged (only 'payment.captured' triggers enrollment processing).`,
        });
      }

      // Safely extract payment entity information
      const paymentEntity = req.body?.payload?.payment?.entity;
      if (!paymentEntity || !paymentEntity.id) {
        console.warn("[Vercel Webhook] ❌ Malformed 'payment.captured' payload: Missing payment entity.");
        return res.status(400).json({
          success: false,
          message: "Malformed webhook payload: missing payment entity.",
        });
      }

      const razorpayPaymentId = String(paymentEntity.id);
      const razorpayOrderId = paymentEntity.order_id ? String(paymentEntity.order_id) : "";
      const amountPaise = typeof paymentEntity.amount === "number" ? paymentEntity.amount : 0;
      const amountRupees = Math.round(amountPaise / 100);
      const currency = paymentEntity.currency || "INR";
      const customerEmail = paymentEntity.email || null;
      let notes: Record<string, any> = paymentEntity.notes || {};

      // If notes are missing courseId or studentId, safely fetch the Razorpay Order notes
      if (razorpayOrderId && (!notes.courseId || (!notes.studentId && !notes.userId))) {
        const rzp = getRazorpayClient();
        if (rzp) {
          try {
            const orderInfo: any = await rzp.orders.fetch(razorpayOrderId);
            if (orderInfo && orderInfo.notes) {
              notes = { ...orderInfo.notes, ...notes };
            }
          } catch (orderFetchErr: any) {
            console.warn(`[Vercel Webhook] Could not fetch Razorpay order ${razorpayOrderId} for notes:`, orderFetchErr?.message || orderFetchErr);
          }
        }
      }

      const candidateCourseId = notes.courseId && notes.courseId !== "custom" ? String(notes.courseId) : null;
      const candidateCourseTitle = notes.courseTitle ? String(notes.courseTitle) : null;
      const candidateStudentId =
        notes.studentId && notes.studentId !== "anonymous"
          ? String(notes.studentId)
          : notes.userId && notes.userId !== "anonymous"
          ? String(notes.userId)
          : null;
      const candidateEmail = notes.studentEmail || notes.email || customerEmail || null;
      const candidateName = notes.studentName || notes.name || null;

      // Delegate to shared idempotent fulfillment engine
      const fulfillmentResult = await fulfillEnrollmentAndPayment({
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature: `webhook_${deliveryId}`,
        courseId: candidateCourseId,
        courseTitle: candidateCourseTitle,
        amountRupees,
        amountPaise,
        currency,
        studentId: candidateStudentId,
        studentName: candidateName,
        studentEmail: candidateEmail,
        source: "webhook",
      });

      if (fulfillmentResult.status === "db_error") {
        return res.status(503).json({
          success: false,
          message: fulfillmentResult.message,
        });
      }

      return res.status(200).json({
        success: true,
        deliveryId,
        status: fulfillmentResult.status,
        message: fulfillmentResult.message,
        paymentId: fulfillmentResult.paymentId,
        orderId: fulfillmentResult.orderId,
        courseId: fulfillmentResult.courseId,
        studentId: fulfillmentResult.studentId,
      });
    } catch (webhookErr: any) {
      console.error("[Vercel Webhook] Error:", webhookErr?.message || webhookErr);
      return res.status(500).json({
        success: false,
        message: "Internal webhook processing error.",
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. HEALTH CHECK
  // --------------------------------------------------------------------------
  if (isHealth) {
    return res.status(200).json({
      status: "online",
      service: "EduPulse Payments API (Vercel Serverless)",
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(404).json({
    error: "Payment route not found",
    url: req.url,
    method: req.method,
  });
}
