import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PersistedAuth, TokenPayload } from '@/lib/token';
import { clearAuthState, decodeToken, loadAuthState, persistAuthState } from '@/lib/token';

type AuthState = PersistedAuth & {
    initializing: boolean;
};

const persisted = loadAuthState();

const initialState: AuthState = {
    accessToken: persisted?.accessToken ?? null,
    refreshToken: persisted?.refreshToken ?? null,
    user: persisted?.user ?? decodeToken(persisted?.accessToken ?? null),
    initializing: true,
};

const persist = (state: AuthState) => {
    persistAuthState({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
    });
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{
                accessToken: string;
                refreshToken?: string;
                user?: TokenPayload | null;
            }>
        ) => {
            state.accessToken = action.payload.accessToken;
            if (action.payload.refreshToken) {
                state.refreshToken = action.payload.refreshToken;
            }
            state.user =
                action.payload.user ?? decodeToken(action.payload.accessToken);
            persist(state);
        },
        setRefreshToken: (state, action: PayloadAction<string | null>) => {
            state.refreshToken = action.payload;
            persist(state);
        },
        setUser: (state, action: PayloadAction<TokenPayload | null>) => {
            state.user = action.payload;
            persist(state);
        },
        setInitializing: (state, action: PayloadAction<boolean>) => {
            state.initializing = action.payload;
        },
        logout: (state) => {
            state.accessToken = null;
            state.refreshToken = null;
            state.user = null;
            clearAuthState();
        },
    },
});

export const {
    setCredentials,
    setRefreshToken,
    setUser,
    setInitializing,
    logout,
} = authSlice.actions;

export default authSlice.reducer;

