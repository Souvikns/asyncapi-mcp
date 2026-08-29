import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createRateLimiter } from '../rate-limit.js';

describe('createRateLimiter', () => {
    let server: Server | undefined;

    afterEach(async () => {
        if (!server) {
            return;
        }
        await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    });

    const startServer = (max: number, windowMs: number): Promise<string> => {
        const app = express();
        app.get('/mcp', createRateLimiter({ max, windowMs }), (req, res) => {
            res.json({ ok: true });
        });
        return new Promise(resolve => {
            server = app.listen(0, () => {
                const { port } = server!.address() as AddressInfo;
                resolve(`http://127.0.0.1:${port}/mcp`);
            });
        });
    };

    it('allows requests within the limit', async () => {
        const url = await startServer(3, 60_000);
        for (let i = 0; i < 3; i++) {
            const res = await fetch(url);
            expect(res.status).toBe(200);
        }
    });

    it('rejects requests past the limit with 429', async () => {
        const url = await startServer(2, 60_000);
        await fetch(url);
        await fetch(url);
        const res = await fetch(url);
        expect(res.status).toBe(429);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Too many requests, try again later.');
    });

    it('sets standard rate limit headers', async () => {
        const url = await startServer(5, 60_000);
        const res = await fetch(url);
        expect(res.headers.get('ratelimit-limit')).toBe('5');
    });
});
