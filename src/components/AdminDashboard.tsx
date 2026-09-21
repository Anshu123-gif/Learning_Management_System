import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Users,
  BookOpen,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";
import { Course } from "../types";

interface AdminDashboardProps {
  onSelectCourse: (course: Course) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectCourse,
}) => {
  const { courses, approveCourse, rejectCourse, payments, processRefund } = useLms();
  const { currentUser, openAuthModal } = useAuth();

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Admin Control Room Access
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Please login with administrator credentials to approve courses, audit transactions, and process refunds.
        </p>
        <div className="flex justify-center items-center gap-3 pt-2">
          <button
            onClick={() => openAuthModal("login")}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            Sign In with Administrator Credentials
          </button>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"courses" | "users" | "payments">("courses");

  // Filter pending courses
  const pendingCourses = courses.filter((c) => c.status === "pending");
  const approvedCourses = courses.filter((c) => c.status === "approved");

  const totalPlatformRevenue = payments.reduce((acc, p) => acc + (p.status === "captured" ? p.amount : 0), 0);
  const totalStudentsCount = courses.reduce((acc, c) => acc + c.studentsEnrolled, 0);

  // Simulated users list for admin user management
  const usersList = [
    {
      _id: "usr_student_1",
      name: "Rahul Sharma",
      email: "rahul.sharma@college.edu",
      role: "student",
      joinedAt: "2025-01-10",
      status: "active",
      enrolledCount: 3,
    },
    {
      _id: "usr_teacher_1",
      name: "Prof. Priya Swaminathan",
      email: "priya.swaminathan@edupulse.org",
      role: "teacher",
      joinedAt: "2024-11-15",
      status: "active",
      enrolledCount: 2840,
    },
    {
      _id: "usr_teacher_2",
      name: "Aditya Roy",
      email: "aditya.roy@edupulse.org",
      role: "teacher",
      joinedAt: "2024-12-01",
      status: "active",
      enrolledCount: 4120,
    },
    {
      _id: "usr_admin_1",
      name: "Dean Vikram Mehta",
      email: "admin@edupulse.org",
      role: "admin",
      joinedAt: "2024-09-01",
      status: "active",
      enrolledCount: 0,
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center ring-4 ring-indigo-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                System Administrator Console
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Platform Governance & Analytics
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Audit instructor course submissions, monitor Razorpay transactions, and regulate user privileges.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cluster Healthy • Atlas Online</span>
            </span>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Platform Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ₹{totalPlatformRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +18.4% this month
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Pending Approvals</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {pendingCourses.length}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold">
            Action required
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Published Courses</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {approvedCourses.length}
          </div>
          <div className="text-[11px] text-slate-400">Live in catalog</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Platform Students</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {totalStudentsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Enrolled accounts</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("courses")}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "courses"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Course Approval & Moderation ({pendingCourses.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "users"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Role Administration</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Payment Ledger & Refunds</span>
        </button>
      </div>

      {/* Tab: Course Moderation */}
      {activeTab === "courses" && (
        <div className="space-y-6">
          {/* Pending Approval Section */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pending Course Moderation Queue
                </h2>
                <p className="text-xs text-slate-500">
                  Review new instructor courses before making them discoverable in the public catalog
                </p>
              </div>
            </div>

            {pendingCourses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Instructor</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Tuition</th>
                      <th className="py-3 px-4 text-right">Moderation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingCourses.map((course) => (
                      <tr key={course._id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{course.title}</div>
                          <div className="text-[11px] text-slate-500">{course.subtitle}</div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{course.instructorName}</div>
                          <div className="text-[10px] text-slate-400">{course.instructorTitle}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100 font-medium text-slate-700">
                            {course.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{course.price.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onSelectCourse(course)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                            >
                              Inspect
                            </button>
                            <button
                              onClick={() => approveCourse(course._id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => rejectCourse(course._id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-xl">
                No courses waiting in the approval queue. All submitted courses are processed!
              </div>
            )}
          </div>

          {/* All Live Courses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Active Platform Catalog ({approvedCourses.length} Approved Courses)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Instructor</th>
                    <th className="py-3 px-4">Enrollments</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvedCourses.map((c) => (
                    <tr key={c._id}>
                      <td className="py-3 px-4 font-bold text-slate-900">{c.title}</td>
                      <td className="py-3 px-4 text-slate-600">{c.category}</td>
                      <td className="py-3 px-4 text-slate-700">{c.instructorName}</td>
                      <td className="py-3 px-4 font-semibold text-indigo-600">
                        {c.studentsEnrolled.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                          Approved
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: User Administration */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">User Access Management</h2>
              <p className="text-xs text-slate-500">
                Manage roles and system permissions across Students, Instructors, and Administrators
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((usr) => (
                  <tr key={usr._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{usr.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{usr.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          usr.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : usr.role === "teacher"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {usr.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500">{usr.joinedAt}</td>

                    <td className="py-3 px-4 text-slate-600">
                      {usr.role === "teacher"
                        ? `${usr.enrolledCount} total students taught`
                        : usr.role === "student"
                        ? `${usr.enrolledCount} courses enrolled`
                        : "Full Governance"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Payments & Refunds */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Razorpay Transactions & Refund Gateway
              </h2>
              <p className="text-xs text-slate-500">
                Audit transaction IDs, webhook verification statuses, and trigger administrative refunds
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200 font-sans">
                <tr>
                  <th className="py-3 px-4">Payment ID / Order ID</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right font-sans">Refund Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">{p.razorpayPaymentId}</div>
                      <div className="text-[10px] text-slate-400">{p.razorpayOrderId}</div>
                    </td>

                    <td className="py-3 px-4 font-sans font-medium text-slate-800">
                      {p.courseTitle}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{p.amount.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px] font-sans">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase font-sans ${
                          p.status === "captured"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "refunded"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-sans">
                      {p.status === "captured" ? (
                        <button
                          onClick={() => {
                            if (confirm(`Confirm refund of ₹${p.amount} to student?`)) {
                              processRefund(p._id);
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-md text-[11px] transition-colors"
                        >
                          Process Refund
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Refund Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
