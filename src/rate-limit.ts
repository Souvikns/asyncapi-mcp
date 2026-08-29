import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export interface RateLimiterOptions {
    windowMs?: number;
    max?: number;
}

export const createRateLimiter = (options: RateLimiterOptions = {}): RequestHandler => {
    const windowMs = options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    const max = options.max ?? Number(process.env.RATE_LIMIT_MAX ?? 60);

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, try again later.' },
    });
};

export const mcpRateLimiter: RequestHandler = createRateLimiter();
