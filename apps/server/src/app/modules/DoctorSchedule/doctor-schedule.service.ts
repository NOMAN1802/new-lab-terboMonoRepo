import httpStatus from 'http-status';
import { type FilterQuery, Types } from 'mongoose';
import { parseDhakaDate, toDhakaDateInput } from '@repo/utils';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import {
  dateRangeFilter,
  resolveDateRange,
  startOfDhakaDay,
} from '../../utils/dateRange';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { Appointment } from '../Appointment/appointment.model';
import { Doctor } from '../Doctor/doctor.model';
import { DoctorServices } from '../Doctor/doctor.service';
import { InvoiceServices } from '../Invoice/invoice.service';
import { User } from '../User/user.model';
import {
  type TDoctorSchedule,
  type TScheduleStatus,
} from './doctor-schedule.interface';
import { DoctorSchedule } from './doctor-schedule.model';
import {
  canApply,
  countSlots,
  generateSlots,
  nextStatus,
  rangesOverlap,
  type TScheduleAction,
} from './schedule.rules';

type TActor = { _id: string; role: string };

type TWindow = Pick<
  TDoctorSchedule,
  'startTime' | 'endTime' | 'slotMinutes'
>;

const STATUSES: TScheduleStatus[] = [
  'pending',
  'approved',
  'declined',
  'cancelled',
];

const populateDoctor = 'name doctorCode specialty';

const withSlotCount = (schedule: { toObject: () => TDoctorSchedule }) => {
  const plain = schedule.toObject();
  return { ...plain, slotCount: countSlots(plain) };
};

const dateLabel = (date: Date): string => toDhakaDateInput(date);

const doctorIdFor = DoctorServices.getDoctorIdForActor;

const assertNotInPast = (dateInput: string) => {
  if (dateInput < toDhakaDateInput()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A schedule cannot be set for a past date'
    );
  }
};

const assertWindow = (window: TWindow) => {
  if (countSlots(window) < 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'The time range is too short for even one slot'
    );
  }
};

const assertNoOverlap = async (
  doctor: Types.ObjectId,
  date: Date,
  window: TWindow,
  excludeId?: Types.ObjectId
) => {
  const sameDay = await DoctorSchedule.find({
    doctor,
    date,
    status: { $in: ['pending', 'approved'] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

  if (sameDay.some((existing) => rangesOverlap(existing, window))) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This overlaps another schedule for the same doctor on that day'
    );
  }
};

type TCreateSchedule = {
  doctor: string;
  date: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  fee?: number;
};

const createSchedule = async (payload: TCreateSchedule, actorId: string) => {
  const doctor = await Doctor.findOne({
    _id: payload.doctor,
    isDeleted: false,
    isActive: true,
  });
  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found or inactive');
  }

  assertNotInPast(payload.date);
  assertWindow(payload);

  const date = parseDhakaDate(payload.date);
  await assertNoOverlap(doctor._id as Types.ObjectId, date, payload);

  const schedule = await DoctorSchedule.create({
    doctor: doctor._id,
    date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    slotMinutes: payload.slotMinutes,
    fee: payload.fee ?? doctor.consultationFee,
    status: 'pending',
    createdBy: new Types.ObjectId(actorId),
  });

  void recordActivity({
    userId: actorId,
    action: 'schedule.created',
    entity: 'DoctorSchedule',
    entityId: schedule._id,
    entityLabel: doctor.doctorCode,
    summary: `Proposed ${doctor.name} on ${payload.date}, ${payload.startTime}-${payload.endTime}`,
  });

  return withSlotCount(schedule);
};

