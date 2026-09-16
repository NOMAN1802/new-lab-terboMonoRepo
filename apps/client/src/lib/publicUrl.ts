/**
 * The address a patient's QR code points at.
 *
 * Not window.location.origin. An invoice is printed from wherever staff happen
 * to have the app open, and that is not always the site a patient can reach:
 * printing from a dev server bakes "localhost:5173" into the code, and
 * printing from a Vercel preview bakes a deployment URL that will be recycled.
 * Either way the paper outlives the address, and the patient gets a QR that
 * cannot resolve on their phone.
 *
 * So the public site is configured, and the current origin is only a fallback
 * for when it is not.
 */
const CONFIGURED = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;

const base = (): string =>
    (CONFIGURED || window.location.origin).replace(/\/+$/, '');

export const publicReportUrl = (token: string): string => `${base()}/r/${token}`;

/**
 * True when the QR would carry an address no patient can open. Staff see a
 * warning on screen rather than discovering it after handing over the paper;
 * it is hidden from the print itself, since it is a note to the operator.
 */
export const isUnreachableBase = (): boolean =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(base());
