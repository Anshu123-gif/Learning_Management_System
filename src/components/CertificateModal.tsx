import React, { useRef } from "react";
import {
  X,
  Award,
  Download,
  Printer,
  CheckCircle,
  ShieldCheck,
  QrCode,
  Share2,
  ExternalLink,
} from "lucide-react";
import { Certificate, Course } from "../types";

interface CertificateModalProps {
  certificate: Certificate;
  course: Course;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  course,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Actions */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-slate-800 text-sm">
              Official Verifiable Certificate of Completion
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Render Canvas */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 flex flex-col items-center bg-slate-100">
          <div
            ref={printRef}
            className="w-full max-w-3xl bg-white rounded-2xl border-8 border-double border-amber-600/30 p-8 sm:p-12 shadow-xl relative overflow-hidden text-center space-y-6"
            style={{
              backgroundImage: "radial-gradient(#fbf9f4 2px, transparent 2px)",
              backgroundSize: "28px 28px",
            }}
          >
            {/* Top Ornamental Seal */}
            <div className="flex items-center justify-between border-b border-amber-600/20 pb-6">
              <div className="text-left">
                <div className="text-xs font-bold text-amber-800 tracking-widest uppercase">
                  EduPulse Academic Institute
                </div>
                <div className="text-[10px] text-slate-500">
                  Accredited MERN Stack Software Center
                </div>
              </div>

              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 ring-4 ring-amber-100">
                <Award className="w-8 h-8" />
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-slate-800">
                  {certificate.verificationId}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Cryptographically Verified
                </div>
              </div>
            </div>

            {/* Certificate Core Text */}
            <div className="space-y-4 pt-4">
              <span className="text-xs sm:text-sm font-serif italic text-slate-500 tracking-wide">
                This is to officially certify that
              </span>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-serif uppercase underline decoration-amber-400/60 decoration-2 underline-offset-8">
                {certificate.studentName}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed pt-2">
                has successfully completed 100% of the prescribed curriculum, practical laboratory assignments, and passed the final comprehensive examination for:
              </p>

              <h2 className="text-lg sm:text-2xl font-bold text-indigo-950 max-w-lg mx-auto leading-snug">
                {certificate.courseTitle}
              </h2>

              <p className="text-xs text-slate-500">
                Demonstrated proficiency in full-stack architecture, relational document modeling, secure streaming, and distributed micro-patterns.
              </p>
            </div>

            {/* Signatures & Verification Footer */}
            <div className="pt-8 border-t border-amber-600/20 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
              {/* Instructor Signature */}
              <div className="text-center sm:text-left space-y-1">
                <div className="font-serif italic text-slate-700 text-lg sm:text-xl border-b border-slate-400 pb-1 inline-block">
                  {certificate.instructorName}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Lead Instructor & Architect
                </div>
                <div className="text-[10px] text-slate-400">EduPulse Faculty</div>
              </div>

              {/* QR Verification Seal */}
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-slate-100" />
                </div>
                <span className="text-[9px] font-mono text-slate-500">
                  Scan to Verify Online
                </span>
              </div>

              {/* Academic Dean & Date */}
              <div className="text-center sm:text-right space-y-1">
                <div className="font-serif italic text-slate-700 text-lg sm:text-xl border-b border-slate-400 pb-1 inline-block">
                  Vikram Mehta
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Head of Academic Dean
                </div>
                <div className="text-[10px] text-slate-500">
                  Issued: {certificate.issuedAt}
                </div>
              </div>
            </div>

            {/* Background watermark badge */}
            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-amber-500/5 pointer-events-none" />
          </div>

          {/* Verification Bar & Share */}
          <div className="w-full max-w-3xl mt-4 bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-700">
                Public Verification URL:{" "}
                <code className="bg-slate-100 px-2 py-0.5 rounded-sm font-mono text-indigo-600">
                  https://edupulse.org/verify/{certificate.verificationId}
                </code>
              </span>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `https://edupulse.org/verify/${certificate.verificationId}`
                );
                alert("Verification link copied to clipboard!");
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Copy Credential Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
