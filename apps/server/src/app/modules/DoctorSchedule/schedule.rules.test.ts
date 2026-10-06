import {
  canApply,
  countSlots,
  generateSlots,
  nextStatus,
  rangesOverlap,
  toMinutes,
} from './schedule.rules';

describe('toMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });
});

describe('countSlots', () => {
  it('fits whole slots into the window', () => {
    expect(
      countSlots({ startTime: '09:00', endTime: '12:00', slotMinutes: 15 })
    ).toBe(12);
  });

  it('drops a leftover shorter than one slot', () => {
    expect(
      countSlots({ startTime: '09:00', endTime: '09:50', slotMinutes: 20 })
    ).toBe(2);
  });

  it('is zero when the window is shorter than a slot or inverted', () => {
    expect(
      countSlots({ startTime: '09:00', endTime: '09:10', slotMinutes: 15 })
    ).toBe(0);
    expect(
      countSlots({ startTime: '12:00', endTime: '09:00', slotMinutes: 15 })
    ).toBe(0);
  });
});

describe('generateSlots', () => {
  const slots = generateSlots({
    date: '2026-10-20',
    startTime: '09:00',
    endTime: '10:00',
    slotMinutes: 20,
  });

  it('numbers slots in time order with serials starting at 1', () => {
    expect(slots.map((s) => [s.slotIndex, s.serialNo])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it('gives each slot back-to-back start and end times', () => {
    expect(slots.map((s) => `${s.startTime}-${s.endTime}`)).toEqual([
      '09:00-09:20',
      '09:20-09:40',
      '09:40-10:00',
    ]);
  });

  it('anchors instants to Dhaka time (UTC+6)', () => {
    expect(slots[0].start.toISOString()).toBe('2026-10-20T03:00:00.000Z');
    expect(slots[2].end.toISOString()).toBe('2026-10-20T04:00:00.000Z');
  });

  it('drops a trailing partial slot at the end of the day', () => {
    const late = generateSlots({
      date: '2026-10-20',
      startTime: '23:00',
      endTime: '23:59',
      slotMinutes: 30,
    });
    expect(late).toHaveLength(1);
    expect(late[0].endTime).toBe('23:30');
  });
});

describe('rangesOverlap', () => {
  const morning = { startTime: '09:00', endTime: '12:00' };

  it('detects partial and contained overlap', () => {
    expect(
      rangesOverlap(morning, { startTime: '11:00', endTime: '14:00' })
    ).toBe(true);
    expect(
      rangesOverlap(morning, { startTime: '10:00', endTime: '11:00' })
    ).toBe(true);
  });

  it('treats back-to-back windows as not overlapping', () => {
    expect(
      rangesOverlap(morning, { startTime: '12:00', endTime: '15:00' })
    ).toBe(false);
    expect(
      rangesOverlap(morning, { startTime: '06:00', endTime: '09:00' })
    ).toBe(false);
  });
});

describe('schedule status rules', () => {
  it('lets the doctor answer only a pending schedule', () => {
    expect(canApply('pending', 'approve')).toBe(true);
    expect(canApply('pending', 'decline')).toBe(true);
    expect(canApply('approved', 'approve')).toBe(false);
    expect(canApply('declined', 'approve')).toBe(false);
    expect(canApply('cancelled', 'decline')).toBe(false);
  });

  it('allows cancelling pending and approved, never a closed schedule', () => {
    expect(canApply('pending', 'cancel')).toBe(true);
    expect(canApply('approved', 'cancel')).toBe(true);
    expect(canApply('declined', 'cancel')).toBe(false);
    expect(canApply('cancelled', 'cancel')).toBe(false);
  });

  it('only allows editing a pending schedule', () => {
    expect(canApply('pending', 'edit')).toBe(true);
    expect(canApply('approved', 'edit')).toBe(false);
  });

  it('maps actions to resulting statuses', () => {
    expect(nextStatus('approve')).toBe('approved');
    expect(nextStatus('decline')).toBe('declined');
    expect(nextStatus('cancel')).toBe('cancelled');
  });
});
