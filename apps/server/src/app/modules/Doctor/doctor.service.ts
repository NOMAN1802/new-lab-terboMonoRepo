import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { DoctorSchedule } from '../DoctorSchedule/doctor-schedule.model';
import { User } from '../User/user.model';
import { type TDoctor } from './doctor.interface';
import { Doctor } from './doctor.model';

const DoctorSearchableFields = ['name', 'doctorCode', 'specialty', 'phone'];

type TCreateDoctor = Pick<
  TDoctor,
  'name' | 'specialty' | 'degrees' | 'phone' | 'consultationFee'
> & { email: string; password: string };

const createDoctor = async (
  payload: TCreateDoctor,
  actorId: string
): Promise<TDoctor> => {
  if (await User.isUserExistsByEmail(payload.email)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This email is already in use');
  }

  const user = await User.create({
    name: payload.name,
    role: 'doctor',
    email: payload.email,
    mobileNumber: payload.phone,
    password: payload.password,
    status: 'active',
  });

  try {
    const doctorCode = formatDocNumber('DR', await nextSequence('doctor'), 4);
    const doctor = await Doctor.create({
      doctorCode,
      name: payload.name,
      specialty: payload.specialty,
      degrees: payload.degrees,
      phone: payload.phone,
      consultationFee: payload.consultationFee,
      user: user._id,
      createdBy: new Types.ObjectId(actorId),
    });

    void recordActivity({
      userId: actorId,
      action: 'doctor.created',
      entity: 'Doctor',
      entityId: doctor._id,
      entityLabel: doctor.doctorCode,
      summary: `Added doctor ${doctor.name} (${doctor.specialty})`,
    });

    return doctor;
  } catch (error) {
    // The login is useless without its doctor profile, and would block the
    // email from being reused on a retry.
    await User.deleteOne({ _id: user._id });
    throw error;
  }
};

const getDoctors = async (query: Record<string, unknown>, role: string) => {
  const baseQuery = Doctor.find({ isDeleted: false });
  // Only the admin manages logins; everyone else just needs the profile.
  if (role === 'admin') baseQuery.populate('user', 'email status');
  else baseQuery.select('-user');

  const doctorQuery = new QueryBuilder(baseQuery, query)
    .search(DoctorSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [doctors, total] = await Promise.all([
    doctorQuery.modelQuery,
    doctorQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: doctors,
  };
};

const getDoctor = async (id: string, role: string): Promise<TDoctor> => {
  const query = Doctor.findOne({ _id: id, isDeleted: false });
  if (role !== 'admin') query.select('-user');
  const doctor = await query;
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');
  return doctor;
};

/** The profile belonging to the logged-in doctor. */
const getMyDoctor = async (userId: string): Promise<TDoctor> => {
  const doctor = await Doctor.findOne({ user: userId, isDeleted: false });
  if (!doctor) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'No doctor profile is linked to this account'
    );
  }
  return doctor;
};

/**
 * The doctor profile behind a doctor-role login, or null for any other role.
 * A doctor login with no live profile is refused outright, so a removed doctor
 * cannot keep reading what they used to own.
 */
const getDoctorIdForActor = async (actor: {
  _id: string;
  role: string;
}): Promise<Types.ObjectId | null> => {
  if (actor.role !== 'doctor') return null;

  const doctor = await Doctor.findOne({ user: actor._id, isDeleted: false });
  if (!doctor) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'No doctor profile is linked to this account'
    );
  }
  return doctor._id as Types.ObjectId;
};

const updateDoctor = async (
  id: string,
  payload: Partial<TDoctor> & { password?: string },
  actorId: string
): Promise<TDoctor> => {
  const { password, ...profile } = payload;

  const doctor = await Doctor.findOneAndUpdate(
    { _id: id, isDeleted: false },
    profile,
    { new: true, runValidators: true }
  );
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');

  // Keep the login in step with the profile. Saved as a document rather than
  // updated in place so a new password goes through the hashing hook.
  const user = await User.findById(doctor.user).select('+password');
  if (user) {
    if (profile.name) user.name = profile.name;
    if (profile.phone) user.mobileNumber = profile.phone;
    if (profile.isActive !== undefined) {
      user.status = profile.isActive ? 'active' : 'inactive';
    }
    if (password) user.password = password;
    await user.save();
  }

  void recordActivity({
    userId: actorId,
    action: 'doctor.updated',
    entity: 'Doctor',
    entityId: doctor._id,
    entityLabel: doctor.doctorCode,
    summary: `Updated doctor ${doctor.name}`,
  });

  return doctor;
};

const deleteDoctor = async (id: string, actorId: string): Promise<void> => {
  const doctor = await Doctor.findOne({ _id: id, isDeleted: false });
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');

  const hasLiveSchedule = await DoctorSchedule.exists({
    doctor: doctor._id,
    status: { $in: ['pending', 'approved'] },
  });
  if (hasLiveSchedule) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Cancel this doctor's pending and approved schedules before removing them"
    );
  }

  // Soft delete: past schedules and appointments keep pointing at the doctor.
  doctor.isDeleted = true;
  doctor.isActive = false;
  await doctor.save();
  await User.updateOne(
    { _id: doctor.user },
    { $set: { isDeleted: true, status: 'inactive' } }
  );

  void recordActivity({
    userId: actorId,
    action: 'doctor.removed',
    entity: 'Doctor',
    entityId: doctor._id,
    entityLabel: doctor.doctorCode,
    summary: `Removed doctor ${doctor.name}`,
  });
};

/**
 * Keeps the clinical profile in step when the login is changed from the Users
 * screen. The profile mirrors the login's name and phone, and a deactivated
 * login is a doctor who can no longer be given schedules.
 */
const syncProfileFromUser = async (
  userId: string,
  patch: { name?: string; mobileNumber?: string; status?: 'active' | 'inactive' }
): Promise<void> => {
  const update: Partial<TDoctor> = {};
  if (patch.name) update.name = patch.name;
  if (patch.mobileNumber) update.phone = patch.mobileNumber;
  if (patch.status) update.isActive = patch.status === 'active';
  if (Object.keys(update).length === 0) return;

  await Doctor.updateOne({ user: userId, isDeleted: false }, { $set: update });
};

/**
 * Removing a doctor's login removes the doctor, with the same rule: not while
 * they still have pending or approved schedules. Returns false when the login
 * has no doctor profile, so the caller can carry on with an ordinary delete.
 */
const deleteDoctorByUser = async (
  userId: string,
  actorId: string
): Promise<boolean> => {
  const doctor = await Doctor.findOne({ user: userId, isDeleted: false }).select('_id');
  if (!doctor) return false;

  await deleteDoctor(String(doctor._id), actorId);
  return true;
};

export const DoctorServices = {
  createDoctor,
  getDoctors,
  getDoctor,
  getMyDoctor,
  getDoctorIdForActor,
  syncProfileFromUser,
  deleteDoctorByUser,
  updateDoctor,
  deleteDoctor,
};
