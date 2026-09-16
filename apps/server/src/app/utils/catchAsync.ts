 
import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import AppError from '../errors/AppError';

/**
 * Expected rejections — a missing token, a validation failure, an overpayment —
 * are part of normal operation and are reported to the caller by the global
 * error handler. Logging them too would bury real faults in noise on a shared
 * host, so only unexpected errors reach the log.
 */
const isExpected = (error: unknown): boolean =>
  error instanceof AppError && error.statusCode < 500;

export const catchAsync = (fn: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error): void => {
      if (!isExpected(error)) {
        console.error(`[${req.method} ${req.originalUrl}]`, error);
      }
      next(error);
    });
  };
};
