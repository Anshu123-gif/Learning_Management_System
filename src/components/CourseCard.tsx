import React from "react";
import { Star, Users, Clock, PlayCircle, CheckCircle2, Bookmark } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Course } from "../types";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";

interface CourseCardProps {
  course: Course;
  onSelectCourse: (course: Course) => void;
  onStartLearning?: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onSelectCourse,
  onStartLearning,
}) => {
  const { isEnrolled, getEnrollmentForCourse } = useLms();
  const { isWishlisted, updateUserWishlist, activeRole, isAuthenticated, openAuthModal } = useAuth();

  const enrolled = isEnrolled(course._id);
  const enrollment = getEnrollmentForCourse(course._id);
  const wishlisted = isWishlisted(course._id);

  const totalLectures = course.sections.flatMap((s) => s.lectures).length;
  const totalDuration = course.sections
    .flatMap((s) => s.lectures)
    .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

  const shouldReduceMotion = useReducedMotion();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ rotateX: 0, rotateY: 0 });
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(window.matchMedia("(hover: none) or (pointer: coarse)").matches);
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || isTouchDevice || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: -y * 6,
      rotateY: x * 6,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform:
          shouldReduceMotion || isTouchDevice
            ? undefined
            : `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        transition:
          "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease",
      }}
      whileHover={shouldReduceMotion || isTouchDevice ? {} : { y: -4 }}
      className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group will-change-transform"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span className="text-white text-xs font-semibold flex items-center gap-1">
            <PlayCircle className="w-4 h-4 text-indigo-400" /> Preview Syllabus
          </span>
        </div>

        {/* Category & Status Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/95 text-slate-800 backdrop-blur-xs shadow-2xs">
            {course.category}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900/80 text-white backdrop-blur-xs">
            {course.level}
          </span>
        </div>

        {/* Status Pill for Teacher & Admin */}
        {course.status !== "approved" && (
          <div className="absolute top-2.5 right-2.5">
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                course.status === "pending"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-rose-100 text-rose-800 border border-rose-300"
              }`}
            >
              {course.status}
            </span>
          </div>
        )}

        {/* Wishlist Button for Students */}
        {(!activeRole || activeRole === "student") && !enrolled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isAuthenticated) {
                openAuthModal("login");
                return;
              }
              updateUserWishlist(course._id);
            }}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-rose-500 shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            title="Wishlist"
          >
            <Bookmark
              className={`w-4 h-4 ${wishlisted ? "fill-rose-500 text-rose-500" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3
            onClick={() => onSelectCourse(course)}
            className="font-bold text-slate-900 text-base line-clamp-2 hover:text-indigo-600 cursor-pointer transition-colors leading-snug"
          >
            {course.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {course.subtitle}
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <img
              src={course.instructorAvatar}
              alt={course.instructorName}
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-xs text-slate-600 font-medium">
              {course.instructorName}
            </span>
          </div>

          {/* Rating & Enrolled count */}
          <div className="flex items-center gap-3 mt-3 text-xs">
            <div className="flex items-center gap-1 font-bold text-amber-600">
              <span>{course.rating > 0 ? course.rating.toFixed(1) : "New"}</span>
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {course.ratingsCount > 0 && (
                <span className="text-slate-400 font-normal">
                  ({course.ratingsCount})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{course.studentsEnrolled.toLocaleString()} students</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> {totalDuration} mins
            </span>
            <span>•</span>
            <span>{totalLectures} lectures</span>
          </div>
        </div>

        {/* Footer / Action */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          {enrolled ? (
            <div className="w-full">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  {enrollment?.progressPercent === 100 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : null}
                  Progress
                </span>
                <span className="font-bold text-indigo-600">
                  {enrollment?.progressPercent || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${enrollment?.progressPercent || 0}%` }}
                />
              </div>
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    openAuthModal("login", () => onStartLearning?.(course));
                    return;
                  }
                  onStartLearning?.(course);
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" /> Continue Learning
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold text-slate-900">
                  ₹{course.price.toLocaleString()}
                </span>
                {course.originalPrice > course.price && (
                  <span className="text-xs text-slate-400 line-through">
                    ₹{course.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => onSelectCourse(course)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                View Syllabus
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
