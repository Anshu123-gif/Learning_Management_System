import React, { useState, useRef, useEffect } from "react";
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
  ShieldCheck,
  Cpu,
  Layers,
  GraduationCap,
  MessageSquare,
  Compass,
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useLms } from "../context/LmsContext";
import { Course } from "../types";

interface SheryiansHeroProps {
  onStartJourney: () => void;
  onSelectCourse: (course: Course) => void;
  onRequestCall: () => void;
  onOpenDossier: () => void;
}

// ====================================================================
// 1. MAGNETIC BUTTON WITH SMOOTH SPRING & TOUCH/REDUCED-MOTION GUARDS
// ====================================================================
const MagneticCTAButton: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  id?: string;
  maxMovement?: number;
}> = ({ children, className = "", onClick, id, maxMovement = 7 }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const shouldReduceMotion = useReducedMotion();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(
        window.matchMedia("(hover: none) or (pointer: coarse)").matches
      );
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion || isTouchDevice || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Calculate normalized -1 to +1 delta from center
    const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
    const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
    setOffset({ x: deltaX * maxMovement, y: deltaY * maxMovement });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={buttonRef}
      id={id}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.5 }}
      whileHover={shouldReduceMotion || isTouchDevice ? {} : { scale: 1.03 }}
      whileTap={shouldReduceMotion || isTouchDevice ? {} : { scale: 0.98 }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.button>
  );
};

