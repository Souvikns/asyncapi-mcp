import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { apiKeyPrefix, extractBearerToken, generateApiKey, hashApiKey } from '../api-keys.js';

describe('generateApiKey', () => {
    it('generates keys with the ak_live_ prefix and 64 hex chars', () => {
        const key = generateApiKey();
        expect(key).toMatch(/^ak_live_[0-9a-f]{64}$/);
    });

    it('generates unique keys', () => {
        expect(generateApiKey()).not.toBe(generateApiKey());
    });
});

describe('hashApiKey', () => {
    it('returns the sha256 hex digest of the key', () => {
        const key = 'ak_live_test';
        expect(hashApiKey(key)).toBe(createHash('sha256').update(key).digest('hex'));
    });

    it('is deterministic', () => {
        const key = generateApiKey();
        expect(hashApiKey(key)).toBe(hashApiKey(key));
    });
});

describe('apiKeyPrefix', () => {
    it('returns the display prefix without the secret portion', () => {
        const key = generateApiKey();
        const prefix = apiKeyPrefix(key);
        expect(prefix.startsWith('ak_live_')).toBe(true);
        expect(prefix.length).toBeLessThan(key.length);
        expect(key.startsWith(prefix)).toBe(true);
    });
});

describe('extractBearerToken', () => {
    it('extracts the token from a Bearer header', () => {
        expect(extractBearerToken('Bearer ak_live_abc123')).toBe('ak_live_abc123');
    });

    it('is case-insensitive on the scheme', () => {
        expect(extractBearerToken('bearer token123')).toBe('token123');
        expect(extractBearerToken('BEARER token123')).toBe('token123');
    });

    it('returns null for missing or malformed headers', () => {
        expect(extractBearerToken(undefined)).toBeNull();
        expect(extractBearerToken('')).toBeNull();
        expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
        expect(extractBearerToken('Bearer')).toBeNull();
        expect(extractBearerToken('Bearer   ')).toBeNull();
    });
});
