import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { Course } from "../types";
import { useLms } from "../context/LmsContext";

interface QuizModalProps {
  course: Course;
  quiz?: any;
  onClose: () => void;
  onOpenCertificate?: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  course,
  quiz: quizProp,
  onClose,
  onOpenCertificate,
}) => {
  const { fetchQuizById, submitQuizAttempt, getQuizForCourse } = useLms();

  // Determine initial quizId from props or course
  const defaultCourseQuiz = getQuizForCourse(course._id);
  const targetQuizId =
    quizProp?.quizId || quizProp?._id || defaultCourseQuiz?.quizId || defaultCourseQuiz?._id;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);

  // Exam navigation & answering state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    score: number;
    totalMarks: number;
    percentage: number;
    completed: boolean;
  } | null>(null);

  // Fetch full student-sanitized quiz from server (GET /api/quizzes/:quizId)
  useEffect(() => {
    let isMounted = true;

    async function loadQuiz() {
      if (!targetQuizId) {
        if (quizProp && Array.isArray(quizProp.questions) && quizProp.questions.length > 0) {
          setActiveQuiz(quizProp);
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
        setFetchError("No quiz or exam configured for this curriculum section.");
        return;
      }

      setIsLoading(true);
      setFetchError(null);

      try {
        const response = await fetchQuizById(targetQuizId);
        if (!isMounted) return;

        if (response.success && response.quiz) {
          setActiveQuiz(response.quiz);

          // If student already has a completed attempt from MongoDB
          if (response.attempt && response.attempt.completed) {
            setResult({
              score: response.attempt.score,
              totalMarks: response.attempt.totalMarks,
              percentage: response.attempt.percentage,
              completed: true,
            });
          }
        } else {
          // If fallback local quiz exists
          if (quizProp && Array.isArray(quizProp.questions) && quizProp.questions.length > 0) {
            setActiveQuiz(quizProp);
          } else if (defaultCourseQuiz && Array.isArray(defaultCourseQuiz.questions) && defaultCourseQuiz.questions.length > 0) {
            setActiveQuiz(defaultCourseQuiz);
          } else {
            setFetchError(response.message || "Failed to load quiz questions.");
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setFetchError(err.message || "Network error loading quiz questions.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadQuiz();

    return () => {
      isMounted = false;
    };
  }, [targetQuizId]);

  // Select option index for current question
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (isSubmitting || result) return;
    setSubmitError(null);
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // Submit quiz answers to server (POST /api/quizzes/:quizId/submit)
  const handleSubmit = async () => {
    if (isSubmitting || !activeQuiz) return;

    const quizIdToSubmit = activeQuiz.quizId || activeQuiz._id || targetQuizId;
    if (!quizIdToSubmit) {
      setSubmitError("Quiz ID missing. Unable to submit.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await submitQuizAttempt(
        course._id,
        quizIdToSubmit,
        selectedAnswers
      );

      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setSubmitError(
          response.message || "Failed to submit quiz attempt. Please check your network and try again."
        );
      }
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const questions = Array.isArray(activeQuiz?.questions) ? activeQuiz.questions : [];
  const totalQuestions = questions.length;
  const currentQ = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                {course.title}
              </span>
              <h2 className="text-base font-bold text-slate-900 truncate">
                {activeQuiz?.title || "Course Quiz"}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors disabled:opacity-40"
            title="Close quiz"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Loading State */}
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600">Loading quiz questions from server...</p>
            </div>
          ) : fetchError || totalQuestions === 0 ? (
            /* Error / Empty State */
            <div className="py-10 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Quiz Unavailable</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {fetchError || "This quiz does not have any questions available at the moment."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          ) : result ? (
            /* Result Screen */
            <div className="py-6 max-w-md mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  Assessment Submitted
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900">Quiz Completed</h3>
                <p className="text-xs text-slate-500">
                  Your attempt has been safely evaluated and recorded.
                </p>
              </div>

              {/* Score Display Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 text-center">
                <div className="text-xs font-semibold text-slate-500">Your Final Score</div>
                <div className="text-3xl font-black text-slate-900">
                  {result.score} <span className="text-lg font-bold text-slate-400">/ {result.totalMarks}</span>
                </div>
                <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-lg">
                  {result.percentage}%
                </div>
              </div>

              {/* Certificate Unlock Banner if available */}
              {result.percentage >= 60 && onOpenCertificate && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-left space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Passing Score Achieved!</span>
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    Great job! You have passed this quiz assessment.
                  </p>
                  <button
                    onClick={onOpenCertificate}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4" /> View Certificate
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            /* Active Quiz Taking Interface */
            <div className="space-y-6">
              {/* Question X of Y and Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>
                    Question <strong className="text-slate-900 font-bold">{currentQuestionIndex + 1}</strong> of{" "}
                    {totalQuestions}
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                    {currentQ?.marks || 1} {Number(currentQ?.marks) === 1 ? "Mark" : "Marks"}
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

              {/* Question Text */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {currentQ?.question || currentQ?.questionText}
                </h3>

                {/* Options List */}
                <div className="space-y-2.5 pt-1">
                  {(currentQ?.options || []).map((optText: string, optIndex: number) => {
                    const questionId = currentQ?.questionId || currentQ?._id;
                    const isSelected = selectedAnswers[questionId] === optIndex;

                    return (
                      <button
                        key={optIndex}
                        type="button"
                        onClick={() => handleSelectOption(questionId, optIndex)}
                        disabled={isSubmitting}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-500 text-indigo-950 font-semibold shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/60"
                        } disabled:pointer-events-none disabled:opacity-60`}
                      >
                        {/* Radio Indicator */}
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </span>

                        <div className="flex-1 leading-relaxed">
                          <span className="font-bold text-slate-500 mr-2 text-[11px]">
                            {String.fromCharCode(65 + optIndex)}.
                          </span>
                          <span>{optText}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submission Error Banner */}
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Navigation Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0 || isSubmitting}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {!isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                    }
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting Quiz...</span>
                      </>
                    ) : (
                      <span>Submit Quiz</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