// ====================================================================
// 2. 3D TILT COURSE CARD WITH FEATURED FOCUS & IMAGE REVEAL
// ====================================================================
const TiltCourseCard: React.FC<{
  course: Course;
  isHovered: boolean;
  isAnyHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  index: number;
  shouldReduceMotion: boolean;
}> = ({
  course,
  isHovered,
  isAnyHovered,
  onHover,
  onClick,
  index,
  shouldReduceMotion,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(
        window.matchMedia("(hover: none) or (pointer: coarse)").matches
      );
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || isTouchDevice || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
    // Max tilt 3.5 degrees
    setTilt({
      rotateX: -y * 7,
      rotateY: x * 7,
    });
  };

  const handleMouseEnter = () => {
    onHover(course._id);
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
    onHover(null);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{
        duration: 0.5,
        delay: shouldReduceMotion ? 0 : (index % 3) * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform:
          shouldReduceMotion || isTouchDevice
            ? undefined
            : `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        transition:
          "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease, filter 0.3s ease",
      }}
      className={`relative rounded-2xl border bg-neutral-900/90 flex flex-col overflow-hidden cursor-pointer select-none will-change-transform ${
        isHovered
          ? "border-[#E84A27]/80 shadow-[0_12px_36px_-8px_rgba(232,74,39,0.35)] scale-[1.015] z-10"
          : isAnyHovered
          ? "border-neutral-800/80 opacity-70 contrast-95 scale-[0.99]"
          : "border-neutral-800 hover:border-neutral-700 shadow-md"
      }`}
    >
      {/* Thumbnail with Masked Smooth Zoom Reveal */}
      <div className="relative aspect-video overflow-hidden bg-neutral-950">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90 hover:opacity-100 will-change-transform"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <span className="text-white text-xs font-semibold flex items-center gap-1.5 drop-shadow-sm">
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
          <h3 className="text-base font-bold text-white transition-colors line-clamp-1 mb-1.5 font-display">
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
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-[#E84A27] text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Explore</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ====================================================================
// 3. STAT COUNTER (COUNT UP FROM 0 WHEN VISIBLE)
// ====================================================================
const StatCounter: React.FC<{
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}> = ({ value, suffix = "", prefix = "", decimals = 0 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(shouldReduceMotion ? value : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    if (!isInView) return;

    let startTime: number | null = null;
    let animationFrame: number;
    const duration = 1600; // ms

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = easeProgress * value;

      setDisplayValue(
        decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current)
      );

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, value, shouldReduceMotion, decimals]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
};

// ====================================================================
// MAIN COMPONENT: SHERYIANS HERO WITH CINEMATIC MOTION
// ====================================================================
export const SheryiansHero: React.FC<SheryiansHeroProps> = ({
  onStartJourney,
  onSelectCourse,
  onRequestCall,
  onOpenDossier,
}) => {
  const { courses } = useLms();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Pointer spotlight state
  const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpotlightVisible, setIsSpotlightVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(
        window.matchMedia("(hover: none) or (pointer: coarse)").matches
      );
    }
  }, []);

  // Scroll ref for hero parallax motion
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Final CTA section parallax ref
  const ctaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: ctaScrollProgress } = useScroll({
    target: ctaRef,
    offset: ["start end", "end start"],
  });
  const ctaGlowY = useTransform(
    ctaScrollProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : -22, shouldReduceMotion ? 0 : 22]
  );

  // Smooth scroll transforms (disabled if prefers-reduced-motion is true)
  const heroContentY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, shouldReduceMotion ? 0 : -45]
  );
  const heroOpacity = useTransform(
    scrollYProgress,
    [0, 0.85],
    [1, shouldReduceMotion ? 1 : 0]
  );
  const heroBgY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, shouldReduceMotion ? 0 : 35]
  );
  const heroVisualScale = useTransform(
    scrollYProgress,
    [0, 1],
    [1, shouldReduceMotion ? 1 : 0.96]
  );

  // Hero cursor spotlight move handler
  const handleHeroPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || isTouchDevice || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setSpotlightPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    if (!isSpotlightVisible) setIsSpotlightVisible(true);
  };

  const handleHeroPointerLeave = () => {
    setIsSpotlightVisible(false);
  };

  const categories = [
    "All",
    "Web Development",
    "Frontend",
    "Cloud & DevOps",
    "System Design",
  ];

  const filteredCourses = courses.filter((c) => {
    if (c.status !== "approved") return false;
    if (activeCategory === "All") return true;
    return c.category === activeCategory;
  });

  // Stagger animation variants for clean motion orchestration
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
        delayChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div className="relative text-white overflow-hidden pb-24 selection:bg-[#E84A27] selection:text-white">
      {/* ==================================================== */}
      {/* 1 & 2. HERO SECTION WITH CINEMATIC MOTION & PARALLAX */}
      {/* ==================================================== */}
      <div
        ref={heroRef}
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
        className="relative min-h-[88vh] flex flex-col justify-center"
      >
        {/* Cursor Spotlight - Very subtle ambient orange glow */}
        {!shouldReduceMotion && !isTouchDevice && isSpotlightVisible && (
          <div
            className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(480px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(232, 74, 39, 0.08), transparent 75%)`,
            }}
          />
        )}

        {/* Subtle Animated Background: Parallax Mesh & Soft Glow */}
        <motion.div
          style={{ y: heroBgY }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {/* Cyber Grid Base */}
          <div className="absolute inset-0 sheryians-grid opacity-30" />

          {/* Slow Ambient Radial Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] sm:w-[900px] h-[450px] sm:h-[600px] rounded-full bg-radial from-[#E84A27]/18 via-[#c83214]/6 to-transparent blur-3xl animate-mesh-slow pointer-events-none" />

          {/* Secondary Soft Cyan/Indigo Tech Accent Glow */}
          <div className="absolute top-1/3 left-1/4 w-[350px] sm:w-[500px] h-[350px] sm:h-[450px] rounded-full bg-radial from-indigo-500/10 via-transparent to-transparent blur-3xl pointer-events-none" />

          {/* Floating Subtle Ambient Particles with staggered variations */}
          <div className="absolute top-24 left-[15%] w-2 h-2 rounded-full bg-[#E84A27]/40 animate-float-1" />
          <div
            className="absolute top-48 right-[18%] w-2.5 h-2.5 rounded-full bg-amber-400/30 animate-float-2"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute top-80 left-[22%] w-1.5 h-1.5 rounded-full bg-indigo-400/30 animate-float-3"
            style={{ animationDelay: "3.5s" }}
          />

          {/* Subtle Architectural Grid Wireframe Frame with slow floating */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[580px] border border-neutral-800/40 rounded-3xl opacity-35 [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]">
            <div className="absolute -top-3 left-12 px-3 py-1 bg-[#0b0b0c] text-[10px] font-mono text-neutral-500 uppercase tracking-widest border border-neutral-800 rounded flex items-center gap-2 animate-float-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E84A27] animate-pulse" />
              <span>SYSTEM.PROD // EDUPULSE_CORE</span>
            </div>
          </div>
        </motion.div>

        {/* Hero Content with Scroll Parallax & Opacity Fade */}
        <motion.div
          style={{ y: heroContentY, opacity: heroOpacity, scale: heroVisualScale }}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 text-center"
        >
          {/* Motion Stagger Orchestration Container */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center"
          >
            {/* Top Eyebrow Badge with subtle float */}
            <motion.div variants={itemVariants} className="mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs tracking-widest font-semibold text-[#E84A27] uppercase shadow-inner backdrop-blur-md animate-float-1">
                <span className="w-2 h-2 rounded-full bg-[#E84A27] animate-pulse" />
                <span>LEARN. BUILD. GET PLACED.</span>
              </div>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.12] mb-6 font-display"
            >
              Become The Software Engineer <br className="hidden sm:inline" />
              That{" "}
              <span className="relative inline-block px-3 py-0.5 mx-1 border border-[#E84A27]/60 rounded-md bg-[#E84A27]/10 text-white shadow-[0_0_25px_rgba(232,74,39,0.25)]">
                Companies
              </span>{" "}
              Want To Hire!
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-400 font-normal leading-relaxed mb-8"
            >
              Master high-throughput distributed systems, production MERN applications,
              Cloudinary signed streaming, and verifiable credentials with mentors.
            </motion.p>

            {/* Student Avatars + Social Proof with subtle staggered floating */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center justify-center gap-3 mb-10"
            >
              <div className="flex items-center -space-x-2.5">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Student"
                  className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover animate-float-1"
                />
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                  alt="Student"
                  className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover animate-float-2"
                  style={{ animationDelay: "1.2s" }}
                />
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                  alt="Student"
                  className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover animate-float-3"
                  style={{ animationDelay: "2.4s" }}
                />
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                  alt="Student"
                  className="w-8 h-8 rounded-full border-2 border-[#0b0b0c] object-cover animate-float-1"
                  style={{ animationDelay: "3.6s" }}
                />
              </div>
              <div className="text-xs sm:text-sm text-neutral-300">
                <span className="font-bold text-[#E84A27]">1 Million+</span>{" "}
                Students learning in our mastery cohorts
              </div>
            </motion.div>

            {/* Magnetic CTA Action Buttons with Cursor Attraction & Glow */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <MagneticCTAButton
                id="sheryians-start-journey-btn"
                onClick={onStartJourney}
                maxMovement={8}
                className="px-8 py-3.5 bg-gradient-to-r from-[#E84A27] to-[#D03816] hover:from-[#f05533] hover:to-[#df401d] text-white font-semibold text-base rounded-xl shadow-lg shadow-[#E84A27]/25 hover:shadow-[#E84A27]/40 transition-shadow flex items-center gap-2 cursor-pointer"
              >
                <span>Start Journey</span>
                <ArrowRight className="w-4 h-4" />
              </MagneticCTAButton>

              <MagneticCTAButton
                onClick={onRequestCall}
                maxMovement={6}
                className="px-6 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white font-medium text-sm rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <PhoneCall className="w-4 h-4 text-[#E84A27]" />
                <span>Request Call</span>
              </MagneticCTAButton>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* SECTION TRANSITION CONNECTOR 1 */}
      <div className="relative max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#E84A27]/25 to-transparent my-4" />

      {/* ==================================================== */}
      {/* 6. STATISTICS COUNTER SECTION (REVEAL & 0 -> VALUE) */}
      {/* ==================================================== */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl"
        >
          {/* Stat 1: YouTube Community */}
          <div className="flex flex-col space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#E84A27]">
              YOUTUBE COMMUNITY
            </span>
            <div className="text-2xl sm:text-4xl font-extrabold text-white font-display">
              <StatCounter value={600} suffix="k+" />
            </div>
            <p className="text-xs text-neutral-400">
              Subscribers learning web artisans engineering
            </p>
          </div>

          {/* Stat 2: Active Learners */}
          <div className="flex flex-col space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
              CAREER LEARNERS
            </span>
            <div className="text-2xl sm:text-4xl font-extrabold text-white font-display">
              <StatCounter value={1} suffix=" Million+" />
            </div>
            <p className="text-xs text-neutral-400">
              Students enrolled across live & recorded cohorts
            </p>
          </div>

          {/* Stat 3: Placement Assistance */}
          <div className="flex flex-col space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400">
              PLACEMENT RATE
            </span>
            <div className="text-2xl sm:text-4xl font-extrabold text-white font-display">
              <StatCounter value={98} suffix="%" />
            </div>
            <p className="text-xs text-neutral-400">
              Of capstone graduates placed within 6 months
            </p>
          </div>

          {/* Stat 4: Capstone Roadmaps */}
          <div className="flex flex-col space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400">
              SYSTEM CAPSTONES
            </span>
            <div className="text-2xl sm:text-4xl font-extrabold text-white font-display">
              <StatCounter value={45} suffix="+" />
            </div>
            <p className="text-xs text-neutral-400">
              Production modules, viva tests & real APIs
            </p>
          </div>
        </motion.div>
      </div>

      {/* ==================================================== */}
      {/* 7. HORIZONTAL TECHNOLOGY & ARCHITECTURE MARQUEE */}
      {/* ==================================================== */}
      <div className="relative z-10 my-16 sm:my-20 overflow-hidden border-y border-neutral-800/80 bg-neutral-950/60 backdrop-blur-xs py-3.5 group">
        {/* Edge Gradient Masks for Seamless Vignette */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#0b0b0c] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#0b0b0c] to-transparent z-10 pointer-events-none" />

        <div className="animate-marquee flex items-center gap-8 whitespace-nowrap">
          {[
            "DSA & ALGORITHMS",
            "MERN FULLSTACK",
            "SYSTEM DESIGN",
            "NEXT.JS 15",
            "DOCKER & K8S",
            "TYPESCRIPT",
            "REDIS CACHING",
            "CLOUDINARY HD STREAMING",
            "AI & LLM AGENTS",
            "PYTHON & FASTAPI",
            "GRAPHQL APIs",
            "CI/CD DEVOPS",
            "POSTGRESQL & MONGO",
          ]
            .concat([
              "DSA & ALGORITHMS",
              "MERN FULLSTACK",
              "SYSTEM DESIGN",
              "NEXT.JS 15",
              "DOCKER & K8S",
              "TYPESCRIPT",
              "REDIS CACHING",
              "CLOUDINARY HD STREAMING",
              "AI & LLM AGENTS",
              "PYTHON & FASTAPI",
              "GRAPHQL APIs",
              "CI/CD DEVOPS",
              "POSTGRESQL & MONGO",
            ])
            .map((tech, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 text-xs font-mono tracking-widest text-neutral-400 uppercase select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#E84A27]/80" />
                <span className="hover:text-white transition-colors">{tech}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 8. WHY EDUPULSE / SHERYIANS FEATURES GRID */}
      {/* ==================================================== */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12">
        {/* Section Heading with Scroll Reveal */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-12 sm:mb-16"
        >
          <div className="text-xs font-mono uppercase tracking-widest text-[#E84A27] mb-2 font-semibold">
            THE ARCHITECTURAL DIFFERENCE
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-display tracking-tight">
            Why High-Growth Companies Hire Our Engineers
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">
            No shallow tutorials. Build end-to-end distributed applications with production code standards.
          </p>
        </motion.div>

        {/* 4 Feature Cards with Staggered Scroll Reveal & Lift */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: Cpu,
              tag: "ARCHITECTURE",
              title: "Production-Grade MERN",
              desc: "Deploy MongoDB Atlas, Express REST routers, indexed models, and React 19 micro-architectures.",
              color: "text-[#E84A27]",
              border: "group-hover:border-[#E84A27]/50",
              bg: "bg-[#E84A27]/10",
            },
            {
              icon: PlayCircle,
              tag: "HD STREAMING",
              title: "Cloudinary Video Player",
              desc: "Signed URL streaming, draggable scrubbers, playback speed controls, and persistent resume timestamps.",
              color: "text-amber-400",
              border: "group-hover:border-amber-500/50",
              bg: "bg-amber-500/10",
            },
            {
              icon: Award,
              tag: "ACCREDITATION",
              title: "Cryptographic Certs",
              desc: "Automated exam evaluation with tamper-proof certificate verification IDs and PDF downloads.",
              color: "text-emerald-400",
              border: "group-hover:border-emerald-500/50",
              bg: "bg-emerald-500/10",
            },
            {
              icon: ShieldCheck,
              tag: "COMMUNITY",
              title: "Peer Reviews & Vivas",
              desc: "Get real Git pull-request code reviews, system viva questions, and mentor guidance on every project.",
              color: "text-indigo-400",
              border: "group-hover:border-indigo-500/50",
              bg: "bg-indigo-500/10",
            },
          ].map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: shouldReduceMotion ? 0 : idx * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={shouldReduceMotion || isTouchDevice ? {} : { y: -4 }}
                className={`p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 backdrop-blur-md ${feat.border} transition-all duration-300 flex flex-col justify-between group cursor-default shadow-md hover:shadow-xl`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-xl ${feat.bg} ${feat.color} border border-white/5 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-white font-display mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-800/70 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 group-hover:text-white transition-colors">
                  <span>Learn curriculum</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* SECTION CONNECTOR: SOFT DIVIDER */}
      <div className="relative max-w-5xl mx-auto h-px bg-gradient-to-r from-transparent via-neutral-800/80 to-transparent my-16" />

      {/* ==================================================== */}
      {/* 4 & 5. CURATED BOOTCAMPS WITH 3D TILT & FOCUS */}
      {/* ==================================================== */}
      <div id="sheryians-courses-section" className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header with Scroll Reveal */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#E84A27] mb-1 font-semibold">
              CURATED BOOTCAMPS & COURSES
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
              Mastery Programs & Cohorts
            </h2>
          </div>

          {/* Filter Segmented Controls */}
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
        </motion.div>

        {/* 3D Tilt + Featured Focus Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, index) => (
            <TiltCourseCard
              key={course._id}
              course={course}
              index={index}
              isHovered={hoveredCourseId === course._id}
              isAnyHovered={hoveredCourseId !== null && hoveredCourseId !== course._id}
              onHover={setHoveredCourseId}
              onClick={() => onSelectCourse(course)}
              shouldReduceMotion={shouldReduceMotion || false}
            />
          ))}
        </div>
      </div>

      {/* SECTION CONNECTOR: AMBIENT DIVIDER */}
      <div className="relative max-w-5xl mx-auto h-px bg-gradient-to-r from-transparent via-[#E84A27]/20 to-transparent my-20" />

      {/* ==================================================== */}
      {/* 5. TESTIMONIALS & PLACEMENT SHOWCASE (SCROLL REVEAL) */}
      {/* ==================================================== */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <div className="text-xs font-mono uppercase tracking-widest text-[#E84A27] mb-2 font-semibold">
            ALUMNI SUCCESS
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white font-display tracking-tight">
            From Beginners to Tech Leaders
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2">
            Read how our alumni transitioned into software engineering roles at top product organizations.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: "Rohan Mehta",
              role: "SDE-1 at Razorpay",
              avatar:
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
              review:
                "The depth of MERN architecture, live JWT authentication, and real system design taught here landed me a 24 LPA role within 3 months of completion.",
              batch: "Cohort 2024",
            },
            {
              name: "Priya Nair",
              role: "Frontend Engineer at Swiggy",
              avatar:
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
              review:
                "The video player with instant resume, capstone reviews, and community mock interviews gave me genuine confidence during technical rounds.",
              batch: "Frontend Mastery",
            },
            {
              name: "Aman Verma",
              role: "Full Stack Engineer at Zomato",
              avatar:
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
              review:
                "EduPulse does not teach toy apps. You build production-ready systems with real cloud databases, secure signed media, and scalable architectures.",
              batch: "System Design Cohort",
            },
          ].map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: shouldReduceMotion ? 0 : i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={shouldReduceMotion || isTouchDevice ? {} : { y: -3 }}
              className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 backdrop-blur-md flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed italic mb-6">
                  "{item.review}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                />
                <div>
                  <div className="text-sm font-bold text-white font-display">
                    {item.name}
                  </div>
                  <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <span>{item.role}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-[#E84A27]">{item.batch}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 9. FINAL CALL TO ACTION (CTA) WITH PARALLAX GLOW */}
      {/* ==================================================== */}
      <div ref={ctaRef} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mt-28 sm:mt-36">
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-900 to-[#0b0b0c] border border-neutral-800/90 p-8 sm:p-14 text-center shadow-2xl"
        >
          {/* Parallax Background Glow Element (Smooth Y offset based on scroll) */}
          <motion.div
            style={{ y: ctaGlowY }}
            className="absolute inset-0 bg-radial from-[#E84A27]/22 via-transparent to-transparent blur-2xl animate-pulse-glow pointer-events-none"
          />
          <div className="absolute inset-0 sheryians-grid opacity-20 pointer-events-none" />

          {/* Foreground Content Remains Stable and Readable */}
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-800/80 border border-neutral-700 text-xs font-semibold text-[#E84A27] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>START YOUR JOURNEY TODAY</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display tracking-tight leading-tight">
              Ready to start learning?
            </h2>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl mx-auto">
              Join over 1 Million+ engineers learning high-performance system architectures,
              modern frontend engineering, and production MERN deployment.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <MagneticCTAButton
                onClick={onStartJourney}
                maxMovement={8}
                className="px-8 py-3.5 bg-gradient-to-r from-[#E84A27] to-[#D03816] hover:from-[#f05533] hover:to-[#df401d] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-[#E84A27]/30 transition-shadow flex items-center gap-2 cursor-pointer"
              >
                <span>Enroll in a Cohort</span>
                <ArrowRight className="w-4 h-4" />
              </MagneticCTAButton>

              <MagneticCTAButton
                onClick={onOpenDossier}
                maxMovement={6}
                className="px-6 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-semibold text-sm rounded-xl border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>View System Architecture</span>
              </MagneticCTAButton>
            </div>

            <div className="flex items-center justify-center gap-6 pt-6 text-xs text-neutral-500 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Verified Certifications
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Instant Access
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 1-on-1 Mentor Support
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
