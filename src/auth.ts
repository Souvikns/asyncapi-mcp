import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';

import { pool } from './db.js';

const scrypt = promisify(scryptCallback);

const SCRYPT_KEY_LENGTH = 64;
export const SESSION_COOKIE = 'session';
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
    id: string;
    email: string;
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: SessionUser;
        sessionToken?: string;
    }
}

export const hashPassword = async (password: string): Promise<string> => {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derived.toString('hex')}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
    const [algorithm, salt, hash] = stored.split(':');
    if (algorithm !== 'scrypt' || !salt || !hash) {
        return false;
    }
    const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
};

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const createSession = async (userId: string): Promise<{ token: string; expiresAt: Date }> => {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
        token,
        userId,
        expiresAt,
    ]);
    return { token, expiresAt };
};

export const deleteSession = async (token: string): Promise<void> => {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
};

export const getSessionUser = async (token: string): Promise<SessionUser | null> => {
    const result = await pool.query(
        `SELECT u.id, u.email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = $1 AND s.expires_at > now()`,
        [token]
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email } : null;
};

export const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) {
        return cookies;
    }
    for (const part of cookieHeader.split(';')) {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }
        const name = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (name) {
            cookies[name] = decodeURIComponent(value);
        }
    }
    return cookies;
};

export const setSessionCookie = (res: Response, token: string, expiresAt: Date): void => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`
    );
};

export const clearSessionCookie = (res: Response): void => {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
};

export const requireSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (!token) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const user = await getSessionUser(token);
        if (!user) {
            clearSessionCookie(res);
            res.status(401).json({ error: 'Session expired or invalid' });
            return;
        }
        req.user = user;
        req.sessionToken = token;
        next();
    } catch (error) {
        next(error);
    }
};
