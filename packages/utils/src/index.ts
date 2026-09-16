// The centre operates in Bangladesh (UTC+6, no DST). Every date formatted for
// display or sent as an API param must be bounded on Dhaka calendar days.
export const CENTRE_TIMEZONE = 'Asia/Dhaka';

// Parses a YYYY-MM-DD string as a Dhaka calendar day.
export const parseDhakaDate = (value: string): Date =>
  new Date(`${value}T00:00:00+06:00`);

// Two-digit day, month and year for the Dhaka calendar day of `date`.
export const dhakaDateParts = (
  date: Date = new Date()
): { dd: string; mm: string; yy: string; yyyy: string } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTRE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const yyyy = get('year');
  return { dd: get('day'), mm: get('month'), yy: yyyy.slice(-2), yyyy };
};

// YYYY-MM-DD in Dhaka time — for date inputs and API range params.
export const toDhakaDateInput = (value: Date = new Date()): string => {
  const { yyyy, mm, dd } = dhakaDateParts(value);
  return `${yyyy}-${mm}-${dd}`;
};
