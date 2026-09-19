import React, { useState } from "react";
import {
  X,
  CreditCard,
  Smartphone,
  Building,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Zap,
  AlertCircle,
} from "lucide-react";
import {
  Course,
  RazorpayOptions,
  RazorpayPaymentSuccessResponse,
  RazorpayPaymentFailureResponse,
} from "../types";
import { useAuth } from "../context/AuthContext";
import { useLms } from "../context/LmsContext";

interface PaymentModalProps {
  course: Course;
  onClose: () => void;
  onSuccess: () => void;
}

// Dynamically load official Razorpay Checkout SDK
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  course,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { enrollInCourse } = useLms();

  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [upiId, setUpiId] = useState(`${currentUser?.name?.toLowerCase().replace(/\s+/g, "") || "student"}@okaxis`);
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8910");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentResponseData, setPaymentResponseData] = useState<RazorpayPaymentSuccessResponse | null>(null);
  const [enrollmentResult, setEnrollmentResult] = useState<{
    enrollmentId?: string;
    alreadyEnrolled?: boolean;
    alreadyProcessed?: boolean;
    studentName?: string;
  } | null>(null);

  const handlePay = async () => {
    if (isProcessing || isVerifying) return;

    setIsProcessing(true);
    setIsVerifying(false);
    setIsVerified(false);
    setErrorMessage(null);

    try {
      // 1. Ensure Razorpay Checkout script is loaded
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded || !window.Razorpay) {
        throw new Error(
          "Could not load Razorpay Checkout SDK. Please check your internet connection and try again."
        );
      }

      // Safe fallback variables for course information
      const safeCourseId = course?._id ? String(course._id) : "course_mern_101";
      const rawPrice = course?.price ?? (course as any)?.amount;
      const safePrice =
        typeof rawPrice === "number" && !isNaN(rawPrice) && rawPrice > 0
          ? Math.round(rawPrice)
          : typeof rawPrice === "string" && !isNaN(parseFloat(rawPrice)) && parseFloat(rawPrice) > 0
          ? Math.round(parseFloat(rawPrice))
          : typeof course?.originalPrice === "number" && course.originalPrice > 0
          ? Math.round(course.originalPrice)
          : 1499;
      const safeCourseTitle = course?.title || "EduPulse LMS Course";

      // 2. Call backend order creation API (Authoritative Server-Side Amount)
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: safeCourseId,
          amount: safePrice,
          courseTitle: safeCourseTitle,
          userId: currentUser?._id,
        }),
      });

      let orderData: any = {};
      const responseText = await res.text();
      try {
        orderData = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          `Payment server returned invalid response (HTTP ${res.status}). Please try again or contact support.`
        );
      }

      if (!res.ok || !orderData.success || !orderData.orderId) {
        throw new Error(
          orderData.message || orderData.error || `Failed to initiate payment order on the server (HTTP ${res.status}).`
        );
      }

      // 3. Prepare Razorpay Checkout options with public Test Key ID
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise from backend
        currency: orderData.currency || "INR",
        name: "EduPulse Technologies",
        description: orderData.courseTitle || safeCourseTitle,
        order_id: orderData.orderId,
        handler: async (response: RazorpayPaymentSuccessResponse) => {
          // Razorpay popup finished; now verify the HMAC signature and enroll in MongoDB on backend
          setIsVerifying(true);
          setIsProcessing(true);
          setErrorMessage(null);

          try {
            const jwtToken = localStorage.getItem("edupulse_jwt_token");

            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                courseId: safeCourseId,
                courseTitle: safeCourseTitle,
                amount: safePrice,
                userId: currentUser?._id,
                studentName: currentUser?.name,
                studentEmail: currentUser?.email,
              }),
            });

            let verifyData: any = {};
            const verifyText = await verifyRes.text();
            try {
              verifyData = verifyText ? JSON.parse(verifyText) : {};
            } catch {
              throw new Error(
                `Payment verification returned invalid server response (HTTP ${verifyRes.status}).`
              );
            }

            // Check if backend rejected verification or enrollment failed
            if (!verifyRes.ok) {
              if (verifyData.paymentVerified && !verifyData.enrolled) {
                throw new Error(
                  verifyData.message ||
                    "Payment was verified, but course enrollment could not be completed. Please contact support."
                );
              }
              throw new Error(
                verifyData.message ||
                  "Payment verification failed. Please contact support if money was deducted."
              );
            }

            if (!verifyData.success || !verifyData.enrolled) {
              throw new Error(
                verifyData.message ||
                  "Payment was verified, but course enrollment could not be completed. Please contact support."
              );
            }

            // Cryptographic signature verified AND MongoDB course enrollment confirmed by backend!
            setIsVerifying(false);
            setIsProcessing(false);
            setIsVerified(true);
            setPaymentResponseData(response);
            setEnrollmentResult({
              enrollmentId: verifyData.enrollment?.enrollmentId,
              alreadyEnrolled: verifyData.alreadyEnrolled,
              alreadyProcessed: verifyData.alreadyProcessed,
              studentName: verifyData.studentName || currentUser?.name,
            });

            // Update client-side LMS context state now that backend confirmed enrollment in MongoDB
            enrollInCourse(safeCourseId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              amount: safePrice,
            });
          } catch (verifyErr: any) {
            console.error("Backend signature verification and enrollment failed:", verifyErr);
            setIsVerifying(false);
            setIsProcessing(false);
            setIsVerified(false);
            setErrorMessage(
              verifyErr.message ||
                "Payment was verified, but course enrollment could not be completed. Please contact support."
            );
          }
        },
        prefill: {
          name: currentUser?.name || "Student",
          email: currentUser?.email || "student@edupulse.in",
          contact: currentUser?.phone || "9876543210",
        },
        notes: {
          courseId: safeCourseId,
          courseTitle: safeCourseTitle,
          amount: String(safePrice),
          userId: currentUser?._id || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setIsVerifying(false);
            setErrorMessage("Payment checkout window was closed before completion.");
          },
        },
      };

      // 4. Open Razorpay Checkout modal
      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (failResponse: RazorpayPaymentFailureResponse) => {
        setIsProcessing(false);
        setIsVerifying(false);
        setErrorMessage(
          failResponse.error?.description || "Payment failed or was declined by the bank."
        );
      });

      rzp.open();
    } catch (err: any) {
      console.error("Razorpay checkout launch error:", err);
      setIsProcessing(false);
      setIsVerifying(false);
      setErrorMessage(
        err.message || "An unexpected error occurred while launching Razorpay Checkout."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Razorpay Branded Top Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-extrabold text-sm tracking-tighter">
              Rzp
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-200">
                Razorpay Secure Checkout (Test Mode)
              </div>
              <div className="text-sm font-bold tracking-tight">
                EduPulse Technologies Ltd.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order Summary Strip */}
        <div className="bg-blue-50/60 border-b border-blue-100 p-4 flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-slate-800 line-clamp-1">{course.title}</div>
            <div className="text-slate-500 text-[10px]">
              Course ID: {course._id}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-extrabold text-slate-900">
              ₹{course.price.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.2 rounded-sm">
              GST Included
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Notice: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {!paymentResponseData ? (
            <>
              {/* Payment Methods Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod("upi")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === "upi"
                        ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-2xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === "card"
                        ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-2xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Card</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod("netbanking")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === "netbanking"
                        ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-2xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Netbanking</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Input Based on Method */}
              {paymentMethod === "upi" && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Instant UPI Apps</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Zero Fee</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 shadow-2xs">
                      GPay
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 shadow-2xs">
                      PhonePe
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 shadow-2xs">
                      Paytm
                    </div>
                  </div>
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] text-slate-500">Student UPI VPA</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === "card" && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500">Test Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        defaultValue="12/28"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">CVV</label>
                      <input
                        type="password"
                        defaultValue="892"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === "netbanking" && (
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                  <label className="text-[11px] text-slate-500">Select Bank</label>
                  <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800">
                    <option>HDFC Bank</option>
                    <option>State Bank of India (SBI)</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                  </select>
                </div>
              )}

              {/* Pay Button */}
              <button
                onClick={handlePay}
                disabled={isProcessing || isVerifying}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying HMAC Signature with Backend...</span>
                  </>
                ) : isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Opening Razorpay Checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{course.price.toLocaleString()} with Razorpay</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>256-bit TLS Encryption • Backend Signature Verification</span>
              </div>
            </>
          ) : (
            /* Razorpay Payment Verified & MongoDB Enrollment Complete (Step 7 Complete) */
            <div className="text-center py-2 space-y-3.5">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {enrollmentResult?.alreadyEnrolled
                    ? "Enrollment Already Active!"
                    : "Payment Verified & Enrolled!"}
                </h3>
                <p className="text-xs text-slate-500">
                  {enrollmentResult?.alreadyEnrolled
                    ? "Your course access was previously registered and is currently active."
                    : "Payment HMAC signature verified and enrollment record saved to MongoDB Atlas."}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-left space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Course:</span>
                  <span className="font-bold text-slate-800 line-clamp-1">{course.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-emerald-600">₹{course.price.toLocaleString()}</span>
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-1.5">
                  <div className="text-[11px] text-slate-700 font-sans font-bold flex items-center justify-between">
                    <span>Backend Signature:</span>
                    <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                      PASSED (HMAC MATCH)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 font-sans font-bold flex items-center justify-between">
                    <span>MongoDB Enrollment:</span>
                    <span className="text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">
                      CONFIRMED & ACTIVE
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Payment ID:</span>
                    <span className="font-bold text-blue-700">{paymentResponseData.razorpay_payment_id}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Order ID:</span>
                    <span className="font-bold text-slate-700">{paymentResponseData.razorpay_order_id}</span>
                  </div>
                  {enrollmentResult?.enrollmentId && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Enrollment ID:</span>
                      <span className="font-bold text-indigo-700">{enrollmentResult.enrollmentId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Access Granted by Backend</span>
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  Your course enrollment has been permanently synchronized with MongoDB. All video lectures, source code, and community discussions are unlocked.
                </p>
              </div>

              <button
                onClick={() => {
                  onSuccess?.();
                  onClose();
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-blue-600/20"
              >
                Go to Classroom & Start Learning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

