import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Loader from '@/components/common/Loader';
import { useAppSelector } from '@/hooks/store';

const ProtectedRoute = () => {
    const { accessToken, initializing } = useAppSelector((state) => state.auth);
    const location = useLocation();

    if (initializing) {
        return <Loader fullScreen message="Securing your workspace..." />;
    }

    if (!accessToken) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
};

export default ProtectedRoute;

