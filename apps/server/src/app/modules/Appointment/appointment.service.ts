import httpStatus from 'http-status';
import { type FilterQuery, Types } from 'mongoose';
import { parseDhakaDate, toDhakaDateInput } from '@repo/utils';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { dateRangeFilter, resolveDateRange } from '../../utils/dateRange';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { round2 } from '../../utils/money';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { Doctor } from '../Doctor/doctor.model';
import { InvoiceServices } from '../Invoice/invoice.service';
import { PaymentServices } from '../Payment/payment.service';
import { User } from '../User/user.model';
import { DoctorServices } from '../Doctor/doctor.service';
import { DoctorSchedule } from '../DoctorSchedule/doctor-schedule.model';
import { generateSlots } from '../DoctorSchedule/schedule.rules';
import { Patient } from '../Patient/patient.model';
import {
  type TAppointment,
  type TAppointmentStatus,
} from './appointment.interface';
import { Appointment } from './appointment.model';
import {
  allowedFrom,
  canApply,
  resultOf,
  slotState,
  type TAppointmentAction,
} from './appointment.rules';

type TActor = { _id: string; role: string };

const STATUSES: TAppointmentStatus[] = [
  'booked',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
];

const populateDoctor = 'name doctorCode specialty';
const populateInvoice =
  'invoiceNumber paymentStatus netPayable paidAmount dueAmount isCancelled';
const DUPLICATE_KEY = 11000;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** APT-YYMMDD-001, numbered per appointment day so the counter stays short. */
const buildAppointmentNumber = (dateInput: string, seq: number): string =>
  formatDocNumber(`APT-${dateInput.slice(2).replace(/-/g, '')}`, seq, 3);

type TBookInput = {
  schedule: string;
  slotIndex: number;
  patient: string;
  notes?: string;
  collectFullPayment?: boolean;
  advanceAmount?: number;
};

const createAppointment = async (payload: TBookInput, actorId: string) => {
  const schedule = await DoctorSchedule.findById(payload.schedule);
  if (!schedule) {
    throw new AppError(httpStatus.NOT_FOUND, 'Schedule not found');
  }
  // Pending and declined schedules were never agreed by the doctor.
  if (schedule.status !== 'approved') {
    throw new AppError(
      httpStatus.CONFLICT,
      'This schedule is not open for booking'
    );
  }

  const dateInput = toDhakaDateInput(schedule.date);
  const slot = generateSlots({
    date: dateInput,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    slotMinutes: schedule.slotMinutes,
  })[payload.slotIndex];

  if (!slot) {
    throw new AppError(httpStatus.BAD_REQUEST, 'That slot does not exist');
  }
  if (slot.end <= new Date()) {
    throw new AppError(httpStatus.CONFLICT, 'That slot has already passed');
  }
  if (schedule.blockedSlots?.some((blocked) => blocked.slotIndex === payload.slotIndex)) {
    throw new AppError(
      httpStatus.CONFLICT,
      'That slot is not available. The doctor has blocked it.'
    );
  }

  const patient = await Patient.findOne({
    _id: payload.patient,
    isDeleted: false,
  });
  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');

  const alreadyBooked = await Appointment.findOne({
    schedule: schedule._id,
    patient: patient._id,
    holdsSlot: true,
  }).select('serialNo startTime');
  if (alreadyBooked) {
    throw new AppError(
      httpStatus.CONFLICT,
      `${patient.name} is already booked in this schedule (serial ${alreadyBooked.serialNo}, ${alreadyBooked.startTime})`
    );
  }

  const doctor = await Doctor.findById(schedule.doctor).select('name specialty');
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');

  const seq = await nextSequence(`appointment:${dateInput}`);

  try {
    const appointment = await Appointment.create({
      appointmentNumber: buildAppointmentNumber(dateInput, seq),
      schedule: schedule._id,
      doctor: schedule.doctor,
      patient: patient._id,
      patientInfo: {
        patientId: patient.patientId,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
      },
      slotIndex: slot.slotIndex,
      serialNo: slot.serialNo,
      date: schedule.date,
      slotStart: slot.start,
      slotEnd: slot.end,
      startTime: slot.startTime,
      endTime: slot.endTime,
      fee: schedule.fee,
      status: 'booked',
      holdsSlot: true,
      notes: payload.notes,
      createdBy: new Types.ObjectId(actorId),
    });

    // The fee is billed on an invoice of its own. If that fails the booking is
    // withdrawn, so no patient is left holding a slot that was never billed.
    let invoice;
    try {
      invoice = await InvoiceServices.createConsultationInvoice(
        {
          patient: String(patient._id),
          appointment: appointment._id as Types.ObjectId,
          doctor: {
            _id: doctor._id as Types.ObjectId,
            name: doctor.name,
            specialty: doctor.specialty,
          },
          fee: schedule.fee,
          visitDate: slot.start,
        },
        actorId
      );
    } catch (invoiceError) {
      await Appointment.deleteOne({ _id: appointment._id });
      throw invoiceError;
    }

    appointment.invoice = invoice._id as Types.ObjectId;
    appointment.invoiceNumber = invoice.invoiceNumber;
    await appointment.save();

    // Money taken at the desk is receipted as part of the booking. The amount
    // is clamped to the net the server computed, so a stale figure on screen
    // can never receipt more than is owed. A failed payment does not undo the
    // booking: the slot and the bill are real, so it is reported alongside.
    const takeNow = payload.collectFullPayment
      ? invoice.netPayable
      : Math.min(payload.advanceAmount ?? 0, invoice.netPayable);
    let paymentWarning: string | undefined;
    if (takeNow > 0 && invoice.netPayable > 0) {
      try {
        await PaymentServices.createPayment(
          { invoice: String(invoice._id), amount: round2(takeNow) },
          actorId
        );
      } catch (paymentError) {
        paymentWarning =
          paymentError instanceof Error
            ? paymentError.message
            : 'The payment could not be recorded';
      }
    }

    void recordActivity({
      userId: actorId,
      action: 'appointment.booked',
      entity: 'Appointment',
      entityId: appointment._id,
      entityLabel: appointment.appointmentNumber,
      summary: `Booked ${patient.name} for serial ${slot.serialNo} at ${slot.startTime} on ${dateInput}`,
    });

    const populated = await appointment.populate([
      { path: 'doctor', select: populateDoctor },
      { path: 'invoice', select: populateInvoice },
    ]);
    return { ...populated.toObject(), paymentWarning };
  } catch (error) {
    // Two people picked the same slot at once; the unique index let one win.
    if ((error as { code?: number }).code === DUPLICATE_KEY) {
      throw new AppError(
        httpStatus.CONFLICT,
        'That slot was just taken. Please choose another.'
      );
    }
    throw error;
  }
};

