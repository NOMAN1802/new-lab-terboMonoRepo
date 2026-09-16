/**
 * All billing figures are BDT amounts held as Numbers. Every derived figure
 * must be rounded the same way, otherwise gross/discount/net stop reconciling
 * and a "paid" invoice can be left with a 0.004 due balance.
 */
export const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const sum = (values: number[]): number =>
  round2(values.reduce((total, value) => total + value, 0));

export const percentOf = (amount: number, percent: number): number =>
  round2((amount * percent) / 100);

/** Treat sub-paisa differences as settled. */
export const isSettled = (due: number): boolean => due <= 0.005;
