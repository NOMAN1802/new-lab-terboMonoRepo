import httpStatus from 'http-status';
import { type FilterQuery, Types } from 'mongoose';
import { parseDhakaDate, toDhakaDateInput } from '@repo/utils';
import AppError from '../../errors/AppError';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { Appointment } from '../Appointment/appointment.model';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { Doctor } from '../Doctor/doctor.model';
import { DoctorServices } from '../Doctor/doctor.service';
import { type TMedicine, type TPrescription } from './prescription.interface';
import { Prescription } from './prescription.model';

type TActor = { _id: string; role: string };

type TSaveInput = {
  complaints?: string;
  diagnosis?: string;
  medicines: TMedicine[];
  investigations: string[];
  advice?: string;
  followUpDate?: string | null;
};

const DUPLICATE_KEY = 11000;

/** RX-YYMMDD-001, numbered per visit day so the counter stays short. */
const buildNumber = (dateInput: string, seq: number): string =>
  formatDocNumber(`RX-${dateInput.slice(2).replace(/-/g, '')}`, seq, 3);

/** Loads an appointment the actor is allowed to see, or 404s as if it were absent. */
const loadVisit = async (appointmentId: string, actor: TActor) => {
  if (!Types.ObjectId.isValid(appointmentId)) {
    throw new AppError(httpStatus.NOT_FOUND, 'Appointment not found');
  }
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Appointment not found');
  }
  const ownDoctor = await DoctorServices.getDoctorIdForActor(actor);
  if (ownDoctor && !ownDoctor.equals(appointment.doctor)) {
    throw new AppError(httpStatus.NOT_FOUND, 'Appointment not found');
  }
  return appointment;
};

const toDate = (value?: string | null): Date | undefined =>
  value ? parseDhakaDate(value) : undefined;

/**
 * Writes or rewrites the prescription for a visit. Only the doctor the visit
 * belongs to can, and only once the patient has been called in. Saving again
 * replaces the earlier text and keeps the same number.
 */
const savePrescription = async (
  appointmentId: string,
  input: TSaveInput,
  actor: TActor
) => {
  const appointment = await loadVisit(appointmentId, actor);

  if (appointment.status !== 'checked_in' && appointment.status !== 'completed') {
    throw new AppError(
      httpStatus.CONFLICT,
      appointment.status === 'booked'
        ? 'Call the patient in before writing a prescription'
        : `A prescription cannot be written for an appointment that is ${appointment.status.replace('_', ' ')}`
    );
  }

  const doctor = await Doctor.findById(appointment.doctor);
  if (!doctor) throw new AppError(httpStatus.NOT_FOUND, 'Doctor not found');

  const fields = {
    complaints: input.complaints || undefined,
    diagnosis: input.diagnosis || undefined,
    medicines: input.medicines,
    investigations: input.investigations,
    advice: input.advice || undefined,
    followUpDate: toDate(input.followUpDate),
  };

  const existing = await Prescription.findOne({ appointment: appointment._id });

  let prescription;
  if (existing) {
    existing.set(fields);
    // Unsetting needs an explicit undefined on a Mongoose document.
    if (!fields.followUpDate) existing.followUpDate = undefined;
    prescription = await existing.save();
  } else {
    const dateInput = toDhakaDateInput(appointment.date);
    const seq = await nextSequence(`prescription:${dateInput}`);
    try {
      prescription = await Prescription.create({
        prescriptionNumber: buildNumber(dateInput, seq),
        appointment: appointment._id,
        doctor: appointment.doctor,
        patient: appointment.patient,
        patientInfo: {
          patientId: appointment.patientInfo.patientId,
          name: appointment.patientInfo.name,
          age: appointment.patientInfo.age,
          gender: appointment.patientInfo.gender,
          phone: appointment.patientInfo.phone,
        },
        doctorInfo: {
          doctorCode: doctor.doctorCode,
          name: doctor.name,
          specialty: doctor.specialty,
          degrees: doctor.degrees,
        },
        visitDate: appointment.date,
        ...fields,
        createdBy: new Types.ObjectId(actor._id),
      });
    } catch (error) {
      // Two saves raced to write the first one; the unique index let one win.
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        throw new AppError(
          httpStatus.CONFLICT,
          'A prescription was just saved for this visit. Reload and edit it.'
        );
      }
      throw error;
    }

    await Appointment.updateOne(
      { _id: appointment._id },
      {
        $set: {
          prescription: prescription._id,
          prescriptionNumber: prescription.prescriptionNumber,
        },
      }
    );
  }

  void recordActivity({
    userId: actor._id,
    action: 'prescription.saved',
    entity: 'Prescription',
    entityId: prescription._id,
    entityLabel: prescription.prescriptionNumber,
    summary: `${existing ? 'Updated' : 'Wrote'} prescription for ${appointment.patientInfo.name}`,
  });

  return prescription;
};

/** The prescription for a visit, or null when none has been written yet. */
const getByAppointment = async (appointmentId: string, actor: TActor) => {
  const appointment = await loadVisit(appointmentId, actor);
  return Prescription.findOne({ appointment: appointment._id });
};

const getPrescription = async (id: string, actor: TActor) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.NOT_FOUND, 'Prescription not found');
  }
  const prescription = await Prescription.findById(id);
  if (!prescription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Prescription not found');
  }
  const ownDoctor = await DoctorServices.getDoctorIdForActor(actor);
  if (ownDoctor && !ownDoctor.equals(prescription.doctor)) {
    throw new AppError(httpStatus.NOT_FOUND, 'Prescription not found');
  }
  return prescription;
};

/** A patient history, newest visit first. A doctor sees only their own. */
const getPrescriptions = async (
  query: Record<string, unknown>,
  actor: TActor
) => {
  const filter: FilterQuery<TPrescription> = {};
  if (typeof query.patient === 'string' && Types.ObjectId.isValid(query.patient)) {
    filter.patient = new Types.ObjectId(query.patient);
  }

  const ownDoctor = await DoctorServices.getDoctorIdForActor(actor);
  if (ownDoctor) {
    filter.doctor = ownDoctor;
  } else if (typeof query.doctor === 'string' && Types.ObjectId.isValid(query.doctor)) {
    filter.doctor = new Types.ObjectId(query.doctor);
  }

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const page = Math.max(Number(query.page) || 1, 1);

  const [result, total] = await Promise.all([
    Prescription.find(filter)
      .sort({ visitDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Prescription.countDocuments(filter),
  ]);

  return { meta: { total, page, limit }, result };
};

export const PrescriptionServices = {
  savePrescription,
  getByAppointment,
  getPrescription,
  getPrescriptions,
};
