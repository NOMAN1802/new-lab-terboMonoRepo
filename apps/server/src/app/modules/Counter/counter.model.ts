import { type ClientSession, Schema, model } from 'mongoose';

type TCounter = {
  _id: string;
  seq: number;
};

const CounterSchema = new Schema<TCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model<TCounter>('Counter', CounterSchema);

/**
 * Atomically reserves the next number in a named sequence.
 *
 * Counting documents to derive the next number (the previous approach) both
 * races under concurrent bookings and re-issues numbers after a delete —
 * neither is acceptable for invoice or receipt numbers, which must be unique
 * and gapless-by-intent for audit.
 */
export const nextSequence = async (
  key: string,
  session?: ClientSession
): Promise<number> => {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return counter!.seq;
};

/** e.g. formatDocNumber('INV', 42) -> 'INV-000042' */
export const formatDocNumber = (prefix: string, seq: number, width = 6): string =>
  `${prefix}-${String(seq).padStart(width, '0')}`;
