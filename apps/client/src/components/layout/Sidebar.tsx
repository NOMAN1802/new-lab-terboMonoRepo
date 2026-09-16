import { Fragment, useState } from 'react';
import type { CSSProperties } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/store';
import { useRole } from '@/hooks/useRole';
import { useT } from '@/i18n/useLanguage';
import type { TranslationKey } from '@/i18n/translations';
import { useUnpaidInvoices } from '@/hooks/useUnpaidInvoices';
import { logout } from '@/features/auth/authSlice';
import { CENTRE } from '@/lib/centre';
import type { UserRole } from '@/lib/token';
import Icon from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import BrandLogo from '@/components/brand/BrandLogo';
import BrandMark from '@/components/brand/BrandMark';

type NavChild = { key: TranslationKey; to: string; roles?: UserRole[] };

type NavItem = {
    key: TranslationKey;
    to: string;
    icon: IconName;
    /** Omit to show for every role. */
    roles?: UserRole[];
    children?: NavChild[];
};

const NAVIGATION: NavItem[] = [
    { key: 'nav.dashboard', to: '/', icon: 'layout-dashboard' },
    { key: 'nav.patients', to: '/patients', icon: 'users' },
    {
        key: 'nav.billing',
        to: '/billing',
        icon: 'credit-card',
        children: [
            { key: 'nav.newBooking', to: '/billing/new' },
            { key: 'nav.allInvoices', to: '/billing' },
        ],
    },
    { key: 'nav.reportDelivery', to: '/patient-reports', icon: 'file-text' },
    {
        key: 'nav.catalogue',
        to: '/tests',
        icon: 'flask-conical',
        children: [
            { key: 'nav.tests', to: '/tests' },
            { key: 'nav.departments', to: '/departments', roles: ['admin'] },
        ],
    },
    { key: 'nav.referrers', to: '/referrers', icon: 'user-round-search', roles: ['admin'] },
    { key: 'nav.commission', to: '/commission', icon: 'banknote', roles: ['admin'] },
    {
        key: 'nav.reports',
        to: '/reports/patients',
        icon: 'chart-column',
        children: [
            { key: 'nav.patientReport', to: '/reports/patients' },
            { key: 'nav.financialSummary', to: '/reports/financial', roles: ['admin'] },
            { key: 'nav.referralCommission', to: '/reports/commission', roles: ['admin'] },
            { key: 'nav.outstandingPayments', to: '/reports/dues', roles: ['admin'] },
        ],
    },
    { key: 'nav.users', to: '/users', icon: 'shield-check', roles: ['admin'] },
    { key: 'nav.activity', to: '/activity', icon: 'clock', roles: ['admin'] },
    { key: 'nav.settings', to: '/settings', icon: 'settings', roles: ['admin'] },
];

const visibleTo = (role: UserRole | undefined, roles?: UserRole[]) => !roles || (role !== undefined && roles.includes(role));

type ItemProps = {
    name: string;
    icon?: IconName;
    active: boolean;
    collapsed?: boolean;
    indent?: boolean;
    hasChildren?: boolean;
    /** Rendered as a pill on the right, e.g. the unpaid-invoice count. */
    count?: number;
    onClick: () => void;
};

const Item = ({ name, icon, active, collapsed = false, indent = false, hasChildren = false, count, onClick }: ItemProps) => {
    const [hover, setHover] = useState(false);

    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            title={collapsed ? name : undefined}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                width: '100%',
                padding: indent ? '8px 12px 8px 14px' : '9px 12px',
                border: 0,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-13)',
                fontWeight: (active ? 'var(--fw-semibold)' : 'var(--fw-medium)') as CSSProperties['fontWeight'],
                background: active ? 'var(--brand-light)' : hover ? 'var(--surface-muted)' : 'transparent',
                color: active ? 'var(--brand-dark)' : hover ? 'var(--text-heading)' : 'var(--text-muted)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'var(--transition-control)',
                position: 'relative',
            }}
        >
            {active && !indent && (
                <span
                    style={{
                        position: 'absolute',
                        left: '-12px',
                        top: '9px',
                        bottom: '9px',
                        width: '3px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--brand)',
                    }}
                />
            )}
            {icon && <Icon name={icon} size={18} strokeWidth={active ? 2 : 1.75} />}
            {!collapsed && <span style={{ flex: 1 }}>{name}</span>}
            {!collapsed && count !== undefined && count > 0 && (
                <span
                    style={{
                        padding: '1px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: active ? 'rgba(255,255,255,.6)' : 'var(--surface-sunken)',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-11)',
                        fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                    }}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
            {!collapsed && hasChildren && <Icon name="chevron-down" size={15} />}
        </button>
    );
};

/**
 * The centre's logo heads the sidebar. Collapsed to the rail only the mark
 * fits; open, the full wordmark, which follows the language toggle.
 */
const Brand = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '18px 0' : '18px 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            minWidth: 0,
        }}
    >
        {collapsed ? <BrandMark size={40} title={CENTRE.name} /> : <BrandLogo size="sm" />}
    </div>
);

