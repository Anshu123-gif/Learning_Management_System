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
  const { courses, addCourse, addSectionToCourse, addLectureToSection, discussions } = useLms();
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
  const [newCourseCategory, setNewCourseCategory] = useState("Web Development");
  const [newCoursePrice, setNewCoursePrice] = useState("3499");
  const [newCourseLevel, setNewCourseLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");

  // New Lecture Form
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [newLectureDuration, setNewLectureDuration] = useState("20");
  const [isUploadingToS3, setIsUploadingToS3] = useState(false);
  const [s3UploadSuccess, setS3UploadSuccess] = useState(false);

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    addCourse({
      title: newCourseTitle,
      subtitle: newCourseSubtitle || "Master real-world production engineering concepts.",
      description: "Comprehensive industry curriculum with hands-on labs and certifications.",
      category: newCourseCategory,
      level: newCourseLevel,
      price: parseInt(newCoursePrice) || 3499,
      originalPrice: (parseInt(newCoursePrice) || 3499) * 2,
      thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=60",
      instructorId: currentUser._id,
      instructorName: currentUser.name,
      instructorAvatar: currentUser.avatar,
      instructorTitle: "Senior Architect & Faculty",
      learningOutcomes: [
        "Architect production systems",
        "Implement secure RESTful APIs",
        "Master cloud deployments",
      ],
      requirements: ["Basic programming syntax"],
    });

    setShowCreateCourseModal(false);
    setNewCourseTitle("");
    setNewCourseSubtitle("");
  };

  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForLecture || !newLectureTitle.trim()) return;

    setIsUploadingToS3(true);

    // Simulate S3 presigned URL generation and upload
    setTimeout(() => {
      let targetSectionId = selectedSectionId;

      if (!targetSectionId && newSectionTitle.trim()) {
        const addedSection = addSectionToCourse(
          selectedCourseForLecture._id,
          newSectionTitle.trim()
        );
        targetSectionId = addedSection._id;
      } else if (!targetSectionId && selectedCourseForLecture.sections[0]) {
        targetSectionId = selectedCourseForLecture.sections[0]._id;
      }

      if (targetSectionId) {
        addLectureToSection(selectedCourseForLecture._id, targetSectionId, {
          title: newLectureTitle.trim(),
          description: "Technical lecture uploaded to AWS S3 storage with signed access.",
          durationMinutes: parseInt(newLectureDuration) || 15,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          s3Key: `courses/${selectedCourseForLecture._id}/lectures/${Date.now()}.mp4`,
          isPreviewFree: false,
        });
      }

      setIsUploadingToS3(false);
      setS3UploadSuccess(true);
      setTimeout(() => {
        setShowAddLectureModal(false);
        setS3UploadSuccess(false);
        setNewLectureTitle("");
        setNewSectionTitle("");
      }, 1200);
    }, 1500);
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
            onClick={() => setShowCreateCourseModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Course Curriculum Management</h2>
            <p className="text-xs text-slate-500">
              Upload videos to S3, manage sections, and inspect verification statuses
            </p>
          </div>
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
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors"
                          title="Upload video to AWS S3"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Create New Curriculum Course
            </h3>

            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  required
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="e.g., Full Stack GraphQL & Next.js Microservices"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tuition Price (INR ₹)
                </label>
                <input
                  type="number"
                  value={newCoursePrice}
                  onChange={(e) => setNewCoursePrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                >
                  Create & Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Lecture & S3 Upload Simulation */}
      {showAddLectureModal && selectedCourseForLecture && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upload Lecture to AWS S3
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 mb-2"
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
                    S3 Bucket Target
                  </label>
                  <div className="p-2 bg-slate-100 rounded-lg font-mono text-[10px] text-slate-600">
                    edupulse-video-streams-prod
                  </div>
                </div>
              </div>

              {/* S3 Upload Dropzone preview */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center space-y-1 bg-slate-50/50">
                <Video className="w-8 h-8 text-indigo-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  Select MP4 / MKV video lecture file
                </div>
                <div className="text-[10px] text-slate-400">
                  Transcoding: 1080p, 720p, 480p with signed URL playback
                </div>
              </div>

              {s3UploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>S3 Multipart Upload Complete! Presigned URL configured.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUploadingToS3}
                  onClick={() => setShowAddLectureModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingToS3}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg flex items-center gap-2"
                >
                  {isUploadingToS3 ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading to S3...</span>
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
