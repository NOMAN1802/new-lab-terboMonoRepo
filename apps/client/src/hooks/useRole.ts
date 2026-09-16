import { useAppSelector } from '@/hooks/store';

/** Role helpers for conditionally rendering financial UI. */
export const useRole = () => {
    const role = useAppSelector((state) => state.auth.user?.role);
    return {
        role,
        isAdmin: role === 'admin',
        isReceptionist: role === 'receptionist',
    };
};
