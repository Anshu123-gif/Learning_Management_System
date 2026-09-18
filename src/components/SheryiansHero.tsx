import React, { useState } from "react";
import {
  Play,
  ArrowRight,
  PhoneCall,
  Sparkles,
  Users,
  Award,
  Terminal,
  Code2,
  ChevronRight,
  PlayCircle,
  FolderGit2,
  CheckCircle2,
  Star,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLms } from "../context/LmsContext";
import { Course } from "../types";
import { CourseCard } from "./CourseCard";

interface SheryiansHeroProps {
  onStartJourney: () => void;
  onSelectCourse: (course: Course) => void;
  onRequestCall: () => void;
  onOpenDossier: () => void;
}

export const SheryiansHero: React.FC<SheryiansHeroProps> = ({
  onStartJourney,
  onSelectCourse,
  onRequestCall,
  onOpenDossier,
}) => {
  const { openAuthModal, isAuthenticated } = useAuth();
  const { courses } = useLms();

  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = ["All", "Web Development", "Frontend", "Cloud & DevOps", "System Design"];

  const filteredCourses = courses.filter((c) => {
    if (activeCategory === "All") return true;
    return c.category === activeCategory;
  });

  return (
    <div className="relative text-white overflow-hidden pb-20">
      {/* Background Grid & Cyber Geometric Overlays */}
      <div className="absolute inset-0 sheryians-grid opacity-35 pointer-events-none" />
      <div className="absolute inset-0 sheryians-radial-glow pointer-events-none" />

      {/* Decorative Geometric Wireframe Lines from Sheryians UI */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[560px] pointer-events-none border border-neutral-800/60 rounded-3xl opacity-30 [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]">
        <div className="absolute -top-3 left-12 px-3 py-1 bg-[#0b0b0c] text-[10px] font-mono text-neutral-500 uppercase tracking-widest border border-neutral-800 rounded">
          SYSTEM.PROD // SHERYIANS_CORE
        </div>
      </div>

      {/* Main Hero Header */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 text-center">
        {/* Top Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs tracking-widest font-semibold text-[#E84A27] uppercase mb-8 shadow-inner animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E84A27]"></span>
          <span>LEARN. BUILD. GET PLACED.</span>
        </div>

        {/* Sheryians Signature Hero Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.12] mb-6 font-display">
          Become The Software Engineer <br className="hidden sm:inline" />
          That{" "}
          <span className="relative inline-block px-3 py-0.5 mx-1 border border-[#E84A27]/60 rounded-md bg-[#E84A27]/10 text-white shadow-[0_0_25px_rgba(232,74,39,0.25)]">
            Companies
          </span>{" "}
          Want To Hire!
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-400 font-normal leading-relaxed mb-8">
          Join a growing community of students preparing for real-world tech careers at
          Sheryians.
        </p>

        {/* Student Avatars + 1 Million+ Social Proof */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <div className="flex items-center -space-x-2">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Student"
              className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
              alt="Student"
              className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
              alt="Student"
              className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
              alt="Student"
              className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover"
            />
          </div>
          <div className="text-xs sm:text-sm text-neutral-300">
            <span className="font-bold text-[#E84A27]">1 Million+</span>{" "}
            Students learning in our mastery programs
          </div>
        </div>

        {/* Primary CTA Button: Start Journey */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            id="sheryians-start-journey-btn"
            onClick={onStartJourney}
            className="px-8 py-3.5 bg-gradient-to-r from-[#E84A27] to-[#D03816] hover:from-[#f05533] hover:to-[#df401d] text-white font-semibold text-base rounded-xl shadow-lg shadow-[#E84A27]/25 hover:shadow-[#E84A27]/40 hover:scale-102 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Start Journey</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onRequestCall}
            className="px-6 py-3.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 hover:text-white font-medium text-sm rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 text-[#E84A27]" />
            <span>Request Call</span>
          </button>
        </div>
      </div>

      {/* 3 Prominent Sheryians Feature Banners (Bottom Carousel / Cards from Screenshot) */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-16 sm:mt-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: 600k YouTube Subscribers */}
          <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 backdrop-blur-md hover:border-[#E84A27]/40 transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white font-display">600k</div>
                  <div className="text-xs text-neutral-400">Sheryians Subscriber</div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                YOUTUBE
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              India's fastest growing community of web artisans learning industry-grade MERN, GSAP animations & modern system design.
            </p>
          </div>

          {/* Card 2: 01 Million Career-Driven Learners */}
          <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 backdrop-blur-md hover:border-[#E84A27]/40 transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white font-display">01 Million</div>
                  <div className="text-xs text-neutral-400">Career-Driven Learners</div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                COMMUNITY
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Structured step-by-step roadmaps, viva questions, full-stack capstone projects, and placement assistance.
            </p>
          </div>

          {/* Card 3: Start Learning Interactive Spotlight */}
          <div
            onClick={onStartJourney}
            className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-[#E84A27]/15 border border-[#E84A27]/30 backdrop-blur-md hover:border-[#E84A27] transition-all flex flex-col justify-between cursor-pointer group shadow-lg shadow-[#E84A27]/5"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#E84A27] font-semibold uppercase tracking-wider">
                  ENROLL TODAY
                </span>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#E84A27] group-hover:translate-x-1 transition-all" />
              </div>
              <div className="text-2xl font-bold text-white font-display mb-1">
                Start Learning
              </div>
              <p className="text-xs text-neutral-400">
                Explore our certified live cohorts & offline batches with mentors.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs font-medium text-neutral-300">
              <span>View All 6+ Cohorts</span>
              <span className="text-[#E84A27]">Instant Access →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Section with Sheryians Dark Aesthetic */}
      <div id="sheryians-courses-section" className="max-w-6xl mx-auto px-4 sm:px-6 mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#E84A27] mb-1">
              CURATED BOOTCAMPS & COURSES
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
              Mastery Programs & Cohorts
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[#E84A27] text-white shadow-sm shadow-[#E84A27]/30"
                    : "bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Courses Grid with Sheryians Dark Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course._id}
              className="bg-neutral-900/90 rounded-2xl border border-neutral-800 hover:border-[#E84A27]/50 shadow-md transition-all duration-300 flex flex-col overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden bg-neutral-950">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-white text-xs font-semibold flex items-center gap-1">
                    <PlayCircle className="w-4 h-4 text-[#E84A27]" /> Preview Syllabus
                  </span>
                </div>

                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/80 text-neutral-200 border border-neutral-700/60 backdrop-blur-xs">
                    {course.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E84A27]/20 text-[#E84A27] border border-[#E84A27]/40">
                    {course.level}
                  </span>
                </div>
              </div>

              {/* Course Info */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#E84A27] transition-colors line-clamp-1 mb-1.5">
                    {course.title}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed mb-4">
                    {course.subtitle}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-neutral-400 mb-4 pb-3 border-b border-neutral-800">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="font-semibold">{course.rating.toFixed(1)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{course.studentsEnrolled.toLocaleString()} learners</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-lg font-bold text-white font-mono">
                      ₹{course.price}
                    </span>
                    <span className="text-[11px] text-neutral-500 line-through ml-2">
                      ₹{course.originalPrice}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectCourse(course)}
                    className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-[#E84A27] text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Explore</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
