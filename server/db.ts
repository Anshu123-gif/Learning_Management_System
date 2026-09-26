import mongoose from "mongoose";

let isConnected = false;

const DEFAULT_MONGODB_URI = "mongodb+srv://san414706_db_user:sYHC0uMqvY0WQOTy@cluster0.w2yjysh.mongodb.net/sheryians_lms?retryWrites=true&w=majority&appName=Cluster0";

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: "majority",
};

export async function connectMongoDB(retries = 3, delayMs = 1500): Promise<boolean> {
  const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  if (!uri) {
    return false;
  }

  if (isConnected || mongoose.connection.readyState >= 1) {
    isConnected = true;
    return true;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, MONGO_OPTIONS);
      isConnected = true;
      console.log("✅ Successfully connected to MongoDB Atlas!");
      return true;
    } catch (error: any) {
      console.error(`❌ MongoDB Atlas connection error (attempt ${attempt}/${retries}):`, error?.message || error);
      isConnected = false;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return false;
}

export function isMongoConnected() {
  return isConnected || mongoose.connection.readyState >= 1;
}
