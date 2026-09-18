import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectMongoDB, isMongoConnected } from "./server/db.js";
import { MongoUser } from "./server/models/User.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
  // MONGODB USER AUTH & PERSISTENCE ROUTES
  // -------------------------------------------------------------

  // Check MongoDB Connection Status
  app.get("/api/mongo/status", (req, res) => {
    res.json({
      connected: isMongoConnected(),
      configured: Boolean(process.env.MONGODB_URI),
    });
  });

  // Get all users from MongoDB
  app.get("/api/mongo/users", async (req, res) => {
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

  // Register / Upsert user in MongoDB
  app.post("/api/mongo/users/register", async (req, res) => {
    try {
      const { userId, name, email, phone, role, avatar, bio } = req.body;
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

      // Create new user in MongoDB
      user = new MongoUser({
        userId: userId || `usr_${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role: role || "student",
        avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        bio: bio || "Student at Sheryians Coding School",
        enrolledCourses: [],
        wishlist: [],
      });

      await user.save();
      console.log(`✅ Saved new user to MongoDB Atlas: ${user.email}`);

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
      const { name, email, password, role } = req.body;

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
      console.log(`✅ [MongoDB] New user registered successfully: ${newUser.email}`);

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
