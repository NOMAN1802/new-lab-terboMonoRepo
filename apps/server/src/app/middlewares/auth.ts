 
/* eslint-disable @typescript-eslint/no-unused-vars */

import { type NextFunction, type Request, type Response } from 'express';
import httpStatus from 'http-status';
import { type JwtPayload } from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import { catchAsync } from '../utils/catchAsync';
import { type USER_ROLE } from '../modules/User/user.constant';
import { verifyToken } from '../utils/verifyJWT';
import { User } from '../modules/User/user.model';

const auth = (...requiredRoles: (keyof typeof USER_ROLE)[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // checking if the token is missing
    if (!authHeader) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    const decoded = verifyToken(
      token,
      config.jwt_access_secret as string
    ) as JwtPayload;

    const { role, email, _id, iat } = decoded;

    // checking if the user exists - prefer _id over email since email can change
    let user;
    if (_id) {
      user = await User.findOne({ _id, isDeleted: false }).select('+password');
    }
    
    // Fallback to email if _id lookup fails (for backward compatibility)
    if (!user && email) {
      user = await User.isUserExistsByEmail(email);
    }

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
    }
    // checking if the user is already deleted

    if (user.status === 'inactive') {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is currently inactive'
      );
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
    }

    req.user = decoded as JwtPayload;
    next();
  });
};

export default auth;
