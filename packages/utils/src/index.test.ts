import {
  CENTRE_TIMEZONE,
  parseDhakaDate,
  dhakaDateParts,
  toDhakaDateInput,
} from './index';

describe('CENTRE_TIMEZONE', () => {
  it('is the Asia/Dhaka IANA identifier', () => {
    expect(CENTRE_TIMEZONE).toBe('Asia/Dhaka');
  });

  it('is a valid IANA timezone accepted by Intl.DateTimeFormat', () => {
    expect(() => new Intl.DateTimeFormat('en', { timeZone: CENTRE_TIMEZONE })).not.toThrow();
  });
});

describe('parseDhakaDate', () => {
  it('returns a Date instance', () => {
    expect(parseDhakaDate('2024-01-15')).toBeInstanceOf(Date);
  });

  it('parses YYYY-MM-DD as midnight in Dhaka (+06:00)', () => {
    // Dhaka midnight 2024-01-15 00:00 +06:00 = UTC 2024-01-14 18:00:00
    const result = parseDhakaDate('2024-01-15');
    expect(result.toISOString()).toBe('2024-01-14T18:00:00.000Z');
  });

  it('handles month boundary correctly', () => {
    const result = parseDhakaDate('2024-03-01');
    expect(result.toISOString()).toBe('2024-02-29T18:00:00.000Z'); // 2024 is a leap year
  });
});

describe('dhakaDateParts', () => {
  it('returns dd, mm, yy, yyyy for a date fully within a Dhaka day', () => {
    // UTC 2024-06-15 06:00 = Dhaka 2024-06-15 12:00
    const date = new Date('2024-06-15T06:00:00Z');
    const { dd, mm, yy, yyyy } = dhakaDateParts(date);
    expect(yyyy).toBe('2024');
    expect(mm).toBe('06');
    expect(dd).toBe('15');
    expect(yy).toBe('24');
  });

  it('advances to the next Dhaka day when UTC time crosses 18:00', () => {
    // UTC 2024-06-15 20:00 = Dhaka 2024-06-16 02:00
    const date = new Date('2024-06-15T20:00:00Z');
    const { yyyy, mm, dd } = dhakaDateParts(date);
    expect(yyyy).toBe('2024');
    expect(mm).toBe('06');
    expect(dd).toBe('16');
  });

  it('handles year rollover', () => {
    // UTC 2023-12-31 20:00 = Dhaka 2024-01-01 02:00
    const date = new Date('2023-12-31T20:00:00Z');
    const { yyyy, mm, dd } = dhakaDateParts(date);
    expect(yyyy).toBe('2024');
    expect(mm).toBe('01');
    expect(dd).toBe('01');
  });

  it('zero-pads single-digit month and day', () => {
    // UTC 2024-01-05 06:00 = Dhaka 2024-01-05 12:00
    const date = new Date('2024-01-05T06:00:00Z');
    const { mm, dd } = dhakaDateParts(date);
    expect(mm).toBe('01');
    expect(dd).toBe('05');
  });

  it('defaults to current date when called without arguments', () => {
    const { dd, mm, yy, yyyy } = dhakaDateParts();
    expect(yyyy).toMatch(/^\d{4}$/);
    expect(mm).toMatch(/^\d{2}$/);
    expect(dd).toMatch(/^\d{2}$/);
    expect(yy).toMatch(/^\d{2}$/);
  });
});

describe('toDhakaDateInput', () => {
  it('returns a string matching YYYY-MM-DD format', () => {
    expect(toDhakaDateInput(new Date('2024-06-15T06:00:00Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  it('returns the correct Dhaka calendar day', () => {
    // UTC 2024-06-15 06:00 = Dhaka 2024-06-15 12:00
    expect(toDhakaDateInput(new Date('2024-06-15T06:00:00Z'))).toBe('2024-06-15');
  });

  it('reflects the timezone shift: UTC 20:00 belongs to next Dhaka day', () => {
    // UTC 2024-06-14 20:00 = Dhaka 2024-06-15 02:00
    expect(toDhakaDateInput(new Date('2024-06-14T20:00:00Z'))).toBe('2024-06-15');
  });

  it('is consistent with dhakaDateParts output', () => {
    const date = new Date('2024-09-20T10:00:00Z');
    const { yyyy, mm, dd } = dhakaDateParts(date);
    expect(toDhakaDateInput(date)).toBe(`${yyyy}-${mm}-${dd}`);
  });

  it('defaults to current date when called without arguments', () => {
    expect(toDhakaDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
