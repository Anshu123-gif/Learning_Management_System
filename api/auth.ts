import type { VercelRequest, VercelResponse } from "@vercel/node";

// In-memory OTP storage for Serverless execution
// For production, can also persist to Redis/KV
const otpCache = new Map<string, { otp: string; expiresAt: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & method headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url = "" } = req;

  // 1. Health check
  if (url.includes("/health") || req.method === "GET") {
    return res.status(200).json({
      status: "online",
      service: "EduPulse / CodeHub LMS Vercel API",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. SEND OTP
  if (url.includes("/send-otp") && req.method === "POST") {
    try {
      const { identifier, fast2SmsApiKey } = req.body || {};
      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ success: false, message: "Valid mobile number is required" });
      }

      const cleanIdentifier = identifier.trim().replace(/\D/g, "");
      if (cleanIdentifier.length < 10) {
        return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number" });
      }

      // Generate secure 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min TTL
      otpCache.set(cleanIdentifier, { otp, expiresAt });

      let liveSmsDelivered = false;
      let gateway = "Simulated / In-Memory (Active)";

      // Fast2SMS API Key from Vercel Environment or user input
      const activeFast2SmsKey = fast2SmsApiKey || process.env.FAST2SMS_API_KEY;
      const isIndianMobile = /^[6-9]\d{9}$/.test(cleanIdentifier);

      if (activeFast2SmsKey && isIndianMobile) {
        try {
          const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
            method: "POST",
            headers: {
              authorization: activeFast2SmsKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              route: "otp",
              variables_values: otp,
              numbers: cleanIdentifier,
            }),
          });
          const smsData = await smsRes.json();
          if (smsData && (smsData.return === true || smsData.status_code === 200)) {
            liveSmsDelivered = true;
            gateway = "Fast2SMS India Telecomm (Delivered to Handset)";
          }
        } catch (smsErr) {
          console.error("Fast2SMS delivery error on Vercel:", smsErr);
        }
      }

      return res.status(200).json({
        success: liveSmsDelivered,
        message: liveSmsDelivered
          ? `Real SMS OTP dispatched to +91 ${cleanIdentifier} via ${gateway}!`
          : `Fast2SMS rejected: complete website verification in your Fast2SMS account before OTP can reach your phone.`,
        identifier: cleanIdentifier,
        expiresInSeconds: 300,
        gateway,
        liveSmsDelivered,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to process OTP" });
    }
  }

  // 3. VERIFY OTP
  if (url.includes("/verify-otp") && req.method === "POST") {
    try {
      const { identifier, otp } = req.body || {};
      if (!identifier || !otp) {
        return res.status(400).json({ success: false, message: "Mobile number and OTP are required" });
      }

      const cleanIdentifier = String(identifier).trim().replace(/\D/g, "");
      const cached = otpCache.get(cleanIdentifier);

      if (!cached) {
        return res.status(400).json({
          success: false,
          message: "No OTP found for this number or expired. Please click 'Resend OTP'.",
        });
      }

      if (Date.now() > cached.expiresAt) {
        otpCache.delete(cleanIdentifier);
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please click 'Resend OTP'.",
        });
      }

      if (cached.otp.trim() !== String(otp).trim()) {
        return res.status(400).json({
          success: false,
          message: "Incorrect OTP code. Please enter the correct 6-digit code.",
        });
      }

      otpCache.delete(cleanIdentifier);
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Mobile number verified successfully!",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Verification failed" });
    }
  }

  return res.status(404).json({ error: "API route not found" });
}
