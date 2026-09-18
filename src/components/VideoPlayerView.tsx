import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  CheckCircle,
  FileText,
  MessageSquare,
  Award,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  ShieldCheck,
  Zap,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Course, Lecture, Section } from "../types";
import { useLms } from "../context/LmsContext";
import { DiscussionForum } from "./DiscussionForum";

interface VideoPlayerViewProps {
  course: Course;
  onBack: () => void;
  onOpenQuiz: () => void;
  onOpenCertificate: () => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  course,
  onBack,
  onOpenQuiz,
  onOpenCertificate,
}) => {
  const {
    getEnrollmentForCourse,
    markLectureComplete,
    saveVideoProgress,
    getQuizForCourse,
    getCertificateForCourse,
  } = useLms();

  const enrollment = getEnrollmentForCourse(course._id);
  const quiz = getQuizForCourse(course._id);
  const certificate = getCertificateForCourse(course._id);

  // Flatten lectures to easily navigate
  const allLectures = course.sections.flatMap((s) => s.lectures);

  // Default to last watched or first lecture
  const [currentLectureId, setCurrentLectureId] = useState<string>(() => {
    return (
      enrollment?.lastWatchedLectureId ||
      course.sections[0]?.lectures[0]?._id ||
      allLectures[0]?._id
    );
  });

  const currentLecture =
    allLectures.find((l) => l._id === currentLectureId) || allLectures[0];

  const currentSection = course.sections.find((s) =>
    s.lectures.some((l) => l._id === currentLectureId)
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "discussions" | "notes">("overview");
  const [personalNotes, setPersonalNotes] = useState<string>(() => {
    return localStorage.getItem(`notes_${course._id}`) || "";
  });

  // Resume playback position
  useEffect(() => {
    if (enrollment?.lastWatchedPositionSeconds && videoRef.current) {
      videoRef.current.currentTime = enrollment.lastWatchedPositionSeconds;
    }
  }, [currentLectureId]);

  // Periodic save of video progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        saveVideoProgress(course._id, currentLectureId, videoRef.current.currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [course._id, currentLectureId]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    setDuration(videoRef.current.duration || 0);

    // Auto mark complete if reached 90%
    if (
      videoRef.current.duration > 0 &&
      videoRef.current.currentTime / videoRef.current.duration > 0.9 &&
      enrollment &&
      !enrollment.completedLectures.includes(currentLectureId)
    ) {
      markLectureComplete(course._id, currentLectureId);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Next & Prev lecture
  const currentIndex = allLectures.findIndex((l) => l._id === currentLectureId);
  const hasNext = currentIndex < allLectures.length - 1;
  const hasPrev = currentIndex > 0;

  const goToNext = () => {
    if (hasNext) {
      setCurrentLectureId(allLectures[currentIndex + 1]._id);
      setIsPlaying(false);
    }
  };

  const goToPrev = () => {
    if (hasPrev) {
      setCurrentLectureId(allLectures[currentIndex - 1]._id);
      setIsPlaying(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isCompleted = enrollment?.completedLectures.includes(currentLectureId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Learning Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Catalog</span>
          </button>
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />
          <h1 className="text-xs sm:text-sm font-bold text-white line-clamp-1 max-w-md">
            {course.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress Indicator */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Your Progress:</span>
            <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${enrollment?.progressPercent || 0}%` }}
              />
            </div>
            <span className="text-xs font-bold text-indigo-400">
              {enrollment?.progressPercent || 0}%
            </span>
          </div>

          {/* Certificate or Quiz Quick Action */}
          {certificate ? (
            <button
              onClick={onOpenCertificate}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs shadow-amber-500/20"
            >
              <Award className="w-3.5 h-3.5" />
              <span>View Certificate</span>
            </button>
          ) : enrollment?.progressPercent === 100 ? (
            <button
              onClick={onOpenQuiz}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs shadow-emerald-500/20 animate-pulse"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Take Final Exam</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Main Workspace: Left Video + Content, Right Curriculum Accordion */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Player & Tab Details */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
          {/* Video Container */}
          <div className="relative aspect-video bg-black w-full flex items-center justify-center group">
            <video
              ref={videoRef}
              src={currentLecture.videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                setIsPlaying(false);
                markLectureComplete(course._id, currentLectureId);
              }}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer"
            />

            {/* S3 Security Watermark Badge */}
            <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 border border-emerald-500/20 shadow-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>AWS S3 Presigned Stream • Encrypted Signed URL</span>
            </div>

            {/* Custom Control Overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {/* Progress Slider */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-3"
              />

              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(
                          0,
                          videoRef.current.currentTime - 10
                        );
                      }
                    }}
                    className="text-slate-300 hover:text-white"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="text-slate-300 font-mono text-[11px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>

                  <button
                    onClick={handleToggleMute}
                    className="text-slate-300 hover:text-white"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-md text-[11px] font-semibold">
                    <span className="text-slate-400">Speed:</span>
                    {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changePlaybackSpeed(speed)}
                        className={`px-1 rounded-sm ${
                          playbackSpeed === speed
                            ? "bg-indigo-600 text-white font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleFullscreen}
                    className="text-slate-300 hover:text-white"
                    title="Fullscreen"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lecture Header & Navigation Buttons */}
          <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-indigo-400 font-semibold">
                {currentSection?.title}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {currentLecture.title}
              </h2>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => markLectureComplete(course._id, currentLectureId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isCompleted ? "Completed" : "Mark as Completed"}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-xs font-medium text-slate-300 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-xs font-bold text-white flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Learning Tabs */}
          <div className="border-b border-slate-800 bg-slate-900/40 px-4 sm:px-6">
            <div className="flex gap-6 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "overview"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-4 h-4" /> Overview
              </button>

              <button
                onClick={() => setActiveTab("resources")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "resources"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Download className="w-4 h-4" /> Resources ({currentLecture.resources?.length || 0})
              </button>

              <button
                onClick={() => setActiveTab("discussions")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "discussions"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Q&A Discussion
              </button>

              <button
                onClick={() => setActiveTab("notes")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "notes"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-4 h-4" /> Personal Notes
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          <div className="p-4 sm:p-6 flex-1">
            {activeTab === "overview" && (
              <div className="space-y-4 max-w-3xl">
                <h3 className="text-sm font-bold text-white">About this lecture</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentLecture.description ||
                    "In this lecture, we explore core concepts, industry standard architectures, and step-by-step implementation code for production systems."}
                </p>

                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    S3 Storage Metadata
                  </h4>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 space-y-1">
                    <div>
                      <span className="text-slate-500">S3 Key:</span> {currentLecture.s3Key}
                    </div>
                    <div>
                      <span className="text-slate-500">Stream Protocol:</span> HLS / Signed HTTP Byte-Range MP4
                    </div>
                    <div>
                      <span className="text-slate-500">Signed URL Expiry:</span> 900 seconds (15 min TTL)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "resources" && (
              <div className="space-y-3 max-w-2xl">
                <h3 className="text-sm font-bold text-white">Lecture Downloads</h3>
                {currentLecture.resources && currentLecture.resources.length > 0 ? (
                  currentLecture.resources.map((res, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold uppercase text-[10px]">
                          {res.fileType}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{res.title}</div>
                          <div className="text-[10px] text-slate-400">
                            {res.sizeMb} MB • Verified file
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => alert(`Simulating download of ${res.title}`)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No downloadable assets attached to this lecture.
                  </p>
                )}
              </div>
            )}

            {activeTab === "discussions" && (
              <div className="max-w-4xl">
                <DiscussionForum courseId={course._id} lectureId={currentLectureId} />
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Private Scratchpad</h3>
                  <span className="text-[11px] text-slate-400">Auto-saved locally</span>
                </div>
                <textarea
                  value={personalNotes}
                  onChange={(e) => {
                    setPersonalNotes(e.target.value);
                    localStorage.setItem(`notes_${course._id}`, e.target.value);
                  }}
                  placeholder="Record your code snippets, architecture observations, and exam prep notes here..."
                  rows={8}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Course Curriculum Accordion */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[500px] lg:h-auto">
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Course Content
            </h3>
            <span className="text-xs text-indigo-400 font-bold">
              {enrollment?.completedLectures.length || 0} / {allLectures.length} Completed
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/80">
            {course.sections.map((section, sIdx) => (
              <div key={section._id}>
                <div className="px-4 py-3 bg-slate-800/50 text-xs font-bold text-slate-300">
                  {section.title}
                </div>
                <div className="divide-y divide-slate-800/40">
                  {section.lectures.map((lecture) => {
                    const isSelected = lecture._id === currentLectureId;
                    const isLecDone = enrollment?.completedLectures.includes(lecture._id);

                    return (
                      <button
                        key={lecture._id}
                        onClick={() => {
                          setCurrentLectureId(lecture._id);
                          setIsPlaying(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-xs transition-colors flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-950/70 text-indigo-200 border-l-2 border-indigo-500"
                            : "hover:bg-slate-800/40 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isLecDone}
                          onChange={(e) => {
                            e.stopPropagation();
                            markLectureComplete(course._id, lecture._id);
                          }}
                          className="mt-0.5 rounded-sm bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-medium line-clamp-2 ${
                              isSelected ? "text-white font-bold" : ""
                            }`}
                          >
                            {lecture.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {lecture.durationMinutes} mins
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Exam / Certification Section in Curriculum */}
            {quiz && (
              <div className="p-4 bg-indigo-950/40 border-t border-indigo-900/40 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Award className="w-4 h-4" />
                  <span>Official Certification Exam</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Timed exam ({quiz.durationMinutes} min) with auto-grading. Requires ≥
                  {quiz.passingScore}% to earn the verified certificate.
                </p>
                <button
                  onClick={onOpenQuiz}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Open Exam Center
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
