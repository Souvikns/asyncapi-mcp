import { describe, expect, it } from 'vitest';
import { validateAsyncApiSpec } from '../asyncapi-parser.js';

const VALID_ASYNCAPI_SPEC = `asyncapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
channels: {}
operations: {}
`;

describe('validateAsyncApiSpec', () => {
    it('returns valid for a valid AsyncAPI document', async () => {
        const result = await validateAsyncApiSpec(VALID_ASYNCAPI_SPEC);

        expect(result.valid).toBe(true);
        expect(result.errorCount).toBe(0);
        expect(result.errors).toEqual([]);
    });

    it('returns validation errors for an invalid AsyncAPI document', async () => {
        const result = await validateAsyncApiSpec(`asyncapi: 3.1.0
info:
  title: Test API
channels: {}
operations: {}
`);

        expect(result.valid).toBe(false);
        expect(result.errorCount).toBeGreaterThan(0);
        expect(result.errors.some(error => error.message.includes('version'))).toBe(true);
        expect(result.errors[0]).toMatchObject({ severity: 'error' });
    });

    it('does not mark informational diagnostics as invalid', async () => {
        const result = await validateAsyncApiSpec(VALID_ASYNCAPI_SPEC.replace('3.1.0', '3.0.0'));

        expect(result.valid).toBe(true);
        expect(result.errorCount).toBe(0);
        expect(result.warningCount).toBeGreaterThan(0);
    });
});
