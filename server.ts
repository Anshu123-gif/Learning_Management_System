import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import { connectMongoDB, isMongoConnected } from "./server/db.js";
import { MongoUser } from "./server/models/User.js";
import { MongoPayment } from "./server/models/Payment.js";
import { MongoEnrollment } from "./server/models/Enrollment.js";
import { MongoCourse } from "./server/models/Course.js";
import { fulfillEnrollmentAndPayment } from "./api/payments.js";
import { createCourseInDb, getCoursesFromDb, updateCourseStatusInDb } from "./api/courses.js";
import { updateCourseCurriculumInDb } from "./server/curriculumService.js";
import {
  generateCloudinaryUploadSignature,
  generateCloudinaryPlayUrl,
} from "./server/videoService.js";
import {
  uploadCourseThumbnail,
  deleteCourseThumbnail,
} from "./server/thumbnailService.js";
import {
  requireAuth,
  requireRole,
  requireOwnerOrAdmin,
} from "./server/authMiddleware.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(
    express.json({
      limit: "10mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Attempt connection to MongoDB Atlas
  connectMongoDB()
    .then((ok) => {
      if (ok) console.log("🚀 MongoDB Atlas is ready to receive data!");
    })
    .catch((err) => {
      console.warn("Initial MongoDB connection attempt failed:", err);
    });

  // Initialize Google GenAI client securely on server-side
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // Initialize ONE Razorpay SDK client with credentials from environment variables
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      service: "Sheryians MERN LMS Backend",
      version: "1.0.0",
      mongoConnected: isMongoConnected(),
      mongoConfigured: Boolean(process.env.MONGODB_URI),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------
  // RAZORPAY PAYMENT GATEWAY ROUTES
  // -------------------------------------------------------------

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

  // POST /api/payments/create-order: Creates an authoritative Razorpay order
  app.post("/api/payments/create-order", async (req, res) => {
    try {
      const { courseId, amount, courseTitle, userId } = req.body;

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
        // Authoritative server-side price (tamper-proof for catalog courses)
        finalPriceInRupees = matchedCourse.price;
        finalCourseTitle = matchedCourse.title;
      } else if (!isNaN(parsedAmount) && parsedAmount > 0) {
        // Fallback for custom, teacher-created, or dynamic courses
        finalPriceInRupees = Math.round(parsedAmount);
        finalCourseTitle = courseTitle || `Course ${courseId || "Standard"}`;
      } else if (courseId) {
        // Fallback if courseId is passed but amount was missing or invalid: default to 1499
        finalPriceInRupees = 1499;
        finalCourseTitle = courseTitle || `Course ${courseId}`;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid course or invalid price specified.",
        });
      }

      // Validate amount (must be positive number and at least 1 INR)
      if (finalPriceInRupees <= 0 || isNaN(finalPriceInRupees)) {
        return res.status(400).json({
          success: false,
          message: "Course price must be greater than zero.",
        });
      }

      // Check if Razorpay keys are configured in environment
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({
          success: false,
          message: "Razorpay payment gateway is not configured on the server.",
        });
      }

      // Convert INR rupees to paise (1 INR = 100 paise)
      const amountInPaise = Math.round(finalPriceInRupees * 100);

      // Prepare options for Razorpay Orders API
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

      // Call Razorpay's Orders API via the SDK client
      const order = await razorpay.orders.create(options);

      return res.status(201).json({
        success: true,
        orderId: order.id,
        amount: order.amount, // in paise
        amountRupees: finalPriceInRupees,
        currency: order.currency,
        courseId: courseId || null,
        courseTitle: finalCourseTitle,
        keyId: process.env.RAZORPAY_KEY_ID || "",
      });
    } catch (err: any) {
      console.error("Razorpay order creation failure:", err?.message || err);
      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay payment order. Please try again later.",
        error: err?.error?.description || err?.message || "Internal payment gateway error",
      });
    }
  });

  // POST /api/payments/verify: Authenticates Razorpay HMAC-SHA256 signature AND creates MongoDB course enrollment
  app.post("/api/payments/verify", async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, courseId, courseTitle, amount, userId, studentName, studentEmail } = req.body;

      // 1. Validate that all three required Razorpay parameters are present
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message:
            "Payment verification failed: Missing required parameters (razorpay_payment_id, razorpay_order_id, razorpay_signature).",
        });
      }

      // 2. Ensure Razorpay Secret is present on the server
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        return res.status(500).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message: "Payment verification failed: Razorpay secret key is not configured on the server.",
        });
      }

      // 3. Generate expected HMAC-SHA256 signature using razorpay_order_id + "|" + razorpay_payment_id
      const bodyToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyToSign)
        .digest("hex");

      // 4. Constant-time comparison using crypto.timingSafeEqual
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

      // 5. If signature does NOT match, immediately reject the payment
      if (!isMatch) {
        console.warn(`⚠️ [Payment Tampering Detected] Invalid HMAC signature for Order: ${razorpay_order_id}`);
        return res.status(400).json({
          success: false,
          paymentVerified: false,
          enrolled: false,
          message:
            "Payment verification failed: Invalid cryptographic signature. Transaction cannot be trusted.",
        });
      }

      console.log(`✅ [Razorpay Signature Verified] HMAC signature match for Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);

      // 6. Identify Authenticated Student (Prefer JWT Bearer Token if present)
      let authenticatedUserId: string | null = null;
      let authenticatedEmail: string | null = null;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const decoded: any = jwt.verify(token, JWT_SECRET);
          authenticatedUserId = decoded.userId || null;
          authenticatedEmail = decoded.email || null;
        } catch (jwtErr) {
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

      // 7. Delegate to shared idempotent fulfillment engine
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
      console.error("Payment verification server error:", err?.message || err);
      return res.status(500).json({
        success: false,
        paymentVerified: false,
        enrolled: false,
        message: "Internal server error occurred during payment verification.",
      });
    }
  });

  // POST /api/payments/webhook: Razorpay Webhook listener for asynchronous payment events (e.g. payment.captured)
  app.post("/api/payments/webhook", async (req, res) => {
    const webhookSignature = req.headers["x-razorpay-signature"] as string | undefined;
    const deliveryId = (req.headers["x-razorpay-event-id"] as string | undefined) || "unknown";

    // 1. Log webhook received (Do NOT log any secrets)
    console.log(`[Razorpay Webhook] 📩 Webhook received. Delivery ID: ${deliveryId}, Event: ${req.body?.event || "unknown"}`);

    // 2. Validate presence of RAZORPAY_WEBHOOK_SECRET in environment (no fallbacks or hardcoded values)
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Razorpay Webhook] ❌ Server configuration error: RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
      return res.status(500).json({
        success: false,
        message: "Server configuration error: Webhook secret is not set.",
      });
    }

    // 3. Validate presence of signature header
    if (!webhookSignature) {
      console.warn("[Razorpay Webhook] ❌ Verification failed: Missing 'x-razorpay-signature' header.");
      return res.status(400).json({
        success: false,
        message: "Missing 'x-razorpay-signature' header.",
      });
    }

    // 4. Verify HMAC-SHA256 signature against the raw request body Buffer
    const rawBody = (req as any).rawBody;
    if (!rawBody || (!Buffer.isBuffer(rawBody) && typeof rawBody !== "string")) {
      console.warn("[Razorpay Webhook] ❌ Verification failed: Raw request body buffer is missing.");
      return res.status(400).json({
        success: false,
        message: "Malformed request: Raw body is required for signature verification.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    let isSignatureValid = false;
    try {
      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      const actualBuffer = Buffer.from(String(webhookSignature), "utf8");
      if (expectedBuffer.length === actualBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
      }
    } catch {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      console.warn(`[Razorpay Webhook] ❌ Signature verification failed for event: ${req.body?.event || "unknown"}`);
      return res.status(400).json({
        success: false,
        message: "Invalid webhook cryptographic signature.",
      });
    }

    console.log(`[Razorpay Webhook] ✅ Signature verified successfully for event: ${req.body?.event || "unknown"}`);

    // 5. Validate webhook event payload structure
    const event = req.body?.event;
    if (!event || typeof event !== "string") {
      console.warn("[Razorpay Webhook] ❌ Malformed payload: Missing or invalid 'event' property.");
      return res.status(400).json({
        success: false,
        message: "Malformed webhook payload: missing event field.",
      });
    }

    console.log(`[Razorpay Webhook] ⚡ Event type: ${event}`);

    // 6. Handle supported events (initially payment.captured)
    if (event !== "payment.captured") {
      console.log(`[Razorpay Webhook] ℹ️ Non-captured event received: ${event}. Safely acknowledged.`);
      return res.status(200).json({
        success: true,
        acknowledged: true,
        message: `Event '${event}' safely acknowledged (only 'payment.captured' triggers enrollment processing).`,
      });
    }

    // 7. Safely extract payment entity information
    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!paymentEntity || !paymentEntity.id) {
      console.warn("[Razorpay Webhook] ❌ Malformed 'payment.captured' payload: Missing payment entity.");
      return res.status(400).json({
        success: false,
        message: "Malformed webhook payload: missing payment entity.",
      });
    }

    const razorpay_payment_id = String(paymentEntity.id);
    const razorpay_order_id = paymentEntity.order_id ? String(paymentEntity.order_id) : "";
    const amountPaise = typeof paymentEntity.amount === "number" ? paymentEntity.amount : 0;
    const amountRupees = Math.round(amountPaise / 100);
    const currency = paymentEntity.currency || "INR";
    const customerEmail = paymentEntity.email || null;
    let notes: Record<string, any> = paymentEntity.notes || {};

    // 8. Reconcile order notes (Fetch from Razorpay Order API if notes not present on payment entity)
    if (razorpay_order_id && (!notes.courseId || (!notes.studentId && !notes.userId))) {
      try {
        const orderInfo = await razorpay.orders.fetch(razorpay_order_id);
        if (orderInfo?.notes) {
          notes = { ...orderInfo.notes, ...notes };
        }
      } catch (fetchErr: any) {
        console.warn(`[Razorpay Webhook] Could not fetch Razorpay order ${razorpay_order_id}:`, fetchErr?.message || fetchErr);
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

    // 9. Delegate to shared idempotent fulfillment engine
    const fulfillmentResult = await fulfillEnrollmentAndPayment({
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
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
  });

  // GET /api/mongo/enrollments/:userId: Fetches student's enrollments from MongoDB (Owner or Admin only)
  app.get(
    "/api/mongo/enrollments/:userId",
    requireAuth,
    requireOwnerOrAdmin("userId"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const connected = await connectMongoDB();
        if (!connected) {
          return res.status(503).json({ success: false, message: "MongoDB connection offline." });
        }

        const enrollments = await MongoEnrollment.find({ studentId: userId }).lean();
        return res.json({ success: true, enrollments });
      } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // GET /api/mongo/payments/:userId: Fetches student's verified payment history from MongoDB (Owner or Admin only)
  app.get(
    "/api/mongo/payments/:userId",
    requireAuth,
    requireOwnerOrAdmin("userId"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const connected = await connectMongoDB();
        if (!connected) {
          return res.status(503).json({ success: false, message: "MongoDB connection offline." });
        }

        const payments = await MongoPayment.find({ studentId: userId }).lean();
        return res.json({ success: true, payments });
      } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
      }
    }
  );

  // -------------------------------------------------------------
  // MONGODB USER AUTH & PERSISTENCE ROUTES
  // -------------------------------------------------------------

  // Check MongoDB Connection Status
  app.get("/api/mongo/status", (req, res) => {
    res.json({
      connected: isMongoConnected(),
      configured: Boolean(process.env.MONGODB_URI),
    });
  });

  // Get all users from MongoDB (Admin only)
  app.get("/api/mongo/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "MongoDB not connected or MONGODB_URI missing." });
      }

      const users = await MongoUser.find().lean();
      return res.json({ success: true, users });
    } catch (err: any) {
      console.error("Error fetching users from MongoDB:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Register / Upsert user in MongoDB (Enforces role: 'student' on public registration)
  app.post("/api/mongo/users/register", async (req, res) => {
    try {
      const { userId, name, email, phone, avatar, bio } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: "Name and email are required." });
      }

      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "MongoDB not connected." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = (phone || "").replace(/\D/g, "");

      // Check if user already exists
      const queryConditions: any[] = [{ email: cleanEmail }];
      if (cleanPhone.length >= 10) {
        queryConditions.push({ phone: cleanPhone });
      }
      let user = await MongoUser.findOne({ $or: queryConditions } as any);

      if (user) {
        return res.json({
          success: true,
          user,
          message: "User already exists. Account loaded.",
        });
      }

      // Create new user in MongoDB - strictly enforce role 'student' for registration
      user = new MongoUser({
        userId: userId || `usr_${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role: "student",
        avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        bio: bio || "Student at Sheryians Coding School",
        enrolledCourses: [],
        wishlist: [],
      });

      await user.save();
      console.log(`✅ Saved new user to MongoDB Atlas: ${user.email} (role: student)`);

      return res.json({
        success: true,
        user,
        message: "User registered in MongoDB Atlas successfully.",
      });
    } catch (err: any) {
      console.error("Error registering user in MongoDB:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Find user by email or phone in MongoDB
  app.post("/api/mongo/users/find", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, message: "Identifier is required." });
      }

      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "MongoDB not connected." });
      }

      const cleanInput = identifier.trim().toLowerCase();
      const cleanDigits = cleanInput.replace(/\D/g, "");

      const searchConditions: any[] = [
        { email: cleanInput },
        { userId: cleanInput },
      ];
      if (cleanDigits.length >= 10) {
        searchConditions.push({ phone: cleanDigits });
      }

      const user = await MongoUser.findOne({ $or: searchConditions } as any).lean();

      if (user) {
        return res.json({ success: true, user });
      }
      return res.status(404).json({ success: false, message: "User not found in MongoDB." });
    } catch (err: any) {
      console.error("Error finding user in MongoDB:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // -------------------------------------------------------------
  // COURSE MANAGEMENT ROUTES (MongoDB Atlas)
  // -------------------------------------------------------------

  // POST /api/courses: Create a course (Requires teacher or admin role)
  // Protected with requireAuth + requireRole("teacher", "admin")
  // NEVER trusts instructorId/instructorName/instructorAvatar from the request body.
  app.post(
    "/api/courses",
    requireAuth,
    requireRole("teacher", "admin"),
    async (req: any, res) => {
      try {
        const result = await createCourseInDb(req.body, req.user.userId);
        return res.status(201).json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to create course in MongoDB.",
        });
      }
    }
  );

  // POST /api/courses/upload-thumbnail: Upload course thumbnail to Cloudinary via backend
  // Role: Teacher or Admin only
  // Validates file type (JPG, JPEG, PNG, WEBP) & max size (5 MB)
  // Uploads to Cloudinary without exposing CLOUDINARY_API_SECRET
  app.post(
    "/api/courses/upload-thumbnail",
    requireAuth,
    requireRole("teacher", "admin"),
    async (req: any, res) => {
      try {
        const { image, fileName } = req.body;
        const result = await uploadCourseThumbnail({
          image,
          fileName,
          userId: req.user.userId,
          userRole: req.user.role,
        });
        return res.json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to upload thumbnail to Cloudinary.",
        });
      }
    }
  );

  // POST /api/courses/delete-thumbnail: Delete unsubmitted course thumbnail from Cloudinary
  // Role: Teacher or Admin only
  app.post(
    "/api/courses/delete-thumbnail",
    requireAuth,
    requireRole("teacher", "admin"),
    async (req: any, res) => {
      try {
        const { publicId } = req.body;
        const result = await deleteCourseThumbnail({
          publicId,
          userId: req.user.userId,
          userRole: req.user.role,
        });
        return res.json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to remove thumbnail.",
        });
      }
    }
  );

  // GET /api/courses: Public Course Catalog returns approved courses
  // Optional: Teachers or Admins can pass ?all=true or ?myCourses=true with their token to see their own drafts
  app.get("/api/courses", async (req, res) => {
    try {
      const result = await getCoursesFromDb({
        authHeader: req.headers.authorization,
        all: req.query.all as string,
        myCourses: req.query.myCourses as string,
        status: req.query.status as string,
      });
      return res.json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to retrieve courses.",
      });
    }
  });

  // PATCH /api/courses/:id/status: Protected course approval/rejection endpoint
  // Role: Only "admin" can call this endpoint
  // Accepts only status: "approved" | "rejected" and optional rejectionReason
  // Never trusts instructorId or role from the request body
  app.patch(
    "/api/courses/:id/status",
    requireAuth,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const courseId = req.params.id;
        const { status, rejectionReason } = req.body;

        if (!status || (status !== "approved" && status !== "rejected")) {
          return res.status(400).json({
            success: false,
            message: "Invalid status. Allowed values are 'approved' or 'rejected'.",
          });
        }

        const result = await updateCourseStatusInDb(courseId, status, rejectionReason);
        return res.json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to update course status in MongoDB.",
        });
      }
    }
  );

  // PUT /api/courses/:id/curriculum: Update sections & lectures in MongoDB
  app.put(
    "/api/courses/:id/curriculum",
    requireAuth,
    async (req: any, res) => {
      try {
        const courseId = req.params.id;
        const { sections } = req.body;
        const user = req.user;

        if (!Array.isArray(sections)) {
          return res.status(400).json({
            success: false,
            message: "sections must be an array of sections.",
          });
        }

        const result = await updateCourseCurriculumInDb(
          courseId,
          sections,
          user.userId,
          user.role
        );
        return res.json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to update curriculum in MongoDB.",
        });
      }
    }
  );

  // POST /api/videos/upload-signature: Cloudinary upload signature for direct browser upload
  const handleUploadSignature = async (req: any, res: any) => {
    try {
      const { courseId, lectureId } = req.body;
      const user = req.user;

      const result = await generateCloudinaryUploadSignature({
        courseId,
        lectureId,
        userId: user.userId,
        userRole: user.role,
      });

      return res.json(result);
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message || "Failed to generate Cloudinary upload signature.",
      });
    }
  };

  app.post(
    "/api/videos/upload-signature",
    requireAuth,
    requireRole("teacher", "admin"),
    handleUploadSignature
  );

  // Alias endpoint for backwards compatibility
  app.post(
    "/api/videos/upload-url",
    requireAuth,
    requireRole("teacher", "admin"),
    handleUploadSignature
  );

  // GET /api/videos/play-url: Authorized secure playback URL for Cloudinary stream
  app.get(
    "/api/videos/play-url",
    requireAuth,
    async (req: any, res) => {
      try {
        const courseId = (req.query.courseId as string) || "";
        const lectureId = (req.query.lectureId as string) || "";
        const user = req.user;

        const result = await generateCloudinaryPlayUrl({
          courseId,
          lectureId,
          userId: user.userId,
          userRole: user.role,
        });

        return res.json(result);
      } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: err.message || "Failed to generate video stream URL.",
        });
      }
    }
  );

  // AI Chatbot Route powered by Gemini
  const handleChat = async (req: express.Request, res: express.Response) => {
    try {
      const { message, history = [], currentCourseTitle, courseContext, userRole } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message prompt is required." });
      }

      const activeCourseName = currentCourseTitle || courseContext?.title || "General Catalog";

      if (!process.env.GEMINI_API_KEY || !ai) {
        return res.json({
          reply: `Welcome to Sheryians! I am your AI Academic Tutor. Regarding "${message}": Our modern web development courses cover full-stack engineering with MongoDB, Express, React, and Node.js.`,
          source: "fallback",
        });
      }

      const systemInstruction = `You are "Sheryians AI", an advanced, friendly AI Tutor for Sheryians Coding School.
Current contextual course: ${activeCourseName}.
User role: ${userRole || "Student"}.`;

      const contents = history.map((h: { role: string; text: string }) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }],
      }));

      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents as any,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({
        reply: response.text || "",
        source: "gemini",
      });
    } catch (error: any) {
      console.error("AI tutor endpoint error:", error);
      return res.status(500).json({
        reply: "Apologies, I encountered an issue processing your query.",
        source: "error",
      });
    }
  };

  app.post("/api/ai/tutor", handleChat);
  app.post("/api/ai/chat", handleChat);

  // -------------------------------------------------------------
  // MONGODB AUTHENTICATION: SIGNUP & LOGIN WITH BCRYPT & JWT
  // -------------------------------------------------------------

  // 1. SIGNUP: Validates name, email, password -> Checks existing email -> Hashes password with bcrypt -> Saves to MongoDB -> Returns JWT & user
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Validate inputs
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Full Name is required." });
      }

      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ success: false, message: "Email is required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
      }

      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "Database connection unavailable. Please check MongoDB configuration." });
      }

      // Check if email already registered in MongoDB
      const existingUser = await MongoUser.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "This email is already registered in MongoDB. Please sign in instead.",
        });
      }

      // Securely hash password using bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userId = `usr_${Date.now()}`;
      const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

      // Create new user record in MongoDB - strictly enforce 'student' role
      const newUser = new MongoUser({
        userId,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: "student",
        avatar: defaultAvatar,
        bio: "Learner at Sheryians Coding School",
        enrolledCourses: [],
        wishlist: [],
      });

      await newUser.save();
      console.log(`✅ [MongoDB] New user registered successfully as student: ${newUser.email}`);

      // Generate secure JWT token
      const token = jwt.sign(
        { userId: newUser.userId, email: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        success: true,
        message: "Account created successfully in MongoDB! Please log in with your credentials.",
        user: {
          _id: newUser.userId,
          userId: newUser.userId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          avatar: newUser.avatar,
          bio: newUser.bio,
          enrolledCourses: newUser.enrolledCourses,
          wishlist: newUser.wishlist,
          createdAt: newUser.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error("Signup error in MongoDB:", err);
      return res.status(500).json({ success: false, message: err.message || "Failed to create account." });
    }
  });

  // 2. LOGIN: Validates email & password -> Checks user in MongoDB -> Compares hashed password with bcrypt -> Returns JWT & user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Both email and password are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "Database connection unavailable. Please check MongoDB configuration." });
      }

      // Query user in MongoDB
      const user = await MongoUser.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email in MongoDB. Please sign up first.",
        });
      }

      // Securely compare entered password with stored bcrypt hash
      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password. Please verify your credentials and try again.",
        });
      }

      // Validate selected role against authoritative database role
      const { selectedRole } = req.body;
      if (selectedRole && ["student", "teacher", "admin"].includes(selectedRole)) {
        if (user.role !== selectedRole) {
          const formattedActual = user.role.charAt(0).toUpperCase() + user.role.slice(1);
          const formattedSelected = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
          return res.status(403).json({
            success: false,
            message: `Role mismatch: This account is registered as a ${formattedActual}, not a ${formattedSelected}. Please select ${formattedActual} to log in.`,
          });
        }
      }

      // Generate JWT Token
      const token = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log(`✅ [MongoDB] User authenticated successfully: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: "Login successful! Welcome back.",
        user: {
          _id: user.userId,
          userId: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          enrolledCourses: user.enrolledCourses,
          wishlist: user.wishlist,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (err: any) {
      console.error("Login error in MongoDB:", err);
      return res.status(500).json({ success: false, message: err.message || "Failed to log in." });
    }
  });

  // 3. CURRENT USER (ME): Validates JWT token and fetches user details from MongoDB
  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization token required." });
      }

      const token = authHeader.split(" ")[1];
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Invalid or expired session token." });
      }

      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({ success: false, message: "Database offline." });
      }

      const user = await MongoUser.findOne({ userId: decoded.userId }).lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found in MongoDB." });
      }

      return res.json({
        success: true,
        user: {
          _id: user.userId,
          userId: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          enrolledCourses: user.enrolledCourses,
          wishlist: user.wishlist,
          createdAt: user.createdAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // OTP Verification In-Memory cache for mobile phone numbers
  const otpCache = new Map<string, { otp: string; expiresAt: number }>();

  // Send OTP endpoint
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone, identifier: rawId } = req.body;
      const targetPhone = phone || rawId;
      if (!targetPhone) {
        return res.status(400).json({ success: false, message: "Phone number required." });
      }

      const cleanNumber = String(targetPhone).replace(/\D/g, "");
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpCache.set(cleanNumber, {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      console.log(`[SMS Gateway] Dispatched OTP for ${cleanNumber}: ${otp}`);

      return res.json({
        success: true,
        sent: true,
        message: `OTP dispatched to +91 ${cleanNumber.slice(-10)}`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Error sending OTP." });
    }
  });

  // Verify OTP endpoint
  app.post("/api/auth/verify-otp", (req, res) => {
    const { phone, identifier, otp } = req.body;
    const target = phone || identifier;
    if (!target || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP required." });
    }

    const clean = String(target).replace(/\D/g, "");
    const cached = otpCache.get(clean);

    if (!cached || Date.now() > cached.expiresAt) {
      return res.status(400).json({ success: false, message: "OTP expired or not found." });
    }

    if (cached.otp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Incorrect OTP." });
    }

    otpCache.delete(clean);
    return res.json({ success: true, verified: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sheryians LMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
