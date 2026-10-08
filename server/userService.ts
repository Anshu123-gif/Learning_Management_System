import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongoDB } from "./db.js";
import { MongoUser } from "./models/User.js";

export interface SafeUserOutput {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
  phone: string;
  avatar: string;
  bio: string;
  enrolledCourses: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Ensures an initial bootstrap administrator account in MongoDB Atlas
 * ONLY IF configured via environment variables (ADMIN_EMAIL & ADMIN_PASSWORD)
 * and no administrator account currently exists in MongoDB.
 *
 * Never logs or exposes passwords.
 * Never overwrites an existing admin account.
 */
export async function ensureDefaultAdminAccount(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Condition: ADMIN_EMAIL & ADMIN_PASSWORD must both be configured
    if (!adminEmail || !adminPassword) {
      console.log("ℹ️ No bootstrap admin credentials configured; skipping default admin creation.");
      return;
    }

    const connected = await connectMongoDB();
    if (!connected) return;

    // Condition: Create default admin account ONLY when no admin account already exists
    const existingAdmin = await MongoUser.findOne({ role: "admin" });
    if (existingAdmin) {
      return;
    }

    // Also check if a user with that email already exists to prevent overwriting
    const existingUserWithEmail = await MongoUser.findOne({ email: adminEmail.toLowerCase() });
    if (existingUserWithEmail) {
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const adminUser = new MongoUser({
      userId: `usr_admin_${Date.now()}`,
      name: "Platform Administrator",
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      bio: "Head of Academic Computing & LMS Platform Administrator.",
      enrolledCourses: [],
      wishlist: [],
    });

    await adminUser.save();
    console.log(`🛡️ Bootstrap administrator account created for ${adminEmail}.`);
  } catch (err: any) {
    console.warn("Could not check/seed bootstrap admin:", err?.message || err);
  }
}

/**
 * Fetch all users from MongoDB Atlas for the Admin Control Room.
 * Explicitly excludes password hashes and sensitive credentials.
 */
export async function getAllUsersForAdmin(): Promise<SafeUserOutput[]> {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  // Fetch all users, strictly projecting out the password field
  const users = await MongoUser.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

  return users.map((u: any) => ({
    _id: u.userId || String(u._id),
    userId: u.userId || String(u._id),
    name: u.name || "User",
    email: u.email || "",
    role: (u.role as "student" | "teacher" | "admin") || "student",
    phone: u.phone || "",
    avatar: u.avatar || "",
    bio: u.bio || "",
    enrolledCourses: Array.isArray(u.enrolledCourses) ? u.enrolledCourses : [],
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split("T")[0] : "",
    updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : "",
  }));
}

/**
 * Change a user's system role (student | teacher | admin).
 * Enforces admin-only privilege and ensures the last remaining admin cannot be demoted.
 */
export async function updateUserRoleByAdmin(
  targetUserId: string,
  newRole: string,
  requesterUserId?: string
): Promise<{ success: boolean; message: string; user: SafeUserOutput }> {
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable. MongoDB not connected.");
    err.statusCode = 503;
    throw err;
  }

  if (!targetUserId || typeof targetUserId !== "string" || !targetUserId.trim()) {
    const err: any = new Error("Target user ID is required.");
    err.statusCode = 400;
    throw err;
  }

  const cleanRole = (newRole || "").trim().toLowerCase();
  const allowedRoles = ["student", "teacher", "admin"];
  if (!allowedRoles.includes(cleanRole)) {
    const err: any = new Error(
      `Invalid role '${newRole}'. Allowed roles are: student, teacher, admin.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 1. Find target user by userId or ObjectId
  let targetUser = await MongoUser.findOne({ userId: targetUserId });
  if (!targetUser && mongoose.Types.ObjectId.isValid(targetUserId)) {
    targetUser = await MongoUser.findById(targetUserId);
  }
  if (!targetUser) {
    targetUser = await MongoUser.findOne({ email: targetUserId.trim().toLowerCase() });
  }

  if (!targetUser) {
    const err: any = new Error(`User with ID '${targetUserId}' not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Security Guard: Prevent demoting the only remaining administrator
  if (targetUser.role === "admin" && cleanRole !== "admin") {
    const adminCount = await MongoUser.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      const err: any = new Error(
        "Operation rejected. Cannot change the role of the only remaining administrator account."
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. Security Guard: Prevent an administrator from demoting their own active session account
  if (
    requesterUserId &&
    (targetUser.userId === requesterUserId || String(targetUser._id) === requesterUserId) &&
    cleanRole !== "admin"
  ) {
    const err: any = new Error(
      "Operation rejected. Administrators cannot demote their own account role."
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. Update role
  targetUser.role = cleanRole as any;
  await targetUser.save();

  console.log(
    `✅ [Admin User Management] Updated role for ${targetUser.email} (${targetUser.userId}) to '${cleanRole}' by admin '${requesterUserId || "system"}'`
  );

  return {
    success: true,
    message: `User role for '${targetUser.name}' successfully updated to '${cleanRole}'.`,
    user: {
      _id: targetUser.userId || String(targetUser._id),
      userId: targetUser.userId || String(targetUser._id),
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone || "",
      avatar: targetUser.avatar || "",
      bio: targetUser.bio || "",
      enrolledCourses: Array.isArray(targetUser.enrolledCourses) ? targetUser.enrolledCourses : [],
      createdAt: targetUser.createdAt ? new Date(targetUser.createdAt).toISOString().split("T")[0] : "",
      updatedAt: targetUser.updatedAt ? new Date(targetUser.updatedAt).toISOString() : "",
    },
  };
}
