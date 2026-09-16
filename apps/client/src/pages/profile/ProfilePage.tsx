import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import StatusBadge from '@/components/common/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import DetailRow from '@/components/ui/DetailRow';
import PageHero from '@/components/ui/PageHero';
import Panel from '@/components/ui/Panel';
import { useT } from '@/i18n/useLanguage';
import RoleBadge from '@/components/ui/RoleBadge';
import { useGetCurrentUserQuery } from '@/services/userApi';
import { useAppSelector } from '@/hooks/store';

const ProfilePage = () => {
    const { accessToken, initializing } = useAppSelector((state) => state.auth);
    const { data: user, isLoading, isError, refetch } = useGetCurrentUserQuery(undefined, {
        skip: !accessToken || initializing,
    });
    const navigate = useNavigate();
    const t = useT();

    if (isLoading) return <Loader fullScreen message={t('ld.profile')} />;

    if (isError || !user) {
        return <ErrorState title={t('err.profile')} description={t('err.network')} onRetry={refetch} />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-grid)' }}>
            <PageHero
                eyebrow="Account"
                title={t('prof.title')}
                description={t('prof.subtitle')}
            />

            <Panel>
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
                        <Avatar name={user.name} size="xl" solid />
                        <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-heading)' }}>{user.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusBadge status={user.status} />
                            <RoleBadge role={user.role} />
                        </div>
                        <Button variant="secondary" icon="pencil" onClick={() => navigate('/settings')}>
                            {t('prof.edit')}
                        </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%),1fr))', gap: 12 }}>
                        <DetailRow icon="user-round" label={t('pform.fullName')} value={user.name} />
                        <DetailRow icon="mail" label={t('fld.emailAddress')} value={user.email} />
                        <DetailRow icon="phone" label={t('fld.mobileNumber')} value={user.mobileNumber} />
                        <DetailRow icon="shield-check" label={t('fld.accountRole')} value={user.role} />
                        <DetailRow icon="calendar" label={t('fld.memberSince')} value={user.createdAt ? dayjs(user.createdAt).format('D MMM YYYY') : '—'} />
                        <DetailRow icon="clock" label={t('fld.lastUpdated')} value={user.updatedAt ? dayjs(user.updatedAt).format('D MMM YYYY') : '—'} />
                    </div>
                </div>
            </Panel>
        </div>
    );
};

export default ProfilePage;
