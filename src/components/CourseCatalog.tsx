import React, { useState } from "react";
import {
  Layers,
  Filter,
  Flame,
  Award,
  Video,
  Database,
  CheckCircle,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { Course } from "../types";
import { CourseCard } from "./CourseCard";
import { useLms } from "../context/LmsContext";

interface CourseCatalogProps {
  searchQuery: string;
  onSelectCourse: (course: Course) => void;
  onStartLearning: (course: Course) => void;
  onOpenDossier: () => void;
}

const CATEGORIES = [
  "All Categories",
  "Web Development",
  "Frontend",
  "Cloud & DevOps",
  "System Design",
];

const LEVELS = ["All Levels", "Beginner", "Intermediate", "Advanced"];

export const CourseCatalog: React.FC<CourseCatalogProps> = ({
  searchQuery,
  onSelectCourse,
  onStartLearning,
  onOpenDossier,
}) => {
  const { courses } = useLms();
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [sortBy, setSortBy] = useState<"popularity" | "rating" | "price-low" | "price-high">("popularity");

  // Filter approved courses for general catalog (admin & teacher can see pending in their dashboards)
  const approvedCourses = courses.filter((c) => c.status === "approved");

  const filteredCourses = approvedCourses.filter((course) => {
    const matchesSearch =
      !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.learningOutcomes.some((o) =>
        o.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      selectedCategory === "All Categories" || course.category === selectedCategory;

    const matchesLevel =
      selectedLevel === "All Levels" || course.level === selectedLevel;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  // Sort
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    if (sortBy === "popularity") return b.studentsEnrolled - a.studentsEnrolled;
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    return 0;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner with Academic Project Accents */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Final Year Major Project Architecture • MERN Stack LMS</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Learn Production Software Engineering, Handcrafted for Industry.
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            A production-grade Udemy replica built with MongoDB Atlas, Express REST architecture, React 19, AWS S3 secure signed-URL video streaming, auto-graded exams, and verified cryptographic certificates.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={onOpenDossier}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all hover:gap-2.5"
            >
              <span>Explore SRS & Mongoose Schemas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-400 px-2 py-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Razorpay Integrated
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Gemini AI Tutor
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">AWS S3 Streaming</div>
              <div className="text-[11px] text-slate-400">Signed URL TTL</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Auto-Graded Exams</div>
              <div className="text-[11px] text-slate-400">Timed Quizzes</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Verified Certs</div>
              <div className="text-[11px] text-slate-400">Unique QR ID</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">MongoDB Atlas</div>
              <div className="text-[11px] text-slate-400">13 Normalized Schemas</div>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
      </section>

      {/* Filter & Category Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/20"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Level & Sort Filters */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Flame className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden"
              >
                <option value="popularity">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-800">{sortedCourses.length}</strong> available courses
            {selectedCategory !== "All Categories" && ` in ${selectedCategory}`}
          </span>
          {searchQuery && (
            <span>
              Matching query: <strong className="text-indigo-600">"{searchQuery}"</strong>
            </span>
          )}
        </div>
      </section>

      {/* Courses Grid */}
      {sortedCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCourses.map((course) => (
            <CourseCard
              key={course._id}
              course={course}
              onSelectCourse={onSelectCourse}
              onStartLearning={onStartLearning}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 p-8 space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No courses found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or clear the search query to view the curriculum.
          </p>
          <button
            onClick={() => {
              setSelectedCategory("All Categories");
              setSelectedLevel("All Levels");
            }}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-lg hover:bg-indigo-100"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
