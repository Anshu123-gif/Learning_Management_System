import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoUser } from "../server/models/User.js";

// Explicitly load .env, .env.local, and .env.example from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.example") });

import { connectMongoDB } from "../server/db.js";

async function seedStaffAccounts() {
  console.log("🔄 Connecting to MongoDB Atlas...");
  const connected = await connectMongoDB();
  if (!connected) {
    console.error("❌ [Seed Error] Could not connect to MongoDB Atlas.");
    process.exit(1);
  }
  console.log("✅ MongoDB Atlas connected successfully.");

  // Read credentials strictly from environment variables
  const teacherEmail = process.env.STAFF_TEACHER_EMAIL?.trim().toLowerCase();
  const teacherPassword = process.env.STAFF_TEACHER_PASSWORD;
  const adminEmail = process.env.STAFF_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.STAFF_ADMIN_PASSWORD;

  if (!teacherEmail || !teacherPassword) {
    console.error("❌ [Seed Error] STAFF_TEACHER_EMAIL and STAFF_TEACHER_PASSWORD must be set in environment.");
    process.exit(1);
  }

  if (!adminEmail || !adminPassword) {
    console.error("❌ [Seed Error] STAFF_ADMIN_EMAIL and STAFF_ADMIN_PASSWORD must be set in environment.");
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------
    // 1. TEACHER ACCOUNT SETUP
    // -------------------------------------------------------------
    const existingTeacher = await MongoUser.findOne({ email: teacherEmail });
    if (existingTeacher) {
      console.log(`ℹ️ [Teacher Exists] Account for "${teacherEmail}" already exists with role: "${existingTeacher.role}". Skipping creation to preserve data.`);
    } else {
      // Hash password using the same bcrypt approach (cost factor 10)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(teacherPassword, salt);

      const newTeacher = new MongoUser({
        userId: `usr_teacher_${Date.now()}`,
        name: "Faculty Instructor",
        email: teacherEmail,
        password: hashedPassword,
        role: "teacher",
        avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
        bio: "Senior Faculty Instructor & Course Author",
        enrolledCourses: [],
        wishlist: [],
      });

      await newTeacher.save();
      console.log(`✅ [Teacher Created] Account "${teacherEmail}" created with role: "teacher" (password securely bcrypt-hashed).`);
    }

    // -------------------------------------------------------------
    // 2. ADMIN ACCOUNT SETUP
    // -------------------------------------------------------------
    const existingAdmin = await MongoUser.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`ℹ️ [Admin Exists] Account for "${adminEmail}" already exists with role: "${existingAdmin.role}". Skipping creation to preserve data.`);
    } else {
      // Hash password using the same bcrypt approach (cost factor 10)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      const newAdmin = new MongoUser({
        userId: `usr_admin_${Date.now()}`,
        name: "Platform Administrator",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
        bio: "System & Academic Administrator",
        enrolledCourses: [],
        wishlist: [],
      });

      await newAdmin.save();
      console.log(`✅ [Admin Created] Account "${adminEmail}" created with role: "admin" (password securely bcrypt-hashed).`);
    }

    console.log("🎉 [Seed Complete] Staff accounts check completed.");
  } catch (err: any) {
    console.error("❌ [Seed Error] Error executing staff seed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed cleanly.");
  }
}

seedStaffAccounts();