/**
 * Every approved schedule on a day with each slot marked free, taken or past.
 * Slots are derived from the schedule, so nothing is stored per free slot.
 */
const getAvailability = async (query: { date?: string; doctor?: string }) => {
  if (!query.date || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'A date (YYYY-MM-DD) is required');
  }

  const filter: FilterQuery<unknown> = {
    date: parseDhakaDate(query.date),
    status: 'approved',
  };
  if (query.doctor && Types.ObjectId.isValid(query.doctor)) {
    filter.doctor = new Types.ObjectId(query.doctor);
  }

  const schedules = await DoctorSchedule.find(filter)
    .populate('doctor', populateDoctor)
    .sort('startTime');

  const held = await Appointment.find({
    schedule: { $in: schedules.map((schedule) => schedule._id) },
    holdsSlot: true,
  }).select('schedule slotIndex');

  const takenBySchedule = new Map<string, Set<number>>();
  for (const appointment of held) {
    const key = String(appointment.schedule);
    if (!takenBySchedule.has(key)) takenBySchedule.set(key, new Set());
    takenBySchedule.get(key)!.add(appointment.slotIndex);
  }

  const now = new Date();

  return schedules.map((schedule) => {
    const taken = takenBySchedule.get(String(schedule._id)) ?? new Set<number>();
    const blockedHere = new Set((schedule.blockedSlots ?? []).map((blocked) => blocked.slotIndex));
    const slots = generateSlots({
      date: query.date as string,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotMinutes: schedule.slotMinutes,
    }).map((slot) => ({
      slotIndex: slot.slotIndex,
      serialNo: slot.serialNo,
      startTime: slot.startTime,
      endTime: slot.endTime,
      state: slotState(slot, taken.has(slot.slotIndex), now, blockedHere.has(slot.slotIndex)),
    }));

    return {
      schedule: {
        _id: schedule._id,
        doctor: schedule.doctor,
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotMinutes: schedule.slotMinutes,
        fee: schedule.fee,
      },
      freeCount: slots.filter((slot) => slot.state === 'free').length,
      slots,
    };
  });
};

