import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import { connectMongoDB } from "../server/db.js";
import { MongoUser } from "../server/models/User.js";
import { MongoPayment } from "../server/models/Payment.js";
import { MongoEnrollment } from "../server/models/Enrollment.js";

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
      } catch (compareError) {
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

      // Connect to MongoDB Atlas
      const isConnected = await connectMongoDB();
      if (!isConnected) {
        console.error("❌ MongoDB Atlas is not connected during course enrollment!");
        return res.status(500).json({
          success: false,
          paymentVerified: true,
          enrolled: false,
          message: "Payment was verified, but database is currently unreachable. Please contact support.",
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
        });
      }

      // Identify student
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

      const finalUserId = authenticatedUserId || userId || `usr_${Date.now()}`;
      const finalEmail = authenticatedEmail || studentEmail || "student@edupulse.ac.in";
      const finalName = studentName || "Student";

      let studentUser = await MongoUser.findOne({
        $or: [{ userId: finalUserId }, { email: finalEmail.toLowerCase() }],
      });

      if (!studentUser) {
        studentUser = new MongoUser({
          userId: finalUserId,
          name: finalName,
          email: finalEmail.toLowerCase(),
          role: "student",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
          bio: "Student at Sheryians Coding School",
          enrolledCourses: [],
          wishlist: [],
        });
        await studentUser.save();
      }

      const finalCourseId = courseId || "course_mern_101";
      const catalogCourse = AUTHORITATIVE_COURSES[finalCourseId];
      const finalCourseTitle = catalogCourse?.title || courseTitle || "EduPulse LMS Course";
      const finalPriceInRupees = typeof amount === "number" && amount > 0 ? Math.round(amount) : (catalogCourse?.price || 1499);

      // Duplicate payment check (Idempotency)
      const existingPayment = await MongoPayment.findOne({
        $or: [{ razorpayPaymentId: razorpay_payment_id }, { razorpayOrderId: razorpay_order_id }],
      });

      if (existingPayment) {
        return res.status(200).json({
          success: true,
          paymentVerified: true,
          enrolled: true,
          alreadyProcessed: true,
          message: "Payment and enrollment have already been recorded and processed.",
          paymentId: existingPayment.razorpayPaymentId,
          orderId: existingPayment.razorpayOrderId,
          courseId: existingPayment.courseId,
          courseTitle: existingPayment.courseTitle,
          studentId: existingPayment.studentId,
        });
      }

      // Check if already enrolled
      const existingEnrollment = await MongoEnrollment.findOne({
        studentId: studentUser.userId,
        courseId: finalCourseId,
      });

      if (existingEnrollment) {
        return res.status(200).json({
          success: true,
          paymentVerified: true,
          enrolled: true,
          alreadyEnrolled: true,
          message: "Student is already enrolled in this course.",
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          courseId: finalCourseId,
          courseTitle: finalCourseTitle,
          studentId: studentUser.userId,
        });
      }

      // Atomic record creation in MongoDB
      const newPaymentRecord = new MongoPayment({
        paymentId: `pay_${Date.now()}`,
        studentId: studentUser.userId,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        amount: finalPriceInRupees,
        amountPaise: Math.round(finalPriceInRupees * 100),
        currency: "INR",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "captured",
      });
      await newPaymentRecord.save();

      const newEnrollmentRecord = new MongoEnrollment({
        enrollmentId: `enr_${Date.now()}`,
        studentId: studentUser.userId,
        studentEmail: studentUser.email,
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        progressPercent: 0,
        completedLectures: [],
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        enrolledAt: new Date().toISOString(),
        certificateIssued: false,
      });
      await newEnrollmentRecord.save();

      await MongoUser.updateOne(
        { userId: studentUser.userId },
        { $addToSet: { enrolledCourses: finalCourseId } }
      );

      return res.status(200).json({
        success: true,
        paymentVerified: true,
        enrolled: true,
        message: "Payment verified successfully and student enrolled in course.",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        courseId: finalCourseId,
        courseTitle: finalCourseTitle,
        studentId: studentUser.userId,
        studentName: studentUser.name,
        enrollment: {
          enrollmentId: newEnrollmentRecord.enrollmentId,
          courseId: finalCourseId,
          enrolledAt: newEnrollmentRecord.enrolledAt,
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
  // --------------------------------------------------------------------------
  if (isWebhook) {
    try {
      const webhookSignature = req.headers["x-razorpay-signature"] as string | undefined;
      const deliveryId = req.headers["x-razorpay-delivery-id"] || "unknown";

      console.log(`[Vercel Webhook] Delivery ID: ${deliveryId}, Event: ${req.body?.event || "unknown"}`);

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[Vercel Webhook] ❌ Server configuration error: RAZORPAY_WEBHOOK_SECRET is not configured.");
        return res.status(500).json({
          success: false,
          message: "Server configuration error: Webhook secret is not set.",
        });
      }

      if (!webhookSignature) {
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

      return res.status(200).json({
        success: true,
        acknowledged: true,
        deliveryId,
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
  // 4. HEALTH CHECK / DEFAULT
  // --------------------------------------------------------------------------
  if (isHealth) {
    return res.status(200).json({
      status: "online",
      service: "EduPulse Payments API (Vercel Serverless)",
      razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(404).json({
    error: "Payment route not found",
    url: req.url,
    method: req.method,
  });
}
