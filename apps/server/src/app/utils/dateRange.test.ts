import {
  startOfDhakaDay,
  endOfDhakaDay,
  resolveDateRange,
  dateRangeFilter,
  groupByExpression,
} from './dateRange';

describe('startOfDhakaDay', () => {
  it('returns midnight Dhaka time as a UTC Date', () => {
    // Dhaka midnight 2024-06-15 00:00 +06:00 = UTC 2024-06-14 18:00:00
    const input = new Date('2024-06-15T06:00:00Z'); // Dhaka 2024-06-15 12:00
    const result = startOfDhakaDay(input);
    expect(result.toISOString()).toBe('2024-06-14T18:00:00.000Z');
  });

  it('handles a date given after Dhaka midnight (UTC 20:00 = Dhaka 02:00 next day)', () => {
    // UTC 2024-06-15 20:00 = Dhaka 2024-06-16 02:00 → start of Dhaka 2024-06-16
    const input = new Date('2024-06-15T20:00:00Z');
    const result = startOfDhakaDay(input);
    expect(result.toISOString()).toBe('2024-06-15T18:00:00.000Z');
  });
});

describe('endOfDhakaDay', () => {
  it('is exactly 24 hours after the start of the same Dhaka day', () => {
    const input = new Date('2024-06-15T06:00:00Z');
    const start = startOfDhakaDay(input);
    const end = endOfDhakaDay(input);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('points to the start of the next Dhaka day', () => {
    // Dhaka 2024-06-15 → end should be 2024-06-15T18:00:00Z (= Dhaka 2024-06-16 00:00)
    const input = new Date('2024-06-15T06:00:00Z');
    expect(endOfDhakaDay(input).toISOString()).toBe('2024-06-15T18:00:00.000Z');
  });
});

describe('resolveDateRange', () => {
  it('returns start and end for a single date query', () => {
    const range = resolveDateRange({ date: '2024-06-15' });
    expect(range.start).toBeDefined();
    expect(range.end).toBeDefined();
    // start = Dhaka midnight 2024-06-15 = UTC 2024-06-14 18:00
    expect(range.start!.toISOString()).toBe('2024-06-14T18:00:00.000Z');
    // end = 24h later
    expect(range.end!.toISOString()).toBe('2024-06-15T18:00:00.000Z');
  });

  it('returns start only when only startDate is provided', () => {
    const range = resolveDateRange({ startDate: '2024-06-01' });
    expect(range.start).toBeDefined();
    expect(range.end).toBeUndefined();
  });

  it('returns end only when only endDate is provided', () => {
    const range = resolveDateRange({ endDate: '2024-06-30' });
    expect(range.start).toBeUndefined();
    expect(range.end).toBeDefined();
  });

  it('returns both bounds for a startDate + endDate range', () => {
    const range = resolveDateRange({ startDate: '2024-06-01', endDate: '2024-06-30' });
    expect(range.start).toBeDefined();
    expect(range.end).toBeDefined();
  });

  it('returns empty range when no query params are provided', () => {
    const range = resolveDateRange({});
    expect(range.start).toBeUndefined();
    expect(range.end).toBeUndefined();
  });

  it('ignores startDate/endDate when date is present', () => {
    const range = resolveDateRange({
      date: '2024-06-15',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
    });
    expect(range.start!.toISOString()).toBe('2024-06-14T18:00:00.000Z');
    expect(range.end!.toISOString()).toBe('2024-06-15T18:00:00.000Z');
  });
});

describe('dateRangeFilter', () => {
  it('returns an empty object when range has no bounds', () => {
    expect(dateRangeFilter('createdAt', {})).toEqual({});
  });

  it('builds a $gte/$lt filter with both bounds', () => {
    const start = new Date('2024-06-14T18:00:00.000Z');
    const end = new Date('2024-06-15T18:00:00.000Z');
    const filter = dateRangeFilter('createdAt', { start, end });
    expect(filter).toEqual({ createdAt: { $gte: start, $lt: end } });
  });

  it('builds a $gte-only filter when end is absent', () => {
    const start = new Date('2024-06-14T18:00:00.000Z');
    const filter = dateRangeFilter('createdAt', { start });
    expect(filter).toEqual({ createdAt: { $gte: start } });
  });

  it('builds a $lt-only filter when start is absent', () => {
    const end = new Date('2024-06-15T18:00:00.000Z');
    const filter = dateRangeFilter('createdAt', { end });
    expect(filter).toEqual({ createdAt: { $lt: end } });
  });
});

describe('groupByExpression', () => {
  it('produces a daily format expression', () => {
    const expr = groupByExpression('daily', 'createdAt');
    expect(expr).toEqual({
      $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Dhaka' },
    });
  });

  it('produces a monthly format expression', () => {
    const expr = groupByExpression('monthly', 'createdAt');
    expect(expr.$dateToString.format).toBe('%Y-%m');
  });

  it('produces a yearly format expression', () => {
    const expr = groupByExpression('yearly', 'createdAt');
    expect(expr.$dateToString.format).toBe('%Y');
  });
});
