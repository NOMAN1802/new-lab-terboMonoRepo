import {
  allowedFrom,
  canApply,
  canReschedule,
  holdsSlot,
  resultOf,
  slotState,
} from './appointment.rules';

describe('appointment status rules', () => {
  it('only checks in a booked appointment', () => {
    expect(canApply('booked', 'check_in')).toBe(true);
    expect(canApply('checked_in', 'check_in')).toBe(false);
    expect(canApply('cancelled', 'check_in')).toBe(false);
  });

  it('cancels until the doctor has seen the patient', () => {
    expect(canApply('booked', 'cancel')).toBe(true);
    expect(canApply('checked_in', 'cancel')).toBe(true);
    expect(canApply('completed', 'cancel')).toBe(false);
    expect(canApply('no_show', 'cancel')).toBe(false);
    expect(canApply('cancelled', 'cancel')).toBe(false);
  });

  it('completes only a patient who has been checked in', () => {
    expect(canApply('checked_in', 'complete')).toBe(true);
    expect(canApply('booked', 'complete')).toBe(false);
  });

  it('marks no-show only on a still-booked appointment', () => {
    expect(canApply('booked', 'no_show')).toBe(true);
    expect(canApply('checked_in', 'no_show')).toBe(false);
  });

  it('exposes the same sources the atomic update filters on', () => {
    expect(allowedFrom('cancel')).toEqual(['booked', 'checked_in']);
  });

  it('maps each action to its resulting status', () => {
    expect(resultOf('check_in')).toBe('checked_in');
    expect(resultOf('cancel')).toBe('cancelled');
    expect(resultOf('no_show')).toBe('no_show');
    expect(resultOf('complete')).toBe('completed');
  });
});

describe('holdsSlot', () => {
  it('releases the slot only when cancelled', () => {
    expect(holdsSlot('cancelled')).toBe(false);
    expect(holdsSlot('booked')).toBe(true);
    expect(holdsSlot('checked_in')).toBe(true);
    expect(holdsSlot('completed')).toBe(true);
    expect(holdsSlot('no_show')).toBe(true);
  });
});

describe('slotState', () => {
  const now = new Date('2026-10-20T04:00:00Z');

  it('reports a slot with an appointment as taken, even in the past', () => {
    expect(slotState({ end: new Date('2026-10-20T03:00:00Z') }, true, now)).toBe(
      'taken'
    );
  });

  it('reports an unbooked slot that has ended as past', () => {
    expect(slotState({ end: new Date('2026-10-20T03:59:00Z') }, false, now)).toBe(
      'past'
    );
    expect(slotState({ end: now }, false, now)).toBe('past');
  });

  it('reports a slot the doctor has blocked as blocked, ahead or past', () => {
    expect(slotState({ end: new Date('2026-10-20T04:15:00Z') }, false, now, true)).toBe(
      'blocked'
    );
    expect(slotState({ end: new Date('2026-10-20T03:00:00Z') }, false, now, true)).toBe(
      'blocked'
    );
  });

  it('still reports a booked slot as taken even if it is also marked blocked', () => {
    expect(slotState({ end: new Date('2026-10-20T04:15:00Z') }, true, now, true)).toBe(
      'taken'
    );
  });

  it('reports an unbooked slot still ahead as free', () => {
    expect(slotState({ end: new Date('2026-10-20T04:15:00Z') }, false, now)).toBe(
      'free'
    );
  });
});

describe('canReschedule', () => {
  it('moves only a patient who has not arrived yet', () => {
    expect(canReschedule('booked')).toBe(true);
    expect(canReschedule('checked_in')).toBe(false);
    expect(canReschedule('completed')).toBe(false);
    expect(canReschedule('cancelled')).toBe(false);
    expect(canReschedule('no_show')).toBe(false);
  });
});
