import {
  CENTRE_TIMEZONE,
  parseDhakaDate,
  dhakaDateParts,
} from '@repo/utils';

// Re-export shared constants so callers that imported from here still compile.
export { CENTRE_TIMEZONE, parseDhakaDate, dhakaDateParts };

const OFFSET_MINUTES = 6 * 60;
const MS_PER_MINUTE = 60_000;

export const startOfDhakaDay = (date: Date): Date => {
  const shifted = new Date(date.getTime() + OFFSET_MINUTES * MS_PER_MINUTE);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - OFFSET_MINUTES * MS_PER_MINUTE);
};

export const endOfDhakaDay = (date: Date): Date => {
  const start = startOfDhakaDay(date);
  return new Date(start.getTime() + 24 * 60 * MS_PER_MINUTE);
};

export type TDateRange = { start?: Date; end?: Date };

export const resolveDateRange = (query: {
  date?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}): TDateRange => {
  if (typeof query.date === 'string' && query.date) {
    const day = parseDhakaDate(query.date);
    return { start: startOfDhakaDay(day), end: endOfDhakaDay(day) };
  }

  const range: TDateRange = {};

  if (typeof query.startDate === 'string' && query.startDate) {
    range.start = startOfDhakaDay(parseDhakaDate(query.startDate));
  }
  if (typeof query.endDate === 'string' && query.endDate) {
    // Inclusive of the whole end day.
    range.end = endOfDhakaDay(parseDhakaDate(query.endDate));
  }

  return range;
};

export const dateRangeFilter = (
  field: string,
  range: TDateRange
): Record<string, unknown> => {
  if (!range.start && !range.end) return {};

  const bounds: Record<string, Date> = {};
  if (range.start) bounds.$gte = range.start;
  if (range.end) bounds.$lt = range.end;

  return { [field]: bounds };
};

export const GROUP_FORMATS = {
  daily: '%Y-%m-%d',
  monthly: '%Y-%m',
  yearly: '%Y',
} as const;

export type TGroupBy = keyof typeof GROUP_FORMATS;

export const groupByExpression = (groupBy: TGroupBy, field: string) => ({
  $dateToString: {
    format: GROUP_FORMATS[groupBy],
    date: `$${field}`,
    timezone: CENTRE_TIMEZONE,
  },
});
