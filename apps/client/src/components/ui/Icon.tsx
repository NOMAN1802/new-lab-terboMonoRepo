import {
    Banknote,
    Bell,
    Building2,
    Calendar,
    ChartColumn,
    Check,
    CircleCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    ClipboardList,
    Clock,
    CreditCard,
    Download,
    Eye,
    EyeOff,
    FileText,
    FlaskConical,
    Globe,
    History,
    Hourglass,
    Info,
    KeyRound,
    Layers,
    LayoutDashboard,
    LifeBuoy,
    LoaderCircle,
    Lock,
    LogOut,
    Mail,
    Menu,
    MoreHorizontal,
    Pencil,
    Percent,
    Phone,
    Plus,
    PowerOff,
    Printer,
    ReceiptText,
    RotateCcw,
    Search,
    Settings,
    ShieldCheck,
    Trash2,
    TrendingDown,
    TrendingUp,
    TriangleAlert,
    Upload,
    UserRound,
    UserRoundPlus,
    UserRoundSearch,
    Users,
    X,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * Kebab-case icon names, exactly as the design system addresses them
 * (`<Icon name="chevron-down" />`). Registered explicitly so the bundle only
 * carries the glyphs the product actually draws.
 */
const REGISTRY = {
    banknote: Banknote,
    bell: Bell,
    'building-2': Building2,
    calendar: Calendar,
    'chart-column': ChartColumn,
    check: Check,
    'circle-check': CircleCheck,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'circle-alert': CircleAlert,
    'clipboard-list': ClipboardList,
    clock: Clock,
    'credit-card': CreditCard,
    download: Download,
    eye: Eye,
    'eye-off': EyeOff,
    'file-text': FileText,
    'flask-conical': FlaskConical,
    globe: Globe,
    history: History,
    hourglass: Hourglass,
    info: Info,
    'key-round': KeyRound,
    layers: Layers,
    'layout-dashboard': LayoutDashboard,
    'life-buoy': LifeBuoy,
    'loader-circle': LoaderCircle,
    lock: Lock,
    'log-out': LogOut,
    mail: Mail,
    menu: Menu,
    'more-horizontal': MoreHorizontal,
    pencil: Pencil,
    percent: Percent,
    phone: Phone,
    plus: Plus,
    'power-off': PowerOff,
    printer: Printer,
    'receipt-text': ReceiptText,
    'rotate-ccw': RotateCcw,
    search: Search,
    settings: Settings,
    'shield-check': ShieldCheck,
    'trash-2': Trash2,
    'trending-down': TrendingDown,
    'trending-up': TrendingUp,
    'triangle-alert': TriangleAlert,
    upload: Upload,
    'user-round': UserRound,
    'user-round-plus': UserRoundPlus,
    'user-round-search': UserRoundSearch,
    users: Users,
    x: X,
} as const;

export type IconName = keyof typeof REGISTRY;

type IconProps = {
    name: IconName;
    size?: number;
    strokeWidth?: number;
    color?: string;
    className?: string;
    style?: CSSProperties;
};

const Icon = ({ name, size = 20, strokeWidth = 1.75, color = 'currentColor', className, style }: IconProps) => {
    const Glyph = REGISTRY[name];
    if (!Glyph) return null;
    return (
        <Glyph
            width={size}
            height={size}
            strokeWidth={strokeWidth}
            color={color}
            className={className}
            aria-hidden="true"
            style={{ display: 'block', flex: '0 0 auto', ...style }}
        />
    );
};

export default Icon;
