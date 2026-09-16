import jwt, { type JwtPayload } from 'jsonwebtoken';
import config from '../../config';

/**
 * The session a patient holds after passing the phone check.
 *
 * Signed with PUBLIC_REPORT_SECRET rather than the staff access secret, so a
 * patient session is not merely under-privileged against staff endpoints -- it
 * is unverifiable there at all, whatever claims someone manages to put in it.
 *
 * Thirty minutes is long enough to read a report on a phone and short enough
 * that a session left open on a shared handset expires on its own.
 */
const SCOPE = 'public-report';
const EXPIRES_IN = '30m';

export type TPublicSession = {
  invoiceId: string;
  scope: typeof SCOPE;
};

const secret = (): string => {
  const value = config.public_report_secret;
  if (!value) {
    // Failing loudly here beats signing patient sessions with `undefined`.
    throw new Error('PUBLIC_REPORT_SECRET is not configured');
  }
  return value;
};

export const signPublicSession = (invoiceId: string): string =>
  jwt.sign({ invoiceId, scope: SCOPE }, secret(), { expiresIn: EXPIRES_IN });

/**
 * Returns the invoice the session is for, or null for anything that does not
 * verify. Callers must check the returned id against the invoice the request
 * is actually asking about: without that, a valid session for one invoice
 * would read every other one.
 */
export const verifyPublicSession = (token: string): TPublicSession | null => {
  try {
    const decoded = jwt.verify(token, secret()) as JwtPayload;
    if (decoded.scope !== SCOPE || typeof decoded.invoiceId !== 'string') {
      return null;
    }
    return { invoiceId: decoded.invoiceId, scope: SCOPE };
  } catch {
    // Expired, tampered, or signed with another key -- all the same to a caller.
    return null;
  }
};
