import { useState } from 'react';
import type { TranslationKey } from '@/i18n/translations';
import DateRangePicker from '@/components/common/DateRangePicker';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import ActionTag from '@/components/ui/ActionTag';
import DataTable from '@/components/ui/DataTable';
import Icon from '@/components/ui/Icon';
import Pagination from '@/components/ui/Pagination';
import { useT } from '@/i18n/useLanguage';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import TextField from '@/components/ui/TextField';
import { rangeForDays } from '@/lib/dateRange';
import { formatDateTime } from '@/lib/format';
import { useGetActivityByUserQuery, useGetActivityQuery } from '@/services/activityApi';
import type { ActivityEntry } from '@/services/activityApi';

const ACTION_FILTERS: { key: TranslationKey; value: string }[] = [
    { key: 'act.everything', value: '' },
    { key: 'act.payments', value: 'payment.recorded' },
    { key: 'act.voids', value: 'payment.voided' },
    { key: 'act.cancellations', value: 'invoice.cancelled' },
    { key: 'act.priceChanges', value: 'test.price_changed' },
];

const PAGE_SIZE = 30;

const ActivityPage = () => {
    const [range, setRange] = useState(rangeForDays(6));
    const [search, setSearch] = useState('');
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const t = useT();

    const { data, isLoading, isFetching, isError, refetch } = useGetActivityQuery({
        ...range,
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        action: action || undefined,
    });

    const { data: byUser = [] } = useGetActivityByUserQuery(range);

    const entries = data?.items ?? [];
    const total = data?.meta.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const resetTo = (fn: () => void) => {
        fn();
        setPage(1);
    };

    return (
        <>
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('act.title')}</h2>
                <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('act.subtitle')}
                </p>
            </div>

            <DateRangePicker value={range} onChange={(r) => resetTo(() => setRange(r))} />

            {byUser.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                    {byUser.slice(0, 4).map((row) => (
                        <StatCard
                            key={row._id}
                            label={`${row.name} · ${row.role}`}
                            value={row.events}
                            icon={row.role === 'admin' ? 'shield-check' : 'user-round'}
                            accent={row.role === 'admin' ? 'brand' : 'neutral'}
                            caption={`Last seen ${formatDateTime(row.lastSeen)}`}
                        />
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, maxWidth: 460 }}>
                    <TextField
                        icon="search"
                        type="search"
                        value={search}
                        onChange={(e) => resetTo(() => setSearch(e.target.value))}
                        placeholder={t('ph.searchActivity')}
                    />
                </div>
                <SegmentedControl options={ACTION_FILTERS.map((filter) => ({ label: t(filter.key), value: filter.value }))} value={action} onChange={(value) => resetTo(() => setAction(value))} />
            </div>

            {isLoading ? (
                <Loader message={t('ld.activity')} />
            ) : isError ? (
                <ErrorState title={t('err.activity')} onRetry={refetch} />
            ) : (
                <>
                    <Panel padding="0">
                        <DataTable<ActivityEntry & { id: string }>
                            minWidth="46rem"
                            empty={t('empty.activity')}
                            rows={entries.map((entry) => ({ ...entry, id: entry._id }))}
                            columns={[
                                {
                                    key: 'at',
                                    header: t('col.when'),
                                    render: (entry) => (
                                        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</span>
                                    ),
                                },
                                {
                                    key: 'actorName',
                                    header: t('col.who'),
                                    render: (entry) => (
                                        <div>
                                            <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{entry.actorName}</p>
                                            <p style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'capitalize', marginTop: 2 }}>
                                                {entry.actorRole}
                                            </p>
                                        </div>
                                    ),
                                },
                                { key: 'action', header: t('col.action'), render: (entry) => <ActionTag action={entry.action} /> },
                                { key: 'summary', header: t('col.detail') },
                            ]}
                        />
                    </Panel>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                            <Icon name="lock" size={14} />
                            {t('jsx.activityNote')}
                        </span>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            busy={isFetching}
                            onChange={setPage}
                            style={{ flex: 1, minWidth: 280, justifyContent: 'flex-end' }}
                        />
                    </div>
                </>
            )}
        </>
    );
};

export default ActivityPage;
