import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { pool } from './db.js';

const KEY_PREFIX = 'ak_live_';

export const generateApiKey = (): string => `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;

export const hashApiKey = (key: string): string => createHash('sha256').update(key).digest('hex');

export const apiKeyPrefix = (key: string): string => key.slice(0, KEY_PREFIX.length + 8);

export const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
    if (!authorizationHeader) {
        return null;
    }
    const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
    return match?.[1]?.trim() || null;
};

export const isApiKeyActive = async (key: string): Promise<boolean> => {
    const result = await pool.query('SELECT 1 FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL', [
        hashApiKey(key),
    ]);
    return result.rowCount !== null && result.rowCount > 0;
};

export const requireApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const key = extractBearerToken(req.headers.authorization);
        if (!key) {
            res.status(401).json({
                error: 'An API key is required. Send it as "Authorization: Bearer <key>". Create one in your dashboard.',
            });
            return;
        }
        if (!(await isApiKeyActive(key))) {
            res.status(401).json({ error: 'API key is invalid or has been revoked' });
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};
