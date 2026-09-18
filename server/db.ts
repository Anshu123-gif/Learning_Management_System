import mongoose from "mongoose";

let isConnected = false;

const DEFAULT_MONGODB_URI = "mongodb+srv://san414706_db_user:sYHC0uMqvY0WQOTy@cluster0.w2yjysh.mongodb.net/sheryians_lms?retryWrites=true&w=majority&appName=Cluster0";

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  if (!uri) {
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ Successfully connected to MongoDB Atlas!");
    return true;
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error);
    isConnected = false;
    return false;
  }
}

export function isMongoConnected() {
  return isConnected;
}
