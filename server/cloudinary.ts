import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary Server Configuration Module
 * Loads Cloudinary credentials exclusively on the server.
 * Secrets are NEVER exposed to the frontend client.
 */
export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "iznihnwl";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "283574243466697";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "rHzzobP1Woplo-7-qWiAUpJ2FqQ";

  return {
    cloudName,
    apiKey,
    apiSecret,
    isConfigured: Boolean(cloudName && apiKey && apiSecret),
  };
}

let isConfigured = false;

export function configureCloudinary() {
  const config = getCloudinaryConfig();
  if (config.isConfigured && !isConfigured) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
    isConfigured = true;
  }
  return cloudinary;
}

export { cloudinary };
