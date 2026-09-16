import { type TUserRole } from '../User/user.interface';
import { type TReferrer } from './referrer.interface';

/** Fields a receptionist must never receive — they encode the commercial terms. */
const FINANCIAL_FIELDS = [
  'defaultDiscountPercent',
  'defaultCommissionType',
  'defaultCommissionValue',
] as const;

type TPlainReferrer = Record<string, unknown>;

const toPlain = (referrer: TReferrer): TPlainReferrer =>
  typeof (referrer as { toObject?: () => TPlainReferrer }).toObject ===
  'function'
    ? (referrer as unknown as { toObject: () => TPlainReferrer }).toObject()
    : ({ ...referrer } as TPlainReferrer);

/**
 * A receptionist picks a referrer when booking but must not see the discount or
 * commission rates attached to them (proposal §4.2, §5).
 */
export const serializeReferrer = (
  referrer: TReferrer,
  role: TUserRole
): TPlainReferrer => {
  const plain = toPlain(referrer);
  if (role === 'admin') return plain;

  for (const field of FINANCIAL_FIELDS) {
    delete plain[field];
  }
  return plain;
};

export const serializeReferrers = (
  referrers: TReferrer[],
  role: TUserRole
): TPlainReferrer[] =>
  referrers.map((referrer) => serializeReferrer(referrer, role));
