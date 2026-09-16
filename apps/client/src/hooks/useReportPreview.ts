import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/format';
import { downloadObjectUrl, downloadReportBlob } from '@/lib/openReport';
import { resolveType } from '@/lib/reportType';
import { useGetReportFileMutation } from '@/services/invoicesApi';

export type ReportTarget = {
    invoiceId: string;
    itemId: string;
    fileName: string;
    caption?: string;
};

/**
 * What the preview modal renders. The modal opens the moment it is asked to,
 * before the file has arrived, so every one of these is a state it can be in —
 * a click never produces nothing.
 */
export type ReportPreview = ReportTarget & {
    url?: string;
    mimeType?: string;
    error?: string;
};

/**
 * Fetching, previewing and saving a report, in one place so the three screens
 * that offer it cannot drift apart.
 *
 * The blob is re-typed before it becomes an object URL: an iframe and an <img>
 * both go by the blob's own type, and a report stored without a usable one
 * would otherwise refuse to render.
 */
export const useReportPreview = () => {
    const [preview, setPreview] = useState<ReportPreview | null>(null);
    const [getReportFile] = useGetReportFileMutation();

    // Object URLs are revoked by hand, so they are held outside React state:
    // creating one inside a state updater runs twice under StrictMode and
    // leaks the first.
    const objectUrlRef = useRef<string | null>(null);

    const releaseUrl = () => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
    };

    const fetchTyped = async (target: ReportTarget) => {
        const blob = await getReportFile({
            invoiceId: target.invoiceId,
            itemId: target.itemId,
        }).unwrap();

        const mimeType = resolveType(blob, target.fileName);
        return { blob: new Blob([blob], { type: mimeType }), mimeType };
    };

    const openPreview = async (target: ReportTarget) => {
        releaseUrl();
        // Open first, fill second — a slow fetch must not look like a dead click.
        setPreview(target);

        try {
            const { blob, mimeType } = await fetchTyped(target);
            const url = URL.createObjectURL(blob);
            objectUrlRef.current = url;

            setPreview({ ...target, url, mimeType });
        } catch (error) {
            const message = apiErrorMessage(error, 'Could not open the report');
            setPreview({ ...target, error: message });
            toast.error(message);
        }
    };

    const closePreview = () => {
        releaseUrl();
        setPreview(null);
    };

    const downloadReport = async (target: ReportTarget) => {
        try {
            const { blob } = await fetchTyped(target);
            downloadReportBlob(blob, target.fileName);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Could not download the report'));
        }
    };

    /** Saves whatever the preview is already showing — no second fetch. */
    const downloadPreview = () => {
        if (preview?.url) downloadObjectUrl(preview.url, preview.fileName);
    };

    return { preview, openPreview, closePreview, downloadReport, downloadPreview };
};

export default useReportPreview;
