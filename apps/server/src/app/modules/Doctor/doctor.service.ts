import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { DoctorSchedule } from '../DoctorSchedule/doctor-schedule.model';
import { Referrer } from '../Referrer/referrer.model';
import { Invoice } from '../Invoice/invoice.model';
import { computeCommission } from '../Invoice/invoice.totals';
import { User } from '../User/user.model';
import { type TDoctor } from './doctor.interface';
import { Doctor } from './doctor.model';

const DoctorSearchableFields = ['name', 'doctorCode', 'specialty', 'phone'];

type TCreateDoctor = Pick<
  TDoctor,
  | 'name'
  | 'specialty'
  | 'degrees'
  | 'phone'
  | 'consultationFee'
  | 'appointmentShareType'
  | 'appointmentShareValue'
> & { email: string; password: string };

const DUPLICATE_KEY = 11000;

type TDoctorForReferrer = Pick<
  TDoctor,
  'name' | 'phone' | 'specialty' | 'doctorCode' | 'isActive' | 'isDeleted' | 'referrer'
> & { _id?: unknown };

/** The doctor code if free, otherwise the code with a suffix. Referrer codes are typed by hand too. */
const freeReferrerCode = async (base: string): Promise<string> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = attempt === 0 ? base : `${base}-${attempt}`;
    if (!(await Referrer.exists({ referrerCode: code }))) return code;
  }
  return `${base}-${Date.now()}`;
};

/**
 * Makes sure the doctor has their entry on the Referrers list, and that it
 * carries the doctor's current name, phone and state. Safe to call any number
 * of times: it creates the entry once and only refreshes it afterwards.
 * Discount and commission are left alone; the admin sets those on Referrers.
 */
const ensureReferrer = async (doctor: TDoctorForReferrer, actorId: string) => {
  const doctorId = new Types.ObjectId(String(doctor._id));
  const profile = {
    name: doctor.name,
    phone: doctor.phone,
    designation: doctor.specialty,
    isActive: doctor.isActive !== false && !doctor.isDeleted,
    isDeleted: Boolean(doctor.isDeleted),
  };

  let referrer =
    (doctor.referrer && (await Referrer.findById(doctor.referrer))) ||
    (await Referrer.findOne({ doctor: doctorId }));

  if (referrer) {
    referrer.set(profile);
    referrer.doctor = doctorId;
    await referrer.save();
  } else {
    try {
      referrer = await Referrer.create({
        referrerCode: await freeReferrerCode(doctor.doctorCode),
        ...profile,
        defaultDiscountPercent: 0,
        defaultCommissionType: 'percent',
        defaultCommissionValue: 0,
        doctor: doctorId,
        createdBy: new Types.ObjectId(actorId),
      });
      void recordActivity({
        userId: actorId,
        action: 'referrer.linked_doctor',
        entity: 'Referrer',
        entityId: referrer._id,
        entityLabel: referrer.referrerCode,
        summary: `Added doctor ${doctor.name} to the Referrers list`,
      });
    } catch (error) {
      // Two calls raced; the unique index on doctor kept one entry.
      if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      referrer = await Referrer.findOne({ doctor: doctorId });
      if (!referrer) throw error;
    }
  }

  if (!doctor.referrer || String(doctor.referrer) !== String(referrer._id)) {
    await Doctor.updateOne({ _id: doctorId }, { $set: { referrer: referrer._id } });
    doctor.referrer = referrer._id as Types.ObjectId;
  }
  return referrer;
};

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
      appointmentShareType: payload.appointmentShareType,
      appointmentShareValue: payload.appointmentShareValue,
      user: user._id,
      createdBy: new Types.ObjectId(actorId),
    });
    await ensureReferrer(doctor, actorId);

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
    // email from being reused on a retry. A profile without its referrer
    // entry goes too, so a retry starts clean.
    await Doctor.deleteOne({ user: user._id });
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

  // Doctors added before the Referrers link existed get their entry the first
  // time they are listed, so nothing has to be migrated by hand.
  await Promise.all(
    doctors
      .filter((doctor) => !doctor.referrer && doctor.doctorCode && doctor.phone)
      .map((doctor) => ensureReferrer(doctor, String(doctor.createdBy ?? doctor._id)))
  );

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
  await ensureReferrer(doctor, actorId);

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
  // Off the Referrers list too. Past invoices keep their own copy of the name.
  await ensureReferrer(doctor, actorId);
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

  const doctor = await Doctor.findOneAndUpdate(
    { user: userId, isDeleted: false },
    { $set: update },
    { new: true }
  );
  if (doctor) await ensureReferrer(doctor, userId);
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

/**
 * Puts the doctor's current appointment share on their past appointments that
 * have not been paid out yet. Used when a share is set after bookings were
 * made. Cancelled invoices and anything already paid out are never touched,
 * so it is safe to run again.
 */
const applyShareToPast = async (id: string, actorId: string) => {
  const doctor = await Doctor.findOne({ _id: id, isDeleted: false });
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');

  const payee = await ensureReferrer(doctor, actorId);
  const type = doctor.appointmentShareType ?? 'percent';
  const value = doctor.appointmentShareValue ?? 0;

  const invoices = await Invoice.find({
    'items.0.kind': 'consultation',
    'items.0.doctor': doctor._id,
    isCancelled: { $ne: true },
    commissionStatus: 'pending',
  }).select('grossAmount netPayable commissionType commissionValue commissionAmount referrer');

  let updated = 0;
  let total = 0;
  for (const invoice of invoices) {
    // As at booking: a flat share never exceeds the fee, a percent never 100.
    const shareValue =
      type === 'fixed' ? Math.min(value, invoice.grossAmount) : Math.min(value, 100);
    const commissionAmount = computeCommission(invoice.netPayable, type, shareValue);
    total += commissionAmount;

    // Already on these terms: nothing to change, so a second run is a no-op.
    if (
      invoice.commissionType === type &&
      invoice.commissionValue === shareValue &&
      invoice.commissionAmount === commissionAmount &&
      String(invoice.referrer) === String(payee._id)
    ) {
      continue;
    }

    const result = await Invoice.updateOne(
      { _id: invoice._id, commissionStatus: 'pending', isCancelled: { $ne: true } },
      {
        $set: {
          referrer: payee._id,
          referrerInfo: {
            referrerCode: payee.referrerCode,
            name: payee.name,
            designation: payee.designation,
            hospital: payee.hospital,
          },
          commissionType: type,
          commissionValue: shareValue,
          commissionAmount,
        },
      }
    );
    if (result.modifiedCount > 0) updated += 1;
  }

  void recordActivity({
    userId: actorId,
    action: 'doctor.updated',
    entity: 'Doctor',
    entityId: doctor._id,
    entityLabel: doctor.doctorCode,
    summary: `Applied ${type === 'fixed' ? `৳${value}` : `${value}%`} share to ${invoices.length} unpaid past appointment(s) of ${doctor.name}`,
  });

  return {
    appointments: invoices.length,
    updated,
    total: Math.round(total * 100) / 100,
  };
};

export const DoctorServices = {
  createDoctor,
  ensureReferrer,
  applyShareToPast,
  getDoctors,
  getDoctor,
  getMyDoctor,
  getDoctorIdForActor,
  syncProfileFromUser,
  deleteDoctorByUser,
  updateDoctor,
  deleteDoctor,
};
