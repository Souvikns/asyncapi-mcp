import { Router } from 'express';

import {
    clearSessionCookie,
    createSession,
    deleteSession,
    hashPassword,
    isValidEmail,
    requireSession,
    setSessionCookie,
    verifyPassword,
} from '../auth.js';
import { pool } from '../db.js';

export const authRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

authRouter.post('/signup', async (req, res, next) => {
    try {
        const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

        if (!email || !isValidEmail(email)) {
            res.status(400).json({ error: 'A valid email address is required' });
            return;
        }
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const passwordHash = await hashPassword(password);

        let user: { id: string; email: string };
        try {
            const result = await pool.query(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
                [normalizedEmail, passwordHash]
            );
            user = result.rows[0];
        } catch (error) {
            if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
                res.status(409).json({ error: 'An account with this email already exists' });
                return;
            }
            throw error;
        }

        const session = await createSession(user.id);
        setSessionCookie(res, session.token, session.expiresAt);
        res.status(201).json({ user });
    } catch (error) {
        next(error);
    }
});

authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
            email.trim().toLowerCase(),
        ]);
        const user = result.rows[0] as { id: string; email: string; password_hash: string } | undefined;

        if (!user || !(await verifyPassword(password, user.password_hash))) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const session = await createSession(user.id);
        setSessionCookie(res, session.token, session.expiresAt);
        res.json({ user: { id: user.id, email: user.email } });
    } catch (error) {
        next(error);
    }
});

authRouter.post('/logout', requireSession, async (req, res, next) => {
    try {
        if (req.sessionToken) {
            await deleteSession(req.sessionToken);
        }
        clearSessionCookie(res);
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

authRouter.get('/me', requireSession, (req, res) => {
    res.json({ user: req.user });
});
