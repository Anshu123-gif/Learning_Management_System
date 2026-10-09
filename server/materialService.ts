import mongoose from "mongoose";
import { Readable } from "stream";
import jwt from "jsonwebtoken";
import { configureCloudinary, getCloudinaryConfig, cloudinary } from "./cloudinary.js";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";
import { MongoEnrollment } from "./models/Enrollment.js";

const JWT_SECRET = process.env.JWT_SECRET || "sheryians_lms_super_secure_jwt_secret_key_2025";

// Allowed MIME types for Study Materials (PDF)
export const ALLOWED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
];

// Maximum allowed PDF size: 25 MB
export const MAX_PDF_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface LectureMaterial {
  materialId: string;
  title: string;
  fileName: string;
  fileSizeMb: number;
  fileType: "pdf";
  publicId?: string;
  resourceType?: string;
  deliveryType?: string;
  format?: string;
  secureUrl: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface UploadMaterialInput {
  courseId: string;
  sectionId: string;
  lectureId: string;
  title?: string;
  fileName?: string;
  fileData: string; // Base64 data URI (data:application/pdf;base64,...) or raw base64 string
  userId: string;
  userRole: string;
}

export interface DeleteMaterialInput {
  courseId: string;
  sectionId: string;
  lectureId: string;
  materialId: string;
  userId: string;
  userRole: string;
}

export interface AccessMaterialInput {
  courseId: string;
  sectionId: string;
  lectureId: string;
  materialId: string;
  userId: string;
  userRole: string;
}

/**
 * Uploads a PDF Study Material to Cloudinary and saves its metadata to the lecture in MongoDB.
 * 
 * Requirements:
 * - Only authenticated teacher (course owner) or admin can upload.
 * - Validates MIME type as PDF.
 * - Enforces max file size (25MB).
 * - Uploads PDF to Cloudinary as resource_type: "raw" / "image".
 * - Persists metadata (materialId, title, fileName, fileSizeMb, publicId, secureUrl, createdAt) into lecture.materials array.
 */
export async function uploadLectureMaterial(input: UploadMaterialInput) {
  const { courseId, sectionId, lectureId, title, fileName, fileData, userId, userRole } = input;

  if (!courseId || !sectionId || !lectureId) {
    const err: any = new Error("courseId, sectionId, and lectureId are required.");
    err.statusCode = 400;
    throw err;
  }

  if (!fileData || typeof fileData !== "string") {
    const err: any = new Error("PDF file data is required (base64).");
    err.statusCode = 400;
    throw err;
  }

  // 1. Connect to MongoDB
  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  // 2. Safe Course lookup
  let course = await MongoCourse.findOne({ courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found in MongoDB.`);
    err.statusCode = 404;
    throw err;
  }

  // 3. Authorization Check: Owner teacher or Admin only
  const isTeacherOwner = userRole === "teacher" && course.instructorId === userId;
  const isAdmin = userRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You can only attach study materials to courses you created.");
    err.statusCode = 403;
    throw err;
  }

  // 4. Validate MIME Type & calculate byte size
  let mimeType = "application/pdf";
  let base64Content = fileData;

  const dataUriMatch = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    base64Content = fileData.substring(dataUriMatch[0].length);
  }

  // Check if MIME type is PDF
  const isPdfMime = ALLOWED_MATERIAL_MIME_TYPES.includes(mimeType) || mimeType.includes("pdf");
  const hasPdfExtension = fileName ? fileName.toLowerCase().endsWith(".pdf") : true;

  if (!isPdfMime && !hasPdfExtension) {
    const err: any = new Error(`Invalid file type "${mimeType}". Only PDF study materials are allowed.`);
    err.statusCode = 400;
    throw err;
  }

  // Calculate size in bytes
  const estimatedSizeBytes = Math.ceil((base64Content.length * 3) / 4);
  if (estimatedSizeBytes > MAX_PDF_FILE_SIZE_BYTES) {
    const sizeInMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(1);
    const err: any = new Error(`PDF file size (${sizeInMB} MB) exceeds maximum allowed limit of 25 MB.`);
    err.statusCode = 413;
    throw err;
  }

  const fileSizeMb = Number((estimatedSizeBytes / (1024 * 1024)).toFixed(2)) || 0.1;

  // 5. Verify section and lecture existence in course curriculum
  const sections = course.sections || [];
  let targetSection = sections.find((s: any) => {
    const sid = String(s.sectionId || s._id || s.id || "");
    return sid === String(sectionId) || sid.toLowerCase() === String(sectionId).toLowerCase();
  });

  let targetLecture = targetSection
    ? (targetSection.lectures || []).find((l: any) => {
        const lid = String(l.lectureId || l._id || l.id || "");
        return lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase();
      })
    : null;

  // Fallback: search across all sections in the course if not matched in specified section
  if (!targetLecture) {
    for (const sec of sections) {
      const foundLec = (sec.lectures || []).find((l: any) => {
        const lid = String(l.lectureId || l._id || l.id || "");
        return lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase();
      });
      if (foundLec) {
        targetSection = sec;
        targetLecture = foundLec;
        break;
      }
    }
  }

  if (!targetLecture) {
    const err: any = new Error(`Lecture "${lectureId}" not found in section "${sectionId}".`);
    err.statusCode = 404;
    throw err;
  }

  // 6. Ensure Cloudinary is configured & upload PDF
  const config = getCloudinaryConfig();
  if (!config.isConfigured) {
    const err: any = new Error("Storage service is not configured on the server.");
    err.statusCode = 503;
    throw err;
  }
  configureCloudinary();

  const sanitizedFileName = (fileName || "study_material.pdf")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/\s+/g, "_");
  const materialTitle = (title || sanitizedFileName.replace(/\.pdf$/i, "")).trim();
  const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanCourseId = course.courseId || courseId;
  const folder = `courses/${cleanCourseId}/materials/${lectureId}`;
  const publicId = `${folder}/${materialId}_${sanitizedFileName.replace(/\.pdf$/i, "")}`;

  // Ensure full data URI is passed to Cloudinary
  const uploadPayload = fileData.startsWith("data:")
    ? fileData
    : `data:application/pdf;base64,${base64Content}`;

  let uploadResult: any;
  try {
    uploadResult = await cloudinary.uploader.upload(uploadPayload, {
      folder,
      public_id: `${materialId}_${sanitizedFileName.replace(/\.pdf$/i, "")}`,
      resource_type: "auto", // handles raw/image/pdf seamlessly
    });
  } catch (uploadErr: any) {
    console.error("[MaterialService] Cloudinary PDF upload failed:", uploadErr);
    const err: any = new Error(uploadErr?.message || "Failed to upload PDF study material.");
    err.statusCode = 502;
    throw err;
  }

  // Clean secure_url so it doesn't bake in fl_attachment or fl_inline
  const cleanSecureUrl = (uploadResult.secure_url || "")
    .replace(/\/fl_attachment(\/|,)?/g, (match: string, suffix: string) => (suffix === "/" ? "/" : ""))
    .replace(/\/fl_inline(\/|,)?/g, (match: string, suffix: string) => (suffix === "/" ? "/" : ""));

  // 7. Construct safe material metadata
  const newMaterial: LectureMaterial = {
    materialId,
    title: materialTitle,
    fileName: sanitizedFileName,
    fileSizeMb,
    fileType: "pdf",
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type || "image",
    deliveryType: uploadResult.type || "upload",
    format: uploadResult.format || "pdf",
    secureUrl: cleanSecureUrl,
    uploadedBy: userId,
    createdAt: new Date().toISOString(),
  };

  // 8. Update MongoDB Course document
  if (!Array.isArray(targetLecture.materials)) {
    targetLecture.materials = [];
  }
  targetLecture.materials.push(newMaterial);

  course.updatedAt = new Date().toISOString();
  course.markModified("sections");
  await course.save();

  console.log(`✅ [Material Uploaded] "${newMaterial.title}" attached to lecture "${lectureId}"`);

  return {
    success: true,
    message: "PDF study material uploaded and attached successfully.",
    material: newMaterial,
    lectureId,
    sectionId,
    courseId: cleanCourseId,
  };
}

/**
 * Removes a PDF Study Material from Cloudinary and deletes its reference from MongoDB.
 */
export async function deleteLectureMaterial(input: DeleteMaterialInput) {
  const { courseId, sectionId, lectureId, materialId, userId, userRole } = input;

  if (!courseId || !lectureId || !materialId || materialId === "undefined" || materialId === "null") {
    const err: any = new Error("courseId, lectureId, and a valid materialId are required.");
    err.statusCode = 400;
    throw err;
  }

  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let course = await MongoCourse.findOne({ courseId });
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId);
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization: Owner teacher or Admin only
  const isTeacherOwner = userRole === "teacher" && course.instructorId === userId;
  const isAdmin = userRole === "admin";

  if (!isTeacherOwner && !isAdmin) {
    const err: any = new Error("Forbidden. You can only delete materials from courses you created.");
    err.statusCode = 403;
    throw err;
  }

  const sections = course.sections || [];
  let targetSection = sections.find((s: any) => {
    const sid = String(s.sectionId || s._id || s.id || "");
    return sid === String(sectionId) || sid.toLowerCase() === String(sectionId).toLowerCase();
  });

  let targetLecture = targetSection
    ? (targetSection.lectures || []).find((l: any) => {
        const lid = String(l.lectureId || l._id || l.id || "");
        return lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase();
      })
    : null;

  // Fallback: search across all sections in the course if not matched in specified section
  if (!targetLecture) {
    for (const sec of sections) {
      const foundLec = (sec.lectures || []).find((l: any) => {
        const lid = String(l.lectureId || l._id || l.id || "");
        return lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase();
      });
      if (foundLec) {
        targetSection = sec;
        targetLecture = foundLec;
        break;
      }
    }
  }

  if (!targetLecture) {
    const err: any = new Error(`Lecture "${lectureId}" not found in section "${sectionId}".`);
    err.statusCode = 404;
    throw err;
  }

  const materials: LectureMaterial[] = Array.isArray(targetLecture.materials)
    ? targetLecture.materials
    : [];
  const targetMaterial = materials.find(
    (m: any) => String(m.materialId || m._id || m.id) === String(materialId)
  );

  if (!targetMaterial) {
    const err: any = new Error(`Material with ID "${materialId}" not found in lecture.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Delete from Cloudinary if publicId exists
  if (targetMaterial.publicId) {
    try {
      configureCloudinary();
      // Try destroying as raw first, then image if needed
      await cloudinary.uploader.destroy(targetMaterial.publicId, { resource_type: "raw" }).catch(async () => {
        return cloudinary.uploader.destroy(targetMaterial.publicId!, { resource_type: "image" });
      });
      console.log(`🗑️ [Cloudinary] Destroyed material ${targetMaterial.publicId}`);
    } catch (cErr: any) {
      console.warn("Could not delete file from Cloudinary (might be expired or already removed):", cErr?.message);
    }
  }

  // 2. Filter out from materials array
  targetLecture.materials = materials.filter((m: any) => m.materialId !== materialId);

  // Also remove from resources array if matching title
  if (Array.isArray(targetLecture.resources)) {
    targetLecture.resources = targetLecture.resources.filter(
      (r: any) => r.title !== targetMaterial.title
    );
  }

  course.updatedAt = new Date().toISOString();
  course.markModified("sections");
  await course.save();

  console.log(`✅ [Material Deleted] ${materialId} removed from lecture ${lectureId}`);

  return {
    success: true,
    message: "Study material deleted successfully.",
    deletedMaterialId: materialId,
  };
}

/**
 * Generates an authorized download/view access URL for a lecture study material.
 * 
 * Requirements:
 * - Student must be enrolled in the course, OR
 * - User must be the instructor of the course or an admin.
 * - Returns signed/secure access URL and file metadata.
 */
export async function getAuthorizedMaterialAccess(input: AccessMaterialInput) {
  const { courseId, sectionId, lectureId, materialId, userId, userRole } = input;

  if (!courseId || !lectureId || !materialId || materialId === "undefined" || materialId === "null") {
    const err: any = new Error("courseId, lectureId, and a valid materialId are required.");
    err.statusCode = 400;
    throw err;
  }

  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let course = await MongoCourse.findOne({ courseId }).lean();
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId).lean();
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Authorization Check: Admin, Course Instructor, or Active Enrolled Student
  const isAdmin = userRole === "admin";
  const isInstructor = userRole === "teacher" && course.instructorId === userId;

  if (!isAdmin && !isInstructor) {
    const actualCourseId = course.courseId || courseId;
    const enrollment = await MongoEnrollment.findOne({
      studentId: userId,
      courseId: actualCourseId,
    }).lean();

    if (!enrollment) {
      const err: any = new Error(
        "Access denied. You must be enrolled in this course to access its study materials."
      );
      err.statusCode = 403;
      throw err;
    }
  }

  // Locate the target material
  let foundMaterial: LectureMaterial | null = null;
  const sections = course.sections || [];
  for (const sec of sections) {
    for (const lec of sec.lectures || []) {
      const lid = String(lec.lectureId || lec._id || lec.id || "");
      if (lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase()) {
        if (Array.isArray(lec.materials)) {
          const mat = lec.materials.find(
            (m: any) => String(m.materialId || m._id || m.id) === String(materialId)
          );
          if (mat) {
            foundMaterial = mat;
            break;
          }
        }
      }
    }
    if (foundMaterial) break;
  }

  if (!foundMaterial) {
    const err: any = new Error(`Study material "${materialId}" not found in this lecture.`);
    err.statusCode = 404;
    throw err;
  }

  // Generate signed / authenticated delivery URLs
  let rawBaseUrl = foundMaterial.secureUrl || "";
  let directDownloadUrl = rawBaseUrl;
  let directViewUrl = rawBaseUrl;
  const config = getCloudinaryConfig();

  if (foundMaterial.publicId && config.isConfigured) {
    configureCloudinary();
    const resourceType = foundMaterial.resourceType || "image";
    const deliveryType = foundMaterial.deliveryType || "upload";
    const format = foundMaterial.format || "pdf";

    try {
      // Direct Cloudinary view URL (note: Cloudinary account setting may still enforce attachment)
      directViewUrl = cloudinary.url(`${foundMaterial.publicId}.${format}`, {
        resource_type: resourceType,
        type: deliveryType,
        secure: true,
        sign_url: true,
      });

      // Direct Cloudinary download URL: uses flags: "attachment" to prompt save dialog
      directDownloadUrl = cloudinary.url(`${foundMaterial.publicId}.${format}`, {
        resource_type: resourceType,
        type: deliveryType,
        secure: true,
        sign_url: true,
        flags: "attachment",
      });
    } catch {
      directDownloadUrl = rawBaseUrl;
      directViewUrl = rawBaseUrl;
    }
  }

  // Double-check direct URL sanitization
  if (directViewUrl && typeof directViewUrl === "string") {
    directViewUrl = directViewUrl
      .replace(/\/fl_attachment(\/|,)?/g, (match, suffix) => (suffix === "/" ? "/" : ""))
      .replace(/\/fl_inline(\/|,)?/g, (match, suffix) => (suffix === "/" ? "/" : ""))
      .replace(/[?&]attachment=[^&#]*/gi, "");
  }

  if (directDownloadUrl && typeof directDownloadUrl === "string") {
    directDownloadUrl = directDownloadUrl.replace(/\/fl_inline(\/|,)?/g, (match, suffix) => (suffix === "/" ? "/" : ""));
    if (directDownloadUrl.includes("res.cloudinary.com") && !directDownloadUrl.includes("fl_attachment") && !directDownloadUrl.includes("download?")) {
      directDownloadUrl = directDownloadUrl.replace(/\/upload\/(v\d+\/)?/, (match) => {
        return match.includes("upload/v")
          ? "/upload/fl_attachment/" + match.replace("/upload/", "")
          : "/upload/fl_attachment/";
      });
    }
  }

  // Generate dedicated, tamper-proof backend tokens for inline viewing and file downloading
  const viewToken = jwt.sign(
    {
      courseId,
      sectionId: sectionId || "",
      lectureId,
      materialId,
      userId,
      userRole,
      action: "view",
      publicId: foundMaterial.publicId || "",
      secureUrl: foundMaterial.secureUrl || "",
      fileName: foundMaterial.fileName || foundMaterial.title || "study_material.pdf",
    },
    JWT_SECRET,
    { expiresIn: "4h" }
  );

  const downloadToken = jwt.sign(
    {
      courseId,
      sectionId: sectionId || "",
      lectureId,
      materialId,
      userId,
      userRole,
      action: "download",
      publicId: foundMaterial.publicId || "",
      secureUrl: foundMaterial.secureUrl || "",
      fileName: foundMaterial.fileName || foundMaterial.title || "study_material.pdf",
    },
    JWT_SECRET,
    { expiresIn: "4h" }
  );

  const safeSecId = sectionId || "sec";
  const backendViewUrl = `/api/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(safeSecId)}/lectures/${encodeURIComponent(lectureId)}/materials/${encodeURIComponent(materialId)}/view?token=${encodeURIComponent(viewToken)}`;
  const backendDownloadUrl = `/api/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(safeSecId)}/lectures/${encodeURIComponent(lectureId)}/materials/${encodeURIComponent(materialId)}/download?token=${encodeURIComponent(downloadToken)}`;

  return {
    success: true,
    material: foundMaterial,
    // Dedicated backend view endpoint that streams PDF with Content-Disposition: inline
    viewUrl: backendViewUrl,
    // Dedicated backend download endpoint that streams PDF with Content-Disposition: attachment
    downloadUrl: backendDownloadUrl,
    // Direct Cloudinary URLs as secondary references
    directViewUrl,
    directDownloadUrl,
  };
}

export interface StreamMaterialInput {
  courseId: string;
  sectionId?: string;
  lectureId: string;
  materialId: string;
  token?: string;
  authHeader?: string;
  mode: "view" | "download";
  rangeHeader?: string;
}

/**
 * Streams an authenticated PDF study material from Cloudinary server-side.
 * 
 * Guarantees:
 * 1. Strict authentication & course enrollment authorization.
 * 2. For mode="view": Emits Content-Disposition: inline so the browser's native PDF viewer opens.
 * 3. For mode="download": Emits Content-Disposition: attachment so the browser saves the file.
 * 4. Content-Type: application/pdf is strictly preserved.
 * 5. Supports HTTP Range requests and byte ranges for instant PDF page navigation.
 * 6. Cloudinary API secrets are never exposed to the client.
 */
export async function getAuthorizedMaterialStream(input: StreamMaterialInput) {
  const { courseId, lectureId, materialId, token, authHeader, mode, rangeHeader } = input;

  if (!courseId || !lectureId || !materialId) {
    const err: any = new Error("courseId, lectureId, and materialId are required.");
    err.statusCode = 400;
    throw err;
  }

  // 1. Authenticate token (from query param or Bearer header)
  let jwtToken = token;
  if (!jwtToken && authHeader && authHeader.startsWith("Bearer ")) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (!jwtToken) {
    const err: any = new Error("Authentication required. Missing access token.");
    err.statusCode = 401;
    throw err;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(jwtToken, JWT_SECRET);
  } catch {
    const err: any = new Error("Invalid or expired session token.");
    err.statusCode = 401;
    throw err;
  }

  const userId = decoded.userId;
  const userRole = decoded.role || decoded.userRole;

  if (!userId) {
    const err: any = new Error("Invalid token payload: missing userId.");
    err.statusCode = 401;
    throw err;
  }

  // 2. Connect to database
  const connected = await connectMongoDB();
  let foundMaterial: LectureMaterial | null = null;

  if (connected) {
    // 3. Locate course
    let course = await MongoCourse.findOne({ courseId }).lean();
    if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
      course = await MongoCourse.findById(courseId).lean();
    }

    if (!course) {
      const err: any = new Error(`Course with ID "${courseId}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    // 4. Authorization check: Admin, Instructor owner, or enrolled student
    const isAdmin = userRole === "admin";
    const isInstructor = userRole === "teacher" && course.instructorId === userId;

    if (!isAdmin && !isInstructor) {
      const actualCourseId = course.courseId || courseId;
      const enrollment = await MongoEnrollment.findOne({
        studentId: userId,
        courseId: actualCourseId,
      }).lean();

      if (!enrollment) {
        const err: any = new Error(
          "Access denied. You must be enrolled in this course to view its study materials."
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Locate material in course sections
    const sections = course.sections || [];
    for (const sec of sections) {
      for (const lec of sec.lectures || []) {
        const lid = String(lec.lectureId || lec._id || lec.id || "");
        if (lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase()) {
          if (Array.isArray(lec.materials)) {
            const mat = lec.materials.find(
              (m: any) => String(m.materialId || m._id || m.id) === String(materialId)
            );
            if (mat) {
              foundMaterial = mat;
              break;
            }
          }
        }
      }
      if (foundMaterial) break;
    }
  } else if (decoded.secureUrl || decoded.publicId) {
    // Verified JWT token was already signed with JWT_SECRET after performing authorization checks
    foundMaterial = {
      materialId,
      title: decoded.fileName || "Study Material",
      fileName: decoded.fileName || "document.pdf",
      fileSizeMb: 0,
      fileType: "pdf",
      publicId: decoded.publicId,
      secureUrl: decoded.secureUrl,
      createdAt: new Date().toISOString(),
    };
  } else {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  if (!foundMaterial) {
    const err: any = new Error(`Study material "${materialId}" not found in this lecture.`);
    err.statusCode = 404;
    throw err;
  }

  // 6. Resolve Cloudinary storage delivery URL
  let fetchUrl = foundMaterial.secureUrl || "";
  const config = getCloudinaryConfig();
  if (foundMaterial.publicId && config.isConfigured) {
    configureCloudinary();
    const resourceType = foundMaterial.resourceType || "image";
    const deliveryType = foundMaterial.deliveryType || "upload";
    const format = foundMaterial.format || "pdf";
    fetchUrl = cloudinary.url(`${foundMaterial.publicId}.${format}`, {
      resource_type: resourceType,
      type: deliveryType,
      secure: true,
      sign_url: true,
    });
  }

  if (!fetchUrl) {
    const err: any = new Error("Storage URL not available for this study material.");
    err.statusCode = 404;
    throw err;
  }

  // Strip forced attachments from storage fetch URL so we receive raw stream
  fetchUrl = fetchUrl
    .replace(/\/fl_attachment(\/|,)?/g, (match, suffix) => (suffix === "/" ? "/" : ""))
    .replace(/\/fl_inline(\/|,)?/g, (match, suffix) => (suffix === "/" ? "/" : ""))
    .replace(/[?&]attachment=[^&#]*/gi, "");

  // 7. Server-side fetch from storage with Range forwarding
  const fetchHeaders: Record<string, string> = {};
  if (rangeHeader) {
    fetchHeaders["Range"] = rangeHeader;
  }

  const storageResponse = await fetch(fetchUrl, {
    headers: fetchHeaders,
  });

  if (!storageResponse.ok && storageResponse.status !== 206) {
    const err: any = new Error(
      `Failed to retrieve document from cloud storage (${storageResponse.status}).`
    );
    err.statusCode = storageResponse.status >= 500 ? 502 : storageResponse.status;
    throw err;
  }

  // 8. Prepare safe RFC 5987 / RFC 6266 Content-Disposition header
  const rawFileName = (foundMaterial.fileName || foundMaterial.title || "document.pdf").trim();
  const safeAsciiName =
    rawFileName
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_") || "document.pdf";
  const encodedName = encodeURIComponent(rawFileName);

  const dispositionType = mode === "download" ? "attachment" : "inline";
  const contentDisposition = `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-transform, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  const contentLength = storageResponse.headers.get("content-length");
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  const contentRange = storageResponse.headers.get("content-range");
  if (contentRange) {
    headers["Content-Range"] = contentRange;
  }

  const rawBytes = Buffer.from(await storageResponse.arrayBuffer());
  if (!headers["Content-Length"]) {
    headers["Content-Length"] = String(rawBytes.length);
  }

  return {
    status: storageResponse.status,
    headers,
    stream: Readable.from(rawBytes),
    buffer: rawBytes,
    arrayBuffer: async () => rawBytes,
    material: foundMaterial,
  };
}

/**
 * Fetches all study materials for a specific lecture.
 * Verifies student enrollment or teacher/admin authorization.
 */
export async function getLectureMaterials(input: {
  courseId: string;
  sectionId?: string;
  lectureId: string;
  userId: string;
  userRole: string;
}) {
  const { courseId, lectureId, userId, userRole } = input;

  const connected = await connectMongoDB();
  if (!connected) {
    const err: any = new Error("Database service unavailable.");
    err.statusCode = 503;
    throw err;
  }

  let course = await MongoCourse.findOne({ courseId }).lean();
  if (!course && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await MongoCourse.findById(courseId).lean();
  }

  if (!course) {
    const err: any = new Error(`Course with ID "${courseId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // Check enrollment if student
  const isAdmin = userRole === "admin";
  const isInstructor = userRole === "teacher" && course.instructorId === userId;

  if (!isAdmin && !isInstructor) {
    const actualCourseId = course.courseId || courseId;
    const enrollment = await MongoEnrollment.findOne({
      studentId: userId,
      courseId: actualCourseId,
    }).lean();

    if (!enrollment) {
      const err: any = new Error(
        "Access denied. You must be enrolled in this course to view its study materials."
      );
      err.statusCode = 403;
      throw err;
    }
  }

  let materials: LectureMaterial[] = [];
  const sections = course.sections || [];
  for (const sec of sections) {
    for (const lec of sec.lectures || []) {
      const lid = String(lec.lectureId || lec._id || lec.id || "");
      if (lid === String(lectureId) || lid.toLowerCase() === String(lectureId).toLowerCase()) {
        materials = Array.isArray(lec.materials) ? lec.materials : [];
        break;
      }
    }
  }

  return {
    success: true,
    materials,
    courseId: course.courseId || courseId,
    lectureId,
  };
}
