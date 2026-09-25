import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LmsProvider, useLms } from "./context/LmsContext";
import { Navbar } from "./components/Navbar";
import { SheryiansHero } from "./components/SheryiansHero";
import { CourseCatalog } from "./components/CourseCatalog";
import { CourseDetailModal } from "./components/CourseDetailModal";
import { PaymentModal } from "./components/PaymentModal";
import { VideoPlayerView } from "./components/VideoPlayerView";
import { StudentDashboard } from "./components/StudentDashboard";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { QuizModal } from "./components/QuizModal";
import { CertificateModal } from "./components/CertificateModal";
import { AiChatbotWidget } from "./components/AiChatbotWidget";
import { ProjectDossierModal } from "./components/ProjectDossierModal";
import { AuthModal } from "./components/AuthModal";
import { Course } from "./types";

const MainApp: React.FC = () => {
  const { activeRole } = useAuth();
  const { courses, getCertificateForCourse } = useLms();

  // Navigation state
  const [currentPage, setCurrentPage] = useState<string>("catalog");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals and Active Course State
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [learningCourse, setLearningCourse] = useState<Course | null>(null);
  const [payingCourse, setPayingCourse] = useState<Course | null>(null);
  const [quizCourse, setQuizCourse] = useState<Course | null>(null);
  const [activeQuizForModal, setActiveQuizForModal] = useState<any | null>(null);
  const [certCourse, setCertCourse] = useState<Course | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // If in active video classroom mode, render full-screen VideoPlayerView
  if (learningCourse) {
    return (
      <div className="min-h-screen bg-[#0b0b0c] text-white font-sans antialiased">
        <VideoPlayerView
          course={learningCourse}
          onBack={() => setLearningCourse(null)}
          onOpenQuiz={(q) => {
            setActiveQuizForModal(q || null);
            setQuizCourse(learningCourse);
          }}
          onOpenCertificate={() => setCertCourse(learningCourse)}
        />

        {/* Exam Modal on top of Video Player */}
        {quizCourse && (
          <QuizModal
            course={quizCourse}
            quiz={activeQuizForModal}
            onClose={() => {
              setQuizCourse(null);
              setActiveQuizForModal(null);
            }}
            onOpenCertificate={() => {
              setCertCourse(quizCourse);
              setQuizCourse(null);
              setActiveQuizForModal(null);
            }}
          />
        )}

        {/* Certificate Modal */}
        {certCourse && (
          <CertificateModal
            course={certCourse}
            certificate={
              getCertificateForCourse(certCourse._id) || {
                _id: "cert_fallback",
                verificationId: "SHERYIANS-2025-DEV",
                studentId: "usr_student_1",
                studentName: "Rahul Sharma",
                courseId: certCourse._id,
                courseTitle: certCourse.title,
                instructorName: certCourse.instructorName,
                issuedAt: "2025-02-14",
                pdfS3Key: "certs/cert.pdf",
              }
            }
            onClose={() => setCertCourse(null)}
          />
        )}

        <AiChatbotWidget currentCourse={learningCourse} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white font-sans flex flex-col antialiased selection:bg-[#E84A27] selection:text-white">
      {/* Sheryians Top Navigation Bar */}
      <Navbar
        currentTab={
          currentPage === "my-courses"
            ? "my-learning"
            : currentPage === "teacher"
            ? "instructor"
            : (currentPage as any)
        }
        setCurrentTab={(tab) => setCurrentPage(tab)}
        currentPage={currentPage}
        onNavigate={(page) => setCurrentPage(page)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchChange={setSearchQuery}
        onOpenDossier={() => setIsDossierOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {currentPage === "catalog" && (
          <SheryiansHero
            onStartJourney={() => {
              const el = document.getElementById("sheryians-courses-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            onSelectCourse={(c) => setSelectedCourse(c)}
            onRequestCall={() => setIsDossierOpen(true)}
            onOpenDossier={() => setIsDossierOpen(true)}
          />
        )}

        {(currentPage === "my-courses" || currentPage === "my-learning") && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <StudentDashboard
              onStartLearning={(c) => setLearningCourse(c)}
              onOpenCertificate={(courseId) => {
                const crs = courses.find((c) => c._id === courseId);
                if (crs) setCertCourse(crs);
              }}
              onExploreCourses={() => setCurrentPage("catalog")}
            />
          </div>
        )}

        {(currentPage === "teacher" || currentPage === "instructor") && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <TeacherDashboard
              onSelectCourse={(c) => setSelectedCourse(c)}
            />
          </div>
        )}

        {currentPage === "admin" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <AdminDashboard
              onSelectCourse={(c) => setSelectedCourse(c)}
            />
          </div>
        )}
      </main>

      {/* Course Detail Modal */}
      {selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onEnroll={(c) => {
            setSelectedCourse(null);
            setPayingCourse(c);
          }}
          onStartLearning={(c) => {
            setSelectedCourse(null);
            setLearningCourse(c);
          }}
          onOpenQuiz={(q) => {
            setActiveQuizForModal(q || null);
            setQuizCourse(selectedCourse);
          }}
        />
      )}

      {/* Quiz / Exam Modal (when accessed outside active video classroom) */}
      {quizCourse && (
        <QuizModal
          course={quizCourse}
          quiz={activeQuizForModal}
          onClose={() => {
            setQuizCourse(null);
            setActiveQuizForModal(null);
          }}
          onOpenCertificate={() => {
            setCertCourse(quizCourse);
            setQuizCourse(null);
            setActiveQuizForModal(null);
          }}
        />
      )}

      {/* Razorpay Payment Modal */}
      {payingCourse && (
        <PaymentModal
          course={payingCourse}
          onClose={() => setPayingCourse(null)}
          onSuccess={() => {
            setLearningCourse(payingCourse);
            setPayingCourse(null);
          }}
        />
      )}

      {/* Certificate Modal */}
      {certCourse && (
        <CertificateModal
          course={certCourse}
          certificate={
            getCertificateForCourse(certCourse._id) || {
              _id: "cert_default",
              verificationId: "SHERYIANS-2025-DEV",
              studentId: "usr_student_1",
              studentName: "Rahul Sharma",
              courseId: certCourse._id,
              courseTitle: certCourse.title,
              instructorName: certCourse.instructorName,
              issuedAt: "2025-02-14",
              pdfS3Key: "certs/cert.pdf",
            }
          }
          onClose={() => setCertCourse(null)}
        />
      )}

      {/* Architecture & SRS Dossier Modal */}
      {isDossierOpen && (
        <ProjectDossierModal onClose={() => setIsDossierOpen(false)} />
      )}

      {/* Gemini AI Chatbot Floating Widget */}
      <AiChatbotWidget currentCourse={selectedCourse || undefined} />

      {/* Sheryians / PW Style Login & Signup Modal */}
      <AuthModal />

      {/* Sheryians Dark Footer */}
      <footer className="border-t border-neutral-800/80 bg-[#070708] py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white font-display">Sheryians Coding School</span>
            <span className="text-neutral-600">•</span>
            <span>Learn. Build. Get Placed.</span>
          </div>

          <div className="flex items-center gap-5 text-neutral-400">
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hover:text-[#E84A27] transition-colors"
            >
              Curriculum & Roadmaps
            </button>
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hover:text-[#E84A27] transition-colors"
            >
              Offline Batches
            </button>
            <button
              onClick={() => setIsDossierOpen(true)}
              className="hover:text-[#E84A27] transition-colors"
            >
              System Design & MERN
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LmsProvider>
        <MainApp />
      </LmsProvider>
    </AuthProvider>
  );
}
