import { round2, sum, percentOf, isSettled } from './money';

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(1.005)).toBe(1.01);
  });

  it('leaves an already-rounded value unchanged', () => {
    expect(round2(10.5)).toBe(10.5);
  });

  it('handles zero', () => {
    expect(round2(0)).toBe(0);
  });

  it('rounds negative values', () => {
    expect(round2(-1.005)).toBe(-1);
  });

  it('handles floating-point imprecision via EPSILON', () => {
    // 1.1 + 2.2 in IEEE 754 is 3.3000000000000003
    expect(round2(1.1 + 2.2)).toBe(3.3);
  });
});

describe('sum', () => {
  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('returns the single element rounded', () => {
    expect(sum([1.005])).toBe(1.01);
  });

  it('sums multiple values and rounds', () => {
    expect(sum([10, 20, 30])).toBe(60);
  });

  it('handles floating-point imprecision', () => {
    expect(sum([0.1, 0.2])).toBe(0.3);
  });
});

describe('percentOf', () => {
  it('calculates a basic percentage', () => {
    expect(percentOf(200, 10)).toBe(20);
  });

  it('returns 0 for 0 percent', () => {
    expect(percentOf(500, 0)).toBe(0);
  });

  it('returns the full amount for 100 percent', () => {
    expect(percentOf(150, 100)).toBe(150);
  });

  it('rounds the result to two decimal places', () => {
    expect(percentOf(100, 33.33)).toBe(33.33);
  });
});

describe('isSettled', () => {
  it('treats 0 as settled', () => {
    expect(isSettled(0)).toBe(true);
  });

  it('treats negative due as settled', () => {
    expect(isSettled(-0.01)).toBe(true);
  });

  it('treats exactly 0.005 as settled (sub-paisa boundary)', () => {
    expect(isSettled(0.005)).toBe(true);
  });

  it('treats 0.006 as NOT settled', () => {
    expect(isSettled(0.006)).toBe(false);
  });

  it('treats a whole-paisa due as NOT settled', () => {
    expect(isSettled(0.01)).toBe(false);
  });
});
