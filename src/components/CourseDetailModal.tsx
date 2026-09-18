import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  PlayCircle,
  Clock,
  BookOpen,
  Award,
  Shield,
  Star,
  Users,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Zap,
} from "lucide-react";
import { Course } from "../types";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";

interface CourseDetailModalProps {
  course: Course | null;
  onClose: () => void;
  onEnroll: (course: Course) => void;
  onStartLearning: (course: Course) => void;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  course,
  onClose,
  onEnroll,
  onStartLearning,
}) => {
  const { isEnrolled, getEnrollmentForCourse } = useLms();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sec_1: true,
    sec_2: true,
  });

  if (!course) return null;

  const enrolled = isEnrolled(course._id);
  const enrollment = getEnrollmentForCourse(course._id);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const totalLectures = course.sections.flatMap((s) => s.lectures).length;
  const totalMinutes = course.sections
    .flatMap((s) => s.lectures)
    .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {course.category}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Level: {course.level}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-8 flex-1">
          {/* Top Banner / Hero Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                {course.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {course.subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-1 font-bold text-amber-600">
                  <span>{course.rating.toFixed(1)}</span>
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                    ))}
                  </div>
                  <span className="text-slate-500 font-normal">
                    ({course.ratingsCount} ratings)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{course.studentsEnrolled.toLocaleString()} students enrolled</span>
                </div>

                <div className="text-slate-500">
                  Last updated: <span className="font-semibold text-slate-700">{course.updatedAt}</span>
                </div>
              </div>

              {/* Instructor snippet */}
              <div className="flex items-center gap-3 pt-2">
                <img
                  src={course.instructorAvatar}
                  alt={course.instructorName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="text-xs text-slate-500">Created by</div>
                  <div className="text-sm font-bold text-slate-900">
                    {course.instructorName}
                  </div>
                  <div className="text-xs text-slate-500">{course.instructorTitle}</div>
                </div>
              </div>
            </div>

            {/* Sticky Card Preview on right */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-indigo-600">
                    <PlayCircle className="w-7 h-7 fill-indigo-600 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white/90 bg-black/60 backdrop-blur-xs py-1 rounded-sm">
                  Preview Video Available
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">
                    ₹{course.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-400 line-through">
                    ₹{course.originalPrice.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">
                    70% OFF
                  </span>
                </div>

                {enrolled ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>You are enrolled in this course!</span>
                    </div>
                    <button
                      onClick={() => {
                        if (!isAuthenticated) {
                          openAuthModal("login", () => onStartLearning(course));
                          return;
                        }
                        onStartLearning(course);
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" /> Continue to Classroom
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (!isAuthenticated) {
                          openAuthModal("login", () => onEnroll(course));
                          return;
                        }
                        onEnroll(course);
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-white" /> Enroll with Razorpay
                    </button>
                    <p className="text-[11px] text-center text-slate-500">
                      30-Day Money-Back Guarantee • Lifetime Access
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{totalMinutes} minutes on-demand video</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Downloadable SRS and code resources</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Certificate of completion with verification ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span>S3 presigned stream security</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What You'll Learn Box */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900">What you'll learn</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-700">
              {course.learningOutcomes.map((outcome, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{outcome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Course Content Curriculum Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Course content</h3>
                <p className="text-xs text-slate-500">
                  {course.sections.length} sections • {totalLectures} lectures • {totalMinutes}m total length
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200 bg-white">
              {course.sections.map((section) => {
                const isOpen = expandedSections[section._id] ?? true;
                const sectionMinutes = section.lectures.reduce(
                  (acc, l) => acc + l.durationMinutes,
                  0
                );

                return (
                  <div key={section._id} className="transition-colors">
                    <button
                      onClick={() => toggleSection(section._id)}
                      className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-800">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                        <span>{section.title}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {section.lectures.length} lectures • {sectionMinutes}m
                      </div>
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-slate-100 bg-white">
                        {section.lectures.map((lecture) => (
                          <div
                            key={lecture._id}
                            className="px-5 py-3 flex items-center justify-between text-xs hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 text-slate-800">
                              <PlayCircle className="w-4 h-4 text-indigo-500" />
                              <span className="font-medium">{lecture.title}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              {lecture.isPreviewFree ? (
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                                  Preview
                                </span>
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span className="text-slate-500 text-[11px]">
                                {lecture.durationMinutes}m
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Requirements & Description */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Requirements</h3>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1.5 pl-1">
              {course.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>

            <h3 className="text-base font-bold text-slate-900 pt-2">Description</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {course.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
