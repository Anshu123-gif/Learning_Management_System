import { configureCloudinary, getCloudinaryConfig, cloudinary } from "./cloudinary.js";

// Allowed thumbnail image MIME types
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Maximum allowed image size: 5 MB (in bytes)
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadThumbnailParams {
  image: string; // Base64 data URI (data:image/...;base64,...)
  fileName?: string;
  userId: string;
  userRole: string;
}

export interface DeleteThumbnailParams {
  publicId: string;
  userId: string;
  userRole: string;
}

/**
 * Upload Course Thumbnail to Cloudinary via Backend
 * 
 * - Enforces teacher or admin authorization
 * - Validates MIME type: JPG, JPEG, PNG, WEBP
 * - Validates file size (max 5 MB)
 * - Uploads to Cloudinary folder "courses/thumbnails"
 * - Returns secure_url and public_id
 * - NEVER exposes CLOUDINARY_API_SECRET
 */
export async function uploadCourseThumbnail(params: UploadThumbnailParams) {
  const { image, fileName, userRole } = params;

  // 1. Role verification
  if (userRole !== "teacher" && userRole !== "admin") {
    const err: any = new Error("Forbidden. Only instructors and administrators can upload course thumbnails.");
    err.statusCode = 403;
    throw err;
  }

  // 2. Validate input presence
  if (!image || typeof image !== "string") {
    const err: any = new Error("Image data is required. Please provide a valid image file.");
    err.statusCode = 400;
    throw err;
  }

  // 3. Extract and validate MIME type from base64 Data URI
  const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  if (!mimeMatch) {
    const err: any = new Error("Invalid image format. Expected a valid base64 data URI (e.g. data:image/jpeg;base64,...).");
    err.statusCode = 400;
    throw err;
  }

  const mimeType = mimeMatch[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    const err: any = new Error(
      `Unsupported file type "${mimeType}". Allowed formats are JPG, JPEG, PNG, and WEBP.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate file size (calculate binary byte length from base64 string)
  const base64Data = image.substring(mimeMatch[0].length);
  const estimatedSizeBytes = Math.ceil((base64Data.length * 3) / 4);

  if (estimatedSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeInMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(1);
    const err: any = new Error(
      `Image size (${sizeInMB} MB) exceeds the maximum allowed limit of 5 MB.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 5. Ensure Cloudinary is initialized
  const config = getCloudinaryConfig();
  if (!config.isConfigured) {
    const err: any = new Error("Cloudinary storage service is not configured on the server.");
    err.statusCode = 503;
    throw err;
  }
  configureCloudinary();

  // 6. Upload directly to Cloudinary
  try {
    const sanitizedName = fileName
      ? fileName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)
      : "thumb";
    const publicId = `thumb_${Date.now()}_${sanitizedName}`;

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: "courses/thumbnails",
      public_id: publicId,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 1280, height: 720, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
    });

    console.log(`✅ [Cloudinary] Course thumbnail uploaded successfully: ${uploadResult.public_id}`);

    return {
      success: true,
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      width: uploadResult.width,
      height: uploadResult.height,
    };
  } catch (uploadErr: any) {
    console.error("Cloudinary thumbnail upload error:", uploadErr);
    const err: any = new Error(uploadErr?.message || "Failed to upload thumbnail to Cloudinary.");
    err.statusCode = 502;
    throw err;
  }
}

/**
 * Delete Course Thumbnail from Cloudinary
 * Used when a teacher removes or replaces an unsubmitted thumbnail.
 */
export async function deleteCourseThumbnail(params: DeleteThumbnailParams) {
  const { publicId, userRole } = params;

  if (userRole !== "teacher" && userRole !== "admin") {
    const err: any = new Error("Forbidden. Only instructors and administrators can manage course thumbnails.");
    err.statusCode = 403;
    throw err;
  }

  if (!publicId || typeof publicId !== "string") {
    const err: any = new Error("publicId is required to delete a thumbnail.");
    err.statusCode = 400;
    throw err;
  }

  // Security check: restrict deletion to the courses/thumbnails/ folder
  if (!publicId.startsWith("courses/thumbnails/")) {
    const err: any = new Error("Invalid publicId for thumbnail deletion.");
    err.statusCode = 400;
    throw err;
  }

  const config = getCloudinaryConfig();
  if (!config.isConfigured) {
    return { success: false, message: "Cloudinary not configured." };
  }
  configureCloudinary();

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
    console.log(`🗑️ [Cloudinary] Deleted thumbnail ${publicId}:`, result);
    return { success: true, result };
  } catch (err: any) {
    console.warn("Error deleting thumbnail from Cloudinary:", err?.message);
    return { success: false, message: err?.message };
  }
}
