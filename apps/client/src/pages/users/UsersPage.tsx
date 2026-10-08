import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import { toast } from 'sonner';
import ConfirmModal from '@/components/common/ConfirmModal';
import type { ConfirmRequest } from '@/components/common/ConfirmModal';
import ErrorState from '@/components/common/ErrorState';
import StatusBadge from '@/components/common/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import DetailRow from '@/components/ui/DetailRow';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import PageHero from '@/components/ui/PageHero';
import Pagination from '@/components/ui/Pagination';
import { useT } from '@/i18n/useLanguage';
import Panel from '@/components/ui/Panel';
import RoleBadge from '@/components/ui/RoleBadge';
import Select from '@/components/ui/Select';
import { apiErrorMessage } from '@/lib/format';
import { useDeleteUserMutation, useGetUsersQuery, useUpdateUserMutation } from '@/services/userApi';
import type { User } from '@/services/userApi';
import { useAppSelector } from '@/hooks/store';
import type { UserRole } from '@/lib/token';

const iconAction = (bg: string, fg: string, enabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 0,
    borderRadius: 'var(--radius-sm)',
    background: bg,
    color: fg,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'var(--transition-control)',
});

const UsersPage = () => {
    const currentUser = useAppSelector((state) => state.auth.user);
    const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
    const [page, setPage] = useState(1);
    const t = useT();
    const [viewing, setViewing] = useState<User | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useGetUsersQuery({ page, limit: 20 });
    const [deleteUser] = useDeleteUserMutation();
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

    // You never administer your own account from this table.
    const allUsers = data?.users;
    const ownId = currentUser?._id;
    const users = useMemo(() => {
        if (!allUsers || !ownId) return allUsers ?? [];
        return allUsers.filter((user) => user._id !== ownId);
    }, [allUsers, ownId]);

    if (isLoading) return <Loader fullScreen message={t('ld.users')} />;

    if (isError || !data) {
        return <ErrorState title={t('err.users')} description={t('err.network')} onRetry={refetch} />;
    }

    const handleDelete = (userId: string, userName: string, role: UserRole) =>
        setConfirmRequest({
            title: `Delete user "${userName}"?`,
            description:
                role === 'doctor'
                    ? 'Their doctor profile goes with them. Past schedules and appointments stay on record, and it is refused while they still have pending or approved schedules.'
                    : 'This action cannot be undone.',
            confirmLabel: 'Delete user',
            onConfirm: async () => {
                try {
                    await deleteUser(userId).unwrap();
                    refetch();
                } catch (error) {
                    toast.error(apiErrorMessage(error, 'Failed to delete user. Please try again.'));
                }
            },
        });

    const handleRoleChange = async (userId: string, userName: string, newRole: UserRole) => {
        try {
            setUpdatingUserId(userId);
            await updateUser({ id: userId, data: { role: newRole } }).unwrap();
            refetch();
        } catch (error) {
            toast.error(apiErrorMessage(error, `Failed to update role for ${userName}. Please try again.`));
        } finally {
            setUpdatingUserId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
    const showing = users.length;

    return (
        <>
            <PageHero
                eyebrow="Administration"
                title={t('users.title')}
                description={t('users.subtitle')}
            />

            <Panel padding="0">
                <DataTable<User & { id: string }>
                    minWidth="60rem"
                    empty={t('empty.users')}
                    rows={users.map((user) => ({ ...user, id: user._id }))}
                    columns={[
                        {
                            key: 'sn',
                            header: 'S/N',
                            render: (user) => (
                                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{users.findIndex((u) => u._id === user._id) + 1}</span>
                            ),
                        },
                        {
                            key: 'name',
                            header: t('col.user'),
                            render: (user) => (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Avatar name={user.name} solid />
                                    <div>
                                        <p style={{ fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>{user.name}</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                            ID: {user._id.slice(-6)}
                                        </p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'email', header: 'Email' },
                        {
                            key: 'mobileNumber',
                            header: t('col.mobile'),
                            render: (user) => <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{user.mobileNumber}</span>,
                        },
                        {
                            key: 'role',
                            header: t('col.role'),
                            render: (user) => (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <RoleBadge role={user.role} />
                                    <Select
                                        size="sm"
                                        value={user.role}
                                        disabled={user.role === 'admin' || user.role === 'doctor' || isUpdating || updatingUserId === user._id}
                                        onChange={(e) => handleRoleChange(user._id, user.name, e.target.value as UserRole)}
                                        options={
                                            user.role === 'doctor'
                                                ? [{ label: 'Doctor', value: 'doctor' }]
                                                : [
                                                      { label: 'Admin', value: 'admin' },
                                                      { label: 'Receptionist', value: 'receptionist' },
                                                  ]
                                        }
                                        style={{ width: 138 }}
                                    />
                                </div>
                            ),
                        },
                        { key: 'status', header: t('col.status'), render: (user) => <StatusBadge status={user.status} /> },
                        {
                            key: 'createdAt',
                            header: t('col.created'),
                            render: (user) => (
                                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {user.createdAt ? dayjs(user.createdAt).format('D MMM YYYY') : '—'}
                                </span>
                            ),
                        },
                        {
                            key: 'actions',
                            header: t('col.actions'),
                            align: 'right',
                            render: (user) => (
                                <span style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setViewing(user)}
                                        title={t('ttl.viewUser')}
                                        style={iconAction('var(--brand-light)', 'var(--brand-dark)', true)}
                                    >
                                        <Icon name="eye" size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={user.role === 'admin'}
                                        title={user.role === 'admin' ? 'Cannot delete another admin' : 'Delete user'}
                                        onClick={() => handleDelete(user._id, user.name, user.role)}
                                        style={iconAction('var(--danger-bg)', 'var(--danger-strong)', user.role !== 'admin')}
                                    >
                                        <Icon name="trash-2" size={16} />
                                    </button>
                                </span>
                            ),
                        },
                    ]}
                />
            </Panel>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Showing {showing} of {data.total} users (excluding you)
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} style={{ flex: 1, minWidth: 260, justifyContent: 'flex-end' }} />
            </div>

            <Modal
                open={Boolean(viewing)}
                onClose={() => setViewing(null)}
                title={t('users.details')}
                width={680}
                footer={<Button onClick={() => setViewing(null)}>Close</Button>}
            >
                {viewing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 12,
                                paddingBottom: 20,
                                borderBottom: '1px solid var(--border-subtle)',
                            }}
                        >
                            <Avatar name={viewing.name} size="xl" solid />
                            <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-heading)' }}>{viewing.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <StatusBadge status={viewing.status} />
                                <RoleBadge role={viewing.role} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%),1fr))', gap: 12 }}>
                            <DetailRow icon="user-round" label={t('pform.fullName')} value={viewing.name} />
                            <DetailRow icon="mail" label={t('fld.emailAddress')} value={viewing.email} />
                            <DetailRow icon="phone" label={t('fld.mobileNumber')} value={viewing.mobileNumber} />
                            <DetailRow icon="shield-check" label={t('fld.accountRole')} value={viewing.role} />
                            <DetailRow
                                icon="calendar"
                                label={t('fld.memberSince')}
                                value={viewing.createdAt ? dayjs(viewing.createdAt).format('D MMM YYYY') : '—'}
                            />
                            <DetailRow
                                icon="clock"
                                label={t('fld.lastUpdated')}
                                value={viewing.updatedAt ? dayjs(viewing.updatedAt).format('D MMM YYYY') : '—'}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />
        </>
    );
};

export default UsersPage;
