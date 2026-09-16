import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import StatusBadge from '@/components/common/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import DetailRow from '@/components/ui/DetailRow';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import InlineAlert from '@/components/ui/InlineAlert';
import Modal from '@/components/ui/Modal';
import PageHero from '@/components/ui/PageHero';
import Pagination from '@/components/ui/Pagination';
import { useT } from '@/i18n/useLanguage';
import Panel from '@/components/ui/Panel';
import RoleBadge from '@/components/ui/RoleBadge';
import Select from '@/components/ui/Select';
import TextField from '@/components/ui/TextField';
import { apiErrorMessage } from '@/lib/format';
import { useCreateUserMutation, useDeleteUserMutation, useGetUsersQuery, useUpdateUserMutation } from '@/services/userApi';
import type { CreateUserInput, User } from '@/services/userApi';
import { useAppSelector } from '@/hooks/store';
import type { UserRole } from '@/lib/token';

const EMPTY_FORM: CreateUserInput = {
    name: '',
    email: '',
    mobileNumber: '',
    password: '',
    role: 'receptionist',
};

const ROLE_OPTIONS = [
    { label: 'Receptionist', value: 'receptionist' },
    { label: 'Admin', value: 'admin' },
];

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

/** Label with a small brand-tinted glyph, as the design system's forms use. */
const legend = (icon: IconName, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} size={15} color="var(--brand)" />
        {text}
    </span>
);

const UsersPage = () => {
    const currentUser = useAppSelector((state) => state.auth.user);
    const [page, setPage] = useState(1);
    const t = useT();
    const [viewing, setViewing] = useState<User | null>(null);
    const [isAddOpen, setAddOpen] = useState(false);
    const [formData, setFormData] = useState<CreateUserInput>(EMPTY_FORM);
    const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useGetUsersQuery({ page, limit: 20 });
    const [deleteUser] = useDeleteUserMutation();
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [createUser, { isLoading: isCreating }] = useCreateUserMutation();

    // You never administer your own account from this table.
    const users = useMemo(() => {
        if (!data?.users || !currentUser?._id) return data?.users ?? [];
        return data.users.filter((user) => user._id !== currentUser._id);
    }, [data?.users, currentUser?._id]);

    if (isLoading) return <Loader fullScreen message={t('ld.users')} />;

    if (isError || !data) {
        return <ErrorState title={t('err.users')} description={t('err.network')} onRetry={refetch} />;
    }

    const handleDelete = async (userId: string, userName: string) => {
        if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) return;
        try {
            await deleteUser(userId).unwrap();
            refetch();
        } catch (error) {
            window.alert(apiErrorMessage(error, 'Failed to delete user. Please try again.'));
        }
    };

    const handleRoleChange = async (userId: string, userName: string, newRole: UserRole) => {
        try {
            setUpdatingUserId(userId);
            await updateUser({ id: userId, data: { role: newRole } }).unwrap();
            refetch();
        } catch (error) {
            window.alert(apiErrorMessage(error, `Failed to update role for ${userName}. Please try again.`));
        } finally {
            setUpdatingUserId(null);
        }
    };

    const openAdd = () => {
        setFormData(EMPTY_FORM);
        setResult(null);
        setAddOpen(true);
    };

    const setField = (key: keyof CreateUserInput) => (event: { target: { value: string } }) => {
        setFormData((current) => ({ ...current, [key]: event.target.value }));
        setResult(null);
    };

    const handleCreateUser = async () => {
        if (!formData.name.trim()) return setResult({ tone: 'error', text: 'Name is required.' });
        if (!formData.mobileNumber.trim()) return setResult({ tone: 'error', text: 'Mobile number is required.' });
        if (formData.password.trim().length < 6) {
            return setResult({ tone: 'error', text: 'Password must be at least 6 characters.' });
        }

        try {
            await createUser(formData).unwrap();
            setResult({ tone: 'success', text: 'User created.' });
            refetch();
            setTimeout(() => setAddOpen(false), 1200);
        } catch (error) {
            setResult({ tone: 'error', text: apiErrorMessage(error, 'Failed to create user. Please try again.') });
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
                action={
                    <button
                        type="button"
                        onClick={openAdd}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            height: 44,
                            padding: '0 22px',
                            border: '1px solid rgba(255,255,255,.28)',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(255,255,255,.14)',
                            color: '#fff',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition-control)',
                        }}
                    >
                        <Icon name="plus" size={18} />
                        {t('jsx.addUser')}
                    </button>
                }
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
                                        disabled={user.role === 'admin' || isUpdating || updatingUserId === user._id}
                                        onChange={(e) => handleRoleChange(user._id, user.name, e.target.value as UserRole)}
                                        options={[
                                            { label: 'Admin', value: 'admin' },
                                            { label: 'Receptionist', value: 'receptionist' },
                                        ]}
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
                                        onClick={() => handleDelete(user._id, user.name)}
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

            <Modal
                open={isAddOpen}
                onClose={() => setAddOpen(false)}
                title={t('ttl.addUser')}
                subtitle={t('ttl.createAccount')}
                width={640}
                footer={
                    <>
                        <Button variant="secondary" icon="x" disabled={isCreating} onClick={() => setAddOpen(false)}>
                            {t('ctrl.cancel')}
                        </Button>
                        <Button icon="check" loading={isCreating} onClick={handleCreateUser}>
                            {isCreating ? 'Creating...' : 'Create user'}
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {result && (
                        <InlineAlert tone={result.tone} onDismiss={() => setResult(null)}>
                            {result.text}
                        </InlineAlert>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%),1fr))', gap: 18 }}>
                        <TextField label={legend('user-round', 'Full name')} value={formData.name} onChange={setField('name')} placeholder={t('ph.fullName')} />
                        <TextField
                            label={legend('phone', 'Mobile number')}
                            type="tel"
                            value={formData.mobileNumber}
                            onChange={setField('mobileNumber')}
                            placeholder="01XXXXXXXXX"
                        />
                    </div>
                    <TextField
                        label={legend('mail', 'Email address')}
                        type="email"
                        value={formData.email}
                        onChange={setField('email')}
                        placeholder="you@example.com"
                    />
                    <TextField
                        label={legend('key-round', 'Password')}
                        type="password"
                        value={formData.password}
                        onChange={setField('password')}
                        placeholder={t('ph.min6')}
                        hint={t('hint.userPassword')}
                    />
                    <Select
                        label={legend('shield-check', 'Role')}
                        value={formData.role}
                        onChange={setField('role')}
                        options={ROLE_OPTIONS}
                        hint={t('hint.role')}
                    />
                </div>
            </Modal>
        </>
    );
};

export default UsersPage;
