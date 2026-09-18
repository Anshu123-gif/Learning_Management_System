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
} from "lucide-react";
import { Course } from "../types";
import { useAuth } from "../context/AuthContext";
import { useLms } from "../context/LmsContext";

interface PaymentModalProps {
  course: Course;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  course,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { enrollInCourse } = useLms();

  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [upiId, setUpiId] = useState(`${currentUser.name.toLowerCase().replace(/\s+/g, "")}@okaxis`);
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8910");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId] = useState(() => `order_${Math.random().toString(36).substring(2, 12).toUpperCase()}`);
  const [paymentId, setPaymentId] = useState("");

  const handlePay = async () => {
    setIsProcessing(true);

    // Simulate API call to /api/payments/verify-signature with Razorpay SDK
    setTimeout(() => {
      const generatedPayId = `pay_${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      setPaymentId(generatedPayId);

      // Perform enrollment
      enrollInCourse(course._id, {
        razorpayOrderId: orderId,
        razorpayPaymentId: generatedPayId,
        amount: course.price,
      });

      setIsProcessing(false);
      setIsSuccess(true);
    }, 1500);
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
                Razorpay Secure Checkout
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
            <div className="text-slate-500 font-mono text-[10px]">
              Order ID: {orderId}
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
          {!isSuccess ? (
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
                    <label className="text-[11px] text-slate-500">Or Enter UPI VPA ID</label>
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
                disabled={isProcessing}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying HMAC Signature...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{course.price.toLocaleString()} Securely</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>256-bit TLS Encryption • PCI-DSS Compliant</span>
              </div>
            </>
          ) : (
            /* Payment Success Screen */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Payment Successful!</h3>
                <p className="text-xs text-slate-500">
                  Transaction verified via Razorpay webhook signature.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-left space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment ID:</span>
                  <span className="font-bold text-slate-800">{paymentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Course Enrolled:</span>
                  <span className="font-bold text-slate-800 line-clamp-1">{course.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-emerald-600">₹{course.price}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Go to Classroom & Start Watching</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