const getSchedules = async (query: Record<string, unknown>, actor: TActor) => {
  const filter: FilterQuery<TDoctorSchedule> = {
    ...dateRangeFilter('date', resolveDateRange(query)),
  };

  if (
    typeof query.status === 'string' &&
    STATUSES.includes(query.status as TScheduleStatus)
  ) {
    filter.status = query.status as TScheduleStatus;
  }

  // A doctor only ever sees their own schedules, whatever the query asks for.
  const ownDoctor = await doctorIdFor(actor);
  if (ownDoctor) {
    filter.doctor = ownDoctor;
  } else if (
    typeof query.doctor === 'string' &&
    Types.ObjectId.isValid(query.doctor)
  ) {
    filter.doctor = new Types.ObjectId(query.doctor);
  }

  const scheduleQuery = new QueryBuilder(
    DoctorSchedule.find(filter).populate('doctor', populateDoctor),
    { sortBy: 'date startTime', ...query }
  )
    .sort()
    .paginate();

  const [schedules, total] = await Promise.all([
    scheduleQuery.modelQuery,
    DoctorSchedule.countDocuments(filter),
  ]);

  const bookedRows = await Appointment.aggregate([
    {
      $match: {
        schedule: { $in: schedules.map((schedule) => schedule._id) },
        holdsSlot: true,
      },
    },
    { $group: { _id: '$schedule', count: { $sum: 1 } } },
  ]);
  const bookedBySchedule = new Map<string, number>(
    bookedRows.map((row) => [String(row._id), row.count as number])
  );

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: schedules.map((schedule) => ({
      ...withSlotCount(schedule),
      // How many of its slots are spoken for: everything but a cancelled booking.
      bookedCount: bookedBySchedule.get(String(schedule._id)) ?? 0,
      blockedCount: schedule.blockedSlots?.length ?? 0,
    })),
  };
};

const loadSchedule = async (id: string, actor: TActor) => {
  const schedule = await DoctorSchedule.findById(id).populate(
    'doctor',
    populateDoctor
  );
  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  const ownDoctor = await doctorIdFor(actor);
  const scheduleDoctor = (schedule.doctor as unknown as { _id: Types.ObjectId })
    ._id;
  if (ownDoctor && !ownDoctor.equals(scheduleDoctor)) {
    // Same answer as a missing record, so ids cannot be probed.
    throw new AppError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  return schedule;
};

const getSchedule = async (id: string, actor: TActor) =>
  withSlotCount(await loadSchedule(id, actor));

const updateSchedule = async (
  id: string,
  payload: Partial<Omit<TCreateSchedule, 'doctor'>>,
  actor: TActor
) => {
  const schedule = await loadSchedule(id, actor);

  // The party who agreed to a schedule may change it. A pending one is the
  // admin proposal until the doctor answers; once approved, only the doctor
  // can move it, so an admin can never alter what a doctor has agreed to.
  const isDoctor = actor.role === 'doctor';
  const editable =
    canApply(schedule.status, 'edit') ||
    (schedule.status === 'approved' && isDoctor);
  if (!editable) {
    throw new AppError(
      httpStatus.CONFLICT,
      schedule.status === 'approved'
        ? 'Only the doctor can change an approved schedule. Cancel it and propose a new one.'
        : 'This schedule can no longer be edited.'
    );
  }
  if (isDoctor && payload.fee !== undefined) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only an admin can change the fee');
  }
  if (schedule.status === 'approved') {
    const hasBookings = await Appointment.exists({
      schedule: schedule._id,
      holdsSlot: true,
    });
    if (hasBookings) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Patients are already booked into this schedule. Block slots or cancel it instead.'
      );
    }
  }

  const dateInput = payload.date ?? dateLabel(schedule.date);
  const window: TWindow = {
    startTime: payload.startTime ?? schedule.startTime,
    endTime: payload.endTime ?? schedule.endTime,
    slotMinutes: payload.slotMinutes ?? schedule.slotMinutes,
  };

  assertNotInPast(dateInput);
  assertWindow(window);

  const date = parseDhakaDate(dateInput);
  const scheduleDoctor = (schedule.doctor as unknown as { _id: Types.ObjectId })
    ._id;
  await assertNoOverlap(scheduleDoctor, date, window, schedule._id);

  const layoutChanged =
    dateLabel(schedule.date) !== dateInput ||
    schedule.startTime !== window.startTime ||
    schedule.endTime !== window.endTime ||
    schedule.slotMinutes !== window.slotMinutes;

  schedule.date = date;
  schedule.startTime = window.startTime;
  schedule.endTime = window.endTime;
  schedule.slotMinutes = window.slotMinutes;
  // Blocked slots point at positions in the old layout, so a new layout starts clear.
  if (layoutChanged) schedule.blockedSlots = [];
  if (payload.fee !== undefined) schedule.fee = payload.fee;
  await schedule.save();

  void recordActivity({
    userId: actor._id,
    action: 'schedule.updated',
    entity: 'DoctorSchedule',
    entityId: schedule._id,
    summary: `Changed the schedule to ${dateInput}, ${window.startTime}-${window.endTime}, ${window.slotMinutes} min each`,
  });

  return withSlotCount(schedule);
};

