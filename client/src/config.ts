// Reserve multipart headers and the text fields within the server request cap.
const configuredLimit = Number(import.meta.env.VITE_MAX_FILE_MB || 100);
export const MAX_FILE_MB =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 100;
export const MAX_UPLOAD_BYTES =
  Math.floor(MAX_FILE_MB * 1024 * 1024) - 64 * 1024;