const getAppointments = async (
  query: Record<string, unknown>,
  actor: TActor
) => {
  const filter: FilterQuery<TAppointment> = {
    ...dateRangeFilter('date', resolveDateRange(query)),
  };

  if (
    typeof query.status === 'string' &&
    STATUSES.includes(query.status as TAppointmentStatus)
  ) {
    filter.status = query.status as TAppointmentStatus;
  }
  // Answers to the logged-in user own requests that they have not seen yet.
  // Scoped to who asked, so one receptionist never sees the outcomes of another.
  if (query.cancelOutcome === 'unseen') {
    Object.assign(filter, {
      'cancellation.requestedBy': new Types.ObjectId(actor._id),
      'cancellation.status': { $in: ['approved', 'rejected'] },
      'cancellation.requesterSeenAt': { $exists: false },
    });
  }
  // Patients the desk still has to phone: a doctor or a schedule change cancelled them.
  if (query.callback === 'pending') {
    Object.assign(filter, {
      'callback.requestedAt': { $exists: true },
      'callback.doneAt': { $exists: false },
    });
  }
  if (query.cancelRequest === 'pending' || query.cancelRequest === 'rejected') {
    (filter as Record<string, unknown>)['cancellation.status'] = query.cancelRequest;
  }
  if (typeof query.patient === 'string' && Types.ObjectId.isValid(query.patient)) {
    filter.patient = new Types.ObjectId(query.patient);
  }
  if (typeof query.schedule === 'string' && Types.ObjectId.isValid(query.schedule)) {
    filter.schedule = new Types.ObjectId(query.schedule);
  }

  // A doctor only ever sees their own, whatever the query asks for.
  const ownDoctor = await DoctorServices.getDoctorIdForActor(actor);
  if (ownDoctor) {
    filter.doctor = ownDoctor;
  } else if (
    typeof query.doctor === 'string' &&
    Types.ObjectId.isValid(query.doctor)
  ) {
    filter.doctor = new Types.ObjectId(query.doctor);
  }

  if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
    const pattern = new RegExp(escapeRegExp(query.searchTerm.trim()), 'i');
    filter.$or = [
      { 'patientInfo.name': pattern },
      { 'patientInfo.phone': pattern },
      { 'patientInfo.patientId': pattern },
      { appointmentNumber: pattern },
    ];
  }

  const appointmentQuery = new QueryBuilder(
    Appointment.find(filter)
      .populate('doctor', populateDoctor)
      .populate('invoice', populateInvoice),
    { sortBy: 'date slotStart', ...query }
  )
    .sort()
    .paginate();

  const [appointments, total] = await Promise.all([
    appointmentQuery.modelQuery,
    Appointment.countDocuments(filter),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: appointments,
  };
};

