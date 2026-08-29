import { describe, expect, it } from 'vitest';

import { hashPassword, isValidEmail, parseCookies, verifyPassword } from '../auth.js';

describe('hashPassword / verifyPassword', () => {
    it('verifies a correct password', async () => {
        const stored = await hashPassword('super-secret-password');
        expect(await verifyPassword('super-secret-password', stored)).toBe(true);
    });

    it('rejects an incorrect password', async () => {
        const stored = await hashPassword('super-secret-password');
        expect(await verifyPassword('wrong-password', stored)).toBe(false);
    });

    it('produces different hashes for the same password (random salt)', async () => {
        const first = await hashPassword('same-password');
        const second = await hashPassword('same-password');
        expect(first).not.toBe(second);
    });

    it('rejects malformed stored hashes', async () => {
        expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
        expect(await verifyPassword('anything', 'bcrypt:abc:def')).toBe(false);
        expect(await verifyPassword('anything', '')).toBe(false);
    });
});

describe('isValidEmail', () => {
    it('accepts valid emails', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('a.b+tag@sub.domain.co')).toBe(true);
    });

    it('rejects invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('not-an-email')).toBe(false);
        expect(isValidEmail('missing@domain')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('spaces in@example.com')).toBe(false);
    });
});

describe('parseCookies', () => {
    it('parses a cookie header into a map', () => {
        expect(parseCookies('session=abc123; theme=dark')).toEqual({ session: 'abc123', theme: 'dark' });
    });

    it('handles empty or missing headers', () => {
        expect(parseCookies(undefined)).toEqual({});
        expect(parseCookies('')).toEqual({});
    });

    it('handles values containing = signs', () => {
        expect(parseCookies('token=abc=def=')).toEqual({ token: 'abc=def=' });
    });

    it('decodes URI-encoded values', () => {
        expect(parseCookies('name=hello%20world')).toEqual({ name: 'hello world' });
    });
});
