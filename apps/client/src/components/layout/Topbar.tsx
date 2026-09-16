import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { useRole } from '@/hooks/useRole';
import { logout } from '@/features/auth/authSlice';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { useT } from '@/i18n/useLanguage';
import type { TranslationKey } from '@/i18n/translations';
import GlobalSearch from './GlobalSearch';
import LanguageToggle from './LanguageToggle';
import NotificationBell from './NotificationBell';

type TopbarProps = {
    onMenuClick: () => void;
};

/** Longest paths first, so /billing/new wins over /billing. */
const PAGE_TITLES: [string, TranslationKey][] = [
    ['/patients/new', 'page.registerPatient'],
    ['/patients', 'page.patients'],
    ['/billing/new', 'page.newBooking'],
    ['/billing', 'page.invoices'],
    ['/patient-reports', 'page.reportDelivery'],
    ['/tests', 'page.testCatalogue'],
    ['/departments', 'page.departments'],
    ['/referrers', 'page.referrers'],
    ['/commission', 'page.commission'],
    ['/reports/patients', 'page.patientReport'],
    ['/reports/financial', 'page.financialSummary'],
    ['/reports/commission', 'page.referralCommission'],
    ['/reports/dues', 'page.outstandingPayments'],
    ['/reports', 'page.reports'],
    ['/activity', 'page.userActivity'],
    ['/users', 'page.userManagement'],
    ['/settings', 'page.settings'],
    ['/profile', 'page.profile'],
];

const titleKeyFor = (pathname: string): TranslationKey => {
    if (pathname === '/') return 'page.dashboard';
    const match = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
    return match ? match[1] : 'page.dashboard';
};

const iconBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    border: '1px solid var(--border-card)',
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-control)',
};

const menuItem = (active: boolean, danger = false): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    width: '100%',
    padding: '10px var(--space-4)',
    border: 0,
    background: active ? 'var(--surface-sunken)' : 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-13)',
    fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
    color: danger ? 'var(--danger-strong)' : 'var(--text-body)',
    textAlign: 'left',
});

/** Sticky app header: page title and the user chip. */
const Topbar = ({ onMenuClick }: TopbarProps) => {
    const user = useAppSelector((state) => state.auth.user);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAdmin } = useRole();
    const t = useT();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    const entries: [string, IconName, () => void][] = [
        [t('shell.profile'), 'user-round', () => navigate('/profile')],
        ...(isAdmin ? ([[t('shell.settings'), 'settings', () => navigate('/settings')]] as [string, IconName, () => void][]) : []),
    ];

    return (
        <header
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-4) var(--space-6)',
                flexWrap: 'wrap',
                minHeight: 'var(--topbar-h)',
                padding: 'var(--space-3) var(--pad-page-x)',
                background: 'var(--surface-card)',
                borderBottom: '1px solid var(--border-card)',
                position: 'sticky',
                top: 0,
                zIndex: 40,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1, minWidth: 0 }}>
                <button type="button" onClick={onMenuClick} aria-label={t('shell.openMenu')} className="only-mobile" style={iconBtn}>
                    <Icon name="menu" size={18} />
                </button>
                <h1
                    style={{
                        font: 'var(--type-page-title)',
                        color: 'var(--text-heading)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: '0 1 auto',
                    }}
                >
                    {t(titleKeyFor(location.pathname))}
                </h1>
                <GlobalSearch />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                <LanguageToggle />
                <NotificationBell />
                <Menu as="div" style={{ position: 'relative' }}>
                    <Menu.Button
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: '4px 10px 4px 4px',
                            border: '1px solid var(--border-card)',
                            background: 'var(--surface-card)',
                            borderRadius: 'var(--radius-pill)',
                            cursor: 'pointer',
                            transition: 'var(--transition-control)',
                        }}
                    >
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: 'var(--brand-light)',
                                color: 'var(--brand-dark)',
                                fontSize: 'var(--text-13)',
                                fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                            }}
                        >
                            {user?.name?.[0]?.toUpperCase() ?? 'U'}
                        </span>
                        <span
                            className="hidden lg:block"
                            style={{
                                fontSize: 'var(--text-13)',
                                fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                color: 'var(--text-body)',
                            }}
                        >
                            {user?.name ?? 'User'}
                        </span>
                        <Icon name="chevron-down" size={15} color="var(--text-faint)" />
                    </Menu.Button>

                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-150"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(100% + 8px)',
                                width: '224px',
                                maxWidth: 'calc(100vw - 24px)',
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-card)',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-pop)',
                                overflow: 'hidden',
                                zIndex: 50,
                                outline: 'none',
                            }}
                        >
                            <div
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    background: 'var(--surface-sunken)',
                                    borderBottom: '1px solid var(--border-card)',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 'var(--text-13)',
                                        fontWeight: 'var(--fw-bold)' as CSSProperties['fontWeight'],
                                        color: 'var(--text-heading)',
                                    }}
                                >
                                    {user?.name ?? 'User'}
                                </p>
                                <p
                                    style={{
                                        fontSize: 'var(--text-12)',
                                        color: 'var(--text-muted)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {user?.email}
                                </p>
                                <p style={{ fontSize: 'var(--text-11)', color: 'var(--text-faint)', textTransform: 'capitalize', marginTop: '2px' }}>
                                    {user?.role}
                                </p>
                            </div>

                            {entries.map(([label, icon, action]) => (
                                <Menu.Item key={label}>
                                    {({ active }) => (
                                        <button type="button" onClick={action} style={menuItem(active)}>
                                            <Icon name={icon} size={16} />
                                            {label}
                                        </button>
                                    )}
                                </Menu.Item>
                            ))}

                            <Menu.Item>
                                {({ active }) => (
                                    <button type="button" onClick={handleLogout} style={menuItem(active, true)}>
                                        <Icon name="log-out" size={16} />
                                        {t('shell.signOut')}
                                    </button>
                                )}
                            </Menu.Item>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>
        </header>
    );
};

export default Topbar;
