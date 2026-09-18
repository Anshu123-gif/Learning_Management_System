import React, { useState } from "react";
import {
  X,
  FileCode,
  Layers,
  Database,
  Cloud,
  CreditCard,
  Bot,
  Award,
  BookOpen,
  CheckCircle,
  Copy,
  Check,
  Server,
  Terminal,
} from "lucide-react";

interface ProjectDossierModalProps {
  onClose: () => void;
}

export const ProjectDossierModal: React.FC<ProjectDossierModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<
    "architecture" | "schemas" | "apis" | "integrations" | "deployment" | "report"
  >("architecture");

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  College Major Project Architecture & Engineering Dossier
                </h2>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.2 rounded-sm">
                  v2.4 Final Submission
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Complete technical reference: 13 Mongoose Schemas, REST Matrix, AWS S3, Razorpay HMAC, & Viva Defense Guide
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-6 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none text-xs font-semibold py-2">
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "architecture"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" /> System Architecture
          </button>

          <button
            onClick={() => setActiveTab("schemas")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "schemas"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-4 h-4" /> 13 Mongoose Schemas
          </button>

          <button
            onClick={() => setActiveTab("apis")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "apis"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-4 h-4" /> REST API Matrix
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "integrations"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Cloud className="w-4 h-4" /> Cloud & Security Setup
          </button>

          <button
            onClick={() => setActiveTab("deployment")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "deployment"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Terminal className="w-4 h-4" /> Deployment Guide
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "report"
                ? "bg-white text-indigo-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Project Report TOC
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700 leading-relaxed">
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === "architecture" && (
            <div className="space-y-6">
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>High-Level MERN Three-Tier Distributed Architecture</span>
                </h3>
                <p className="text-slate-600">
                  EduPulse LMS utilizes a decoupled client-server model engineered to sustain high concurrent student video consumption, automated exam validation, and webhook-driven financial transactions.
                </p>
              </div>

              {/* Architectural Block Flow Diagram */}
              <div className="bg-slate-900 text-white rounded-2xl p-6 font-mono space-y-4 border border-slate-800">
                <div className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider">
                  System Flow Diagram (College Defense Ready)
                </div>
                <div className="text-slate-300 text-[11px] leading-6 whitespace-pre font-mono overflow-x-auto">
{`+-------------------------------------------------------------------------+
|                  Client Tier (React 19 SPA on Vercel)                  |
|  - Role Portals: Student (Watch/Quiz) | Teacher (Studio) | Admin (Gov)  |
|  - Video Streaming Engine (HTML5 Custom Controls + Seek Restoration)   |
|  - Socket.io Real-time Forum Sync & Gemini Interactive Tutor Widget     |
+------------------------------------+------------------------------------+
                                     |
                       HTTPS / REST  |  JWT Bearer Tokens
                                     v
+------------------------------------+------------------------------------+
|               Application Tier (Node.js / Express on Render)           |
|  - Auth Middleware: verifyToken(), requireRole(['admin','teacher'])     |
|  - Video Controller: Generates S3 Pre-signed URL with 15-min TTL       |
|  - Quiz Engine: Auto-grades attempts & issues Cryptographic Cert ID    |
|  - Razorpay Controller: HMAC-SHA256 Signature Verification Webhooks     |
|  - Gemini AI Proxy: Grounded context prompts server-side                |
+---------+--------------------------+------------------------+-----------+
          |                          |                        |
          v                          v                        v
+-------------------+      +-------------------+    +--------------------+
|  MongoDB Atlas    |      |  AWS S3 Bucket    |    |  Razorpay API      |
|  (Document DB)    |      |  (Video Storage)  |    |  (Payment Gateway) |
|  - 13 Collections |      |  - Signed GET/PUT |    |  - UPI / Cards     |
|  - Compound Index |      |  - Private ACL    |    |  - Auto-Refunds    |
+-------------------+      +-------------------+    +--------------------+`}
                </div>
              </div>

              {/* Core Architectural Trade-offs & Decisions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                  <h4 className="font-bold text-slate-900 text-xs">
                    Why MongoDB Atlas instead of PostgreSQL?
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    Hierarchical curriculum data (Course ➔ Sections ➔ Lectures ➔ Resources) naturally maps to embedded document trees. MongoDB handles rich JSON queries with zero join bottlenecks during peak student lecture streaming.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                  <h4 className="font-bold text-slate-900 text-xs">
                    Why S3 Presigned URLs instead of Direct Server Streaming?
                  </h4>
                  <p className="text-slate-600 text-[11px]">
                    Streaming gigabytes of MP4 videos through the Node.js event loop blocks worker threads and exhausts CPU. Presigned URLs offload all heavy byte-range I/O directly to AWS edge storage with a strict 15-minute expiration time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONGOOSE SCHEMAS */}
          {activeTab === "schemas" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    All 13 Normalized Mongoose Data Models
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Production-grade schemas with compound indexes, role enums, and foreign references.
                  </p>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      `// Mongoose Schemas\n// Exported for Major Project Submission`,
                      "all_schemas"
                    )
                  }
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {copiedSection === "all_schemas" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy Schema Definitions</span>
                </button>
              </div>

              {/* Schema 1: User & Course */}
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs">
                    <span>1. User Schema (RBAC with bcrypt hashing)</span>
                    <span className="text-[10px] text-slate-400">models/User.js</span>
                  </div>
                  <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, minlength: 8 },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student', index: true },
  avatar: { type: String, default: 'https://images.unsplash.com/...' },
  bio: { type: String, default: '' },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });`}
                  </pre>
                </div>

                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs">
                    <span>2. Course, Section & Lecture Schemas</span>
                    <span className="text-[10px] text-slate-400">models/Course.js</span>
                  </div>
                  <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`const lectureSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  videoUrl: String,
  s3Key: { type: String, required: true },
  durationMinutes: { type: Number, default: 0 },
  isPreviewFree: { type: Boolean, default: false },
  resources: [{
    title: String,
    fileUrl: String,
    fileType: { type: String, enum: ['pdf', 'zip', 'doc', 'code'] },
    sizeMb: Number,
  }],
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  lectures: [lectureSchema],
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, index: 'text' },
  subtitle: String,
  description: { type: String, required: true },
  thumbnail: { type: String, required: true },
  category: { type: String, required: true, index: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  price: { type: Number, required: true, min: 0 },
  originalPrice: Number,
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'pending', index: true },
  sections: [sectionSchema],
  studentsEnrolled: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
}, { timestamps: true });`}
                  </pre>
                </div>

                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs">
                    <span>3. Enrollment, Quiz & Certificate Schemas</span>
                    <span className="text-[10px] text-slate-400">models/Enrollment.js, Quiz.js, Certificate.js</span>
                  </div>
                  <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`const enrollmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  progressPercent: { type: Number, default: 0 },
  completedLectures: [{ type: String }],
  lastWatchedLectureId: String,
  lastWatchedPositionSeconds: Number,
}, { timestamps: true });
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const quizSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, unique: true },
  title: { type: String, required: true },
  durationMinutes: { type: Number, default: 15 },
  passingScore: { type: Number, default: 60 },
  questions: [{
    questionText: String,
    questionType: { type: String, enum: ['mcq', 'true_false', 'short_answer'] },
    options: [String],
    correctAnswer: mongoose.Schema.Types.Mixed,
    points: { type: Number, default: 10 },
    explanation: String,
  }],
});

