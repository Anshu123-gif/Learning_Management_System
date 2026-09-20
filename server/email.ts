import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface PaymentEmailPayload {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  courseId: string;
  amountRupees: number;
  currency?: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  fulfillmentSource: "verify" | "webhook";
}

export interface EmailSendResult {
  studentEmailSent: boolean;
  adminEmailSent: boolean;
  studentError?: string;
  adminError?: string;
}

/**
 * Escapes raw strings for safe HTML interpolation
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sends transactional email notifications for confirmed course enrollment:
 * 1. Student payment and enrollment confirmation
 * 2. Admin new sale notification
 *
 * Uses Resend API. If RESEND_API_KEY is missing, logs gracefully without failing the transaction.
 */
export async function sendPaymentSuccessEmails(
  payload: PaymentEmailPayload
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      "[Email Service] ⚠️ RESEND_API_KEY is not configured in the environment. Skipping email notifications."
    );
    return {
      studentEmailSent: false,
      adminEmailSent: false,
      studentError: "RESEND_API_KEY not configured",
    };
  }

  // Sender: Resend's test sender if custom domain is not configured
  // Note: Resend requires using onboarding@resend.dev until a custom domain is verified in Resend dashboard
  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || "EduPulse <onboarding@resend.dev>";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();

  const {
    studentName,
    studentEmail,
    courseTitle,
    courseId,
    amountRupees,
    currency = "INR",
    razorpayPaymentId,
    razorpayOrderId,
    fulfillmentSource,
  } = payload;

  const results: EmailSendResult = {
    studentEmailSent: false,
    adminEmailSent: false,
  };

  const formattedDate = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // 1. Send Confirmation Email to Student
  if (studentEmail && studentEmail.includes("@")) {
    try {
      const studentHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment &amp; Enrollment Confirmed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 28px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; color: #94a3b8; font-size: 14px; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; margin-bottom: 20px; line-height: 1.5; }
    .course-badge { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 6px; margin: 20px 0; }
    .course-title { font-size: 18px; font-weight: 600; color: #0f172a; margin: 0; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .receipt-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .receipt-table td.label { color: #64748b; width: 40%; }
    .receipt-table td.value { font-weight: 600; color: #0f172a; text-align: right; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; margin-top: 16px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>EduPulse LMS</h1>
      <p>Enrollment &amp; Payment Confirmation</p>
    </div>
    <div class="content">
      <p class="greeting">Hi <strong>${escapeHtml(studentName)}</strong>,</p>
      <p>Congratulations! Your payment was successfully confirmed, and your course access has been activated immediately.</p>
      
      <div class="course-badge">
        <p class="course-title">${escapeHtml(courseTitle)}</p>
      </div>

      <table class="receipt-table">
        <tr>
          <td class="label">Amount Paid</td>
          <td class="value">₹${amountRupees.toLocaleString("en-IN")} ${currency}</td>
        </tr>
        <tr>
          <td class="label">Payment ID</td>
          <td class="value"><code>${escapeHtml(razorpayPaymentId)}</code></td>
        </tr>
        <tr>
          <td class="label">Order ID</td>
          <td class="value"><code>${escapeHtml(razorpayOrderId)}</code></td>
        </tr>
        <tr>
          <td class="label">Date &amp; Time</td>
          <td class="value">${escapeHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td class="label">Status</td>
          <td class="value" style="color: #16a34a;">● Payment Captured</td>
        </tr>
      </table>

      <p>You can start watching lectures, accessing code repositories, and submitting projects right away:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://edupulse.ac.in/dashboard" class="cta-btn">Open Student Dashboard &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you have any questions or need technical support, reply directly to this email or reach out to support.</p>
    </div>
    <div class="footer">
      EduPulse Learning Management System &bull; Secure transactions processed via Razorpay
    </div>
  </div>
</body>
</html>
      `.trim();

      const studentText = `
Hi ${studentName},

Congratulations! Your payment of ₹${amountRupees} ${currency} for "${courseTitle}" was successfully confirmed.

Order ID: ${razorpayOrderId}
Payment ID: ${razorpayPaymentId}
Date: ${formattedDate}
Status: Captured

You can access your course anytime from your student dashboard: https://edupulse.ac.in/dashboard

Happy learning!
The EduPulse Team
      `.trim();

      const studentIdempotencyKey = `payment/${razorpayPaymentId}/student`;
      const { data, error } = await resend.emails.send(
        {
          from: fromAddress,
          to: [studentEmail.trim()],
          subject: `Payment & Enrollment Confirmed: ${courseTitle} — EduPulse`,
          html: studentHtml,
          text: studentText,
        },
        {
          idempotencyKey: studentIdempotencyKey,
        }
      );

      if (error) {
        console.error(
          `[Email Service] ❌ Resend error sending confirmation to student (${studentEmail}):`,
          error
        );
        results.studentError = error.message;
      } else {
        console.log(
          `[Email Service] ✉️ Enrollment confirmation sent to student: ${studentEmail} (Resend ID: ${data?.id})`
        );
        results.studentEmailSent = true;
      }
    } catch (err: any) {
      console.error(
        `[Email Service] ❌ Failed to dispatch student email:`,
        err?.message || err
      );
      results.studentError = err?.message || String(err);
    }
  } else {
    console.warn(
      `[Email Service] ⚠️ Student email address is missing or invalid: ${studentEmail}. Skipping student email.`
    );
  }

  // 2. Send New Sale Notification Email to Admin
  if (adminEmail && adminEmail.includes("@")) {
    try {
      const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Course Sale Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #065f46; padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0 0; color: #a7f3d0; font-size: 14px; }
    .content { padding: 32px; }
    .stat-badge { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .stat-amount { font-size: 24px; font-weight: 800; color: #065f46; }
    .receipt-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .receipt-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .receipt-table td.label { color: #64748b; width: 38%; }
    .receipt-table td.value { font-weight: 600; color: #0f172a; text-align: right; }
    .footer { padding: 18px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>💰 New Course Sale Alert</h1>
      <p>EduPulse Transaction Reconciliation</p>
    </div>
    <div class="content">
      <div class="stat-badge">
        <div>
          <div style="font-size: 12px; color: #047857; font-weight: 600; text-transform: uppercase;">Revenue Collected</div>
          <div class="stat-amount">₹${amountRupees.toLocaleString("en-IN")} ${currency}</div>
        </div>
        <div style="background: #10b981; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">PAID</div>
      </div>

      <table class="receipt-table">
        <tr>
          <td class="label">Course</td>
          <td class="value">${escapeHtml(courseTitle)}</td>
        </tr>
        <tr>
          <td class="label">Course ID</td>
          <td class="value"><code>${escapeHtml(courseId)}</code></td>
        </tr>
        <tr>
          <td class="label">Student Name</td>
          <td class="value">${escapeHtml(studentName)}</td>
        </tr>
        <tr>
          <td class="label">Student Email</td>
          <td class="value">${escapeHtml(studentEmail)}</td>
        </tr>
        <tr>
          <td class="label">Payment ID</td>
          <td class="value"><code>${escapeHtml(razorpayPaymentId)}</code></td>
        </tr>
        <tr>
          <td class="label">Order ID</td>
          <td class="value"><code>${escapeHtml(razorpayOrderId)}</code></td>
        </tr>
        <tr>
          <td class="label">Fulfillment Channel</td>
          <td class="value"><span style="text-transform: capitalize;">${escapeHtml(fulfillmentSource)}</span></td>
        </tr>
        <tr>
          <td class="label">Processed At</td>
          <td class="value">${escapeHtml(formattedDate)}</td>
        </tr>
      </table>
    </div>
    <div class="footer">
      EduPulse Administrative Notifications &bull; Automated webhook &amp; verification reconciler
    </div>
  </div>
</body>
</html>
      `.trim();

      const adminText = `
New Course Sale!

Course: ${courseTitle} (${courseId})
Amount: ₹${amountRupees} ${currency}
Student: ${studentName} (${studentEmail})
Payment ID: ${razorpayPaymentId}
Order ID: ${razorpayOrderId}
Source: ${fulfillmentSource}
Time: ${formattedDate}
      `.trim();

      const adminIdempotencyKey = `payment/${razorpayPaymentId}/admin`;
      const { data, error } = await resend.emails.send(
        {
          from: fromAddress,
          to: [adminEmail],
          subject: `New Sale: ₹${amountRupees} for ${courseTitle} (${studentName})`,
          html: adminHtml,
          text: adminText,
        },
        {
          idempotencyKey: adminIdempotencyKey,
        }
      );

      if (error) {
        console.error(
          `[Email Service] ❌ Resend error sending sale notification to admin (${adminEmail}):`,
          error
        );
        results.adminError = error.message;
      } else {
        console.log(
          `[Email Service] ✉️ New sale alert sent to admin: ${adminEmail} (Resend ID: ${data?.id})`
        );
        results.adminEmailSent = true;
      }
    } catch (err: any) {
      console.error(
        `[Email Service] ❌ Failed to dispatch admin email:`,
        err?.message || err
      );
      results.adminError = err?.message || String(err);
    }
  } else {
    console.log(
      "[Email Service] ℹ️ ADMIN_NOTIFICATION_EMAIL is not set or empty. Skipping admin email alert."
    );
  }

  return results;
}