const loadAppointment = async (id: string, actor: TActor) => {
  const appointment = await Appointment.findById(id)
    .populate('doctor', populateDoctor)
    .populate('invoice', populateInvoice);
  if (!appointment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  const ownDoctor = await DoctorServices.getDoctorIdForActor(actor);
  const appointmentDoctor = (appointment.doctor as unknown as {
    _id: Types.ObjectId;
  })._id;
  if (ownDoctor && !ownDoctor.equals(appointmentDoctor)) {
    // Same answer as a missing record, so ids cannot be probed.
    throw new AppError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  return appointment;
};

const getAppointment = (id: string, actor: TActor) =>
  loadAppointment(id, actor);

const ACTIVITY: Record<
  TAppointmentAction,
  | 'appointment.checked_in'
  | 'appointment.cancelled'
  | 'appointment.no_show'
  | 'appointment.completed'
> = {
  check_in: 'appointment.checked_in',
  cancel: 'appointment.cancelled',
  no_show: 'appointment.no_show',
  complete: 'appointment.completed',
};

/**
 * Moves an appointment on in one atomic step, conditioned on its status, so a
 * cancel and a check-in racing each other cannot both succeed.
 */
const transition = async (
  id: string,
  action: TAppointmentAction,
  actor: TActor,
  reason?: string,
  note?: string,
  refund?: boolean
) => {
  const appointment = await loadAppointment(id, actor);

  if (!canApply(appointment.status, action)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `This appointment is already ${appointment.status.replace('_', ' ')}`
    );
  }
  if (action === 'no_show' && appointment.slotStart > new Date()) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The appointment time has not arrived yet'
    );
  }

  // The invoice travels with the appointment. Money already taken is not
  // quietly written off: it has to be voided on the invoice (a refund) first.
  const linked = appointment.invoice as unknown as
    | {
        _id: Types.ObjectId;
        invoiceNumber: string;
        paidAmount: number;
        isCancelled?: boolean;
      }
    | null
    | undefined;
  if (action === 'cancel' && linked && !linked.isCancelled && linked.paidAmount > 0 && !refund) {
    throw new AppError(
      httpStatus.CONFLICT,
      `${linked.paidAmount} has been paid on ${linked.invoiceNumber}. Cancel with a refund, or refund it from the invoice first.`
    );
  }

  const next = resultOf(action);
  const set: Record<string, unknown> = { status: next };
  if (action === 'check_in') set.checkedInAt = new Date();
  if (action === 'complete') set.completedAt = new Date();
  if (action === 'cancel') {
    set.holdsSlot = false;
    set.cancelReason = reason;

    // Cancelling while the desk has a request waiting answers that request.
    if (appointment.cancellation?.status === 'pending') {
      const reviewer = await User.findById(actor._id).select('name');
      set['cancellation.status'] = 'approved';
      set['cancellation.reviewedBy'] = new Types.ObjectId(actor._id);
      set['cancellation.reviewedByName'] = reviewer?.name ?? 'Admin';
      set['cancellation.reviewedAt'] = new Date();
      if (note) set['cancellation.reviewNote'] = note;
    }

    // Money already taken goes back first. If the refund is refused (say the
    // commission was paid out) the whole call fails with the appointment intact.
    if (refund && linked && !linked.isCancelled && linked.paidAmount > 0) {
      await PaymentServices.refundPayment(
        {
          invoice: String(linked._id),
          amount: linked.paidAmount,
          reason: `Appointment cancelled${reason ? `: ${reason}` : ''}`,
        },
        actor._id
      );
    }

    // The invoice goes next. If it cannot be cancelled the whole call fails
    // and the appointment is untouched, so the two never drift apart silently.
    if (linked && !linked.isCancelled) {
      await InvoiceServices.cancelInvoice(
        String(linked._id),
        actor._id,
        `Appointment cancelled${reason ? `: ${reason}` : ''}`,
        { fromAppointment: true }
      );
    }
  }

  const updated = await Appointment.findOneAndUpdate(
    { _id: appointment._id, status: { $in: allowedFrom(action) } },
    { $set: set },
    { new: true }
  )
    .populate('doctor', populateDoctor)
    .populate('invoice', populateInvoice);

  if (!updated) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This appointment was just changed by someone else. Reload and try again.'
    );
  }

  void recordActivity({
    userId: actor._id,
    action: ACTIVITY[action],
    entity: 'Appointment',
    entityId: updated._id,
    entityLabel: updated.appointmentNumber,
    summary: `${updated.patientInfo.name}, serial ${updated.serialNo}: ${next.replace('_', ' ')}${
      reason ? ` (${reason})` : ''
    }`,
    meta: reason ? { reason } : undefined,
  });

  return updated;
};

/** The desk asks; an admin decides. Nothing changes on the appointment yet. */
const requestCancel = async (id: string, reason: string, actor: TActor) => {
  const appointment = await loadAppointment(id, actor);

  if (!canApply(appointment.status, 'cancel')) {
    throw new AppError(
      httpStatus.CONFLICT,
      `This appointment is already ${appointment.status.replace('_', ' ')}`
    );
  }
  if (appointment.cancellation?.status === 'pending') {
    throw new AppError(
      httpStatus.CONFLICT,
      'A cancellation request for this appointment is already waiting for an admin'
    );
  }

  const requester = await User.findById(actor._id).select('name');

  const updated = await Appointment.findOneAndUpdate(
    {
      _id: appointment._id,
      status: { $in: allowedFrom('cancel') },
      'cancellation.status': { $ne: 'pending' },
    },
    {
      $set: {
        cancellation: {
          status: 'pending',
          reason,
          requestedBy: new Types.ObjectId(actor._id),
          requestedByName: requester?.name ?? 'Staff',
          requestedAt: new Date(),
        },
      },
    },
    { new: true }
  )
    .populate('doctor', populateDoctor)
    .populate('invoice', populateInvoice);

  if (!updated) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This appointment was just changed by someone else. Reload and try again.'
    );
  }

  void recordActivity({
    userId: actor._id,
    action: 'appointment.cancel_requested',
    entity: 'Appointment',
    entityId: updated._id,
    entityLabel: updated.appointmentNumber,
    summary: `Cancellation requested for ${updated.patientInfo.name}, serial ${updated.serialNo}: ${reason}`,
    meta: { reason },
  });

  return updated;
};

