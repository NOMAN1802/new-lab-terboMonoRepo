import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { QueryBuilder } from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { dateRangeFilter, resolveDateRange } from '../../utils/dateRange';
import { recordActivity } from '../ActivityLog/activity-log.service';
import { formatDocNumber, nextSequence } from '../Counter/counter.model';
import { type TPatient } from './patient.interface';
import { Patient } from './patient.model';

const PatientSearchableFields = ['name', 'phone', 'patientId', 'address'];

const createPatient = async (
  payload: TPatient,
  userId: string
): Promise<TPatient> => {
  const seq = await nextSequence('patient');

  const patient = await Patient.create({
    ...payload,
    patientId: formatDocNumber('PT', seq),
    createdBy: new Types.ObjectId(userId),
  });

  await recordActivity({
    userId,
    action: 'patient.registered',
    entity: 'Patient',
    entityId: patient._id,
    entityLabel: patient.patientId,
    summary: `Registered patient ${patient.name} (${patient.patientId})`,
  });

  return patient;
};

const getPatients = async (query: Record<string, unknown>) => {
  const range = resolveDateRange(query);

  const baseQuery = Patient.find({
    isDeleted: false,
    ...dateRangeFilter('createdAt', range),
  });

  const patientQuery = new QueryBuilder(baseQuery, query)
    .search(PatientSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [patients, total] = await Promise.all([
    patientQuery.modelQuery,
    patientQuery.countTotal(),
  ]);

  return {
    meta: {
      total,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    },
    result: patients,
  };
};

const getPatient = async (id: string): Promise<TPatient> => {
  const patient = await Patient.findOne({ _id: id, isDeleted: false });
  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');
  return patient;
};

/**
 * Whitelist of client-editable fields. patientId is server-assigned and
 * permanent (it is printed on invoices), and createdBy/isDeleted are not the
 * caller's to set — an allow-list keeps new schema fields closed by default.
 */
const EDITABLE_FIELDS = [
  'name',
  'age',
  'gender',
  'phone',
  'address',
] as const satisfies readonly (keyof TPatient)[];

const updatePatient = async (
  id: string,
  payload: Partial<TPatient>
): Promise<TPatient> => {
  const updatable: Partial<TPatient> = {};
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] !== undefined) {
      Object.assign(updatable, { [field]: payload[field] });
    }
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: id, isDeleted: false },
    updatable,
    { new: true, runValidators: true }
  );

  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');
  return patient;
};

const deletePatient = async (id: string): Promise<void> => {
  const patient = await Patient.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!patient) throw new AppError(httpStatus.NOT_FOUND, 'Patient not found');
};

export const PatientServices = {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
};