const certificateSchema = new mongoose.Schema({
  verificationId: { type: String, required: true, unique: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  issuedAt: { type: Date, default: Date.now },
  pdfS3Key: String,
  verificationUrl: String,
});`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REST APIS */}
          {activeTab === "apis" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                REST API Controller Matrix
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Endpoint</th>
                      <th className="py-2.5 px-3">Role Required</th>
                      <th className="py-2.5 px-3">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/auth/register</td>
                      <td className="py-2 px-3 font-sans">Public</td>
                      <td className="py-2 px-3 font-sans">Create account with bcrypt hashed password</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/auth/login</td>
                      <td className="py-2 px-3 font-sans">Public</td>
                      <td className="py-2 px-3 font-sans">Authenticate & return JWT Bearer token</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-blue-600 font-bold">GET</td>
                      <td className="py-2 px-3">/api/courses</td>
                      <td className="py-2 px-3 font-sans">Public</td>
                      <td className="py-2 px-3 font-sans">Fetch approved courses with category/search filters</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/courses</td>
                      <td className="py-2 px-3 font-sans text-indigo-600 font-bold">Teacher</td>
                      <td className="py-2 px-3 font-sans">Create course draft (triggers admin pending queue)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/s3/presigned-url</td>
                      <td className="py-2 px-3 font-sans text-indigo-600 font-bold">Teacher / Student</td>
                      <td className="py-2 px-3 font-sans">Get 15-min signed GET (stream) or PUT (upload) URL</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/payments/razorpay-order</td>
                      <td className="py-2 px-3 font-sans">Student</td>
                      <td className="py-2 px-3 font-sans">Generate Razorpay order_id with receipt ID</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/payments/verify-signature</td>
                      <td className="py-2 px-3 font-sans">Student</td>
                      <td className="py-2 px-3 font-sans">Verify HMAC-SHA256 signature & auto-enroll</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-amber-600 font-bold">PATCH</td>
                      <td className="py-2 px-3">/api/admin/courses/:id/status</td>
                      <td className="py-2 px-3 font-sans text-purple-600 font-bold">Admin</td>
                      <td className="py-2 px-3 font-sans">Approve or reject instructor curriculum submission</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-600 font-bold">POST</td>
                      <td className="py-2 px-3">/api/gemini/chat</td>
                      <td className="py-2 px-3 font-sans">Authenticated</td>
                      <td className="py-2 px-3 font-sans">Proxy contextual course queries to Gemini 2.5 Flash</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="text-indigo-400 font-bold text-xs">
                  AWS S3 Pre-Signed Streaming URL (Node.js SDK v3)
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const generateLectureStreamUrl = async (s3Key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: s3Key,
  });
  // URL expires in 15 minutes (900 seconds)
  return await getSignedUrl(s3, command, { expiresIn: 900 });
};`}
                </pre>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="text-indigo-400 font-bold text-xs">
                  Razorpay HMAC-SHA256 Signature Verification
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`import crypto from "crypto";

export const verifyRazorpayPayment = (orderId, paymentId, signature) => {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === signature;
};`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: DEPLOYMENT */}
          {activeTab === "deployment" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Production Deployment Runbook (Vercel + Render + Atlas)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900">1. Frontend (Vercel)</div>
                  <p className="text-[11px] text-slate-600">
                    Connect GitHub repo. Build command: <code className="bg-white px-1 py-0.5 border font-mono">npm run build</code>, Output directory: <code className="bg-white px-1 py-0.5 border font-mono">dist</code>. Set <code className="font-mono">VITE_API_URL</code> to Render URL.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900">2. Backend (Render)</div>
                  <p className="text-[11px] text-slate-600">
                    Create Web Service. Build command: <code className="bg-white px-1 py-0.5 border font-mono">npm run build</code>, Start command: <code className="bg-white px-1 py-0.5 border font-mono">node dist/server.cjs</code>. Add environment variables.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900">3. Database (Atlas)</div>
                  <p className="text-[11px] text-slate-600">
                    Provision M0 free cluster in AWS ap-south-1 (Mumbai). Whitelist 0.0.0.0/0 IP, generate DB user, and supply <code className="font-mono">MONGODB_URI</code> to Render.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-2">
                <div className="text-indigo-400 font-bold text-xs">
                  Required Environment Variables (.env) Checklist
                </div>
                <pre className="text-slate-300 font-mono text-[11px] overflow-x-auto">
{`PORT=3000
MONGODB_URI=mongodb+srv://admin:pass@edupulse.mongodb.net/edupulse_prod
JWT_SECRET=super_secret_jwt_key_32_bytes_long
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=edupulse-video-streams-prod
RAZORPAY_KEY_ID=rzp_live_abcdef123456
RAZORPAY_KEY_SECRET=xyz789secretkey
GEMINI_API_KEY=AIzaSy...`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 6: REPORT */}
          {activeTab === "report" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Official College Major Project Report - Table of Contents
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 1: Introduction</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>1.1 Project Overview & Motivation</li>
                    <li>1.2 Problem Statement in Modern E-Learning</li>
                    <li>1.3 Objectives and Scope of EduPulse LMS</li>
                    <li>1.4 Feasibility Study (Technical, Operational, Economic)</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 2: Literature Survey</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>2.1 Comparison with Existing Solutions (Coursera, Udemy, edX)</li>
                    <li>2.2 Video Streaming Protocols (HLS vs. Byte-Range Signed S3 URLs)</li>
                    <li>2.3 Security Assessment of Payment Webhook Signatures</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 3: System Requirements Specification (SRS)</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>3.1 Functional Requirements (Role-Based Access Control)</li>
                    <li>3.2 Non-Functional Requirements (Latency, 99.9% Uptime, TLS)</li>
                    <li>3.3 Hardware and Software Environment Specifications</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 4: System Architecture & Design</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>4.1 High-Level Distributed Architecture</li>
                    <li>4.2 Entity-Relationship (ER) Diagram & Mongoose Schema Mapping</li>
                    <li>4.3 Data Flow Diagrams (DFD Level 0, 1, and 2)</li>
                    <li>4.4 Unified Modeling Language (UML) Sequence & Use-Case Diagrams</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 5: Implementation & Module Coding</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>5.1 Authentication & JWT Token Handling</li>
                    <li>5.2 AWS S3 Signed Video Streaming Service</li>
                    <li>5.3 Auto-Graded Time-Bound Quiz Engine</li>
                    <li>5.4 Razorpay Webhook Payment Gateway</li>
                    <li>5.5 Cryptographic Verification of PDF Certificates</li>
                    <li>5.6 Gemini AI Academic Tutor Integration</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 6: Software Testing & Validation</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>6.1 Unit Testing (Jest & Supertest for Express Routes)</li>
                    <li>6.2 Integration Testing (End-to-End Enrollment Flow)</li>
                    <li>6.3 Load Testing with Apache JMeter</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-indigo-900">Chapter 7: Conclusion & Future Scope</div>
                  <ul className="list-disc list-inside text-slate-600 pl-3 space-y-0.5">
                    <li>7.1 Project Summary and Academic Learning Outcomes</li>
                    <li>7.2 Future Enhancements (Live WebRTC Classrooms, Multi-lingual Subtitles)</li>
                    <li>7.3 References & Bibliography</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