/**
 * Moves a schedule to its next status in one atomic step, so two people
 * answering at once cannot both succeed.
 */
const transition = async (
  id: string,
  action: Exclude<TScheduleAction, 'edit'>,
  actor: TActor,
  extra: Partial<TDoctorSchedule> = {}
) => {
  const schedule = await loadSchedule(id, actor);
  const allowedFrom = (['pending', 'approved'] as TScheduleStatus[]).filter(
    (status) => canApply(status, action)
  );

  if (!canApply(schedule.status, action)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `This schedule is already ${schedule.status}`
    );
  }

  const updated = await DoctorSchedule.findOneAndUpdate(
    { _id: schedule._id, status: { $in: allowedFrom } },
    { $set: { status: nextStatus(action), ...extra } },
    { new: true }
  ).populate('doctor', populateDoctor);

  if (!updated) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This schedule was just changed by someone else. Reload and try again.'
    );
  }

  return updated;
};

const approveSchedule = async (id: string, actor: TActor) => {
  const schedule = await loadSchedule(id, actor);
  if (startOfDhakaDay(schedule.date) < startOfDhakaDay(new Date())) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The date of this schedule has already passed'
    );
  }

  const updated = await transition(id, 'approve', actor, {
    respondedAt: new Date(),
    respondedBy: new Types.ObjectId(actor._id),
  });

  void recordActivity({
    userId: actor._id,
    action: 'schedule.approved',
    entity: 'DoctorSchedule',
    entityId: updated._id,
    summary: `Approved the schedule on ${dateLabel(updated.date)}, ${updated.startTime}-${updated.endTime}`,
  });

  return withSlotCount(updated);
};

const declineSchedule = async (id: string, reason: string, actor: TActor) => {
  const updated = await transition(id, 'decline', actor, {
    declineReason: reason,
    respondedAt: new Date(),
    respondedBy: new Types.ObjectId(actor._id),
  });

  void recordActivity({
    userId: actor._id,
    action: 'schedule.declined',
    entity: 'DoctorSchedule',
    entityId: updated._id,
    summary: `Declined the schedule on ${dateLabel(updated.date)}: ${reason}`,
    meta: { reason },
  });

  return withSlotCount(updated);
};

const liveAppointments = (filter: Record<string, unknown>) =>
  Appointment.find({ ...filter, status: { $in: ['booked', 'checked_in'] } })
    .select('appointmentNumber serialNo startTime patientInfo invoice invoiceNumber')
    .populate('invoice', 'paidAmount isCancelled');

type TLive = Awaited<ReturnType<typeof liveAppointments>>;

/**
 * Cancels bookings that lost their slot because the schedule changed under
 * them. Their consultation invoices go too, unless money was already taken:
 * that has to be refunded by hand, so it is flagged. Each booking is also
 * marked for the desk to phone the patient, which the cancel-request flow does
 * not need because there the desk is the one who asked.
 */