const HelpCard = () => {
    const t = useT();
    return (
    <div
        style={{
            background: 'var(--brand)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
        }}
    >
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'rgba(255,255,255,.18)',
            }}
        >
            <Icon name="life-buoy" size={16} />
        </span>
        <p style={{ fontSize: 13, fontWeight: 700 }}>{t('shell.needHand')}</p>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,.8)' }}>
            {t('shell.helpBody')}
        </p>
        {CENTRE.handbookUrl && (
            <a
                href={CENTRE.handbookUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 4,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--paper)',
                    color: 'var(--brand-dark)',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                }}
            >
                {t('shell.openHandbook')}
            </a>
        )}
    </div>
    );
};

type NavListProps = {
    collapsed?: boolean;
    onNavigate?: () => void;
};

const NavList = ({ collapsed = false, onNavigate }: NavListProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { role } = useRole();
    const { total: unpaidCount } = useUnpaidInvoices();

    const items = NAVIGATION.filter((item) => visibleTo(role, item.roles));

    /** The group owning the page you are on, if any. */
    const routeGroup = items.find((item) => item.children?.some((child) => child.to === location.pathname))?.key ?? null;

    /**
     * Which group is open is the user's to decide, so this is the only source
     * of truth. Arriving on a page opens its group, but from then on a click
     * wins — otherwise a group could never be collapsed while you were looking
     * at one of its own pages.
     */
    const t = useT();
    const [openGroup, setOpenGroup] = useState<string | null>(routeGroup);
    const [openedFor, setOpenedFor] = useState(location.pathname);

    if (openedFor !== location.pathname) {
        setOpenedFor(location.pathname);
        setOpenGroup(routeGroup);
    }

    const go = (to: string) => {
        navigate(to);
        onNavigate?.();
    };

    return (
        <nav
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '4px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
            }}
        >
            {items.map((item) => {
                const children = item.children?.filter((child) => visibleTo(role, child.roles));
                const childActive = Boolean(children?.some((child) => child.to === location.pathname));
                const isOpen = !collapsed && Boolean(children?.length) && openGroup === item.key;
                const active = item.to === location.pathname || (childActive && !isOpen);

                return (
                    <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <Item
                            name={t(item.key)}
                            icon={item.icon}
                            active={active}
                            collapsed={collapsed}
                            count={item.key === 'nav.billing' ? unpaidCount : undefined}
                            hasChildren={Boolean(children?.length)}
                            onClick={() => (children?.length && !collapsed ? setOpenGroup(isOpen ? null : item.key) : go(item.to))}
                        />
                        {isOpen && children && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    margin: '2px 0 4px 15px',
                                    paddingLeft: '12px',
                                    borderLeft: '1px solid var(--border-subtle)',
                                }}
                            >
                                {children.map((child) => (
                                    <Item
                                        key={child.to}
                                        name={t(child.key)}
                                        active={child.to === location.pathname}
                                        indent
                                        onClick={() => go(child.to)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
};

type SidebarProps = {
    open: boolean;
    onClose: () => void;
};

const Sidebar = ({ open, onClose }: SidebarProps) => {
    const t = useT();
    const [collapsed, setCollapsed] = useState(false);
    const dispatch = useAppDispatch();

    const signOut = () => dispatch(logout());

    const surface: CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--border-card)',
    };

    return (
        <>
            {/* Desktop */}
            <aside
                className="only-desktop"
                style={{
                    ...surface,
                    width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
                    flex: '0 0 auto',
                    height: '100vh',
                    position: 'sticky',
                    top: 0,
                    transition: 'width var(--dur-slow) var(--ease-standard)',
                }}
            >
                <Brand collapsed={collapsed} />
                <NavList collapsed={collapsed} />

                <div style={{ padding: collapsed ? '12px 8px' : 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!collapsed && <HelpCard />}
                    <Button
                        variant="ghost"
                        icon="log-out"
                        block
                        onClick={signOut}
                        style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                    >
                        {!collapsed && t('shell.signOut')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={collapsed ? 'chevron-right' : 'chevron-left'}
                        block
                        aria-label={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
                        onClick={() => setCollapsed((value) => !value)}
                    />
                </div>
            </aside>

            {/* Mobile */}
            <Transition show={open} as={Fragment}>
                <Dialog onClose={onClose} className="relative z-50 lg:hidden">
                    <Transition.Child
                        as={Fragment}
                        enter="transition-opacity ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0" style={{ background: 'rgba(38,33,25,.48)', backdropFilter: 'blur(3px)' }} />
                    </Transition.Child>

                    <Transition.Child
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="-translate-x-full"
                        enterTo="translate-x-0"
                        leave="transition ease-in duration-150"
                        leaveFrom="translate-x-0"
                        leaveTo="-translate-x-full"
                    >
                        <Dialog.Panel
                            className="fixed inset-y-0 left-0"
                            style={{ ...surface, width: 'var(--sidebar-w)', boxShadow: 'var(--shadow-pop)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }}>
                                <Brand />
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label={t('shell.closeMenu')}
                                    style={{
                                        display: 'flex',
                                        border: 0,
                                        background: 'transparent',
                                        padding: 8,
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-faint)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Icon name="x" size={20} />
                                </button>
                            </div>

                            <NavList onNavigate={onClose} />

                            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <HelpCard />
                                <Button variant="ghost" icon="log-out" block onClick={signOut} style={{ justifyContent: 'flex-start' }}>
                                    {t('shell.signOut')}
                                </Button>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </Dialog>
            </Transition>
        </>
    );
};

export default Sidebar;
