import multer from 'multer';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';

/**
 * Diagnostic reports are PDFs or scanned images. They are held in memory and
 * streamed straight to Cloudinary (see utils/fileUpload.ts) — nothing is
 * written to the server's disk, which matters on 5GB shared hosting where
 * dist/ is rebuilt on every deploy.
 */
export const MAX_REPORT_SIZE = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_REPORT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

export const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REPORT_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (
      !(ACCEPTED_REPORT_MIME_TYPES as readonly string[]).includes(file.mimetype)
    ) {
      return cb(
        new AppError(
          httpStatus.BAD_REQUEST,
          'Report must be a PDF, PNG, JPG or WEBP file'
        )
      );
    }
    cb(null, true);
  },
});
