import mongoose from "mongoose";
import { configureCloudinary, getCloudinaryConfig, cloudinary } from "./cloudinary.js";
import { connectMongoDB } from "./db.js";
import { MongoCourse } from "./models/Course.js";
import { MongoEnrollment } from "./models/Enrollment.js";

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
      flags: "attachment",
    });
  } catch (uploadErr: any) {
    console.error("[MaterialService] Cloudinary PDF upload failed:", uploadErr);
    const err: any = new Error(uploadErr?.message || "Failed to upload PDF study material.");
    err.statusCode = 502;
    throw err;
  }

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
    secureUrl: uploadResult.secure_url,
    uploadedBy: userId,
    createdAt: new Date().toISOString(),
  };

  // 8. Update MongoDB Course document
  if (!Array.isArray(targetLecture.materials)) {
    targetLecture.materials = [];
  }
  targetLecture.materials.push(newMaterial);

  // Also maintain backward-compatibility with existing lecture.resources array
  if (!Array.isArray(targetLecture.resources)) {
    targetLecture.resources = [];
  }
  const existingResourceIdx = targetLecture.resources.findIndex(
    (r: any) => r.title === newMaterial.title
  );
  const resourceEntry = {
    title: newMaterial.title,
    url: newMaterial.secureUrl,
    fileType: "pdf",
    sizeMb: newMaterial.fileSizeMb,
  };
  if (existingResourceIdx >= 0) {
    targetLecture.resources[existingResourceIdx] = resourceEntry;
  } else {
    targetLecture.resources.push(resourceEntry);
  }

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
  let downloadUrl = foundMaterial.secureUrl;
  let viewUrl = foundMaterial.secureUrl;
  const config = getCloudinaryConfig();

  if (foundMaterial.publicId && config.isConfigured) {
    configureCloudinary();
    const resourceType = foundMaterial.resourceType || "image";
    const deliveryType = foundMaterial.deliveryType || "upload";
    const format = foundMaterial.format || "pdf";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1-hour expiration

    try {
      // 1. Authenticated download URL via Cloudinary API with Content-Disposition: attachment
      downloadUrl = cloudinary.utils.private_download_url(
        foundMaterial.publicId,
        format,
        {
          resource_type: resourceType,
          type: deliveryType,
          attachment: true,
          expires_at: expiresAt,
        }
      );

      // 2. Authenticated view URL via Cloudinary API with Content-Disposition: inline
      viewUrl = cloudinary.utils.private_download_url(
        foundMaterial.publicId,
        format,
        {
          resource_type: resourceType,
          type: deliveryType,
          attachment: false,
          expires_at: expiresAt,
        }
      );
    } catch {
      // Fallback: signed delivery URL using API secret signature
      try {
        downloadUrl = cloudinary.url(`${foundMaterial.publicId}.${format}`, {
          resource_type: resourceType,
          secure: true,
          sign_url: true,
          flags: "attachment",
        });
        viewUrl = cloudinary.url(`${foundMaterial.publicId}.${format}`, {
          resource_type: resourceType,
          secure: true,
          sign_url: true,
        });
      } catch {
        downloadUrl = foundMaterial.secureUrl;
        viewUrl = foundMaterial.secureUrl;
      }
    }
  }

  return {
    success: true,
    material: foundMaterial,
    downloadUrl,
    viewUrl,
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
