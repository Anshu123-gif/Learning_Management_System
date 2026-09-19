import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectMongoDB, isMongoConnected } from "../server/db.js";
import { MongoUser } from "../server/models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

// In-memory OTP storage for Serverless execution
const otpCache = new Map<string, { otp: string; expiresAt: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & preflight headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Determine subroute from raw URL, query parameters (from Vercel rewrites), and headers
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

  const isSignup =
    (pathCombined.includes("signup") || queryPath.includes("signup") || rawUrl.endsWith("/signup")) &&
    req.method === "POST";

  const isLogin =
    (pathCombined.includes("login") || queryPath.includes("login") || rawUrl.endsWith("/login")) &&
    req.method === "POST";

  const isMe =
    (pathCombined.includes("/me") || queryPath === "me" || queryPath.endsWith("/me") || searchParams.includes("me")) &&
    req.method === "GET";

  const isSendOtp =
    (pathCombined.includes("send-otp") || queryPath.includes("send-otp")) &&
    req.method === "POST";

  const isVerifyOtp =
    (pathCombined.includes("verify-otp") || queryPath.includes("verify-otp")) &&
    req.method === "POST";

  const isHealth =
    pathCombined.includes("health") ||
    queryPath.includes("health") ||
    (req.method === "GET" && !isMe);

  // 1. SIGNUP: Validates name, email, password -> Checks existing email -> Hashes password with bcrypt -> Saves to MongoDB -> Returns JWT & user
  if (isSignup) {
    try {
      const { name, email, password, role } = req.body || {};

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
        return res.status(503).json({
          success: false,
          message: "Database connection unavailable. Please check MongoDB configuration.",
        });
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
      const defaultAvatar =
        role === "teacher"
          ? "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
          : role === "admin"
          ? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

      // Create new user record in MongoDB
      const newUser = new MongoUser({
        userId,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: role || "student",
        avatar: defaultAvatar,
        bio: "Learner at Sheryians Coding School",
        enrolledCourses: [],
        wishlist: [],
      });

      await newUser.save();
      console.log(`✅ [MongoDB / Vercel API] New user registered successfully: ${newUser.email}`);

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
      console.error("Signup error in MongoDB on Vercel:", err);
      return res.status(500).json({ success: false, message: err.message || "Failed to create account." });
    }
  }

  // 2. LOGIN: Validates email & password -> Checks user in MongoDB -> Compares hashed password with bcrypt -> Returns JWT & user
  if (isLogin) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Both email and password are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const connected = await connectMongoDB();
      if (!connected) {
        return res.status(503).json({
          success: false,
          message: "Database connection unavailable. Please check MongoDB configuration.",
        });
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

      // Generate JWT Token
      const token = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log(`✅ [MongoDB / Vercel API] User authenticated successfully: ${user.email}`);

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
      console.error("Login error in MongoDB on Vercel:", err);
      return res.status(500).json({ success: false, message: err.message || "Failed to log in." });
    }
  }

  // 3. CURRENT USER (ME): Validates JWT token and fetches user details from MongoDB
  if (isMe) {
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

      return res.status(200).json({
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
      return res.status(500).json({ success: false, message: err.message || "Session verification failed." });
    }
  }

  // 4. SEND OTP
  if (isSendOtp) {
    try {
      const { identifier, phone, fast2SmsApiKey } = req.body || {};
      const targetPhone = identifier || phone;
      if (!targetPhone || typeof targetPhone !== "string") {
        return res.status(400).json({ success: false, message: "Valid mobile number is required" });
      }

      const cleanIdentifier = targetPhone.trim().replace(/\D/g, "");
      if (cleanIdentifier.length < 10) {
        return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number" });
      }

      // Generate secure 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min TTL
      otpCache.set(cleanIdentifier, { otp, expiresAt });

      let liveSmsDelivered = false;
      let gateway = "Simulated / In-Memory (Active)";

      // Fast2SMS API Key from Vercel Environment or user input
      const activeFast2SmsKey = fast2SmsApiKey || process.env.FAST2SMS_API_KEY;
      const isIndianMobile = /^[6-9]\d{9}$/.test(cleanIdentifier);

      if (activeFast2SmsKey && isIndianMobile) {
        try {
          const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
            method: "POST",
            headers: {
              authorization: activeFast2SmsKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              route: "otp",
              variables_values: otp,
              numbers: cleanIdentifier,
            }),
          });
          const smsData = await smsRes.json();
          if (smsData && (smsData.return === true || smsData.status_code === 200)) {
            liveSmsDelivered = true;
            gateway = "Fast2SMS India Telecomm (Delivered to Handset)";
          }
        } catch (smsErr) {
          console.error("Fast2SMS delivery error on Vercel:", smsErr);
        }
      }

      return res.status(200).json({
        success: liveSmsDelivered,
        message: liveSmsDelivered
          ? `Real SMS OTP dispatched to +91 ${cleanIdentifier} via ${gateway}!`
          : `Fast2SMS rejected: complete website verification in your Fast2SMS account before OTP can reach your phone.`,
        identifier: cleanIdentifier,
        expiresInSeconds: 300,
        gateway,
        liveSmsDelivered,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to process OTP" });
    }
  }

  // 5. VERIFY OTP
  if (isVerifyOtp) {
    try {
      const { identifier, phone, otp } = req.body || {};
      const target = identifier || phone;
      if (!target || !otp) {
        return res.status(400).json({ success: false, message: "Mobile number and OTP are required" });
      }

      const cleanIdentifier = String(target).trim().replace(/\D/g, "");
      const cached = otpCache.get(cleanIdentifier);

      if (!cached) {
        return res.status(400).json({
          success: false,
          message: "No OTP found for this number or expired. Please click 'Resend OTP'.",
        });
      }

      if (Date.now() > cached.expiresAt) {
        otpCache.delete(cleanIdentifier);
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please click 'Resend OTP'.",
        });
      }

      if (cached.otp.trim() !== String(otp).trim()) {
        return res.status(400).json({
          success: false,
          message: "Incorrect OTP code. Please enter the correct 6-digit code.",
        });
      }

      otpCache.delete(cleanIdentifier);
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Mobile number verified successfully!",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Verification failed" });
    }
  }

  // 6. HEALTH CHECK
  if (isHealth) {
    return res.status(200).json({
      status: "online",
      service: "EduPulse / CodeHub LMS Vercel API",
      mongoConnected: isMongoConnected(),
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(404).json({ error: "API route not found" });
}
