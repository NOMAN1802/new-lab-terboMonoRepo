/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextFunction, type Request, type Response } from 'express';
import { type AnyZodObject, type ZodEffects } from 'zod';
import { catchAsync } from '../utils/catchAsync';

/**
 * ZodEffects is accepted alongside plain objects so schemas can use
 * .superRefine() for cross-field rules — the commission value, for instance,
 * is only capped at 100 when its type is 'percent'.
 */
type TRequestSchema = AnyZodObject | ZodEffects<any, any, any>;

const validateRequest = (schema: TRequestSchema) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
    });
    next();
  });
};

export const validateRequestCookies = (schema: TRequestSchema) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsedCookies = await schema.parseAsync({
      cookies: req.cookies,
    });

    req.cookies = (parsedCookies as { cookies: Record<string, any> }).cookies;

    next();
  });
};

export default validateRequest;
