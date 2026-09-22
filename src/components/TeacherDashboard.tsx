import React, { useState } from "react";
import {
  Plus,
  BookOpen,
  Users,
  DollarSign,
  Star,
  Video,
  Upload,
  FileCheck,
  MessageSquare,
  Sparkles,
  Clock,
  Trash2,
  CheckCircle,
  AlertCircle,
  FolderPlus,
} from "lucide-react";
import { Course, Lecture, Section } from "../types";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";

interface TeacherDashboardProps {
  onSelectCourse: (course: Course) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onSelectCourse,
}) => {
  const {
    courses,
    addCourse,
    addSectionToCourse,
    addLectureToSection,
    saveCourseCurriculum,
    discussions,
  } = useLms();
  const { currentUser, openAuthModal } = useAuth();

  if (!currentUser || currentUser.role !== "teacher") {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          Instructor Studio Access
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Please login with an instructor account to upload video batches, create syllabus sections, and track student earnings.
        </p>
        <div className="flex justify-center items-center gap-3 pt-2">
          <button
            onClick={() => openAuthModal("login")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            Sign In with Instructor Credentials
          </button>
        </div>
      </div>
    );
  }

  // Filter courses by current instructor (or all if simulated instructor)
  const teacherCourses = courses.filter(
    (c) => c.instructorId === currentUser._id || currentUser.role === "teacher"
  );

  const totalStudents = teacherCourses.reduce((acc, c) => acc + c.studentsEnrolled, 0);
  const totalRevenue = teacherCourses.reduce((acc, c) => acc + c.studentsEnrolled * c.price, 0);

  // Modal / form states
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [selectedCourseForLecture, setSelectedCourseForLecture] = useState<Course | null>(null);

  // New Course Form
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseSubtitle, setNewCourseSubtitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseCategory, setNewCourseCategory] = useState("Web Development");
  const [newCoursePrice, setNewCoursePrice] = useState("3499");
  const [newCourseLevel, setNewCourseLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [newCourseThumbnail, setNewCourseThumbnail] = useState("https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60");
  const [newCourseLanguage, setNewCourseLanguage] = useState("English");
  const [newCourseRequirements, setNewCourseRequirements] = useState("Basic programming fundamentals");
  const [newCourseLearningOutcomes, setNewCourseLearningOutcomes] = useState("Build production web applications\nImplement secure APIs and database operations");
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);
  const [createCourseError, setCreateCourseError] = useState("");
  const [createCourseSuccess, setCreateCourseSuccess] = useState("");

  // New Lecture Form
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureDuration, setNewLectureDuration] = useState("20");
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [uploadStatusMessage, setUploadStatusMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [cloudinaryUploadSuccess, setCloudinaryUploadSuccess] = useState(false);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    setIsSubmittingCourse(true);
    setCreateCourseError("");
    setCreateCourseSuccess("");

    const reqList = newCourseRequirements
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const outcomesList = newCourseLearningOutcomes
      .split("\n")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    const priceNum = parseInt(newCoursePrice) || 3499;

    const res = await addCourse({
      title: newCourseTitle.trim(),
      subtitle: newCourseSubtitle.trim() || "Master real-world production engineering concepts.",
      description: newCourseDescription.trim() || "Comprehensive industry curriculum with hands-on labs and certifications.",
      category: newCourseCategory,
      level: newCourseLevel,
      price: priceNum,
      originalPrice: priceNum * 2,
      thumbnail: newCourseThumbnail.trim() || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60",
      language: newCourseLanguage.trim() || "English",
      requirements: reqList.length > 0 ? reqList : ["Basic programming fundamentals"],
      learningOutcomes: outcomesList.length > 0 ? outcomesList : ["Build end-to-end applications"],
      instructorId: currentUser._id,
      instructorName: currentUser.name,
      instructorAvatar: currentUser.avatar,
      instructorTitle: currentUser.bio?.slice(0, 40) || "Senior Architect & Faculty",
    });

    setIsSubmittingCourse(false);

    if (res && res.success) {
      setCreateCourseSuccess("Course created successfully and submitted for Admin approval (status: pending).");
      setTimeout(() => {
        setShowCreateCourseModal(false);
        setNewCourseTitle("");
        setNewCourseSubtitle("");
        setNewCourseDescription("");
        setCreateCourseSuccess("");
      }, 1500);
    } else {
      setCreateCourseError(res?.message || "Failed to create course. Please try again.");
    }
  };

  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForLecture || !newLectureTitle.trim()) return;

    setIsUploadingToCloudinary(true);
    setUploadError("");
    setCloudinaryUploadSuccess(false);
    setUploadProgressPercent(0);
    setUploadStatusMessage("Preparing lecture...");

    try {
      const token = localStorage.getItem("edupulse_jwt_token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        authHeaders["Authorization"] = `Bearer ${token}`;
      }

      // 1. Determine target section
      let targetSectionId = selectedSectionId;
      let currentSections: Section[] = JSON.parse(
        JSON.stringify(selectedCourseForLecture.sections || [])
      );

      if (!targetSectionId && newSectionTitle.trim()) {
        const newSecId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newSec: Section = {
          _id: newSecId,
          courseId: selectedCourseForLecture._id,
          title: newSectionTitle.trim(),
          order: currentSections.length + 1,
          lectures: [],
        };
        currentSections.push(newSec);
        targetSectionId = newSecId;
      } else if (!targetSectionId && currentSections.length > 0) {
        targetSectionId = currentSections[0]._id;
      } else if (!targetSectionId) {
        const newSecId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newSec: Section = {
          _id: newSecId,
          courseId: selectedCourseForLecture._id,
          title: "Section 1: Course Overview",
          order: 1,
          lectures: [],
        };
        currentSections.push(newSec);
        targetSectionId = newSecId;
      }

      const newLectureId = `lec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let videoPublicId = "";
      let videoUrl = "";

      // 2. If video file selected, upload directly to Cloudinary using signed upload
      if (selectedVideoFile) {
        // Validate file type
        const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/ogg"];
        if (selectedVideoFile.type && !allowedTypes.includes(selectedVideoFile.type.toLowerCase())) {
          throw new Error("Invalid file type. Please upload an MP4, WebM, QuickTime, or MKV video file.");
        }

        // Validate max size 2GB
        if (selectedVideoFile.size > 2 * 1024 * 1024 * 1024) {
          throw new Error("Video file exceeds the maximum 2GB size limit.");
        }

        setUploadStatusMessage("Requesting Cloudinary upload signature from backend...");
        setUploadProgressPercent(10);

        const sigRes = await fetch("/api/videos/upload-signature", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            courseId: selectedCourseForLecture._id,
            lectureId: newLectureId,
          }),
        });

        const sigData = await sigRes.json();
        if (!sigRes.ok || !sigData.success) {
          throw new Error(sigData.message || "Failed to obtain Cloudinary upload signature.");
        }

        const { cloudName, apiKey, timestamp, signature, folder, publicId, uploadUrl } = sigData;

        setUploadStatusMessage("Uploading video directly to Cloudinary CDN...");
        setUploadProgressPercent(20);

        // Prepare multipart form data for Cloudinary direct signed upload
        const formData = new FormData();
        formData.append("file", selectedVideoFile);
        formData.append("api_key", apiKey);
        formData.append("timestamp", String(timestamp));
        formData.append("signature", signature);
        formData.append("folder", folder);
        formData.append("public_id", publicId);

        // Upload directly from browser to Cloudinary
        const cldResponse: any = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl || `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, true);

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.round(20 + (evt.loaded / evt.total) * 70);
              setUploadProgressPercent(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const parsed = JSON.parse(xhr.responseText);
                resolve(parsed);
              } catch (e) {
                reject(new Error("Invalid response format received from Cloudinary."));
              }
            } else {
              let errorMsg = `Cloudinary upload error (${xhr.status})`;
              try {
                const errObj = JSON.parse(xhr.responseText);
                if (errObj?.error?.message) {
                  errorMsg = errObj.error.message;
                }
              } catch {}
              reject(new Error(errorMsg));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network connection error during Cloudinary video upload."));
          };

          xhr.send(formData);
        });

        videoPublicId = cldResponse.public_id;
        videoUrl = cldResponse.secure_url || cldResponse.url;
      }

      setUploadStatusMessage("Saving curriculum structure to MongoDB...");
      setUploadProgressPercent(93);

      // 3. Assemble new lecture and attach to target section
      const newLecture: Lecture = {
        _id: newLectureId,
        sectionId: targetSectionId,
        title: newLectureTitle.trim(),
        description: selectedVideoFile
          ? `Uploaded video: ${selectedVideoFile.name} (${(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB)`
          : "Standard course curriculum lecture.",
        durationMinutes: parseInt(newLectureDuration) || 15,
        videoPublicId: videoPublicId || undefined,
        videoResourceType: videoPublicId ? "video" : undefined,
        videoUrl: videoUrl || undefined,
        isPreviewFree: false,
        resources: [],
      };

      currentSections = currentSections.map((sec) => {
        if (sec._id === targetSectionId) {
          return {
            ...sec,
            lectures: [...(sec.lectures || []), newLecture],
          };
        }
        return sec;
      });

      // 4. Persist to MongoDB via PUT /api/courses/:id/curriculum
      const saveRes = await saveCourseCurriculum(
        selectedCourseForLecture._id,
        currentSections
      );

      if (!saveRes.success) {
        throw new Error(saveRes.message || "Failed to persist curriculum changes to database.");
      }

      // Update selectedCourseForLecture reference
      setSelectedCourseForLecture((prev: any) =>
        prev ? { ...prev, sections: currentSections } : prev
      );

      setUploadProgressPercent(100);
      setUploadStatusMessage("Upload & Curriculum Sync Completed Successfully!");
      setCloudinaryUploadSuccess(true);

      setTimeout(() => {
        setShowAddLectureModal(false);
        setCloudinaryUploadSuccess(false);
        setNewLectureTitle("");
        setNewSectionTitle("");
        setSelectedVideoFile(null);
        setUploadProgressPercent(0);
        setUploadStatusMessage("");
        setIsUploadingToCloudinary(false);
      }, 1500);
    } catch (err: any) {
      console.error("Lecture upload error:", err);
      setUploadError(err.message || "Failed to complete lecture video upload.");
      setIsUploadingToCloudinary(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Teacher Stats Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-2xl object-cover ring-4 ring-indigo-500/30"
            />
            <div>
              <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                Instructor Studio
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Faculty Dashboard • {currentUser.name}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Manage your syllabus, AWS S3 video assets, auto-graded quizzes, and student queries.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setCreateCourseError("");
              setCreateCourseSuccess("");
              setShowCreateCourseModal(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            ₹{totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            Razorpay settlements
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Students</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {totalStudents.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">Across all courses</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Instructor Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">4.9 ★</div>
          <div className="text-[11px] text-slate-400">Weighted student average</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Active Courses</span>
            <BookOpen className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {teacherCourses.length}
          </div>
          <div className="text-[11px] text-slate-400">Under your curriculum</div>
        </div>
      </div>

      {/* Courses Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Course Curriculum Management</h2>
            <p className="text-xs text-slate-500">
              Upload videos to S3, manage sections, and inspect verification statuses
            </p>
          </div>
          <button
            onClick={() => {
              setCreateCourseError("");
              setCreateCourseSuccess("");
              setShowCreateCourseModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Enrollments</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Lectures</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teacherCourses.map((course) => {
                const totalLecs = course.sections.flatMap((s) => s.lectures).length;
                return (
                  <tr key={course._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-12 h-8 rounded-md object-cover"
                        />
                        <div>
                          <div className="font-bold text-slate-900 line-clamp-1">
                            {course.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {course.category} • {course.level}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                          course.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : course.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {course.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {course.studentsEnrolled.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{course.price.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {totalLecs} lectures ({course.sections.length} sections)
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedCourseForLecture(course);
                            setShowAddLectureModal(true);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Upload video to Cloudinary"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Add Lecture</span>
                        </button>

                        <button
                          onClick={() => onSelectCourse(course)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                        >
                          View Syllabus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create New Course */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Create New Curriculum Course
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Submit course details to MongoDB. The course will be saved with <span className="font-semibold text-amber-600">status: "pending"</span> awaiting administrative approval before going live.
              </p>
            </div>

            {createCourseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createCourseError}</span>
              </div>
            )}

            {createCourseSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{createCourseSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="e.g., Full Stack GraphQL & Next.js Microservices"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Subtitle Excerpt
                </label>
                <input
                  type="text"
                  value={newCourseSubtitle}
                  onChange={(e) => setNewCourseSubtitle(e.target.value)}
                  placeholder="e.g., Build resilient production platforms from scratch."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Full Description
                </label>
                <textarea
                  rows={3}
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Detailed curriculum overview, target audience, and engineering principles covered..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option>Web Development</option>
                    <option>Frontend</option>
                    <option>Cloud & DevOps</option>
                    <option>System Design</option>
                    <option>Cybersecurity</option>
                    <option>Data Science</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Level
                  </label>
                  <select
                    value={newCourseLevel}
                    onChange={(e) => setNewCourseLevel(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Language
                  </label>
                  <input
                    type="text"
                    value={newCourseLanguage}
                    onChange={(e) => setNewCourseLanguage(e.target.value)}
                    placeholder="e.g., English, Hindi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tuition Price (INR ₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newCoursePrice}
                    onChange={(e) => setNewCoursePrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Thumbnail Image URL
                  </label>
                  <input
                    type="url"
                    value={newCourseThumbnail}
                    onChange={(e) => setNewCourseThumbnail(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Requirements (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={newCourseRequirements}
                    onChange={(e) => setNewCourseRequirements(e.target.value)}
                    placeholder="e.g., Basic JavaScript&#10;Node.js installed"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Learning Outcomes (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={newCourseLearningOutcomes}
                    onChange={(e) => setNewCourseLearningOutcomes(e.target.value)}
                    placeholder="e.g., Build production systems&#10;Deploy to cloud infrastructure"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmittingCourse}
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCourse}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingCourse ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving to MongoDB...</span>
                    </>
                  ) : (
                    <span>Create & Submit for Approval</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Lecture & Cloudinary Direct Signed Upload */}
      {showAddLectureModal && selectedCourseForLecture && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upload Lecture Video (Cloudinary)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Course: {selectedCourseForLecture.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleAddLecture} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Target Section
                </label>
                {selectedCourseForLecture.sections.length > 0 ? (
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 mb-2 cursor-pointer"
                  >
                    <option value="">-- Or Create New Section Below --</option>
                    {selectedCourseForLecture.sections.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                ) : null}

                {!selectedSectionId && (
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="New section name (e.g., Section 4: Advanced Caching)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                  />
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Lecture Title
                </label>
                <input
                  type="text"
                  required
                  value={newLectureTitle}
                  onChange={(e) => setNewLectureTitle(e.target.value)}
                  placeholder="e.g., Setting Up Redis Cluster with Sharding"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={newLectureDuration}
                    onChange={(e) => setNewLectureDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Storage Provider
                  </label>
                  <div className="p-2 bg-slate-100 rounded-lg font-mono text-[10px] text-slate-600 flex items-center justify-between">
                    <span>Cloudinary Video</span>
                    <span className="text-emerald-600 font-bold">Direct Signed</span>
                  </div>
                </div>
              </div>

              {/* Real Video File Picker Dropzone */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Video File (Direct to Cloudinary)
                </label>
                <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl p-4 text-center space-y-2 block cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,video/mkv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedVideoFile(e.target.files[0]);
                      }
                    }}
                  />
                  <Video className="w-8 h-8 text-indigo-500 mx-auto" />
                  {selectedVideoFile ? (
                    <div>
                      <div className="text-xs font-bold text-slate-800 truncate max-w-xs mx-auto">
                        {selectedVideoFile.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedVideoFile.type || "video/mp4"}
                      </div>
                      <span className="text-[10px] text-indigo-600 font-medium underline mt-1 inline-block">
                        Click to change file
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-semibold text-slate-700">
                        Choose course video file from your computer
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        MP4, MKV, WebM or MOV up to 2GB • Uploads directly to Cloudinary
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {/* Progress and status message */}
              {isUploadingToCloudinary && (
                <div className="space-y-1.5 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900">
                    <span>{uploadStatusMessage}</span>
                    <span>{uploadProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error feedback */}
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Success feedback */}
              {cloudinaryUploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cloudinary Direct Upload & MongoDB Curriculum Sync Complete!</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUploadingToCloudinary}
                  onClick={() => {
                    setShowAddLectureModal(false);
                    setSelectedVideoFile(null);
                    setUploadError("");
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingToCloudinary}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {isUploadingToCloudinary ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading to Cloudinary...</span>
                    </>
                  ) : (
                    <span>Upload & Attach Lecture</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
