import httpStatus from 'http-status';
import bcryptjs from 'bcryptjs';
import config from '../../config';
import AppError from '../../errors/AppError';
import { QueryBuilder } from '../../builder/QueryBuilder';
import { type TUser } from './user.interface';
import { User } from './user.model';

const createUser = async (payload: TUser): Promise<TUser> => {
  const existingUser = await User.isUserExistsByEmail(payload.email);

  if (existingUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This user already exists!');
  }

  const result = await User.create({ ...payload, status: payload.status ?? 'active' });
  return result;
};

const getUser = async (id: string): Promise<TUser | null> => {
  const result = await User.findOne({ _id: id, isDeleted: false });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const getUsers = async (
  query: Record<string, unknown>
): Promise<{ users: TUser[]; total: number; page: number; limit: number }> => {
  const baseQuery = User.find({ isDeleted: false });

  const userQuery = new QueryBuilder(baseQuery, query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [users, total] = await Promise.all([
    userQuery.modelQuery,
    User.countDocuments(userQuery.modelQuery.getFilter()),
  ]);

  const { page = 1, limit = 10 } = query;

  return {
    users,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

const updateUser = async (
  id: string,
  payload: Partial<TUser>
): Promise<TUser | null> => {
  const user = await User.findOne({ _id: id, isDeleted: false });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (payload.email && payload.email !== user.email) {
    const existing = await User.isUserExistsByEmail(payload.email);
    if (existing) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Email already in use');
    }
  }

  if (payload.password) {
    payload.password = await bcryptjs.hash(
      payload.password,
      Number(config.bcrypt_salt_rounds)
    );
  }

  const result = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  );
  return result;
};

const deleteUser = async (id: string): Promise<boolean> => {
  const result = await User.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: { isDeleted: true, status: 'inactive' } },
    { new: true }
  );

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return true;
};

export const UserServices = {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
};
