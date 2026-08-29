import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export interface RateLimiterOptions {
    windowMs?: number;
    max?: number;
}

const parsePositiveInt = (raw: string | undefined, fallback: number, envVarName: string): number => {
    if (raw === undefined) {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(`Invalid ${envVarName}="${raw}" — falling back to default ${fallback}`);
        return fallback;
    }
    return parsed;
};

export const createRateLimiter = (options: RateLimiterOptions = {}): RequestHandler => {
    const windowMs = options.windowMs ?? parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000, 'RATE_LIMIT_WINDOW_MS');
    const max = options.max ?? parsePositiveInt(process.env.RATE_LIMIT_MAX, 60, 'RATE_LIMIT_MAX');

    return rateLimit({
        windowMs,
        limit: max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, try again later.' },
    });
};

export const mcpRateLimiter: RequestHandler = createRateLimiter();
