import {
  money,
  percent,
  commissionBasis,
  formatDate,
  formatDateTime,
  apiErrorMessage,
} from './format';

describe('money', () => {
  it('returns em-dash for undefined', () => {
    expect(money(undefined)).toBe('—');
  });

  it('returns em-dash for null', () => {
    expect(money(null)).toBe('—');
  });

  it('formats a positive number with BDT taka sign', () => {
    const result = money(1000);
    expect(result).toContain('৳');
    expect(result).toContain('1,000.00');
  });

  it('formats zero', () => {
    expect(money(0)).toContain('0.00');
  });
});

describe('percent', () => {
  it('returns em-dash for undefined', () => {
    expect(percent(undefined)).toBe('—');
  });

  it('returns em-dash for null', () => {
    expect(percent(null)).toBe('—');
  });

  it('appends a percent sign', () => {
    expect(percent(15)).toBe('15%');
  });

  it('handles zero', () => {
    expect(percent(0)).toBe('0%');
  });
});

describe('commissionBasis', () => {
  it('returns em-dash when value is undefined', () => {
    expect(commissionBasis('percent', undefined)).toBe('—');
  });

  it('returns em-dash when value is null', () => {
    expect(commissionBasis('fixed', null)).toBe('—');
  });

  it('formats a percent commission', () => {
    expect(commissionBasis('percent', 10)).toBe('10% of paid');
  });

  it('formats a fixed commission with flat prefix', () => {
    const result = commissionBasis('fixed', 500);
    expect(result).toMatch(/^flat ৳/);
  });

  it('defaults to percent format when type is null', () => {
    expect(commissionBasis(null, 5)).toBe('5% of paid');
  });
});

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a date string in en-GB locale within Dhaka timezone', () => {
    // UTC 2024-06-15 06:00 = Dhaka 2024-06-15 12:00 → "15 Jun 2024"
    const result = formatDate('2024-06-15T06:00:00Z');
    expect(result).toContain('2024');
    expect(result).toMatch(/Jun/i);
    expect(result).toContain('15');
  });

  it('accepts a Date object', () => {
    const result = formatDate(new Date('2024-01-01T06:00:00Z'));
    expect(result).toContain('2024');
  });
});

describe('formatDateTime', () => {
  it('returns em-dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('includes time in the output', () => {
    const result = formatDateTime('2024-06-15T06:00:00Z');
    // Dhaka time is 12:00 — should contain hour and minute
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('apiErrorMessage', () => {
  it('returns the fallback when error is undefined', () => {
    expect(apiErrorMessage(undefined)).toBe('Something went wrong');
  });

  it('returns a custom fallback when provided', () => {
    expect(apiErrorMessage(undefined, 'Custom error')).toBe('Custom error');
  });

  it('extracts the message from a structured API error', () => {
    const error = { data: { message: 'Not found' } };
    expect(apiErrorMessage(error)).toBe('Not found');
  });

  it('falls back when data is present but message is missing', () => {
    const error = { data: {} };
    expect(apiErrorMessage(error)).toBe('Something went wrong');
  });
});
