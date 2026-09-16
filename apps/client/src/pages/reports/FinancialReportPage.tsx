import { useState } from 'react';
import DateRangePicker from '@/components/common/DateRangePicker';
import { rangeForDays } from '@/lib/dateRange';
import ErrorState from '@/components/common/ErrorState';
import ExportButtons from '@/components/common/ExportButtons';
import Loader from '@/components/common/Loader';
import StatCard from '@/components/common/StatCard';
import AreaTrendChart from '@/components/ui/AreaTrendChart';
import DataTable from '@/components/ui/DataTable';
import GaugeMeter from '@/components/ui/GaugeMeter';
import Panel from '@/components/ui/Panel';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { money } from '@/lib/format';
import { useT } from '@/i18n/useLanguage';
import { useGetCollectionByUserReportQuery, useGetFinancialSummaryQuery, useGetRevenueReportQuery } from '@/services/reportsApi';
import type { UserCollectionRow } from '@/services/dashboardApi';
import type { TranslationKey } from '@/i18n/translations';

type GroupBy = 'daily' | 'monthly' | 'yearly';

const GROUP_KEYS: { key: TranslationKey; value: GroupBy }[] = [
    { key: 'ctrl.daily', value: 'daily' },
    { key: 'ctrl.monthly', value: 'monthly' },
    { key: 'ctrl.yearly', value: 'yearly' },
];

const compactMoney = (value: number) => `৳${Math.round(value / 1000)}K`;

const FinancialReportPage = () => {
    const [range, setRange] = useState(rangeForDays(29));
    const t = useT();
    const [groupBy, setGroupBy] = useState<GroupBy>('daily');

    const summaryQuery = useGetFinancialSummaryQuery(range);
    const revenueQuery = useGetRevenueReportQuery({ ...range, groupBy });
    const collectionQuery = useGetCollectionByUserReportQuery(range);

    const isLoading = summaryQuery.isLoading || revenueQuery.isLoading || collectionQuery.isLoading;
    const isError = summaryQuery.isError || revenueQuery.isError;

    const summary = summaryQuery.data;
    const series = revenueQuery.data?.series ?? [];
    const collections = collectionQuery.data?.rows ?? [];

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>{t('rep.financialTitle')}</h2>
                    <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', maxWidth: 620 }}>
                        {t('rep.financialSub')}
                    </p>
                </div>
                <ExportButtons
                    title={t('rep.revenue')}
                    subtitle={`${range.startDate} to ${range.endDate}`}
                    filename={`revenue-${range.startDate}-to-${range.endDate}`}
                    columns={[
                        { header: 'Period', accessor: (row: { _id: string }) => row._id },
                        { header: 'Collected (BDT)', accessor: (row: { collected: number }) => row.collected },
                        { header: t('col.receipts'), accessor: (row: { receipts: number }) => row.receipts },
                    ]}
                    rows={series}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <DateRangePicker value={range} onChange={setRange} />
                <SegmentedControl options={GROUP_KEYS.map((group) => ({ label: t(group.key), value: group.value }))} value={groupBy} onChange={(value) => setGroupBy(value as GroupBy)} />
            </div>

            {isLoading ? (
                <Loader message={t('ld.financial')} />
            ) : isError || !summary ? (
                <ErrorState
                    title={t('err.financial')}
                    onRetry={() => {
                        summaryQuery.refetch();
                        revenueQuery.refetch();
                    }}
                />
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <StatCard label={t('dash.cashCollected')} value={money(summary.cashCollected)} icon="banknote" accent="accent" />
                        <StatCard
                            label={t('rep.netBilled')}
                            value={money(summary.netBilled)}
                            icon="receipt-text"
                            caption={`${summary.invoiceCount} invoices`}
                        />
                        <StatCard label={t('rep.outstanding')} value={money(summary.outstanding)} icon="triangle-alert" accent="danger" />
                        <StatCard label={t('rep.commissionAccrued')} value={money(summary.commissionAccrued)} icon="user-round-search" accent="warning" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <StatCard label={t('rep.grossBilled')} value={money(summary.grossBilled)} accent="neutral" />
                        <StatCard
                            label={t('rep.discountsGiven')}
                            value={money(summary.discountGiven)}
                            accent="neutral"
                            trend={{ value: summary.discountRate, isPositive: false, label: 'of gross' }}
                        />
                        <StatCard label={t('rep.invoicesCount')} value={summary.invoiceCount} accent="neutral" />
                        <StatCard
                            label={t('rep.revenue')}
                            value={money(summary.revenue)}
                            accent="accent"
                            caption={t('rep.revenueCaption')}
                        />
                    </div>

                    <Panel title={`Cash collected, ${groupBy}`} subtitle={t('ttl.groupedDhaka')}>
                        {series.length === 0 ? (
                            <p style={{ padding: '48px 0', textAlign: 'center', fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>
                                {t('jsx.noPaymentsPeriod')}
                            </p>
                        ) : (
                            <AreaTrendChart
                                data={series.map((point) => ({ label: point._id, value: point.collected }))}
                                height={260}
                                valueFormat={(v) => compactMoney(Number(v))}
                            />
                        )}
                    </Panel>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%),1fr))', gap: 'var(--gap-grid)' }}>
                        <Panel title={t('rep.collectionByStaff')}>
                            <DataTable<UserCollectionRow & { id: string }>
                                dense
                                minWidth="24rem"
                                empty={t('empty.cash')}
                                rows={collections.map((row) => ({ ...row, id: row._id }))}
                                columns={[
                                    { key: 'name', header: 'Staff' },
                                    { key: 'receipts', header: t('col.receipts'), align: 'right' },
                                    {
                                        key: 'collected',
                                        header: t('col.collected'),
                                        align: 'right',
                                        render: (row) => <span style={{ color: 'var(--success-strong)', fontWeight: 600 }}>{money(row.collected)}</span>,
                                    },
                                ]}
                            />
                        </Panel>

                        <Panel title={t('dash.collectionRate')}>
                            <GaugeMeter value={summary.collectionRate} size={200} caption="of net billed, this period" />
                        </Panel>
                    </div>
                </>
            )}
        </>
    );
};

export default FinancialReportPage;
