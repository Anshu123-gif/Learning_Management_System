import React, { useState, useEffect } from "react";
import { X, RefreshCw, AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    login,
    signup,
    quickDemoLogin,
    mongoStatus,
  } = useAuth();

  // "login" or "signup"
  const [activeTab, setActiveTab] = useState<"login" | "signup">(authModalMode);

  // Login Form States (Exactly 2 input fields: Email, Password)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup Form States (Exactly 3 input fields: Name, Email, Password)
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Processing & Feedback Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "success" | "info";
    text: string;
  } | null>(null);

  // Sync mode whenever opened or changed
  useEffect(() => {
    setActiveTab(authModalMode);
    setStatusMessage(null);
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  // -------------------------------------------------------------
  // LOGIN SUBMISSION HANDLER
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Frontend validation
    if (!cleanEmail) {
      setStatusMessage({
        type: "error",
        text: "Please enter your registered email address.",
      });
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid email format (e.g., student@example.com).",
      });
      return;
    }

    if (!loginPassword) {
      setStatusMessage({
        type: "error",
        text: "Please enter your account password.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await login(cleanEmail, loginPassword, "student");
      setIsProcessing(false);

      if (!result.success) {
        setStatusMessage({
          type: "error",
          text: result.message || "Invalid email or password. Please try again.",
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage({
        type: "error",
        text: err.message || "An unexpected error occurred during login.",
      });
    }
  };

  // -------------------------------------------------------------
  // SIGNUP SUBMISSION HANDLER
  // -------------------------------------------------------------
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanName = signupName.trim();
    const cleanEmail = signupEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1. Frontend validation for Name, Email, and Password
    if (!cleanName || cleanName.length < 2) {
      setStatusMessage({
        type: "error",
        text: "Please enter your full name (at least 2 characters).",
      });
      return;
    }

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid email address.",
      });
      return;
    }

    if (!signupPassword || signupPassword.length < 6) {
      setStatusMessage({
        type: "error",
        text: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 2. Submit to MongoDB authentication endpoint (which checks existing email, hashes password with bcrypt, and stores user in MongoDB)
      const result = await signup({
        name: cleanName,
        email: cleanEmail,
        password: signupPassword,
        role: "student",
      });

      setIsProcessing(false);

      if (result.success) {
        // 3. Signup successful: Redirect/switch to Login page, prefill email, and display success banner
        setLoginEmail(cleanEmail);
        setLoginPassword("");
        setActiveTab("login");
        setStatusMessage({
          type: "success",
          text: "✅ Account created successfully in MongoDB! Please enter your password to sign in.",
        });
      } else {
        // 4. If email already registered or other error, display clear error message
        setStatusMessage({
          type: "error",
          text: result.message || "This email is already registered. Please sign in instead.",
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage({
        type: "error",
        text: err.message || "Registration failed. Please try again.",
      });
    }
  };

  return (
    <div
      id="pw-auth-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 font-sans"
    >
      {/* Modal Card matching Sheryians Dark UI */}
      <div
        id="pw-auth-modal-card"
        className="bg-[#0b0b0c] text-white w-full max-w-[460px] rounded-2xl p-7 sm:p-9 shadow-2xl border border-neutral-800 relative"
      >
        {/* Close Button */}
        <button
          id="pw-auth-close-btn"
          onClick={closeAuthModal}
          className="absolute top-6 right-6 z-10 w-8 h-8 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-neutral-800"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Database Status Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] text-neutral-400 tracking-wide font-mono uppercase">
            MongoDB Atlas Database Active
          </span>
        </div>

        {/* ----------------- LOGIN VIEW ----------------- */}
        {activeTab === "login" && (
          <div>
            {/* Header */}
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display mb-1.5">
              Sign In
            </h2>
            <div className="text-sm text-neutral-400 mb-6 font-normal">
              <span>New user? </span>
              <button
                id="pw-switch-to-signup-btn"
                type="button"
                onClick={() => {
                  setActiveTab("signup");
                  setStatusMessage(null);
                }}
                className="text-[#E84A27] hover:underline font-medium cursor-pointer transition-colors"
              >
                Create an account
              </button>
            </div>

            {/* Status Alert */}
            {statusMessage && (
              <div
                id="pw-login-status-message"
                className={`mb-5 p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                  statusMessage.type === "error"
                    ? "bg-rose-950/40 text-rose-300 border border-rose-800/60"
                    : statusMessage.type === "info"
                    ? "bg-neutral-900 text-neutral-300 border border-neutral-700"
                    : "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60"
                }`}
              >
                {statusMessage.type === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
              </div>
            )}

            {/* LOGIN FORM: Exactly 2 Input Fields (Email, Password) */}
            <form id="pw-login-form" onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Field 1: Email */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="pw-login-email-input"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-[#0e0e10] border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#E84A27] focus:ring-1 focus:ring-[#E84A27] text-sm transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-neutral-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="pw-login-password-input"
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 bg-[#0e0e10] border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#E84A27] focus:ring-1 focus:ring-[#E84A27] text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="pw-login-submit-btn"
                type="submit"
                disabled={isProcessing}
                className="w-full mt-2 py-3.5 px-4 bg-[#E84A27] hover:bg-[#d43f1e] active:bg-[#c03517] text-white font-medium rounded-lg text-sm transition-all shadow-md shadow-[#E84A27]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying credentials...</span>
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Quick Demo Login Switcher */}
            <div className="mt-7 pt-4 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Quick Test Access:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => quickDemoLogin("student")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Student
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => quickDemoLogin("teacher")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Instructor
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => quickDemoLogin("admin")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- SIGN UP VIEW ----------------- */}
        {activeTab === "signup" && (
          <div>
            {/* Header */}
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display mb-1.5">
              Sign Up
            </h2>
            <div className="text-sm text-neutral-400 mb-6 font-normal">
              <span>Already have an account? </span>
              <button
                id="pw-switch-to-login-btn"
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setStatusMessage(null);
                }}
                className="text-[#E84A27] hover:underline font-medium cursor-pointer transition-colors"
              >
                Sign In
              </button>
            </div>

            {/* Status Alert */}
            {statusMessage && (
              <div
                id="pw-signup-status-message"
                className={`mb-4 p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                  statusMessage.type === "error"
                    ? "bg-rose-950/40 text-rose-300 border border-rose-800/60"
                    : statusMessage.type === "info"
                    ? "bg-neutral-900 text-neutral-300 border border-neutral-700"
                    : "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60"
                }`}
              >
                {statusMessage.type === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
              </div>
            )}

            {/* SIGNUP FORM: Exactly 3 Input Fields (Name, Email, Password) */}
            <form id="pw-signup-form" onSubmit={handleSignUpSubmit} className="space-y-4">
              {/* Field 1: Name */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="pw-signup-name-input"
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 bg-[#0e0e10] border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#E84A27] focus:ring-1 focus:ring-[#E84A27] text-sm transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Email */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="pw-signup-email-input"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-10 pr-4 py-3 bg-[#0e0e10] border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#E84A27] focus:ring-1 focus:ring-[#E84A27] text-sm transition-all"
                  />
                </div>
              </div>

              {/* Field 3: Password */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="pw-signup-password-input"
                    type={showSignupPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a password (min. 6 characters)"
                    className="w-full pl-10 pr-10 py-3 bg-[#0e0e10] border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#E84A27] focus:ring-1 focus:ring-[#E84A27] text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Stored securely in MongoDB Atlas with bcrypt one-way hashing.
                </p>
              </div>

              {/* Submit Button */}
              <button
                id="pw-signup-submit-btn"
                type="submit"
                disabled={isProcessing}
                className="w-full mt-2 py-3.5 px-4 bg-[#E84A27] hover:bg-[#d43f1e] active:bg-[#c03517] text-white font-medium rounded-lg text-sm transition-all shadow-md shadow-[#E84A27]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating MongoDB Account...</span>
                  </span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>

            {/* Quick Demo Switcher */}
            <div className="mt-6 pt-4 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Quick Test Access:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => quickDemoLogin("student")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Student
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => quickDemoLogin("teacher")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Instructor
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => quickDemoLogin("admin")}
                  className="hover:text-neutral-300 underline cursor-pointer"
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
