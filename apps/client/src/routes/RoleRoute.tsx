import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/hooks/store';
import type { UserRole } from '@/lib/token';

type RoleRouteProps = {
    allow: UserRole[];
};

/**
 * Hides routes a role has no business opening. This is a navigation
 * convenience, not a security boundary — the API independently rejects and
 * field-strips every request, so a hand-typed URL gains nothing.
 */
const RoleRoute = ({ allow }: RoleRouteProps) => {
    const role = useAppSelector((state) => state.auth.user?.role);

    if (!role || !allow.includes(role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default RoleRoute;
