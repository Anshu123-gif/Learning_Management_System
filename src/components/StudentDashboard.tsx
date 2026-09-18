import React from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  PlayCircle,
  FileCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";
import { Course } from "../types";

interface StudentDashboardProps {
  onStartLearning: (course: Course) => void;
  onOpenCertificate: (courseId: string) => void;
  onExploreCourses: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onStartLearning,
  onOpenCertificate,
  onExploreCourses,
}) => {
  const { courses, enrollments, certificates, quizAttempts } = useLms();
  const { currentUser, openAuthModal } = useAuth();

  if (!currentUser) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Login to Access Your Learning
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Please login or create an account to view your enrolled batches, watch course lectures, solve quizzes, and download verified certificates.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => openAuthModal("login")}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            Login / Register Now
          </button>
          <button
            onClick={onExploreCourses}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all cursor-pointer"
          >
            Browse Batches
          </button>
        </div>
      </div>
    );
  }

  const myEnrollments = enrollments.filter((e) => e.studentId === currentUser._id);
  const enrolledCourses = courses.filter((c) =>
    myEnrollments.some((e) => e.courseId === c._id)
  );

  const completedCount = myEnrollments.filter((e) => e.progressPercent === 100).length;
  const myCertificates = certificates.filter((c) => c.studentId === currentUser._id);

  return (
    <div className="space-y-8 pb-16">
      {/* Student Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-2xl object-cover ring-4 ring-indigo-400/30"
            />
            <div>
              <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                Student Learning Portal
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Welcome back, {currentUser.name}!
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Track your active lecture milestones, exam qualifications, and verified credentials.
              </p>
            </div>
          </div>

          <button
            onClick={onExploreCourses}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Enrolled Courses</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {myEnrollments.length}
          </div>
          <div className="text-[11px] text-slate-400">Active enrollments</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Completed Courses</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {completedCount}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            100% video milestone
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Verified Certificates</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {myCertificates.length}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold">
            Cryptographically signed
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Exams Attempted</span>
            <FileCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {quizAttempts.length}
          </div>
          <div className="text-[11px] text-slate-400">Auto-graded sessions</div>
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Courses in Progress</h2>
          <span className="text-xs text-slate-500">
            {enrolledCourses.length} active courses
          </span>
        </div>

        {enrolledCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enrolledCourses.map((course) => {
              const enrollment = myEnrollments.find((e) => e.courseId === course._id);
              const progress = enrollment?.progressPercent || 0;
              const hasCertificate = myCertificates.some((c) => c.courseId === course._id);

              return (
                <div
                  key={course._id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col sm:flex-row"
                >
                  <div className="sm:w-48 aspect-video sm:aspect-auto bg-slate-900 relative">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center sm:hidden">
                      <PlayCircle className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                        {course.category}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1 line-clamp-2">
                        {course.title}
                      </h3>
                      <div className="text-xs text-slate-500 mt-1">
                        Instructor: {course.instructorName}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600">Completion</span>
                        <span className="text-indigo-600">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => onStartLearning(course)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>{progress === 0 ? "Start Course" : "Resume Lecture"}</span>
                        </button>

                        {hasCertificate && (
                          <button
                            onClick={() => onOpenCertificate(course._id)}
                            className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1"
                            title="View Verified Certificate"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-600" />
                            <span>Certificate</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800">You haven't enrolled in any courses yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Explore our curriculum to start learning full-stack development and earning credentials.
            </p>
            <button
              onClick={onExploreCourses}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg"
            >
              Browse Catalog
            </button>
          </div>
        )}
      </div>

      {/* Verified Certificates Vault */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900">
              Verified Certificates Vault
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {myCertificates.length} credentials earned
          </span>
        </div>

        {myCertificates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myCertificates.map((cert) => (
              <div
                key={cert._id}
                className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm font-bold">
                      {cert.verificationId}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1.5 line-clamp-1">
                      {cert.courseTitle}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Issued on: {cert.issuedAt} • Instructor: {cert.instructorName}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified
                  </span>
                  <button
                    onClick={() => onOpenCertificate(cert.courseId)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    View & Print PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
            Complete 100% of video lectures and pass the final certification exam (≥60%) to generate your first credential.
          </div>
        )}
      </div>
    </div>
  );
};
