 
import { type Model } from 'mongoose';
import { type USER_ROLE } from './user.constant';

export type TUserRole = keyof typeof USER_ROLE;

export type TUser = {
  _id?: string;
  name: string;
  role: TUserRole;
  email: string;
  mobileNumber: string;
  password: string;
  status?: 'active' | 'inactive';
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface IUserModel extends Model<TUser> {
  isUserExistsByEmail(id: string): Promise<TUser>;
  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string
  ): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number
  ): boolean;
}