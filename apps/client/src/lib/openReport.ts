/**
 * Opens a fetched report blob in a new tab.
 *
 * Why a blob and not the storage URL: the link can only be had after an await,
 * and `window.open` outside a click's own call stack is what browsers treat as
 * a popup — it was being blocked silently, so the icon looked dead. An object
 * URL on our own origin sidesteps that, and carries the type and filename the
 * API set rather than whatever the storage path implied.
 *
 * Returns false when the tab was blocked anyway, so the caller can say so
 * instead of leaving the user staring at nothing.
 */
export const openReportBlob = (blob: Blob, fileName: string): boolean => {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');

    if (!opened) {
        // Popups off: fall back to a download, which needs no new window.
        saveBlob(url, fileName);
    }

    // Revoking immediately would race the new tab's load.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Boolean(opened);
};

/**
 * Saves the report to disk under the name it was uploaded with. An anchor on
 * an object URL is same-origin, so `download` is honoured — which it is not
 * when the href points at storage on another domain.
 */
export const downloadReportBlob = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    saveBlob(url, fileName);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * Saves from an object URL that is already open — the preview's, say. The
 * caller still owns that URL, so this must not revoke it.
 */
export const downloadObjectUrl = (url: string, fileName: string): void => saveBlob(url, fileName);

const saveBlob = (url: string, fileName: string): void => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
};
