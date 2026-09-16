  import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import AppError from '../errors/AppError';
import { type TUserRole } from '../modules/User/user.interface';


export const createToken = (
  jwtPayload: {
    _id?: string;
    name: string;
    email: string;
    role: TUserRole;
  },
  secret: string,
  expiresIn: string
) => {
  return jwt.sign(jwtPayload, secret, {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  });
};

export const verifyToken = (
  token: string,
  secret: string
): JwtPayload | Error => {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error)
    throw new AppError(401, 'You are not authorized!');
    
  }
};
