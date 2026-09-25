import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle,
  FileText,
  MessageSquare,
  Award,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Film,
  Tv,
  Settings,
  FastForward,
  HelpCircle,
} from "lucide-react";
import { Course } from "../types";
import { useLms } from "../context/LmsContext";
import { DiscussionForum } from "./DiscussionForum";

interface VideoPlayerViewProps {
  course: Course;
  onBack: () => void;
  onOpenQuiz: (quiz?: any) => void;
  onOpenCertificate: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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

  // Flatten all lectures to easily navigate
  const allLectures = course.sections.flatMap((s) => s.lectures);

  // Default to last watched lecture or first lecture
  const [currentLectureId, setCurrentLectureId] = useState<string>(() => {
    return (
      enrollment?.lastWatchedLectureId ||
      course.sections[0]?.lectures[0]?._id ||
      allLectures[0]?._id ||
      ""
    );
  });

  const currentLecture =
    allLectures.find((l) => l._id === currentLectureId) || allLectures[0];

  const currentSection = course.sections.find((s) =>
    s.lectures.some((l) => l._id === currentLectureId)
  );

  // References
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const resumeNotificationTimeoutRef = useRef<any>(null);
  const shortcutToastTimeoutRef = useRef<any>(null);
  const lastSavedPositionRef = useRef<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipAvailable, setIsPipAvailable] = useState(false);

  // Interactive UI state
  const [showControls, setShowControls] = useState(true);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPosPercent, setHoverSeekPosPercent] = useState<number>(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [resumeNotification, setResumeNotification] = useState<string | null>(null);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const [showUpNextPrompt, setShowUpNextPrompt] = useState(false);

  // Tabs & Notes
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "discussions" | "notes">("overview");
  const [personalNotes, setPersonalNotes] = useState<string>(() => {
    return localStorage.getItem(`notes_${course._id}`) || "";
  });

  // Dynamic Cloudinary Secure Stream Loading
  const [streamVideoUrl, setStreamVideoUrl] = useState<string>("");
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string>("");
  const [streamSource, setStreamSource] = useState<string>("");

  // Navigation helpers
  const currentIndex = allLectures.findIndex((l) => l._id === currentLectureId);
  const hasNext = currentIndex >= 0 && currentIndex < allLectures.length - 1;
  const hasPrev = currentIndex > 0;
  const nextLecture = hasNext ? allLectures[currentIndex + 1] : null;

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const totalSecs = Math.floor(secs);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Check PiP availability
  useEffect(() => {
    if (typeof document !== "undefined" && "pictureInPictureEnabled" in document) {
      setIsPipAvailable(document.pictureInPictureEnabled);
    }
  }, []);

  // Listen to Fullscreen change events on document
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Flash shortcut feedback
  const triggerShortcutToast = (message: string) => {
    setShortcutFeedback(message);
    if (shortcutToastTimeoutRef.current) {
      clearTimeout(shortcutToastTimeoutRef.current);
    }
    shortcutToastTimeoutRef.current = setTimeout(() => {
      setShortcutFeedback(null);
    }, 750);
  };

  // Switch lecture safely
  const switchLecture = useCallback((lectureId: string) => {
    // 1. Save last position of exiting lecture
    if (videoRef.current && currentLectureId) {
      const exitingPos = Math.round(videoRef.current.currentTime);
      if (exitingPos > 0) {
        saveVideoProgress(course._id, currentLectureId, exitingPos);
        localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(exitingPos));
      }
    }

    // 2. Reset player state for new lecture
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setShowUpNextPrompt(false);
    setResumeNotification(null);
    lastSavedPositionRef.current = 0;
    setCurrentLectureId(lectureId);
  }, [course._id, currentLectureId, saveVideoProgress]);

  const goToNext = useCallback(() => {
    if (hasNext && nextLecture) {
      switchLecture(nextLecture._id);
    }
  }, [hasNext, nextLecture, switchLecture]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      switchLecture(allLectures[currentIndex - 1]._id);
    }
  }, [hasPrev, allLectures, currentIndex, switchLecture]);

  // Fetch authorized play URL for current lecture
  useEffect(() => {
    if (!currentLecture) {
      setStreamVideoUrl("");
      setStreamError("Video is not available for this lecture yet.");
      return;
    }

    let isMounted = true;
    setIsLoadingStream(true);
    setStreamError("");
    setStreamVideoUrl("");

    const fetchPlayUrl = async () => {
      try {
        const token = localStorage.getItem("edupulse_jwt_token");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(
          `/api/videos/play-url?courseId=${encodeURIComponent(course._id)}&lectureId=${encodeURIComponent(
            currentLecture._id
          )}`,
          { headers }
        );

        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.videoUrl) {
          setStreamVideoUrl(data.videoUrl);
          setStreamSource(data.source || "cloudinary");
          setStreamError("");
        } else {
          // If backend couldn't generate Cloudinary signed url, check direct fallback
          if (currentLecture.videoUrl) {
            setStreamVideoUrl(currentLecture.videoUrl);
            setStreamSource("direct");
            setStreamError("");
          } else {
            setStreamError(
              data.message || "Video is not available for this lecture yet."
            );
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (currentLecture.videoUrl) {
          setStreamVideoUrl(currentLecture.videoUrl);
          setStreamSource("direct");
        } else {
          setStreamError("Unable to load this video. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingStream(false);
        }
      }
    };

    fetchPlayUrl();

    return () => {
      isMounted = false;
    };
  }, [course._id, currentLecture?._id]);

  // Resume saved watch position on lecture video metadata loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const vidDuration = vid.duration || 0;
    setDuration(vidDuration);

    // Look up saved position for this specific lecture:
    // Priority:
    // 1. Per-lecture positions in enrollment model
    // 2. localStorage instant mirror: `edupulse_pos_${courseId}_${currentLectureId}`
    // 3. Fallback: enrollment.lastWatchedPositionSeconds (if last watched lecture matches)
    let savedPos = 0;
    const localSaved = localStorage.getItem(`edupulse_pos_${course._id}_${currentLectureId}`);
    if (localSaved && !isNaN(Number(localSaved))) {
      savedPos = Number(localSaved);
    } else if (enrollment?.lecturePositions && enrollment.lecturePositions[currentLectureId]) {
      savedPos = enrollment.lecturePositions[currentLectureId];
    } else if (enrollment?.lastWatchedLectureId === currentLectureId && enrollment.lastWatchedPositionSeconds) {
      savedPos = enrollment.lastWatchedPositionSeconds;
    }

    // Only resume if position is meaningful (e.g. > 2 seconds and not already at the very end)
    if (savedPos > 2 && (vidDuration === 0 || savedPos < vidDuration - 3)) {
      try {
        vid.currentTime = savedPos;
        setCurrentTime(savedPos);
        lastSavedPositionRef.current = savedPos;
        setResumeNotification(`Resumed from ${formatTime(savedPos)}`);

        if (resumeNotificationTimeoutRef.current) {
          clearTimeout(resumeNotificationTimeoutRef.current);
        }
        resumeNotificationTimeoutRef.current = setTimeout(() => {
          setResumeNotification(null);
        }, 4000);
      } catch (err) {
        console.warn("Could not set saved video position:", err);
      }
    } else {
      vid.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Periodic intelligent progress save (every 6 seconds while video is playing)
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.currentTime > 0) {
        const cur = Math.round(videoRef.current.currentTime);
        if (Math.abs(cur - lastSavedPositionRef.current) >= 3) {
          lastSavedPositionRef.current = cur;
          saveVideoProgress(course._id, currentLectureId, cur);
          localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
        }
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [course._id, currentLectureId, saveVideoProgress]);

  // Clean up and save position on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && currentLectureId) {
        const cur = Math.round(videoRef.current.currentTime);
        if (cur > 0) {
          saveVideoProgress(course._id, currentLectureId, cur);
          localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
        }
      }
    };
  }, [course._id, currentLectureId, saveVideoProgress]);

  // Auto-hide controls timer
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Only auto-hide if playing and not seeking or interacting with speed menu
    if (isPlaying && !isDraggingSeek && !showSpeedMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  }, [isPlaying, isDraggingSeek, showSpeedMenu]);

  // Handle user activity over player
  const handlePlayerMouseMove = () => {
    resetControlsTimeout();
  };

  // Keep controls open when video is paused
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  }, [isPlaying, resetControlsTimeout]);

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        triggerShortcutToast("Play");
      }).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerShortcutToast("Pause");
      // Save position on pause
      const cur = Math.round(videoRef.current.currentTime);
      saveVideoProgress(course._id, currentLectureId, cur);
      localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
    }
  };

  // Rewind / Forward by delta seconds
  const seekRelative = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerShortcutToast(deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`);
  };

  // Volume and Mute
  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    triggerShortcutToast(nextMuted ? "Muted" : `Volume ${Math.round(volume * 100)}%`);
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  // Playback speed
  const changePlaybackSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    triggerShortcutToast(`${speed}x Speed`);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen().catch(() => {});
      } else if ((playerContainerRef.current as any).webkitRequestFullscreen) {
        (playerContainerRef.current as any).webkitRequestFullscreen();
      }
      triggerShortcutToast("Fullscreen");
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      triggerShortcutToast("Exit Fullscreen");
    }
  };

  // Picture in Picture
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        triggerShortcutToast("Exit PiP");
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
        triggerShortcutToast("Picture-in-Picture");
      }
    } catch (err) {
      console.warn("PiP not supported or rejected:", err);
    }
  };

  // Safe Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(5);
          break;
        case "KeyM":
          e.preventDefault();
          handleToggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, isMuted, volume, duration]);

  // Video Events: Time Update & Progress Calculation
  const handleTimeUpdate = () => {
    if (!videoRef.current || isDraggingSeek) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);

    // Calculate buffered range
    if (videoRef.current.buffered.length > 0) {
      try {
        const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedEnd(end);
      } catch {}
    }

    // Auto mark complete when reaching 90%
    if (
      dur > 0 &&
      cur / dur >= 0.9 &&
      enrollment &&
      !enrollment.completedLectures.includes(currentLectureId)
    ) {
      markLectureComplete(course._id, currentLectureId);
    }
  };

  // Video Events: Video Progress (Buffer)
  const handleProgress = () => {
    if (!videoRef.current) return;
    if (videoRef.current.buffered.length > 0) {
      try {
        const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedEnd(end);
      } catch {}
    }
  };

  // Video Events: Video Ended
  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    markLectureComplete(course._id, currentLectureId);
    // Save final position
    if (videoRef.current) {
      const cur = Math.round(videoRef.current.currentTime);
      saveVideoProgress(course._id, currentLectureId, cur);
      localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
    }
    // Show Up Next overlay if there is a next lecture
    if (hasNext) {
      setShowUpNextPrompt(true);
    }
  };

  // Progress Bar Dragging & Seeking Handlers
  const calculateSeekTimeFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    return ratio * duration;
  };

  const handlePointerDownSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSeek(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    const targetTime = calculateSeekTimeFromEvent(e);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handlePointerMoveSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setHoverSeekPosPercent(ratio * 100);
    setHoverSeekTime(ratio * duration);

    if (isDraggingSeek && videoRef.current) {
      const targetTime = ratio * duration;
      setCurrentTime(targetTime);
      videoRef.current.currentTime = targetTime;
    }
  };

  const handlePointerUpSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSeek) {
      setIsDraggingSeek(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      if (videoRef.current) {
        const cur = Math.round(videoRef.current.currentTime);
        saveVideoProgress(course._id, currentLectureId, cur);
        localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
      }
    }
  };

  const isCompleted = enrollment?.completedLectures.includes(currentLectureId);
  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  // Safe Empty Curriculum State (No sections or no lectures)
  if (allLectures.length === 0 || !currentLecture) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to Catalog</span>
          </button>
          <div className="text-xs font-mono text-slate-400">
            {course.title}
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shadow-xl">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Curriculum Content Being Prepared</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The instructor is actively structuring modules and rendering high-definition videos for this course. Please check back shortly.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Back to Course Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Header Bar with Real-Time Course Progress */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="truncate">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-xl">
              {course.title}
            </h1>
            <div className="text-[11px] text-slate-400 truncate">
              {currentSection?.title} • {currentLecture.title}
            </div>
          </div>
        </div>

        {/* Course Progress Indicator */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 text-right sm:text-left">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[11px] text-slate-400 font-medium">Course Progress:</span>
              <span className="text-xs font-bold text-indigo-400">
                {enrollment?.progressPercent || 0}%
              </span>
            </div>
            <div className="w-20 sm:w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                style={{ width: `${enrollment?.progressPercent || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 hidden md:inline">
              ({enrollment?.completedLectures.length || 0} of {allLectures.length} completed)
            </span>
          </div>

          {/* Certificate or Exam Action */}
          {certificate ? (
            <button
              onClick={onOpenCertificate}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs shadow-amber-500/20 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Certificate</span>
            </button>
          ) : enrollment?.progressPercent === 100 && quiz ? (
            <button
              onClick={onOpenQuiz}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs shadow-emerald-500/20 animate-pulse cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Take Exam</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Main Learning Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Video Player & Tabs */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
          {/* ==================================================== */}
          {/* PROFESSIONAL LMS VIDEO PLAYER CONTAINER */}
          {/* ==================================================== */}
          <div
            ref={playerContainerRef}
            onMouseMove={handlePlayerMouseMove}
            onPointerMove={handlePlayerMouseMove}
            onMouseLeave={() => {
              if (isPlaying && !showSpeedMenu && !isDraggingSeek) {
                setShowControls(false);
              }
            }}
            className={`relative aspect-video bg-black w-full flex items-center justify-center select-none overflow-hidden group ${
              !showControls && isPlaying ? "cursor-none" : "cursor-default"
            }`}
          >
            {isLoadingStream ? (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-300">
                <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono font-medium tracking-wide">
                  Loading video stream...
                </span>
              </div>
            ) : streamError ? (
              <div className="p-6 text-center max-w-md space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h3 className="text-sm font-bold text-white">Video Unavailable</h3>
                <p className="text-xs text-slate-400">{streamError}</p>
                <button
                  onClick={() => {
                    setCurrentLectureId((prev) => prev);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            ) : streamVideoUrl ? (
              <>
                {/* Standard HTML5 <video> Element */}
                <video
                  ref={videoRef}
                  src={streamVideoUrl}
                  playsInline
                  onClick={togglePlay}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onProgress={handleProgress}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleVideoEnded}
                  onError={() => {
                    setStreamError("Unable to load this video. Please try again.");
                  }}
                  className="w-full h-full object-contain cursor-pointer"
                />

                {/* Keyboard Shortcut & Action Flash Toast Indicator */}
                {shortcutFeedback && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/15 text-white font-mono text-sm font-bold shadow-2xl flex items-center gap-2 animate-in zoom-in-95 duration-150">
                      <span>{shortcutFeedback}</span>
                    </div>
                  </div>
                )}

                {/* Resume Playback Notification Banner */}
                {resumeNotification && (
                  <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-indigo-500/40 text-white text-xs px-3 py-2 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <span className="text-indigo-400 font-semibold">{resumeNotification}</span>
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = 0;
                          setCurrentTime(0);
                          setResumeNotification(null);
                        }
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Start from beginning
                    </button>
                  </div>
                )}

                {/* Top Video Header Overlay (Title & Stream Provider Badge) */}
                <div
                  className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/30 to-transparent p-3 sm:p-4 flex items-center justify-between transition-opacity duration-300 z-10 ${
                    showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="text-xs font-semibold text-white/90 truncate max-w-sm sm:max-w-md drop-shadow">
                    {currentLecture.title}
                  </div>
                  <div className="bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 border border-emerald-500/20 shadow-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {streamSource === "cloudinary"
                        ? "Cloudinary • Authorized Stream"
                        : "Direct Video Stream"}
                    </span>
                  </div>
                </div>

                {/* Big Center Play Button Overlay when Paused */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl backdrop-blur-xs border border-white/20 transition-transform transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                    aria-label="Play video"
                  >
                    <Play className="w-7 h-7 fill-white ml-1" />
                  </button>
                )}

                {/* Up Next Overlay on Video End */}
                {showUpNextPrompt && hasNext && nextLecture && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Lecture Completed!</span>
                    </div>
                    <div className="space-y-1 max-w-md">
                      <span className="text-xs text-slate-400 font-medium">Up Next</span>
                      <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                        {nextLecture.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowUpNextPrompt(false);
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.play().catch(() => {});
                          }
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Replay
                      </button>
                      <button
                        onClick={goToNext}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <span>Play Next Lecture</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ==================================================== */}
                {/* BOTTOM CONTROLS OVERLAY */}
                {/* ==================================================== */}
                <div
                  className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 py-2 sm:px-4 sm:py-3 transition-opacity duration-300 z-10 flex flex-col gap-2 ${
                    showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {/* Clickable and Draggable Scrub / Seek Bar */}
                  <div
                    ref={progressBarRef}
                    onPointerDown={handlePointerDownSeek}
                    onPointerMove={handlePointerMoveSeek}
                    onPointerUp={handlePointerUpSeek}
                    onMouseLeave={() => setHoverSeekTime(null)}
                    className="relative w-full h-5 flex items-center cursor-pointer group/seek touch-none"
                  >
                    {/* Hover Timestamp Tooltip */}
                    {hoverSeekTime !== null && duration > 0 && (
                      <div
                        className="absolute bottom-6 -translate-x-1/2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-white shadow-xl pointer-events-none z-30"
                        style={{ left: `${hoverSeekPosPercent}%` }}
                      >
                        {formatTime(hoverSeekTime)}
                      </div>
                    )}

                    {/* Progress Rail Track */}
                    <div className="w-full h-1 group-hover/seek:h-2 transition-all duration-150 bg-slate-700/70 rounded-full relative overflow-hidden">
                      {/* Buffered Portion */}
                      <div
                        className="absolute inset-y-0 left-0 bg-slate-500/50 rounded-full transition-all duration-200"
                        style={{ width: `${bufferedPercent}%` }}
                      />
                      {/* Watched / Played Portion */}
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-75 ease-out shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                        style={{ width: `${playedPercent}%` }}
                      />
                    </div>

                    {/* Scrubber Handle / Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-indigo-600 scale-0 group-hover/seek:scale-100 transition-transform pointer-events-none"
                      style={{ left: `${playedPercent}%` }}
                    />
                  </div>

                  {/* Main Controls Row */}
                  <div className="flex items-center justify-between text-xs text-white">
                    {/* Left Controls: Play/Pause, Rewind, Forward, Volume, Time */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Play / Pause */}
                      <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                        title={isPlaying ? "Pause (Space/k)" : "Play (Space/k)"}
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        )}
                      </button>

                      {/* 10s Rewind */}
                      <button
                        onClick={() => seekRelative(-10)}
                        className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                        title="Rewind 10 seconds (← 5s)"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* 10s Forward */}
                      <button
                        onClick={() => seekRelative(10)}
                        className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                        title="Forward 10 seconds (→ 5s)"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      {/* Volume Slider & Mute Toggle */}
                      <div className="flex items-center gap-1.5 group/vol">
                        <button
                          onClick={handleToggleMute}
                          className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                          title={isMuted ? "Unmute (m)" : "Mute (m)"}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4 text-rose-400" />
                          ) : volume < 0.5 ? (
                            <Volume1 className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all"
                          title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                        />
                      </div>

                      {/* Current Time / Total Duration */}
                      <div className="text-slate-300 font-mono text-[11px] select-none ml-1">
                        <span className="text-white font-medium">{formatTime(currentTime)}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Right Controls: Next Lecture, Speed Selector, PiP, Fullscreen */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Next Lecture Quick Trigger */}
                      {hasNext && (
                        <button
                          onClick={goToNext}
                          className="hidden sm:flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                          title="Skip to next lecture"
                        >
                          <span>Next</span>
                          <FastForward className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Playback Speed Selector Popover */}
                      <div className="relative">
                        <button
                          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                          className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Playback Speed"
                        >
                          <span>{playbackSpeed}x</span>
                          <Settings className="w-3 h-3 text-slate-400" />
                        </button>

                        {showSpeedMenu && (
                          <div className="absolute bottom-full right-0 mb-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 w-24 flex flex-col gap-0.5 z-40 animate-in fade-in zoom-in-95">
                            <div className="text-[10px] text-slate-400 font-bold px-2 py-1 border-b border-slate-800">
                              Speed
                            </div>
                            {SPEED_OPTIONS.map((spd) => (
                              <button
                                key={spd}
                                onClick={() => changePlaybackSpeed(spd)}
                                className={`px-2 py-1 rounded text-left text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-between ${
                                  playbackSpeed === spd
                                    ? "bg-indigo-600 text-white font-bold"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <span>{spd}x</span>
                                {playbackSpeed === spd && <CheckCircle className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Picture-in-Picture */}
                      {isPipAvailable && (
                        <button
                          onClick={togglePictureInPicture}
                          className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                          title="Picture-in-Picture"
                        >
                          <Tv className="w-4 h-4" />
                        </button>
                      )}

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                        title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
                        aria-label="Toggle Fullscreen"
                      >
                        {isFullscreen ? (
                          <Minimize className="w-4 h-4" />
                        ) : (
                          <Maximize className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center max-w-md space-y-2 text-slate-400">
                <Film className="w-8 h-8 mx-auto text-slate-500" />
                <p className="text-xs">No video stream loaded.</p>
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* LECTURE HEADER & NAVIGATION CONTROLS */}
          {/* ==================================================== */}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isCompleted ? "Completed" : "Mark as Completed"}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-medium text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Learning Tabs */}
          <div className="border-b border-slate-800 bg-slate-900/40 px-4 sm:px-6">
            <div className="flex gap-6 text-xs font-semibold overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "overview"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-4 h-4" /> Overview
              </button>

              <button
                onClick={() => setActiveTab("resources")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "resources"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Download className="w-4 h-4" /> Resources ({currentLecture.resources?.length || 0})
              </button>

              <button
                onClick={() => setActiveTab("discussions")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "discussions"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Q&A Discussion
              </button>

              <button
                onClick={() => setActiveTab("notes")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
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
                    Cloudinary Video Delivery Metadata
                  </h4>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 space-y-1">
                    <div>
                      <span className="text-slate-500">Public ID:</span>{" "}
                      {currentLecture.videoPublicId || currentLecture.videoKey || "Direct Delivery"}
                    </div>
                    <div>
                      <span className="text-slate-500">Stream Protocol:</span> Cloudinary Signed Adaptive HTTPS
                    </div>
                    <div>
                      <span className="text-slate-500">Delivery Status:</span> Active & Authenticated
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
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
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

        {/* ==================================================== */}
        {/* RIGHT COLUMN: COURSE CURRICULUM ACCORDION */}
        {/* ==================================================== */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[500px] lg:h-auto shrink-0">
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Course Content
            </h3>
            <span className="text-xs text-indigo-400 font-bold">
              {enrollment?.completedLectures.length || 0} / {allLectures.length} Completed
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/80">
            {course.sections.map((section) => (
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
                        onClick={() => switchLecture(lecture._id)}
                        className={`w-full px-4 py-3 text-left text-xs transition-colors flex items-start gap-3 cursor-pointer ${
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

                  {/* Section Quizzes */}
                  {section.quizzes && section.quizzes.length > 0 &&
                    section.quizzes.map((q) => (
                      <div
                        key={q.quizId}
                        onClick={() => onOpenQuiz(q)}
                        className="w-full px-4 py-3 text-left text-xs transition-colors flex items-center justify-between hover:bg-purple-950/50 text-purple-200 border-l-2 border-purple-500 bg-purple-950/20 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-purple-100 truncate">{q.title}</div>
                            <div className="text-[10px] text-purple-300/80">
                              Section Quiz • {q.questionsCount || q.questions?.length || 0} Questions
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-sm shrink-0">
                          {q.totalMarks || 0} pts
                        </span>
                      </div>
                    ))}
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
                  onClick={() => onOpenQuiz(quiz)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
