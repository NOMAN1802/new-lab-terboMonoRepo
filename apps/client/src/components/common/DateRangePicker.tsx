import { useT } from '@/i18n/useLanguage';
import type { CSSProperties } from 'react';
import Icon from '@/components/ui/Icon';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { toDhakaDateInput } from '@/lib/format';
import { rangeForDays } from '@/lib/dateRange';
import type { DateRange } from '@/lib/dateRange';

const PRESETS = [
    { key: 'ctrl.today' as const, value: '0' },
    { key: 'ctrl.7days' as const, value: '6' },
    { key: 'ctrl.30days' as const, value: '29' },
    { key: 'ctrl.90days' as const, value: '89' },
    { key: 'ctrl.1year' as const, value: '364' },
];

const dateBox: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    height: 'var(--control-h)',
    padding: '0 var(--space-3)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-xs)',
    fontSize: 'var(--text-13)',
    color: 'var(--text-body)',
    fontFamily: 'var(--font-sans)',
};

const bareInput: CSSProperties = {
    border: 0,
    outline: 'none',
    background: 'transparent',
    font: 'inherit',
    color: 'inherit',
};

type DateRangePickerProps = {
    value: DateRange;
    onChange: (range: DateRange) => void;
};

/** Preset row plus an explicit from/to pair. Every report screen starts with this. */
const DateRangePicker = ({ value, onChange }: DateRangePickerProps) => {
    const t = useT();
    const today = toDhakaDateInput();

    // The active preset is derived, not stored: whichever preset reproduces the
    // current range wins, and a hand-edited range matches none of them.
    const activePreset =
        PRESETS.find((preset) => {
            const range = rangeForDays(Number(preset.value));
            return range.startDate === value.startDate && range.endDate === value.endDate;
        })?.value ?? '';

    return (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <SegmentedControl options={PRESETS.map((preset) => ({ label: t(preset.key), value: preset.value }))} value={activePreset} onChange={(days) => onChange(rangeForDays(Number(days)))} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
                <span style={dateBox}>
                    <Icon name="calendar" size={16} color="var(--text-faint)" />
                    <input
                        type="date"
                        aria-label={t('ctrl.fromDate')}
                        value={value.startDate}
                        max={value.endDate || today}
                        onChange={(e) => onChange({ ...value, startDate: e.target.value })}
                        style={bareInput}
                    />
                </span>
                <span style={{ fontSize: 'var(--text-13)', color: 'var(--text-faint)' }}>{t('ctrl.to')}</span>
                <span style={dateBox}>
                    <Icon name="calendar" size={16} color="var(--text-faint)" />
                    <input
                        type="date"
                        aria-label={t('ctrl.toDate')}
                        value={value.endDate}
                        min={value.startDate}
                        max={today}
                        onChange={(e) => onChange({ ...value, endDate: e.target.value })}
                        style={bareInput}
                    />
                </span>
            </span>
        </div>
    );
};

export default DateRangePicker;