const releaseAppointments = async (
  affected: TLive,
  reasonText: string,
  actor: TActor
) => {
  if (affected.length === 0) return [];

  await Appointment.updateMany(
    { _id: { $in: affected.map((appointment) => appointment._id) } },
    {
      $set: {
        status: 'cancelled',
        holdsSlot: false,
        cancelReason: reasonText,
        callback: { reason: reasonText, requestedAt: new Date() },
      },
    }
  );

  const refundDue = new Map<string, number>();
  for (const appointment of affected) {
    const linked = appointment.invoice as unknown as
      | { _id: Types.ObjectId; paidAmount: number; isCancelled?: boolean }
      | null
      | undefined;
    if (!linked || linked.isCancelled) continue;

    if (linked.paidAmount > 0) {
      refundDue.set(String(appointment._id), linked.paidAmount);
      continue;
    }

    try {
      await InvoiceServices.cancelInvoice(String(linked._id), actor._id, reasonText, {
        fromAppointment: true,
      });
    } catch (invoiceError) {
      console.error('[schedule] invoice not cancelled', appointment.invoiceNumber, invoiceError);
    }
  }

  return affected.map((appointment) => ({
    _id: appointment._id,
    appointmentNumber: appointment.appointmentNumber,
    serialNo: appointment.serialNo,
    startTime: appointment.startTime,
    patientName: appointment.patientInfo.name,
    patientPhone: appointment.patientInfo.phone,
    invoiceNumber: appointment.invoiceNumber,
    refundDue: refundDue.get(String(appointment._id)) ?? 0,
  }));
};

const cancelSchedule = async (
  id: string,
  reason: string | undefined,
  actor: TActor
) => {
  const schedule = await loadSchedule(id, actor);
  if (schedule.status === 'approved' && !reason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A reason is required to cancel an approved schedule'
    );
  }

  const updated = await transition(id, 'cancel', actor, {
    cancelReason: reason,
  });

  // Patients already booked into it lose their slot, and reception needs to
  // know who to call, so hand back who was released.
  const affected = await liveAppointments({ schedule: updated._id });
  const cancelledAppointments = await releaseAppointments(
    affected,
    `Schedule cancelled${reason ? `: ${reason}` : ''}`,
    actor
  );

  void recordActivity({
    userId: actor._id,
    action: 'schedule.cancelled',
    entity: 'DoctorSchedule',
    entityId: updated._id,
    summary: `Cancelled the schedule on ${dateLabel(updated.date)}${
      reason ? `: ${reason}` : ''
    }${affected.length ? ` (${affected.length} appointment(s) released)` : ''}`,
    meta: { ...(reason ? { reason } : {}), released: affected.length },
  });

  return { ...withSlotCount(updated), cancelledAppointments };
};

const slotsOf = (schedule: {
  date: Date;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}) =>
  generateSlots({
    date: dateLabel(schedule.date),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    slotMinutes: schedule.slotMinutes,
  });

const assertSlotIndex = (slotIndex: number) => {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'That slot does not exist');
  }
};

/** The schedule slot by slot: who is in each, and which are blocked. */
const getScheduleSlots = async (id: string, actor: TActor) => {
  const schedule = await loadSchedule(id, actor);

  const booked = await Appointment.find({ schedule: schedule._id, holdsSlot: true }).select(
    'slotIndex appointmentNumber status patientInfo'
  );
  const bookedAt = new Map(booked.map((appointment) => [appointment.slotIndex, appointment]));
  const blockedAt = new Map(
    (schedule.blockedSlots ?? []).map((blocked) => [blocked.slotIndex, blocked])
  );
  const now = new Date();

  return {
    schedule: withSlotCount(schedule),
    slots: slotsOf(schedule).map((slot) => {
      const appointment = bookedAt.get(slot.slotIndex);
      const blocked = blockedAt.get(slot.slotIndex);
      const state = appointment
        ? 'booked'
        : blocked
          ? 'blocked'
          : slot.end <= now
            ? 'past'
            : 'free';

      return {
        slotIndex: slot.slotIndex,
        serialNo: slot.serialNo,
        startTime: slot.startTime,
        endTime: slot.endTime,
        state,
        appointment: appointment
          ? {
              _id: appointment._id,
              appointmentNumber: appointment.appointmentNumber,
              status: appointment.status,
              patientName: appointment.patientInfo.name,
              patientAge: appointment.patientInfo.age,
              patientGender: appointment.patientInfo.gender,
            }
          : undefined,
        blocked: blocked
          ? { reason: blocked.reason, blockedByName: blocked.blockedByName }
          : undefined,
      };
    }),
  };
};

