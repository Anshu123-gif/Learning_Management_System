import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Circle,
  FileText,
  MessageSquare,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Film,
  Tv,
  Settings,
  FastForward,
  HelpCircle,
  BookOpen,
  Code,
  Layers,
  Check,
  Copy,
  Menu,
  X,
  ArrowLeft,
  Home,
  Clock,
  Compass,
  Sun,
  Moon,
} from "lucide-react";
import { Course, SectionQuiz } from "../types";
import { useLms } from "../context/LmsContext";
import { DiscussionForum } from "./DiscussionForum";

interface VideoPlayerViewProps {
  course: Course;
  onBack: () => void;
  onOpenQuiz: (quiz?: any) => void;
  onOpenCertificate: () => void;
  onNavigateHome?: () => void;
  onNavigateMyCourses?: () => void;
  onNavigateCommunity?: () => void;
  onNavigateCertificates?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  course,
  onBack,
  onOpenQuiz,
  onOpenCertificate,
  onNavigateHome,
  onNavigateMyCourses,
  onNavigateCommunity,
  onNavigateCertificates,
}) => {
  const {
    getEnrollmentForCourse,
    markLectureComplete,
    saveVideoProgress,
    getQuizForCourse,
    getCertificateForCourse,
    fetchCourseById,
    quizAttempts,
    getLectureMaterialAccess,
  } = useLms();

  const [activeCourse, setActiveCourse] = useState<Course>(course);

  useEffect(() => {
    setActiveCourse(course);
    let isMounted = true;
    fetchCourseById(course._id).then((fresh) => {
      if (isMounted && fresh) {
        setActiveCourse(fresh);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [course._id, course.updatedAt, fetchCourseById]);

  const enrollment = getEnrollmentForCourse(course._id);
  const quiz = getQuizForCourse(course._id);
  const certificate = getCertificateForCourse(course._id);

  // Flatten all lectures to easily navigate
  const allLectures = useMemo(
    () => activeCourse.sections.flatMap((s) => s.lectures),
    [activeCourse.sections]
  );

  // All section quizzes in course
  const allSectionQuizzes: SectionQuiz[] = useMemo(
    () => activeCourse.sections.flatMap((s) => s.quizzes || []),
    [activeCourse.sections]
  );

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

  const currentSection = activeCourse.sections.find((s) =>
    s.lectures.some((l) => l._id === currentLectureId)
  );

  // Collapsible section IDs state (default: active section expanded)
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>(() => {
    const curSec = course.sections.find((s) =>
      s.lectures.some((l) => l._id === currentLectureId)
    );
    return curSec ? [curSec._id] : [course.sections[0]?._id].filter(Boolean) as string[];
  });

  // Keep active section open when current lecture changes
  useEffect(() => {
    if (currentSection && !expandedSectionIds.includes(currentSection._id)) {
      setExpandedSectionIds((prev) => [...prev, currentSection._id]);
    }
  }, [currentSection, expandedSectionIds]);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Mobile drawer states
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileCurriculumOpen, setIsMobileCurriculumOpen] = useState(false);

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

  // Student Learning Interface Theme State (Light ↔ Dark)
  // Persisted in localStorage and respects prefers-color-scheme when no saved preference exists
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("edupulse_theme");
      if (saved === "light" || saved === "dark") return saved;
      if (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
      ) {
        return "light";
      }
    } catch {}
    return "dark";
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const saved = localStorage.getItem("edupulse_theme");
        if (!saved) {
          setTheme(e.matches ? "light" : "dark");
        }
      };
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    } catch {}
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("edupulse_theme", next);
      } catch {}
      return next;
    });
  };

  const isLight = theme === "light";

  // Simple Tabs below video
  type TabType = "notes" | "code" | "explanation" | "discussion" | "resources" | "practice";
  const [activeTab, setActiveTab] = useState<TabType>("notes");

  // Notes state
  const [personalNotes, setPersonalNotes] = useState<string>(() => {
    return localStorage.getItem(`notes_${course._id}`) || "";
  });
  const [copiedNotes, setCopiedNotes] = useState(false);

  // Practice state (interactive quick checks)
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [copiedCode, setCopiedCode] = useState(false);

  // Material Access State
  const [accessingMaterialId, setAccessingMaterialId] = useState<string | null>(null);
  const [materialActionType, setMaterialActionType] = useState<"view" | "download" | null>(null);
  const [materialAccessError, setMaterialAccessError] = useState<string | null>(null);

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
    if (videoRef.current && currentLectureId) {
      const exitingPos = Math.round(videoRef.current.currentTime);
      if (exitingPos > 0) {
        saveVideoProgress(course._id, currentLectureId, exitingPos);
        localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(exitingPos));
      }
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setShowUpNextPrompt(false);
    setResumeNotification(null);
    lastSavedPositionRef.current = 0;
    setCurrentLectureId(lectureId);
    setIsMobileCurriculumOpen(false);
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
          if (currentLecture.videoUrl) {
            setStreamVideoUrl(currentLecture.videoUrl);
            setStreamSource("direct");
            setStreamError("");
          } else {
            setStreamError(data.message || "Video is not available for this lecture yet.");
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

    let savedPos = 0;
    const localSaved = localStorage.getItem(`edupulse_pos_${course._id}_${currentLectureId}`);
    if (localSaved && !isNaN(Number(localSaved))) {
      savedPos = Number(localSaved);
    } else if (enrollment?.lecturePositions && enrollment.lecturePositions[currentLectureId]) {
      savedPos = enrollment.lecturePositions[currentLectureId];
    } else if (enrollment?.lastWatchedLectureId === currentLectureId && enrollment.lastWatchedPositionSeconds) {
      savedPos = enrollment.lastWatchedPositionSeconds;
    }

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
    if (isPlaying && !isDraggingSeek && !showSpeedMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  }, [isPlaying, isDraggingSeek, showSpeedMenu]);

  const handlePlayerMouseMove = () => {
    resetControlsTimeout();
  };

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

  const handleProgress = () => {
    if (!videoRef.current) return;
    if (videoRef.current.buffered.length > 0) {
      try {
        const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedEnd(end);
      } catch {}
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    markLectureComplete(course._id, currentLectureId);
    if (videoRef.current) {
      const cur = Math.round(videoRef.current.currentTime);
      saveVideoProgress(course._id, currentLectureId, cur);
      localStorage.setItem(`edupulse_pos_${course._id}_${currentLectureId}`, String(cur));
    }
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

  // Progress Calculations for Right Sidebar
  const totalSectionsCount = activeCourse.sections.length;
  const completedSectionsCount = activeCourse.sections.filter(
    (s) =>
      s.lectures.length > 0 &&
      s.lectures.every((l) => enrollment?.completedLectures.includes(l._id))
  ).length;

  const totalLecturesCount = allLectures.length;
  const completedLecturesCount = enrollment?.completedLectures.length || 0;

  const totalQuizzesCount = allSectionQuizzes.length + (quiz ? 1 : 0);
  const completedQuizzesCount = useMemo(() => {
    const allQuizIds = [
      ...allSectionQuizzes.map((q) => q.quizId || q._id),
      ...(quiz ? [quiz.quizId || quiz._id] : []),
    ];
    return allQuizIds.filter((qId) =>
      quizAttempts.some(
        (a) =>
          (a.quizId === qId || a._id === qId) &&
          (a.completed || a.passed || a.score !== undefined)
      )
    ).length;
  }, [allSectionQuizzes, quiz, quizAttempts]);

  // Insert timestamp into notes
  const handleInsertTimestampToNotes = () => {
    const timestampTag = `[${formatTime(currentTime)}] `;
    const updated = personalNotes ? `${personalNotes}\n${timestampTag}` : timestampTag;
    setPersonalNotes(updated);
    localStorage.setItem(`notes_${course._id}`, updated);
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(personalNotes);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // Code Snippet Example for current lesson
  const sampleCodeSnippet = useMemo(() => {
    const cleanTitle = currentLecture?.title || "Lesson";
    return `// Implementation for: ${cleanTitle}
// Course: ${course.title}
// Section: ${currentSection?.title || "Module"}

export async function executeLessonSolution(params: { debug?: boolean } = {}) {
  console.log("Initializing module for ${cleanTitle}...");
  
  const state = {
    courseId: "${course._id}",
    lectureId: "${currentLectureId}",
    status: "active",
    timestamp: new Date().toISOString()
  };

  if (params.debug) {
    console.debug("[Debug Info]", state);
  }

  return {
    success: true,
    data: state,
    message: "Module logic processed successfully."
  };
}

// Auto-run example:
// executeLessonSolution({ debug: true }).then(console.log);`;
  }, [currentLecture?.title, course.title, course._id, currentLectureId, currentSection?.title]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sampleCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Safe Empty Curriculum State
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

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-4">
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

  // Current section quiz (if any)
  const currentSectionQuiz = currentSection?.quizzes?.[0];

  return (
    <div
      className={`h-screen w-full flex flex-col font-sans select-none overflow-hidden transition-colors ${
        isLight ? "bg-slate-50 text-slate-900" : "bg-[#090d16] text-slate-100"
      }`}
    >
      {/* ==================================================== */}
      {/* MOBILE TOP BAR (Appears on screens < lg) */}
      {/* ==================================================== */}
      <div
        className={`lg:hidden h-14 border-b px-4 flex items-center justify-between shrink-0 z-30 transition-colors ${
          isLight
            ? "bg-white border-slate-200 text-slate-900"
            : "bg-[#0d131f] border-slate-800 text-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isLight
                ? "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
            aria-label="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={onBack}
            className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
              isLight
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{course.title}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Sun / Moon Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer border ${
              isLight
                ? "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
          <button
            onClick={() => setIsMobileCurriculumOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Curriculum ({completedLecturesCount}/{totalLecturesCount})</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MAIN 3-PART LEARNING WORKSPACE */}
      {/* ==================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ==================================================== */}
        {/* PART 1: LEFT SIDEBAR (Course Navigation) */}
        {/* ==================================================== */}
        {/* Desktop Left Sidebar */}
        <aside
          className={`w-64 shrink-0 border-r flex flex-col hidden lg:flex select-none transition-colors ${
            isLight
              ? "bg-white border-slate-200 text-slate-800"
              : "bg-[#0d131f] border-slate-800 text-slate-100"
          }`}
        >
          {/* Top Brand / Navigation Group */}
          <div
            className={`p-3 border-b space-y-1 ${
              isLight ? "border-slate-200" : "border-slate-800/80"
            }`}
          >
            <button
              onClick={onNavigateHome || onBack}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Home className="w-4 h-4 text-slate-400" />
              <span>Home</span>
            </button>
            <button
              onClick={onNavigateMyCourses || onBack}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>My Courses</span>
            </button>
            <button
              onClick={onNavigateCommunity || (() => setActiveTab("discussion"))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Community</span>
            </button>
            <button
              onClick={onNavigateCertificates || onOpenCertificate}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Certificates</span>
            </button>

            {/* Sun / Moon Theme Toggle in Desktop Left Nav */}
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              {isLight ? (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Back to My Courses Action */}
          <div className="px-3 pt-3">
            <button
              onClick={onNavigateMyCourses || onBack}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My Courses</span>
            </button>
          </div>

          {/* Current Course Summary Card */}
          <div
            className={`p-3 mx-3 my-2 border rounded-xl space-y-2.5 ${
              isLight
                ? "bg-slate-50 border-slate-200"
                : "bg-slate-900/90 border-slate-800"
            }`}
          >
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-800">
              <img
                src={activeCourse.thumbnail || activeCourse.thumbnailUrl}
                alt={activeCourse.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 pointer-events-none">
                <span className="text-[10px] font-medium text-white/90 truncate">
                  {activeCourse.category}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h2
                className={`text-xs font-bold line-clamp-2 leading-snug ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {activeCourse.title}
              </h2>
              <div
                className={`text-[11px] truncate ${
                  isLight ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Instructor: {activeCourse.instructorName}
              </div>
            </div>

            {/* Course Progress Minimal Indicator */}
            <div
              className={`space-y-1 pt-1 border-t ${
                isLight ? "border-slate-200" : "border-slate-800/80"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className={isLight ? "text-slate-600" : "text-slate-400"}>Progress</span>
                <span className={`font-bold ${isLight ? "text-indigo-600" : "text-indigo-400"}`}>
                  {enrollment?.progressPercent || 0}%
                </span>
              </div>
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden ${
                  isLight ? "bg-slate-200" : "bg-slate-800"
                }`}
              >
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${enrollment?.progressPercent || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Course-Related Navigation */}
          <div className="p-3 space-y-1 flex-1 overflow-y-auto">
            <div
              className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Course Navigation
            </div>

            <button
              onClick={() => {
                const el = document.getElementById("right-curriculum-panel");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Course Content</span>
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === "notes"
                  ? isLight
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "bg-indigo-600/20 text-indigo-300 font-semibold"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Notes</span>
            </button>

            <button
              onClick={() => setActiveTab("discussion")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === "discussion"
                  ? isLight
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "bg-indigo-600/20 text-indigo-300 font-semibold"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Q&A</span>
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                activeTab === "resources"
                  ? isLight
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "bg-indigo-600/20 text-indigo-300 font-semibold"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Resources ({currentLecture.resources?.length || 0})</span>
            </button>
          </div>
        </aside>

        {/* Mobile Left Drawer Backdrop & Drawer */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <div
              className={`relative w-72 max-w-[80vw] border-r h-full flex flex-col z-50 p-4 space-y-4 animate-in slide-in-from-left duration-200 ${
                isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0d131f] border-slate-800 text-white"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-2 border-b ${
                  isLight ? "border-slate-200" : "border-slate-800"
                }`}
              >
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}
                >
                  Menu
                </span>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`p-1 rounded ${
                    isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    if (onNavigateHome) onNavigateHome();
                    else onBack();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Home className="w-4 h-4" /> Home
                </button>
                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    if (onNavigateMyCourses) onNavigateMyCourses();
                    else onBack();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> My Courses
                </button>
                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    if (onNavigateCommunity) onNavigateCommunity();
                    else setActiveTab("discussion");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> Community
                </button>
                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    if (onNavigateCertificates) onNavigateCertificates();
                    else onOpenCertificate();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-400" /> Certificates
                </button>

                {/* Sun / Moon Theme Toggle in Mobile Drawer */}
                <button
                  onClick={() => {
                    toggleTheme();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {isLight ? (
                    <>
                      <Moon className="w-4 h-4 text-slate-600" />
                      <span>Switch to Dark Mode</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>Switch to Light Mode</span>
                    </>
                  )}
                </button>
              </div>

              <div
                className={`pt-2 border-t ${
                  isLight ? "border-slate-200" : "border-slate-800"
                }`}
              >
                <button
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    if (onNavigateMyCourses) onNavigateMyCourses();
                    else onBack();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" /> Back to My Courses
                </button>
              </div>

              <div
                className={`p-3 border rounded-xl space-y-2 ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
                }`}
              >
                <div
                  className={`text-xs font-bold line-clamp-1 ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}
                >
                  {activeCourse.title}
                </div>
                <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {activeCourse.instructorName}
                </div>
                <div
                  className={`flex justify-between text-[11px] font-medium pt-1 border-t ${
                    isLight ? "border-slate-200" : "border-slate-800"
                  }`}
                >
                  <span className={isLight ? "text-slate-600" : "text-slate-400"}>Progress</span>
                  <span className={isLight ? "text-indigo-600 font-bold" : "text-indigo-400 font-bold"}>
                    {enrollment?.progressPercent || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* PART 2: CENTER CONTENT (Current Lesson + Video + Tabs) */}
        {/* ==================================================== */}
        <main
          className={`flex-1 flex flex-col overflow-y-auto select-text transition-colors ${
            isLight ? "bg-slate-50 text-slate-900" : "bg-[#090d16] text-slate-100"
          }`}
        >
          {/* Clean Top Header & Breadcrumbs */}
          <div
            className={`px-4 sm:px-6 pt-4 pb-3 border-b sticky top-0 z-20 backdrop-blur-md space-y-2 transition-colors ${
              isLight
                ? "bg-white/95 border-slate-200 shadow-2xs"
                : "bg-[#090d16]/95 border-slate-800/80"
            }`}
          >
            {/* Breadcrumb: My Courses → Course → Section → Lesson */}
            <div
              className={`flex items-center gap-1.5 text-[11px] truncate ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <button
                onClick={onNavigateMyCourses || onBack}
                className={`transition-colors cursor-pointer shrink-0 ${
                  isLight ? "hover:text-slate-900 text-slate-600" : "hover:text-white"
                }`}
              >
                My Courses
              </button>
              <ChevronRight
                className={`w-3 h-3 shrink-0 ${
                  isLight ? "text-slate-400" : "text-slate-600"
                }`}
              />
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {activeCourse.title}
              </span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 ${
                  isLight ? "text-slate-400" : "text-slate-600"
                }`}
              />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">
                {currentSection?.title}
              </span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 ${
                  isLight ? "text-slate-400" : "text-slate-600"
                }`}
              />
              <span
                className={`truncate max-w-[150px] sm:max-w-[240px] font-semibold ${
                  isLight ? "text-slate-900" : "text-slate-200"
                }`}
              >
                {currentLecture.title}
              </span>
            </div>

            {/* Lesson Title and Navigation Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
              <div className="min-w-0">
                <h1
                  className={`text-base sm:text-lg font-bold truncate tracking-tight ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}
                >
                  {currentLecture.title}
                </h1>
                {/* Lesson Progress Visible */}
                <div
                  className={`flex items-center gap-2 text-xs mt-0.5 ${
                    isLight ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  <span className={isLight ? "text-slate-700 font-medium" : "text-slate-300 font-medium"}>
                    Current lesson:
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      isLight ? "text-slate-900 font-semibold" : "text-slate-200"
                    }`}
                  >
                    {formatTime(currentTime)} / {formatTime(duration || currentLecture.durationMinutes * 60)}
                  </span>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-semibold ml-1">
                      <CheckCircle className="w-3 h-3" /> Completed
                    </span>
                  )}
                </div>
              </div>

              {/* Prev / Next Lesson Buttons + Sun/Moon Theme Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Sun / Moon Theme Toggle in Center Header */}
                <button
                  onClick={toggleTheme}
                  aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
                  title={isLight ? "Switch to dark mode" : "Switch to light mode"}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    isLight
                      ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                      : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/60"
                  }`}
                >
                  {isLight ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                      <span className="hidden sm:inline">Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Light</span>
                    </>
                  )}
                </button>

                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className={`px-3 py-1.5 rounded-lg disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                    isLight
                      ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                      : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/60"
                  }`}
                  title="Previous lesson"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  title="Next lesson"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* LARGE VIDEO PLAYER (The Primary Focus - Clean & Uncluttered - Never Change Video Background) */}
          <div className="w-full bg-black relative flex items-center justify-center">
            <div
              ref={playerContainerRef}
              onMouseMove={handlePlayerMouseMove}
              onPointerMove={handlePlayerMouseMove}
              onMouseLeave={() => {
                if (isPlaying && !showSpeedMenu && !isDraggingSeek) {
                  setShowControls(false);
                }
              }}
              className={`relative aspect-video bg-black w-full max-w-5xl mx-auto flex items-center justify-center select-none overflow-hidden group ${
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

                  {/* Keyboard Shortcut Flash Toast */}
                  {shortcutFeedback && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/15 text-white font-mono text-sm font-bold shadow-2xl flex items-center gap-2 animate-in zoom-in-95 duration-150">
                        <span>{shortcutFeedback}</span>
                      </div>
                    </div>
                  )}

                  {/* Resume Notification Banner */}
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

                  {/* Top Minimal Video Overlay */}
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

                  {/* Up Next Prompt on Video End */}
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

                  {/* BOTTOM CONTROLS OVERLAY */}
                  <div
                    className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 py-2 sm:px-4 sm:py-3 transition-opacity duration-300 z-10 flex flex-col gap-2 ${
                      showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {/* Scrub / Seek Bar */}
                    <div
                      ref={progressBarRef}
                      onPointerDown={handlePointerDownSeek}
                      onPointerMove={handlePointerMoveSeek}
                      onPointerUp={handlePointerUpSeek}
                      onMouseLeave={() => setHoverSeekTime(null)}
                      className="relative w-full h-5 flex items-center cursor-pointer group/seek touch-none"
                    >
                      {hoverSeekTime !== null && duration > 0 && (
                        <div
                          className="absolute bottom-6 -translate-x-1/2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-white shadow-xl pointer-events-none z-30"
                          style={{ left: `${hoverSeekPosPercent}%` }}
                        >
                          {formatTime(hoverSeekTime)}
                        </div>
                      )}

                      <div className="w-full h-1 group-hover/seek:h-2 transition-all duration-150 bg-slate-700/70 rounded-full relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-500/50 rounded-full transition-all duration-200"
                          style={{ width: `${bufferedPercent}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-75 ease-out shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                          style={{ width: `${playedPercent}%` }}
                        />
                      </div>

                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-indigo-600 scale-0 group-hover/seek:scale-100 transition-transform pointer-events-none"
                        style={{ left: `${playedPercent}%` }}
                      />
                    </div>

                    {/* Main Controls Row */}
                    <div className="flex items-center justify-between text-xs text-white">
                      <div className="flex items-center gap-2 sm:gap-3">
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

                        <button
                          onClick={() => seekRelative(-10)}
                          className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                          title="Rewind 10 seconds"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => seekRelative(10)}
                          className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1"
                          title="Forward 10 seconds"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        {/* Volume Control */}
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

                        {/* Current Time / Duration Display */}
                        <div className="text-slate-300 font-mono text-[11px] select-none ml-1">
                          <span className="text-white font-medium">{formatTime(currentTime)}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Speed Menu */}
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

                        {/* PiP */}
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
          </div>

          {/* Quick Lecture Completion Action Strip directly under video */}
          <div
            className={`px-4 sm:px-6 py-2.5 border-b flex items-center justify-between text-xs transition-colors ${
              isLight ? "bg-white border-slate-200" : "bg-[#0b0f19] border-slate-800/80"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => markLectureComplete(course._id, currentLectureId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isCompleted
                    ? isLight
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : isLight
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{isCompleted ? "Completed" : "Mark as Completed"}</span>
              </button>
            </div>

            <div
              className={`flex items-center gap-3 text-[11px] ${
                isLight ? "text-slate-600" : "text-slate-400"
              }`}
            >
              <span>Section: {currentSection?.title}</span>
              <span>·</span>
              <span>Duration: {currentLecture.durationMinutes}m</span>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SIMPLE TABS BELOW VIDEO */}
          {/* Exactly one tab visually active */}
          {/* ==================================================== */}
          <div
            className={`border-b px-4 sm:px-6 shrink-0 transition-colors ${
              isLight ? "bg-white border-slate-200" : "bg-[#0d131f] border-slate-800"
            }`}
          >
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-1">
              {[
                { id: "notes", label: "Notes", icon: FileText },
                { id: "code", label: "Code Files", icon: Code },
                { id: "explanation", label: "Explanation", icon: BookOpen },
                { id: "discussion", label: "Discussion", icon: MessageSquare },
                { id: "resources", label: `Resources (${currentLecture.resources?.length || 0})`, icon: Download },
                { id: "practice", label: "Practice", icon: HelpCircle },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`px-3.5 py-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? isLight
                          ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-bold"
                          : "bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-500 font-bold"
                        : isLight
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENTS (Clean & Focused) */}
          <div className="p-4 sm:p-6 flex-1 max-w-4xl">
            {/* TAB 1: NOTES */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className={`text-sm font-bold ${
                        isLight ? "text-slate-900" : "text-white"
                      }`}
                    >
                      Lecture Notes
                    </h3>
                    <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Personal notes for this course. Automatically saved to your device.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleInsertTimestampToNotes}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors cursor-pointer border ${
                        isLight
                          ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-transparent"
                      }`}
                      title="Insert current video timestamp"
                    >
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span>Timestamp ({formatTime(currentTime)})</span>
                    </button>
                    <button
                      onClick={handleCopyNotes}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors cursor-pointer border ${
                        isLight
                          ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-transparent"
                      }`}
                    >
                      {copiedNotes ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <textarea
                  value={personalNotes}
                  onChange={(e) => {
                    setPersonalNotes(e.target.value);
                    localStorage.setItem(`notes_${course._id}`, e.target.value);
                  }}
                  placeholder="Take notes while watching the video. Click 'Timestamp' above to bookmark key moments in the lecture..."
                  rows={10}
                  className={`w-full rounded-xl p-3.5 text-xs focus:outline-hidden font-mono leading-relaxed transition-colors border ${
                    isLight
                      ? "bg-white border-slate-300 text-slate-900 shadow-2xs focus:border-indigo-600 placeholder:text-slate-400"
                      : "bg-slate-900/90 border-slate-800 text-slate-200 focus:border-indigo-500 placeholder:text-slate-500"
                  }`}
                />

                <div
                  className={`flex items-center justify-between text-[11px] ${
                    isLight ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  <span>Characters: {personalNotes.length}</span>
                  <button
                    onClick={() => {
                      if (window.confirm("Clear all notes for this course?")) {
                        setPersonalNotes("");
                        localStorage.removeItem(`notes_${course._id}`);
                      }
                    }}
                    className={`transition-colors cursor-pointer ${
                      isLight
                        ? "text-slate-500 hover:text-rose-600"
                        : "text-slate-400 hover:text-rose-400"
                    }`}
                  >
                    Clear notes
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: CODE FILES */}
            {activeTab === "code" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className={`text-sm font-bold ${
                        isLight ? "text-slate-900" : "text-white"
                      }`}
                    >
                      Lesson Code & Solution
                    </h3>
                    <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Starter template and reference implementation for this lesson.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      isLight
                        ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-transparent"
                    }`}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied Code</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Code Editor Box */}
                <div
                  className={`rounded-xl border overflow-hidden font-mono text-xs shadow-md ${
                    isLight ? "border-slate-300 bg-slate-900" : "border-slate-800 bg-slate-950"
                  }`}
                >
                  <div
                    className={`px-4 py-2 border-b flex items-center justify-between text-[11px] ${
                      isLight
                        ? "bg-slate-800 border-slate-700 text-slate-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-indigo-400" />
                      solution.ts
                    </span>
                    <span>TypeScript</span>
                  </div>
                  <pre className="p-4 text-slate-200 overflow-x-auto text-[11px] leading-relaxed">
                    <code>{sampleCodeSnippet}</code>
                  </pre>
                </div>

                {/* Attached code resources */}
                {currentLecture.resources?.filter((r) => r.fileType === "code").length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4
                      className={`text-xs font-bold ${
                        isLight ? "text-slate-800" : "text-slate-300"
                      }`}
                    >
                      Attached Code Files
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentLecture.resources
                        .filter((r) => r.fileType === "code")
                        .map((res, i) => (
                          <div
                            key={i}
                            className={`p-3 border rounded-lg flex items-center justify-between text-xs ${
                              isLight
                                ? "bg-white border-slate-200 shadow-2xs"
                                : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <span
                              className={`font-medium truncate mr-2 ${
                                isLight ? "text-slate-900" : "text-white"
                              }`}
                            >
                              {res.title}
                            </span>
                            <button
                              onClick={() => alert(`Simulating download of ${res.title}`)}
                              className={`px-2.5 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer border ${
                                isLight
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent"
                              }`}
                            >
                              <Download className="w-3 h-3" /> Get
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EXPLANATION */}
            {activeTab === "explanation" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3
                    className={`text-sm font-bold ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    Lesson Overview
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      isLight ? "text-slate-700" : "text-slate-300"
                    }`}
                  >
                    {currentLecture.description ||
                      `In this lecture "${currentLecture.title}", we explore core concepts, industry standard architectures, and step-by-step implementation code for production systems.`}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <h4
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isLight ? "text-slate-800" : "text-white"
                    }`}
                  >
                    Key Takeaways
                  </h4>
                  <ul
                    className={`space-y-1.5 text-xs ${
                      isLight ? "text-slate-700" : "text-slate-300"
                    }`}
                  >
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Mastery of the core patterns introduced in {currentSection?.title}.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Practical hands-on implementation matching real-world engineering standards.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Preparation for the accompanying section quiz and final certification exam.</span>
                    </li>
                  </ul>
                </div>

                {/* Video Delivery Technical Metadata */}
                <div
                  className={`pt-4 border-t space-y-2 ${
                    isLight ? "border-slate-200" : "border-slate-800/80"
                  }`}
                >
                  <h4
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isLight ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    Video Stream Details
                  </h4>
                  <div
                    className={`border rounded-xl p-3 text-xs font-mono space-y-1 ${
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-800"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div>
                      <span className={isLight ? "text-slate-500" : "text-slate-500"}>Public ID:</span>{" "}
                      {currentLecture.videoPublicId || currentLecture.videoKey || "Direct Delivery"}
                    </div>
                    <div>
                      <span className={isLight ? "text-slate-500" : "text-slate-500"}>Protocol:</span> Cloudinary Signed Adaptive Delivery
                    </div>
                    <div>
                      <span className={isLight ? "text-slate-500" : "text-slate-500"}>Status:</span> Active & Authenticated
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: DISCUSSION */}
            {activeTab === "discussion" && (
              <div className="space-y-4">
                <DiscussionForum courseId={course._id} lectureId={currentLectureId} theme={theme} />
              </div>
            )}

            {/* TAB 5: RESOURCES & STUDY MATERIALS */}
            {activeTab === "resources" && (() => {
              // Deduplicate resources: filter out any resource entry that duplicates an attached PDF study material
              const attachedMaterials = currentLecture.materials || [];
              const rawResources = currentLecture.resources || [];
              const nonDuplicateResources = rawResources.filter((res) => {
                const normResTitle = (res.title || "").trim().toLowerCase();
                const normResUrl = (res.url || "").trim().toLowerCase();
                const isDuplicate = attachedMaterials.some((mat) => {
                  const normMatTitle = (mat.title || "").trim().toLowerCase();
                  const normMatFile = (mat.fileName || "").trim().toLowerCase();
                  const normMatUrl = (mat.secureUrl || "").trim().toLowerCase();
                  return (
                    normResTitle === normMatTitle ||
                    normResTitle === normMatFile ||
                    normResTitle.replace(/\.pdf$/i, "") === normMatTitle.replace(/\.pdf$/i, "") ||
                    normResTitle.replace(/\.pdf$/i, "") === normMatFile.replace(/\.pdf$/i, "") ||
                    (normResUrl !== "#" && normResUrl !== "" && normResUrl === normMatUrl)
                  );
                });
                return !isDuplicate;
              });

              return (
                <div className="space-y-6">
                  {/* Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                          Course Materials
                        </span>
                        <span className="text-slate-500" aria-hidden="true">·</span>
                        <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          Lecture {currentIndex + 1} of {allLectures.length}
                        </span>
                      </div>
                      <h3
                        className={`text-base font-bold mt-0.5 tracking-tight ${
                          isLight ? "text-slate-900" : "text-white"
                        }`}
                      >
                        Study Materials & Resources
                      </h3>
                      <p className={`text-xs mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Official lecture notes, handouts, and reference materials for &ldquo;{currentLecture.title}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                          isLight
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                            : "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Enrolled Student Access</span>
                      </div>
                    </div>
                  </div>

                  {materialAccessError && (
                    <div
                      role="alert"
                      className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-rose-400 text-xs animate-in fade-in duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{materialAccessError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMaterialAccessError(null)}
                        className="text-rose-400 hover:text-rose-200 text-xs font-semibold cursor-pointer underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* 1. OFFICIAL PDF STUDY MATERIALS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <h4
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isLight ? "text-slate-800" : "text-slate-200"
                          }`}
                        >
                          Lecture PDF Notes ({attachedMaterials.length})
                        </h4>
                      </div>
                      <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                        Read online or save offline
                      </span>
                    </div>

                    {attachedMaterials.length > 0 ? (
                      <div className="space-y-2.5">
                        {attachedMaterials.map((mat) => {
                          const isProcessingThis = accessingMaterialId === mat.materialId;
                          const isViewingThis = isProcessingThis && materialActionType === "view";
                          const isDownloadingThis = isProcessingThis && materialActionType === "download";

                          return (
                            <div
                              key={mat.materialId}
                              className={`rounded-xl p-4 border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                isLight
                                  ? "bg-white border-slate-200/90 shadow-xs hover:border-amber-400/80 hover:shadow-sm"
                                  : "bg-slate-900/90 border-slate-800 hover:border-amber-500/40"
                              }`}
                            >
                              {/* Left file identity */}
                              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                <div
                                  className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                    isLight
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  }`}
                                  aria-label="PDF Document"
                                >
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <h5
                                    className={`font-semibold text-sm leading-tight truncate ${
                                      isLight ? "text-slate-900" : "text-white"
                                    }`}
                                    title={mat.title}
                                  >
                                    {mat.title}
                                  </h5>
                                  <div
                                    className={`text-xs flex items-center flex-wrap gap-1.5 ${
                                      isLight ? "text-slate-500" : "text-slate-400"
                                    }`}
                                  >
                                    <span className="font-mono text-[11px] truncate max-w-[220px]" title={mat.fileName}>
                                      {mat.fileName}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>{mat.fileSizeMb} MB</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-amber-500 font-medium">PDF Document</span>
                                  </div>
                                </div>
                              </div>

                                {/* Right Action Buttons */}
                              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                                {/* Action A: OPEN PDF IN BROWSER */}
                                <button
                                  type="button"
                                  disabled={isProcessingThis}
                                  onClick={async () => {
                                    const matId = mat.materialId || (mat as any)._id || (mat as any).id;
                                    setAccessingMaterialId(matId || "open");
                                    setMaterialActionType("view");
                                    setMaterialAccessError(null);
                                    try {
                                      let openUrl = "";
                                      if (matId) {
                                        const accessResult = await getLectureMaterialAccess(
                                          activeCourse._id || (activeCourse as any).courseId,
                                          currentSection?._id || (currentSection as any)?.sectionId || "",
                                          currentLecture._id || (currentLecture as any)?.lectureId,
                                          matId
                                        );

                                        if (accessResult.success && accessResult.viewUrl) {
                                          openUrl = accessResult.viewUrl;
                                        } else {
                                          throw new Error(accessResult.message || "Failed to obtain secure viewing link.");
                                        }
                                      }

                                      if (openUrl) {
                                        // Resolve full URL and ensure inline rendering in browser PDF viewer
                                        const finalViewUrl = openUrl.startsWith("/")
                                          ? `${window.location.origin}${openUrl}`
                                          : openUrl
                                              .replace(/\/fl_attachment(\/|,)?/g, (match: string, suffix: string) => (suffix === "/" ? "/" : ""))
                                              .replace(/[?&]attachment=[^&#]*/gi, "");

                                        window.open(finalViewUrl, "_blank", "noopener,noreferrer");
                                      } else {
                                        throw new Error("Could not obtain viewing link for this document.");
                                      }
                                    } catch (err: any) {
                                      console.warn("Failed to open material in browser:", err);
                                      setMaterialAccessError(err.message || "Could not open study material in browser.");
                                    } finally {
                                      setAccessingMaterialId(null);
                                      setMaterialActionType(null);
                                    }
                                  }}
                                  title="View document in new browser tab"
                                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
                                    isLight
                                      ? "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300"
                                      : "bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600"
                                  } ${isViewingThis ? "opacity-75 cursor-wait" : ""}`}
                                >
                                  {isViewingThis ? (
                                    <>
                                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                      <span>Opening...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Open PDF</span>
                                    </>
                                  )}
                                </button>

                                {/* Action B: DOWNLOAD PDF TO DEVICE */}
                                <button
                                  type="button"
                                  disabled={isProcessingThis}
                                  onClick={async () => {
                                    const matId = mat.materialId || (mat as any)._id || (mat as any).id;
                                    setAccessingMaterialId(matId || "download");
                                    setMaterialActionType("download");
                                    setMaterialAccessError(null);
                                    try {
                                      let targetDownloadUrl = "";
                                      if (matId) {
                                        const accessResult = await getLectureMaterialAccess(
                                          activeCourse._id || (activeCourse as any).courseId,
                                          currentSection?._id || (currentSection as any)?.sectionId || "",
                                          currentLecture._id || (currentLecture as any)?.lectureId,
                                          matId
                                        );

                                        if (accessResult.success && accessResult.downloadUrl) {
                                          targetDownloadUrl = accessResult.downloadUrl;
                                        }
                                      }

                                      if (!targetDownloadUrl && mat.secureUrl) {
                                        targetDownloadUrl = mat.secureUrl;
                                      }

                                      if (targetDownloadUrl) {
                                        let finalDownloadUrl = targetDownloadUrl.startsWith("/")
                                          ? `${window.location.origin}${targetDownloadUrl}`
                                          : targetDownloadUrl;

                                        // Ensure fl_attachment is present for Cloudinary delivery if direct
                                        if (finalDownloadUrl.includes("res.cloudinary.com") && !finalDownloadUrl.includes("fl_attachment") && !finalDownloadUrl.includes("download?")) {
                                          finalDownloadUrl = finalDownloadUrl.replace(/\/upload\/(v\d+\/)?/, (match: string) => {
                                            return match.includes("upload/v")
                                              ? "/upload/fl_attachment/" + match.replace("/upload/", "")
                                              : "/upload/fl_attachment/";
                                          });
                                        }

                                        // Trigger explicit download
                                        const downloadLink = document.createElement("a");
                                        downloadLink.href = finalDownloadUrl;
                                        downloadLink.target = "_blank";
                                        downloadLink.download = mat.fileName || `${mat.title || "study_material"}.pdf`;
                                        document.body.appendChild(downloadLink);
                                        downloadLink.click();
                                        document.body.removeChild(downloadLink);
                                      } else {
                                        throw new Error("Could not generate authenticated download link.");
                                      }
                                    } catch (err: any) {
                                      console.error("Failed to download material:", err);
                                      setMaterialAccessError(err.message || "Could not generate download link.");
                                    } finally {
                                      setAccessingMaterialId(null);
                                      setMaterialActionType(null);
                                    }
                                  }}
                                  title="Download PDF to local storage"
                                  className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                    isDownloadingThis
                                      ? "bg-amber-600/60 text-white cursor-wait"
                                      : "bg-amber-600 hover:bg-amber-500 active:scale-98 text-white"
                                  }`}
                                >
                                  {isDownloadingThis ? (
                                    <>
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Downloading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Download</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className={`p-6 rounded-xl border text-center space-y-2 ${
                          isLight
                            ? "bg-slate-50/80 border-slate-200"
                            : "bg-slate-900/40 border-slate-800"
                        }`}
                      >
                        <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                        <p
                          className={`text-xs font-medium ${
                            isLight ? "text-slate-700" : "text-slate-300"
                          }`}
                        >
                          No PDF study materials attached to this lecture yet.
                        </p>
                        <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                          When the instructor uploads revision notes, cheatsheets, or exercise sheets, they will appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2. ADDITIONAL ASSETS (Zip files, source code repositories, datasets - duplicates filtered out) */}
                  {nonDuplicateResources.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isLight ? "text-slate-800" : "text-slate-200"
                          }`}
                        >
                          Additional Assets & Source Files ({nonDuplicateResources.length})
                        </h4>
                        <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          Project archives & code attachments
                        </span>
                      </div>

                      <div className="space-y-2">
                        {nonDuplicateResources.map((res, i) => (
                          <div
                            key={i}
                            className={`border rounded-xl p-3 flex items-center justify-between text-xs transition-colors ${
                              isLight
                                ? "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                                : "bg-slate-900 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold uppercase text-[10px] shrink-0 border border-indigo-500/20">
                                {res.fileType || "FILE"}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={`font-semibold truncate ${
                                    isLight ? "text-slate-900" : "text-white"
                                  }`}
                                >
                                  {res.title}
                                </div>
                                <div
                                  className={`text-[10px] ${
                                    isLight ? "text-slate-500" : "text-slate-400"
                                  }`}
                                >
                                  {res.sizeMb} MB · Verified resource
                                </div>
                              </div>
                            </div>

                            <a
                              href={res.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border ${
                                isLight
                                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-transparent"
                              }`}
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB 6: PRACTICE */}
            {activeTab === "practice" && (
              <div className="space-y-5">
                <div>
                  <h3
                    className={`text-sm font-bold ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    Quick Practice & Knowledge Check
                  </h3>
                  <p className={`text-[11px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Test your understanding of the concepts covered in this lesson.
                  </p>
                </div>

                {/* Interactive Practice Question 1 */}
                <div
                  className={`p-4 border rounded-xl space-y-3 ${
                    isLight
                      ? "bg-white border-slate-200 shadow-2xs"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    1. What is the primary purpose of breaking application logic into modular sections?
                  </div>
                  <div className="space-y-1.5">
                    {[
                      "To increase code complexity and execution overhead",
                      "To improve maintainability, testability, and separation of concerns",
                      "To restrict code reuse across features",
                      "To bypass type safety in TypeScript",
                    ].map((opt, optIndex) => {
                      const selected = practiceAnswers["q1"] === optIndex;
                      const isCorrectOption = optIndex === 1;
                      return (
                        <button
                          key={optIndex}
                          onClick={() => setPracticeAnswers((prev) => ({ ...prev, q1: optIndex }))}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer border ${
                            selected
                              ? isCorrectOption
                                ? isLight
                                  ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold"
                                  : "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                                : isLight
                                ? "bg-rose-50 border-rose-400 text-rose-900 font-semibold"
                                : "bg-rose-950/60 border-rose-500/50 text-rose-200"
                              : isLight
                              ? "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                              : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-transparent"
                          }`}
                        >
                          <span>{opt}</span>
                          {selected && (
                            <span className="text-[11px] font-bold">
                              {isCorrectOption ? "✓ Correct" : "✗ Review lesson"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section Quiz Prompt if Available */}
                {currentSectionQuiz && (
                  <div
                    className={`p-4 border rounded-xl space-y-2.5 ${
                      isLight
                        ? "bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs"
                        : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                            isLight
                              ? "bg-amber-200 text-amber-900 border-amber-300"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}
                        >
                          QUIZ
                        </span>
                        <h4
                          className={`text-xs font-bold ${
                            isLight ? "text-amber-950" : "text-amber-200"
                          }`}
                        >
                          {currentSectionQuiz.title}
                        </h4>
                      </div>
                      <span
                        className={`text-[11px] font-mono ${
                          isLight ? "text-amber-800 font-bold" : "text-amber-300"
                        }`}
                      >
                        {currentSectionQuiz.totalMarks || 10} pts
                      </span>
                    </div>
                    <p
                      className={`text-xs ${
                        isLight ? "text-amber-900" : "text-slate-300"
                      }`}
                    >
                      Ready to test your knowledge for {currentSection?.title}? Take the official section quiz now.
                    </p>
                    <button
                      onClick={() => onOpenQuiz(currentSectionQuiz)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Section Quiz</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ==================================================== */}
        {/* PART 3: RIGHT SIDEBAR (Compact Course Progress & Curriculum) */}
        {/* ==================================================== */}
        <aside
          id="right-curriculum-panel"
          className={`w-80 shrink-0 border-l flex flex-col hidden lg:flex select-none transition-colors ${
            isLight
              ? "bg-white border-slate-200 text-slate-800"
              : "bg-[#0d131f] border-slate-800 text-slate-100"
          }`}
        >
          {/* Top Progress Box */}
          <div
            className={`p-4 border-b space-y-3 transition-colors ${
              isLight ? "bg-white border-slate-200" : "bg-[#0d131f] border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Course Progress
              </span>
              <span className={`text-sm font-bold ${isLight ? "text-indigo-600" : "text-indigo-400"}`}>
                {enrollment?.progressPercent || 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div
              className={`w-full h-2 rounded-full overflow-hidden ${
                isLight ? "bg-slate-200" : "bg-slate-800"
              }`}
            >
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${enrollment?.progressPercent || 0}%` }}
              />
            </div>

            {/* Stat Counters: Sections, Lessons, Quizzes */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[11px]">
              <div
                className={`border rounded-lg p-2 ${
                  isLight
                    ? "bg-slate-50 border-slate-200 text-slate-900"
                    : "bg-slate-900 border-slate-800/80 text-white"
                }`}
              >
                <div className="font-bold">
                  {completedSectionsCount} / {totalSectionsCount}
                </div>
                <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Sections
                </div>
              </div>
              <div
                className={`border rounded-lg p-2 ${
                  isLight
                    ? "bg-slate-50 border-slate-200 text-slate-900"
                    : "bg-slate-900 border-slate-800/80 text-white"
                }`}
              >
                <div className="font-bold">
                  {completedLecturesCount} / {totalLecturesCount}
                </div>
                <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Lessons
                </div>
              </div>
              <div
                className={`border rounded-lg p-2 ${
                  isLight
                    ? "bg-slate-50 border-slate-200 text-slate-900"
                    : "bg-slate-900 border-slate-800/80 text-white"
                }`}
              >
                <div className="font-bold">
                  {completedQuizzesCount} / {totalQuizzesCount}
                </div>
                <div className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Quizzes
                </div>
              </div>
            </div>
          </div>

          {/* Course Content Header */}
          <div
            className={`px-4 py-2.5 border-b flex items-center justify-between ${
              isLight
                ? "bg-slate-50 border-slate-200 text-slate-900"
                : "bg-slate-900/50 border-slate-800/80 text-white"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Course Content
            </span>
            <span className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              {completedLecturesCount} of {allLectures.length} completed
            </span>
          </div>

          {/* Collapsible Sections List */}
          <div
            className={`overflow-y-auto flex-1 divide-y ${
              isLight ? "divide-slate-200" : "divide-slate-800/60"
            }`}
          >
            {activeCourse.sections.map((section, sIdx) => {
              const isExpanded = expandedSectionIds.includes(section._id);
              const sectionLecs = section.lectures;
              const sectionQuizzes = section.quizzes || [];
              const completedInSection = sectionLecs.filter((l) =>
                enrollment?.completedLectures.includes(l._id)
              ).length;

              return (
                <div key={section._id} className="bg-transparent">
                  {/* Collapsible Section Header */}
                  <button
                    onClick={() => toggleSection(section._id)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isLight ? "hover:bg-slate-50 text-slate-800" : "hover:bg-slate-800/40 text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold truncate">
                        Section {sIdx + 1}: {section.title}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isLight ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        {completedInSection} / {sectionLecs.length} Lessons
                        {sectionQuizzes.length > 0 && ` · ${sectionQuizzes.length} Quiz`}
                      </div>
                    </div>
                    <div className={isLight ? "text-slate-400 shrink-0" : "text-slate-400 shrink-0"}>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Section Items */}
                  {isExpanded && (
                    <div
                      className={`divide-y ${
                        isLight
                          ? "bg-slate-50/70 divide-slate-200"
                          : "bg-slate-950/60 divide-slate-900/80"
                      }`}
                    >
                      {/* Lessons */}
                      {sectionLecs.map((lecture) => {
                        const isCurrent = lecture._id === currentLectureId;
                        const isLecDone = enrollment?.completedLectures.includes(lecture._id);

                        return (
                          <div
                            key={lecture._id}
                            onClick={() => switchLecture(lecture._id)}
                            className={`w-full px-4 py-2.5 text-left text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                              isCurrent
                                ? isLight
                                  ? "bg-indigo-50 text-indigo-950 font-bold border-l-2 border-indigo-600"
                                  : "bg-indigo-950/60 text-white font-bold border-l-2 border-indigo-500"
                                : isLight
                                ? "hover:bg-slate-100 text-slate-700"
                                : "hover:bg-slate-800/40 text-slate-300"
                            }`}
                          >
                            {/* Visual State Icon */}
                            <div className="pt-0.5 shrink-0">
                              {isLecDone ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : isCurrent ? (
                                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                                </div>
                              ) : (
                                <Circle className={`w-4 h-4 ${isLight ? "text-slate-400" : "text-slate-600"}`} />
                              )}
                            </div>

                            {/* Lesson Title & Progress */}
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-xs leading-snug line-clamp-2 ${
                                  isCurrent
                                    ? isLight
                                      ? "font-bold text-indigo-950"
                                      : "font-bold text-white"
                                    : "font-medium"
                                }`}
                              >
                                {lecture.title}
                              </div>
                              <div
                                className={`text-[10px] mt-0.5 font-mono ${
                                  isLight ? "text-slate-500" : "text-slate-400"
                                }`}
                              >
                                {isCurrent
                                  ? `${formatTime(currentTime)} / ${formatTime(
                                      duration || lecture.durationMinutes * 60
                                    )}`
                                  : `${lecture.durationMinutes} mins`}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Quizzes in this Section (Extremely Clear Quiz Visibility) */}
                      {sectionQuizzes.map((q) => {
                        const qId = q.quizId || q._id;
                        const attempt = quizAttempts.find(
                          (a) => a.quizId === qId || a._id === qId
                        );

                        return (
                          <div
                            key={qId}
                            onClick={() => onOpenQuiz(q)}
                            className={`w-full px-4 py-2.5 text-left text-xs transition-colors flex items-center justify-between border-l-2 cursor-pointer ${
                              isLight
                                ? "hover:bg-amber-100/70 text-amber-950 border-amber-600 bg-amber-50/80"
                                : "hover:bg-amber-950/30 text-amber-200 border-amber-500 bg-amber-950/15"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <HelpCircle
                                className={`w-4 h-4 shrink-0 ${
                                  isLight ? "text-amber-600" : "text-amber-400"
                                }`}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`truncate text-xs ${
                                      isLight ? "font-bold text-amber-950" : "font-semibold text-amber-100"
                                    }`}
                                  >
                                    {q.title}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                                      isLight
                                        ? "bg-amber-200 text-amber-900 border-amber-300"
                                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    }`}
                                  >
                                    QUIZ
                                  </span>
                                </div>
                                <div
                                  className={`text-[10px] mt-0.5 ${
                                    isLight ? "text-amber-800" : "text-amber-300/80"
                                  }`}
                                >
                                  {q.questionsCount || q.questions?.length || 0} Questions ·{" "}
                                  {q.totalMarks || 10} pts
                                </div>
                              </div>
                            </div>

                            {attempt ? (
                              <span className="text-[10px] font-bold text-emerald-500 shrink-0">
                                {attempt.score}%
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-sm shrink-0 border ${
                                  isLight
                                    ? "bg-amber-200 text-amber-900 border-amber-300"
                                    : "bg-amber-500/20 text-amber-300 border-transparent"
                                }`}
                              >
                                Start
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Official Certification Exam in Curriculum */}
            {quiz && (
              <div
                className={`p-4 border-t space-y-2 ${
                  isLight
                    ? "bg-indigo-50/70 border-indigo-100 text-slate-700"
                    : "bg-indigo-950/30 border-indigo-900/40 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex items-center gap-1.5 font-bold text-xs ${
                      isLight ? "text-indigo-900" : "text-amber-300"
                    }`}
                  >
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Final Certification Exam</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      isLight
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    QUIZ
                  </span>
                </div>
                <p className={`text-[11px] leading-snug ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Timed exam ({quiz.durationMinutes} min). Pass with ≥{quiz.passingScore}% to earn your verified certificate.
                </p>
                <button
                  onClick={() => onOpenQuiz(quiz)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Launch Exam</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Curriculum Drawer */}
        {isMobileCurriculumOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in"
              onClick={() => setIsMobileCurriculumOpen(false)}
            />
            <div
              className={`relative w-80 max-w-[85vw] border-l h-full flex flex-col z-50 animate-in slide-in-from-right duration-200 ${
                isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#0d131f] border-slate-800 text-white"
              }`}
            >
              <div
                className={`p-4 border-b flex items-center justify-between ${
                  isLight ? "border-slate-200" : "border-slate-800"
                }`}
              >
                <div>
                  <h3
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    Course Content
                  </h3>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      isLight ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {completedLecturesCount} of {allLectures.length} completed
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileCurriculumOpen(false)}
                  className={`p-1 rounded ${
                    isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className={`p-3 border-b ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
                }`}
              >
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className={isLight ? "text-slate-600" : "text-slate-400"}>Course Progress</span>
                  <span className={isLight ? "text-indigo-600 font-bold" : "text-indigo-400 font-bold"}>
                    {enrollment?.progressPercent || 0}%
                  </span>
                </div>
                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                    isLight ? "bg-slate-200" : "bg-slate-800"
                  }`}
                >
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${enrollment?.progressPercent || 0}%` }}
                  />
                </div>
              </div>

              {/* Mobile Curriculum Scroll Area */}
              <div
                className={`overflow-y-auto flex-1 divide-y ${
                  isLight ? "divide-slate-200" : "divide-slate-800/60"
                }`}
              >
                {activeCourse.sections.map((section, sIdx) => (
                  <div key={section._id}>
                    <div
                      className={`px-4 py-2.5 text-xs font-bold ${
                        isLight ? "bg-slate-100 text-slate-800" : "bg-slate-900/60 text-slate-300"
                      }`}
                    >
                      Section {sIdx + 1}: {section.title}
                    </div>
                    <div
                      className={`divide-y ${
                        isLight ? "divide-slate-200" : "divide-slate-900/50"
                      }`}
                    >
                      {section.lectures.map((lecture) => {
                        const isCurrent = lecture._id === currentLectureId;
                        const isLecDone = enrollment?.completedLectures.includes(lecture._id);

                        return (
                          <div
                            key={lecture._id}
                            onClick={() => switchLecture(lecture._id)}
                            className={`px-4 py-2.5 text-xs flex items-start gap-2.5 cursor-pointer ${
                              isCurrent
                                ? isLight
                                  ? "bg-indigo-50 text-indigo-950 font-bold border-l-2 border-indigo-600"
                                  : "bg-indigo-950/70 text-white font-bold border-l-2 border-indigo-500"
                                : isLight
                                ? "text-slate-700 hover:bg-slate-100"
                                : "text-slate-300 hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isLecDone ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : isCurrent ? (
                                <Play className="w-3.5 h-3.5 fill-indigo-500 text-indigo-500" />
                              ) : (
                                <Circle className={`w-4 h-4 ${isLight ? "text-slate-400" : "text-slate-600"}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{lecture.title}</div>
                              <div
                                className={`text-[10px] ${
                                  isLight ? "text-slate-500" : "text-slate-400"
                                }`}
                              >
                                {lecture.durationMinutes} mins
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Quizzes in Mobile Drawer */}
                      {section.quizzes &&
                        section.quizzes.map((q) => (
                          <div
                            key={q.quizId || q._id}
                            onClick={() => {
                              setIsMobileCurriculumOpen(false);
                              onOpenQuiz(q);
                            }}
                            className={`px-4 py-2.5 text-xs flex items-center justify-between border-l-2 cursor-pointer ${
                              isLight
                                ? "bg-amber-50 text-amber-950 border-amber-600 hover:bg-amber-100"
                                : "bg-amber-950/20 text-amber-200 border-amber-500 hover:bg-amber-950/40"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                  isLight
                                    ? "bg-amber-200 text-amber-900 border-amber-300"
                                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                }`}
                              >
                                QUIZ
                              </span>
                              <span className="truncate">{q.title}</span>
                            </div>
                            <span
                              className={`text-[10px] font-mono ${
                                isLight ? "text-amber-800" : "text-amber-300"
                              }`}
                            >
                              {q.totalMarks || 10} pts
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
