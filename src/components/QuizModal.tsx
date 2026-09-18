import React, { useState, useEffect } from "react";
import {
  X,
  Timer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Course } from "../types";
import { useLms } from "../context/LmsContext";

interface QuizModalProps {
  course: Course;
  onClose: () => void;
  onOpenCertificate: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  course,
  onClose,
  onOpenCertificate,
}) => {
  const {
    getQuizForCourse,
    submitQuizAttempt,
    getAttemptsForQuiz,
    getEnrollmentForCourse,
    getCertificateForCourse,
  } = useLms();

  const quiz = getQuizForCourse(course._id);
  const enrollment = getEnrollmentForCourse(course._id);
  const certificate = getCertificateForCourse(course._id);
  const previousAttempts = quiz ? getAttemptsForQuiz(quiz._id) : [];

  // State
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState((quiz?.durationMinutes || 10) * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastAttemptResult, setLastAttemptResult] = useState<any>(null);

  // Timer effect
  useEffect(() => {
    if (!hasStarted || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isSubmitted]);

  if (!quiz) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-bold text-slate-900">No Exam Configured</h3>
          <p className="text-xs text-slate-500">
            The instructor has not attached a certification exam for this course yet.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSelectAnswer = (questionId: string, answer: string | number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmit = () => {
    const formatted = Object.entries(selectedAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    const result = submitQuizAttempt(course._id, quiz._id, formatted);
    setLastAttemptResult(result);
    setIsSubmitted(true);
  };

  const currentQ = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;
  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Exam Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
              Major Project Examination Engine
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">{quiz.title}</h2>
          </div>

          <div className="flex items-center gap-4">
            {hasStarted && !isSubmitted && (
              <div
                className={`flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1.5 rounded-lg ${
                  timeLeftSeconds < 120
                    ? "bg-rose-100 text-rose-700 animate-pulse"
                    : "bg-indigo-50 text-indigo-700"
                }`}
              >
                <Timer className="w-4 h-4" />
                <span>
                  {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!hasStarted && !isSubmitted ? (
            /* Intro / Pre-Exam Screen */
            <div className="space-y-6 max-w-xl mx-auto text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center shadow-inner">
                <Award className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-900">
                  Ready to test your knowledge?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {quiz.description}
                </p>
              </div>

              {/* Exam Rules Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2">
                <div className="font-bold text-slate-800">Exam Instructions & Rules:</div>
                <ul className="list-disc list-inside text-slate-600 space-y-1">
                  <li>Total Questions: <strong>{totalQuestions} questions</strong></li>
                  <li>Time Limit: <strong>{quiz.durationMinutes} minutes</strong> (auto-submits on timeout)</li>
                  <li>Passing Threshold: <strong>{quiz.passingScore}%</strong> required for certificate</li>
                  <li>Instant auto-grading for MCQ & True/False</li>
                </ul>
              </div>

              {/* Previous attempts if any */}
              {previousAttempts.length > 0 && (
                <div className="text-left bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-xs">
                  <div className="font-bold text-indigo-950 mb-1.5">
                    Your Past Attempt History:
                  </div>
                  <div className="space-y-1">
                    {previousAttempts.map((att, i) => (
                      <div
                        key={att._id}
                        className="flex items-center justify-between text-slate-600 text-[11px]"
                      >
                        <span>
                          Attempt #{previousAttempts.length - i} • {new Date(att.attemptedAt).toLocaleDateString()}
                        </span>
                        <span
                          className={`font-bold ${
                            att.passed ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          Score: {att.score}% ({att.passed ? "PASSED" : "FAILED"})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setHasStarted(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <span>Start Time-Bound Exam</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : !isSubmitted ? (
            /* Active Exam Taking Interface */
            <div className="space-y-6">
              {/* Question Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>
                    Question <strong className="text-slate-800">{currentQuestionIndex + 1}</strong> of {totalQuestions}
                  </span>
                  <span>
                    Answered {Object.keys(selectedAnswers).length} / {totalQuestions}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    {currentQ.questionType === "true_false" ? "True / False" : "Multiple Choice"}
                  </span>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {currentQ.points} Points
                  </span>
                </div>

                <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {currentQ.questionText}
                </p>

                {/* Options List */}
                <div className="space-y-2.5 pt-2">
                  {currentQ.options?.map((opt, optIndex) => {
                    const isSelected = selectedAnswers[currentQ._id] === optIndex;
                    return (
                      <button
                        key={optIndex}
                        onClick={() => handleSelectAnswer(currentQ._id, optIndex)}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs font-semibold"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-slate-300 text-slate-500"
                          }`}
                        >
                          {String.fromCharCode(65 + optIndex)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exam Navigation Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Previous
                </button>

                {currentQuestionIndex < totalQuestions - 1 ? (
                  <button
                    onClick={() =>
                      setCurrentQuestionIndex((prev) =>
                        Math.min(totalQuestions - 1, prev + 1)
                      )
                    }
                    className="px-5 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-600/20"
                  >
                    Submit Examination
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Post-Submission Result & Breakdown Screen */
            <div className="space-y-6 max-w-xl mx-auto text-center py-2">
              <div
                className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center shadow-lg ${
                  lastAttemptResult?.passed
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-rose-100 text-rose-600"
                }`}
              >
                {lastAttemptResult?.passed ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : (
                  <XCircle className="w-10 h-10" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Instant Auto-Grading Complete
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900">
                  {lastAttemptResult?.passed ? "Congratulations, You Passed!" : "Exam Incomplete"}
                </h3>
                <p className="text-xs text-slate-600">
                  You scored <strong className="text-slate-900 text-sm">{lastAttemptResult?.score}%</strong> (Passing score: {quiz.passingScore}%)
                </p>
              </div>

              {/* Certificate Qualification Callout */}
              {lastAttemptResult?.passed ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-left space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Official Certification Unlocked!</span>
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    You have demonstrated academic proficiency. Your cryptographic completion certificate has been generated with a unique verification hash.
                  </p>
                  <button
                    onClick={onOpenCertificate}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" /> View & Download Certificate
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-left space-y-2">
                  <div className="font-bold text-amber-900">Passing Score Not Reached</div>
                  <p className="text-amber-800">
                    A minimum of {quiz.passingScore}% is required to generate the course certificate. You can review the course lectures and attempt the exam again anytime.
                  </p>
                </div>
              )}

              {/* Question by Question Answer Review */}
              <div className="text-left space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-800">Review Questions:</div>
                <div className="space-y-2">
                  {quiz.questions.map((q, idx) => {
                    const ans = lastAttemptResult?.answers?.find(
                      (a: any) => a.questionId === q._id
                    );
                    const isCorrect = ans?.isCorrect;

                    return (
                      <div
                        key={q._id}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          isCorrect
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-rose-50/50 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start justify-between font-bold text-slate-900">
                          <span>
                            {idx + 1}. {q.questionText}
                          </span>
                          <span
                            className={isCorrect ? "text-emerald-700" : "text-rose-700"}
                          >
                            {isCorrect ? "+25 pts" : "0 pts"}
                          </span>
                        </div>
                        {q.explanation && (
                          <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg mt-1">
                            <span className="font-bold text-slate-700">Explanation: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setHasStarted(false);
                    setSelectedAnswers({});
                    setTimeLeftSeconds((quiz.durationMinutes || 10) * 60);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake Exam
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
