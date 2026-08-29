import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { apiFetch } from './api';

export interface User {
    id: string;
    email: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch<{ user: User }>('/api/auth/me')
            .then(data => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const data = await apiFetch<{ user: User }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setUser(data.user);
    }, []);

    const signup = useCallback(async (email: string, password: string) => {
        const data = await apiFetch<{ user: User }>('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        await apiFetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
    }, []);

    return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
