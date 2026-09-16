import { API_BASE_URL } from '@/lib/apiBase';

export type PublicSummary = {
    invoiceNumber: string;
    patientName: string;
    visitDate: string;
    isCancelled: boolean;
};

export type PublicReportItem = {
    itemId: string;
    testName: string;
    testCode: string;
    ready: boolean;
    originalName?: string;
    mimeType?: string;
};

export type PublicPayload =
    | { state: 'cancelled'; invoiceNumber: string; patientName: string; visitDate: string }
    | {
          state: 'unpaid';
          invoiceNumber: string;
          patientName: string;
          visitDate: string;
          netPayable: number;
          paidAmount: number;
          dueAmount: number;
      }
    | {
          state: 'ready';
          invoiceNumber: string;
          patientName: string;
          visitDate: string;
          items: PublicReportItem[];
      };

export type PublicVerifyResult = PublicPayload & { accessToken: string };

/** Carries the HTTP status, so the page can tell a bad link from a dead server. */
export class PublicReportError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/**
 * Plain fetch, not an RTK Query slice.
 *
 * Three calls, none of them needing caching, deduplication, tag invalidation
 * or a store -- and Redux Toolkit Query costs roughly fifty kilobytes gzipped
 * to provide them. Patients reach this page on the worst connections anyone
 * using this system has, so that overhead is the difference between a page
 * that appears and one that looks broken.
 *
 * Dropping Redux also removes, structurally, the hazard the previous version
 * had to be careful about: with no store on this entry there is no staff token
 * to attach by accident and no auth state a failure here could clobber.
 */
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, init);
    } catch {
        // Offline, DNS failure, blocked -- no status to report.
        throw new PublicReportError('Network request failed', 0);
    }

    const body = await response.json().catch(() => ({}) as Record<string, unknown>);

    if (!response.ok) {
        const message =
            typeof (body as { message?: unknown }).message === 'string'
                ? (body as { message: string }).message
                : 'Something went wrong';
        throw new PublicReportError(message, response.status);
    }

    return (body as { data: T }).data;
};

export const fetchPublicSummary = (token: string) =>
    request<PublicSummary>(`/public/reports/${encodeURIComponent(token)}`);

export const verifyPublicReport = (token: string, last4: string) =>
    request<PublicVerifyResult>(`/public/reports/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4 }),
    });

/** Returns the raw bytes. The session rides on this call alone. */
export const fetchPublicReportFile = async (
    token: string,
    itemId: string,
    accessToken: string
): Promise<Blob> => {
    let response: Response;
    try {
        response = await fetch(
            `${API_BASE_URL}/public/reports/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}/file`,
            { headers: { authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
        );
    } catch {
        throw new PublicReportError('Network request failed', 0);
    }

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new PublicReportError(body.message ?? 'Could not open the report', response.status);
    }

    return response.blob();
};