const approveCancel = async (
  id: string,
  note: string | undefined,
  actor: TActor,
  refund?: boolean
) => {
  const appointment = await loadAppointment(id, actor);

  if (appointment.cancellation?.status !== 'pending') {
    throw new AppError(
      httpStatus.CONFLICT,
      'There is no cancellation request waiting on this appointment'
    );
  }

  return transition(id, 'cancel', actor, appointment.cancellation.reason, note, refund);
};

const rejectCancel = async (id: string, note: string, actor: TActor) => {
  const appointment = await loadAppointment(id, actor);

  if (appointment.cancellation?.status !== 'pending') {
    throw new AppError(
      httpStatus.CONFLICT,
      'There is no cancellation request waiting on this appointment'
    );
  }

  const reviewer = await User.findById(actor._id).select('name');

  const updated = await Appointment.findOneAndUpdate(
    { _id: appointment._id, 'cancellation.status': 'pending' },
    {
      $set: {
        'cancellation.status': 'rejected',
        'cancellation.reviewedBy': new Types.ObjectId(actor._id),
        'cancellation.reviewedByName': reviewer?.name ?? 'Admin',
        'cancellation.reviewedAt': new Date(),
        'cancellation.reviewNote': note,
      },
    },
    { new: true }
  )
    .populate('doctor', populateDoctor)
    .populate('invoice', populateInvoice);

  if (!updated) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This request was just answered by someone else. Reload and try again.'
    );
  }

  void recordActivity({
    userId: actor._id,
    action: 'appointment.cancel_rejected',
    entity: 'Appointment',
    entityId: updated._id,
    entityLabel: updated.appointmentNumber,
    summary: `Cancellation refused for ${updated.patientInfo.name}, serial ${updated.serialNo}: ${note}`,
    meta: { note },
  });

  return updated;
};

/** Marks the answers to the requests this user raised as seen. */
const acknowledgeOutcomes = async (ids: string[] | undefined, actor: TActor) => {
  const filter: Record<string, unknown> = {
    'cancellation.requestedBy': new Types.ObjectId(actor._id),
    'cancellation.status': { $in: ['approved', 'rejected'] },
    'cancellation.requesterSeenAt': { $exists: false },
  };
  if (ids && ids.length > 0) {
    filter._id = {
      $in: ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)),
    };
  }

  const result = await Appointment.updateMany(filter, {
    $set: { 'cancellation.requesterSeenAt': new Date() },
  });
  return { acknowledged: result.modifiedCount };
};

/** Marks patients as told. Any desk user can do it; it is a shared task. */
const markInformed = async (ids: string[] | undefined, actor: TActor) => {
  const filter: Record<string, unknown> = {
    'callback.requestedAt': { $exists: true },
    'callback.doneAt': { $exists: false },
  };
  if (ids && ids.length > 0) {
    filter._id = {
      $in: ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)),
    };
  }

  const user = await User.findById(actor._id).select('name');
  const result = await Appointment.updateMany(filter, {
    $set: {
      'callback.doneAt': new Date(),
      'callback.doneBy': new Types.ObjectId(actor._id),
      'callback.doneByName': user?.name ?? 'Staff',
    },
  });

  if (result.modifiedCount > 0) {
    void recordActivity({
      userId: actor._id,
      action: 'appointment.informed',
      entity: 'Appointment',
      summary: `Marked ${result.modifiedCount} patient(s) as informed of a cancelled appointment`,
    });
  }
  return { informed: result.modifiedCount };
};

export const AppointmentServices = {
  createAppointment,
  getAvailability,
  getAppointments,
  getAppointment,
  checkIn: (id: string, actor: TActor) => transition(id, 'check_in', actor),
  /** Cancelling outright is an admin decision; the desk asks with requestCancel. */
  cancel: (id: string, reason: string, actor: TActor, refund?: boolean) => {
    if (actor.role !== 'admin') {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Only an admin can cancel an appointment directly. Request cancellation instead.'
      );
    }
    return transition(id, 'cancel', actor, reason, undefined, refund);
  },
  requestCancel,
  approveCancel,
  rejectCancel,
  acknowledgeOutcomes,
  markInformed,
  markNoShow: (id: string, actor: TActor) => transition(id, 'no_show', actor),
  complete: (id: string, actor: TActor) => transition(id, 'complete', actor),
};
