import { Router } from 'express';

import { apiKeyPrefix, generateApiKey, hashApiKey } from '../api-keys.js';
import { requireSession } from '../auth.js';
import { pool } from '../db.js';

export const keysRouter = Router();

keysRouter.use(requireSession);

keysRouter.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, key_prefix, created_at, revoked_at
             FROM api_keys
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user!.id]
        );
        res.json({
            keys: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                prefix: row.key_prefix,
                createdAt: row.created_at,
                revoked: row.revoked_at !== null,
            })),
        });
    } catch (error) {
        next(error);
    }
});

keysRouter.post('/', async (req, res, next) => {
    try {
        const { name } = (req.body ?? {}) as { name?: string };
        const keyName = (name ?? '').trim() || 'Default';

        if (keyName.length > 100) {
            res.status(400).json({ error: 'Key name must be 100 characters or fewer' });
            return;
        }

        const key = generateApiKey();
        const result = await pool.query(
            `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, key_prefix, created_at`,
            [req.user!.id, keyName, hashApiKey(key), apiKeyPrefix(key)]
        );
        const row = result.rows[0];

        res.status(201).json({
            key: {
                id: row.id,
                name: row.name,
                prefix: row.key_prefix,
                createdAt: row.created_at,
                token: key,
            },
        });
    } catch (error) {
        next(error);
    }
});

keysRouter.delete('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE api_keys
             SET revoked_at = now()
             WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
            [req.params.id, req.user!.id]
        );
        if (!result.rowCount || result.rowCount === 0) {
            res.status(404).json({ error: 'API key not found' });
            return;
        }
        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});
