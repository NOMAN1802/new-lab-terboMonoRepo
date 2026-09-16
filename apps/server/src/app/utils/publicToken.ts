import crypto from 'crypto';

/**
 * The token a patient scans off their invoice.
 *
 * 16 bytes -- 128 bits -- from the CSPRNG, base64url encoded to 22 characters.
 * That keeps the scanned URL near 52 characters, which a QR encodes at version
 * 3 and a phone camera reads reliably at about 22mm on A4. Longer tokens push
 * the QR denser for no security anyone can use: 128 bits is already far beyond
 * guessing.
 *
 * base64url rather than hex because hex would need 32 characters for the same
 * entropy, and rather than plain base64 because '+' and '/' need escaping in a
 * URL and get mangled when a patient retypes a link by hand.
 */
export const generatePublicToken = (): string =>
  crypto.randomBytes(16).toString('base64url');

/**
 * Shows enough of a name for the patient to recognise their own invoice, and
 * not enough for a stranger holding it to learn whose it is.
 *
 * 'Mustakim Al Noman' -> 'M....... A. N....'
 */
export const maskName = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] + '•'.repeat(Math.max(word.length - 1, 0)))
    .join(' ');

/**
 * The digits a patient actually knows. Stored numbers carry country codes,
 * spaces and dashes in practice, so both sides are reduced to digits before
 * comparing -- otherwise '+880 1712-345678' would never match what is typed.
 */
export const lastFourDigits = (phone: string): string =>
  phone.replace(/\D/g, '').slice(-4);
