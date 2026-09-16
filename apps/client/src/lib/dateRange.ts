import { toDhakaDateInput } from './format';

export type DateRange = { startDate: string; endDate: string };

/**
 * A range ending today, spanning `days` back. Boundaries are Dhaka calendar
 * days, matching how the API groups them.
 */
export const rangeForDays = (days: number): DateRange => {
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { startDate: toDhakaDateInput(start), endDate: toDhakaDateInput() };
};
