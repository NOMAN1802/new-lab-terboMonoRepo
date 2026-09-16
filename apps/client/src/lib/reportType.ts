/**
 * A leaf module on purpose.
 *
 * This used to live in useReportPreview, which imports the staff invoices API
 * -- so the patient page, needing nothing but this one function, dragged the
 * whole authenticated API layer into its bundle. Patients are the least
 * connected people who use this system; they should download the least.
 */
const TYPE_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

/** Falls back to the filename when storage did not record a usable type. */
export const resolveType = (blob: Blob, fileName: string): string => {
    if (blob.type && blob.type !== 'application/octet-stream') return blob.type;

    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
};
