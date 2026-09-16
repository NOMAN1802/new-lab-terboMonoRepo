import type { UploadApiResponse } from 'cloudinary';
import httpStatus from 'http-status';
import { cloudinary } from '../config/cloudinary.config';
import AppError from '../errors/AppError';

export type TStoredFile = {
  url: string;
  publicId: string;
  resourceType: string;
  /** Delivery extension, e.g. 'pdf' or 'png'. Needed to build a working URL. */
  format?: string;
  version?: string;
  mimeType: string;
  originalName: string;
  size: number;
};

const REPORTS_FOLDER = 'newlab/reports';

/**
 * PDFs go to `raw`, images to `image`.
 *
 * Not `auto`: that routes a PDF into Cloudinary's *image* pipeline, where PDF
 * delivery is blocked by default on most accounts — every uploaded PDF report
 * then 401s on download. `raw` stores and returns the exact bytes, which is
 * what a diagnostic report needs anyway.
 */
const resourceTypeFor = (mimetype: string): 'raw' | 'image' =>
  mimetype === 'application/pdf' ? 'raw' : 'image';

/** The extension a report should land under, taken from the type we validated. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

/** Cloudinary public_ids and attachment names travel in a URL: keep them plain. */
const slugify = (value: string): string =>
  value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'report';

/**
 * Streams a buffer to Cloudinary.
 *
 * `type: 'authenticated'` keeps the asset off the public CDN, so a patient's
 * report cannot be read by guessing its URL. Delivery goes through
 * getSignedFileUrl() below.
 */
export const uploadReportFile = (
  file: Express.Multer.File,
  folder: string = REPORTS_FOLDER
): Promise<TStoredFile> =>
  new Promise((resolve, reject) => {
    const resourceType = resourceTypeFor(file.mimetype);
    const extension = EXTENSION_BY_MIME[file.mimetype];

    /**
     * The public_id is built here rather than left to `use_filename`, because
     * the two resource types disagree about extensions and Cloudinary's
     * defaults get it wrong for us:
     *
     *   raw   - the extension is *part of* the public_id. use_filename strips
     *           it, so a report.pdf landed as `report_ab12cd` with no
     *           extension at all, and the download had no type. Append it.
     *   image - the public_id must NOT carry an extension; `format` selects
     *           the delivery one. Appending it here would give `x.png.png`.
     */
    const base = `${slugify(file.originalname)}-${Date.now().toString(36)}`;
    const publicId =
      resourceType === 'raw' && extension ? `${base}.${extension}` : base;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            new AppError(
              httpStatus.INTERNAL_SERVER_ERROR,
              `Report upload failed: ${error?.message ?? 'unknown error'}`
            )
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          version: result.version ? String(result.version) : undefined,
          mimeType: file.mimetype,
          originalName: file.originalname,
          size: result.bytes,
        });
      }
    );

    stream.end(file.buffer);
  });

/** What getSignedFileUrl needs off a stored report to address it again. */
export type TSignableFile = {
  publicId: string;
  resourceType: string;
  format?: string;
  version?: string;
  mimeType?: string;
  originalName?: string;
  /** The URL recorded at upload, kept as a last-resort fallback. */
  url?: string;
};

/**
 * Signed delivery URL for an authenticated asset.
 *
 * `version` matters: without the real one the signature is computed against
 * the wrong path and the link 401s.
 *
 * `format` is where this used to go wrong. It may only be appended for an
 * *image*, whose public_id carries no extension. A raw asset's public_id is
 * the complete identifier, extension included, so appending there either
 * doubles it (`x.pdf.pdf`) or invents one the asset does not have — a 404 or
 * a broken signature.
 *
 * `asAttachment` adds `fl_attachment`, which names the download for anyone
 * following the link straight to Cloudinary. Leave it off when the API is
 * fetching the bytes to re-serve them itself — a transformation in the path
 * changes what is signed, and there is nothing to gain when our own response
 * carries the Content-Disposition.
 */
export const getSignedFileUrl = (
  file: TSignableFile,
  asAttachment = true
): string => {
  const isRaw = file.resourceType === 'raw';
  const extension =
    file.format ?? (file.mimeType ? EXTENSION_BY_MIME[file.mimeType] : undefined);

  return cloudinary.url(file.publicId, {
    resource_type: file.resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    ...(asAttachment
      ? { flags: `attachment:${slugify(file.originalName ?? 'report')}` }
      : {}),
    ...(!isRaw && extension ? { format: extension } : {}),
    ...(file.version ? { version: file.version } : {}),
  });
};

/**
 * Every URL shape a stored report might legitimately answer on, best first.
 *
 * Reports uploaded across different versions of this code do not all share one
 * addressing scheme: the extension may or may not be inside the public_id, the
 * version may or may not be signed, and older records were written before
 * `format` was captured at all. Rather than encode a guess about which applies
 * to a given row, the caller tries these in order and keeps the one that
 * answers — a fetch that 404s costs a round trip, not a broken report.
 */
export const candidateFileUrls = (file: TSignableFile): string[] => {
  const extension =
    file.format ?? (file.mimeType ? EXTENSION_BY_MIME[file.mimeType] : undefined);

  const base = {
    resource_type: file.resourceType,
    type: 'authenticated' as const,
    sign_url: true,
    secure: true,
  };

  const isRaw = file.resourceType === 'raw';

  /**
   * First choice, and the documented one for an authenticated asset: the API's
   * own download endpoint, signed with the api_key. A `raw` PDF has no
   * delivery pipeline the way an image does, which is why the signed delivery
   * URLs below fetch a scan happily and refuse a PDF. This is server-side
   * only — the key never reaches a browser.
   *
   * Both spellings are offered because the extension may sit inside the
   * public_id (raw) or beside it as the format (image).
   */
  const apiDownloads = [
    cloudinary.utils.private_download_url(file.publicId, '', {
      resource_type: file.resourceType,
      type: 'authenticated',
    }),
    ...(extension
      ? [
          cloudinary.utils.private_download_url(file.publicId, extension, {
            resource_type: file.resourceType,
            type: 'authenticated',
          }),
        ]
      : []),
  ];

  const variants: Record<string, unknown>[] = [
    // As stored: extension in the path only where it belongs.
    { ...base, ...(!isRaw && extension ? { format: extension } : {}), ...(file.version ? { version: file.version } : {}) },
    // Same, unversioned — a wrong version is a common signature mismatch.
    { ...base, ...(!isRaw && extension ? { format: extension } : {}) },
    // No format at all: for a public_id that already carries its extension.
    { ...base, ...(file.version ? { version: file.version } : {}) },
    { ...base },
  ];

  const urls = [
    ...apiDownloads,
    ...variants.map((options) => cloudinary.url(file.publicId, options)),
  ];

  // The URL recorded at upload, in case the asset is not authenticated at all.
  if (file.url) urls.push(file.url);

  return [...new Set(urls)];
};

export const deleteReportFile = async (
  publicId: string,
  resourceType = 'image'
): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    invalidate: true,
  });
};
