import React, { useState } from "react";
import {
  MessageSquare,
  ThumbsUp,
  CheckCircle2,
  Send,
  Sparkles,
  UserCheck,
  Check,
} from "lucide-react";
import { useLms } from "../context/LmsContext";
import { useAuth } from "../context/AuthContext";

interface DiscussionForumProps {
  courseId: string;
  lectureId?: string;
  theme?: "dark" | "light";
}

export const DiscussionForum: React.FC<DiscussionForumProps> = ({
  courseId,
  lectureId,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const {
    getCourseDiscussions,
    addDiscussionThread,
    addDiscussionReply,
    toggleUpvoteDiscussion,
    toggleResolveDiscussion,
  } = useLms();
  const { currentUser, activeRole } = useAuth();

  const discussions = getCourseDiscussions(courseId);

  // New question form state
  const [showAskForm, setShowAskForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

  // Reply state
  const [activeReplyThreadId, setActiveReplyThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const handlePostQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newQuestion.trim()) return;

    addDiscussionThread(courseId, lectureId, newTitle, newQuestion);
    setNewTitle("");
    setNewQuestion("");
    setShowAskForm(false);
  };

  const handlePostReply = (threadId: string) => {
    if (!replyText.trim()) return;
    addDiscussionReply(threadId, replyText);
    setReplyText("");
    setActiveReplyThreadId(null);
  };

  return (
    <div className="space-y-6">
      {/* Forum Header & Ask Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span>Course Discussions & Q&A</span>
          </h3>
          <p className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Ask doubts, brainstorm architecture, and collaborate with instructors
          </p>
        </div>

        <button
          onClick={() => setShowAskForm(!showAskForm)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask a Question</span>
        </button>
      </div>

      {/* Ask Question Form */}
      {showAskForm && (
        <form
          onSubmit={handlePostQuestion}
          className={`border rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-150 ${
            isLight
              ? "bg-slate-50 border-indigo-200 shadow-xs"
              : "bg-slate-900 border-indigo-500/40"
          }`}
        >
          <div
            className={`text-xs font-bold ${
              isLight ? "text-indigo-700" : "text-indigo-300"
            }`}
          >
            Post a New Discussion Query
          </div>

          <div>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Summary of your question (e.g., How does S3 multipart chunking work?)"
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 ${
                isLight
                  ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  : "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
              }`}
            />
          </div>

          <div>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Describe your doubt in detail. Provide code snippets or error logs if applicable..."
              rows={4}
              className={`w-full border rounded-xl p-3.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono ${
                isLight
                  ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  : "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
              }`}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAskForm(false)}
              className={`px-3 py-1.5 border rounded-lg text-xs cursor-pointer ${
                isLight
                  ? "border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3 h-3" /> Post Question
            </button>
          </div>
        </form>
      )}

      {/* Threads List */}
      <div className="space-y-4">
        {discussions.length > 0 ? (
          discussions.map((thread) => (
            <div
              key={thread._id}
              className={`border rounded-2xl p-4 sm:p-5 space-y-4 transition-colors ${
                isLight
                  ? thread.isResolved
                    ? "bg-white border-emerald-300 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                  : thread.isResolved
                  ? "bg-slate-900/80 border-emerald-500/30"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Thread Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <img
                    src={thread.studentAvatar}
                    alt={thread.studentName}
                    className={`w-8 h-8 rounded-full object-cover border mt-0.5 ${
                      isLight ? "border-slate-200" : "border-slate-700"
                    }`}
                  />
                  <div>
                    <h4
                      className={`text-sm font-bold leading-snug ${
                        isLight ? "text-slate-900" : "text-white"
                      }`}
                    >
                      {thread.title}
                    </h4>
                    <div
                      className={`text-[11px] flex items-center gap-2 mt-0.5 ${
                        isLight ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      <span>{thread.studentName}</span>
                      <span>•</span>
                      <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                      {thread.isResolved && (
                        <span
                          className={`font-semibold px-2 py-0.2 rounded-full text-[10px] flex items-center gap-1 border ${
                            isLight
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-emerald-400 bg-emerald-950/60 border-emerald-800"
                          }`}
                        >
                          <Check className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upvote & Resolve Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleUpvoteDiscussion(thread._id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isLight
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{thread.upvotes}</span>
                  </button>

                  {(activeRole === "teacher" || activeRole === "admin") && (
                    <button
                      onClick={() => toggleResolveDiscussion(thread._id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        thread.isResolved
                          ? isLight
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                          : isLight
                          ? "bg-slate-100 text-slate-600 hover:text-emerald-600"
                          : "bg-slate-800 text-slate-400 hover:text-emerald-400"
                      }`}
                      title="Toggle Resolved status"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Question Body */}
              <p
                className={`text-xs leading-relaxed whitespace-pre-line pl-11 ${
                  isLight ? "text-slate-700" : "text-slate-300"
                }`}
              >
                {thread.question}
              </p>

              {/* Replies List */}
              {thread.replies.length > 0 && (
                <div
                  className={`pl-11 space-y-3 pt-2 border-t ${
                    isLight ? "border-slate-100" : "border-slate-800/80"
                  }`}
                >
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isLight ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {thread.replies.length} Replies:
                  </div>

                  {thread.replies.map((reply) => (
                    <div
                      key={reply._id}
                      className={`p-3 rounded-xl text-xs space-y-1.5 ${
                        reply.isInstructorResponse
                          ? isLight
                            ? "bg-indigo-50/70 border border-indigo-200"
                            : "bg-indigo-950/40 border border-indigo-500/30"
                          : isLight
                          ? "bg-slate-50 border border-slate-200"
                          : "bg-slate-950 border border-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={reply.authorAvatar}
                            alt={reply.authorName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span
                            className={`font-semibold ${
                              isLight ? "text-slate-900" : "text-white"
                            }`}
                          >
                            {reply.authorName}
                          </span>
                          {reply.isInstructorResponse && (
                            <span className="px-1.5 py-0.2 rounded-sm text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider flex items-center gap-0.5">
                              <UserCheck className="w-2.5 h-2.5" /> Instructor
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] ${
                            isLight ? "text-slate-500" : "text-slate-500"
                          }`}
                        >
                          {new Date(reply.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p
                        className={`leading-relaxed pl-7 ${
                          isLight ? "text-slate-700" : "text-slate-300"
                        }`}
                      >
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input or Trigger */}
              <div className="pl-11 pt-1">
                {activeReplyThreadId === thread._id ? (
                  <div className="space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your answer or feedback..."
                      rows={3}
                      className={`w-full border rounded-xl p-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500 ${
                        isLight
                          ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                          : "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePostReply(thread._id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Submit Reply
                      </button>
                      <button
                        onClick={() => {
                          setActiveReplyThreadId(null);
                          setReplyText("");
                        }}
                        className={`px-3 py-1.5 text-xs cursor-pointer ${
                          isLight
                            ? "text-slate-500 hover:text-slate-800"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveReplyThreadId(thread._id)}
                    className="text-xs text-indigo-600 hover:text-indigo-500 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Reply to this discussion...</span>
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div
            className={`text-center py-8 rounded-2xl border text-xs ${
              isLight
                ? "bg-slate-50 border-slate-200 text-slate-500"
                : "bg-slate-900/50 border-slate-800 text-slate-400"
            }`}
          >
            No questions posted yet. Be the first to start a discussion!
          </div>
        )}
      </div>
    </div>
  );
};
