const AUTH_STORAGE_KEY = 'newlab-auth-state';

export type UserRole = 'admin' | 'receptionist';

export type TokenPayload = {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    profileImage?: string;
    iat?: number;
    exp?: number;
};

export type PersistedAuth = {
    accessToken: string | null;
    refreshToken: string | null;
    user: TokenPayload | null;
};

export const persistAuthState = (state: PersistedAuth) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
};

export const loadAuthState = (): PersistedAuth | null => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as PersistedAuth;
    } catch (error) {
        console.error('Failed to parse auth state', error);
        return null;
    }
};

export const clearAuthState = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const decodeToken = (token: string | null): TokenPayload | null => {
    if (!token) return null;
    try {
        const payload = atob(token.split('.')[1] ?? '');
        return JSON.parse(payload) as TokenPayload;
    } catch (error) {
        console.warn('Unable to decode token', error);
        return null;
    }
};

