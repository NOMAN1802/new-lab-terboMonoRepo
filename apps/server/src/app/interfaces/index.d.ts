import { type JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload;
      /**
       * Set only by the public-report guard, for a patient who has passed the
       * phone check on a scanned invoice. Optional because almost no request
       * has one, and separate from `user` so a patient session can never be
       * mistaken for a staff one by code reading req.user.
       */
      publicSession?: { invoiceId: string };
    }
  }
}