/**
 * Takes one slot out of an approved schedule, for a break or an emergency. The
 * slot is blocked first so nobody can book it in the meantime; a patient
 * already in it is then released, and the desk is told to phone them.
 */
const blockSlot = async (
  id: string,
  slotIndex: number,
  reason: string,
  actor: TActor
) => {
  assertSlotIndex(slotIndex);
  const schedule = await loadSchedule(id, actor);

  if (schedule.status !== 'approved') {
    throw new AppError(
      httpStatus.CONFLICT,
      'Only an approved schedule has slots that can be blocked'
    );
  }

  const slot = slotsOf(schedule)[slotIndex];
  if (!slot) throw new AppError(httpStatus.BAD_REQUEST, 'That slot does not exist');
  if (slot.end <= new Date()) {
    throw new AppError(httpStatus.CONFLICT, 'That slot has already passed');
  }

  const blocker = await User.findById(actor._id).select('name');

  const updated = await DoctorSchedule.findOneAndUpdate(
    { _id: schedule._id, status: 'approved', 'blockedSlots.slotIndex': { $ne: slotIndex } },
    {
      $push: {
        blockedSlots: {
          slotIndex,
          reason,
          blockedBy: new Types.ObjectId(actor._id),
          blockedByName: blocker?.name ?? 'Staff',
          blockedAt: new Date(),
        },
      },
    },
    { new: true }
  ).populate('doctor', populateDoctor);

  if (!updated) {
    throw new AppError(
      httpStatus.CONFLICT,
      'That slot is already blocked, or the schedule has just changed'
    );
  }

  const affected = await liveAppointments({ schedule: updated._id, slotIndex });
  const cancelledAppointments = await releaseAppointments(
    affected,
    `The ${slot.startTime} slot was blocked: ${reason}`,
    actor
  );

  void recordActivity({
    userId: actor._id,
    action: 'schedule.slot_blocked',
    entity: 'DoctorSchedule',
    entityId: updated._id,
    summary: `Blocked the ${slot.startTime} slot on ${dateLabel(updated.date)}: ${reason}${
      affected.length ? ' (a booked patient was released)' : ''
    }`,
    meta: { slotIndex, reason, released: affected.length },
  });

  return { ...withSlotCount(updated), cancelledAppointments };
};

const unblockSlot = async (id: string, slotIndex: number, actor: TActor) => {
  assertSlotIndex(slotIndex);
  const schedule = await loadSchedule(id, actor);

  const slot = slotsOf(schedule)[slotIndex];
  if (slot && slot.end <= new Date()) {
    throw new AppError(httpStatus.CONFLICT, 'That slot has already passed');
  }

  const updated = await DoctorSchedule.findOneAndUpdate(
    { _id: schedule._id, status: 'approved', 'blockedSlots.slotIndex': slotIndex },
    { $pull: { blockedSlots: { slotIndex } } },
    { new: true }
  ).populate('doctor', populateDoctor);

  if (!updated) {
    throw new AppError(httpStatus.NOT_FOUND, 'That slot is not blocked');
  }

  void recordActivity({
    userId: actor._id,
    action: 'schedule.slot_unblocked',
    entity: 'DoctorSchedule',
    entityId: updated._id,
    summary: `Reopened the ${slot?.startTime ?? slotIndex} slot on ${dateLabel(updated.date)}`,
    meta: { slotIndex },
  });

  return withSlotCount(updated);
};

export const DoctorScheduleServices = {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  approveSchedule,
  declineSchedule,
  cancelSchedule,
  getScheduleSlots,
  blockSlot,
  unblockSlot,
};
