import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    formatUnknownError,
    getSpecMetadata,
    getSectionText,
    searchSpec,
    listAsyncApiSpecVersions,
    fetchAsyncApiSpec,
} from '../asyncapi-spec.js';
import { createSpecCacheEntry, SAMPLE_SPEC_MD, GITHUB_TAGS_RESPONSE } from './fixtures.js';

describe('formatUnknownError', () => {
    it('formats Error instances', () => {
        expect(formatUnknownError(new Error('something went wrong'))).toBe('something went wrong');
    });

    it('formats non-Error values', () => {
        expect(formatUnknownError('plain string')).toBe('plain string');
        expect(formatUnknownError(42)).toBe('42');
        expect(formatUnknownError(true)).toBe('true');
    });

    it('formats null and undefined', () => {
        expect(formatUnknownError(null)).toBe('null');
        expect(formatUnknownError(undefined)).toBe('undefined');
    });
});

describe('getSpecMetadata', () => {
    it('returns full metadata from a cache entry', () => {
        const entry = createSpecCacheEntry({
            etag: '"abc123"',
            lastModified: 'Wed, 15 Jan 2025 10:00:00 GMT',
            version: '3.0.0',
        });
        const metadata = getSpecMetadata(entry);

        expect(metadata.sourceUrl).toBe(entry.sourceUrl);
        expect(metadata.version).toBe('3.0.0');
        expect(metadata.requestedVersion).toBeNull();
        expect(metadata.resolvedTag).toBeNull();
        expect(metadata.hasEtag).toBe(true);
        expect(metadata.hasLastModified).toBe(true);
        expect(metadata.contentSizeBytes).toBeGreaterThan(0);
        expect(metadata.fetchedAt).toBe(entry.fetchedAt.toISOString());
        expect(typeof metadata.cacheAgeSeconds).toBe('number');
    });

    it('handles missing optional fields', () => {
        const entry = createSpecCacheEntry({
            etag: undefined,
            lastModified: undefined,
            version: undefined,
        });
        const metadata = getSpecMetadata(entry);

        expect(metadata.version).toBeNull();
        expect(metadata.hasEtag).toBe(false);
        expect(metadata.hasLastModified).toBe(false);
    });

    it('includes requestedVersion and resolvedTag when present', () => {
        const entry = createSpecCacheEntry({
            requestedVersion: '3.0.0',
            resolvedTag: 'v3.0.0',
        });
        const metadata = getSpecMetadata(entry);

        expect(metadata.requestedVersion).toBe('3.0.0');
        expect(metadata.resolvedTag).toBe('v3.0.0');
    });
});

describe('getSectionText', () => {
    it('finds a section by exact heading title', () => {
        const section = getSectionText(SAMPLE_SPEC_MD, 'Server Object');

        expect(section).toBeDefined();
        expect(section!.heading.title).toBe('Server Object');
        expect(section!.heading.slug).toBe('server-object');
        expect(section!.text).toContain('The Server Object describes a server');
    });

    it('finds a section by slug', () => {
        const section = getSectionText(SAMPLE_SPEC_MD, 'channel-item-object');

        expect(section).toBeDefined();
        expect(section!.heading.title).toBe('Channel Item Object');
        expect(section!.text).toContain('A channel item describes a channel');
    });

    it('finds a heading with HTML anchor tags', () => {
        const section = getSectionText(SAMPLE_SPEC_MD, 'Definitions');

        expect(section).toBeDefined();
        expect(section!.heading.title).toBe('Definitions');
    });

    it('returns undefined for non-existent heading', () => {
        const section = getSectionText(SAMPLE_SPEC_MD, 'Non-existent Section');

        expect(section).toBeUndefined();
    });

    it('section text includes content up to the next heading', () => {
        const section = getSectionText(SAMPLE_SPEC_MD, 'Info Object');

        expect(section!.text).toContain('The Info Object contains metadata');
        expect(section!.text).toContain('```yaml');
        expect(section!.text).not.toContain('The License object');
    });
});

describe('searchSpec', () => {
    it('returns matching lines', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'server', 10);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.snippet.toLowerCase().includes('server'))).toBe(true);
    });

    it('includes heading context for results', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'Server Object', 10);

        expect(results.length).toBeGreaterThan(0);
        const headingResult = results.find(r => r.heading);
        expect(headingResult).toBeDefined();
    });

    it('respects the limit parameter', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'the', 2);

        expect(results.length).toBe(2);
    });

    it('returns empty array for empty query', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, '', 10);

        expect(results).toEqual([]);
    });

    it('returns empty array for whitespace-only query', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, '   ', 10);

        expect(results).toEqual([]);
    });

    it('returns empty array when no matches found', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'xyznonexistentquery', 10);

        expect(results).toEqual([]);
    });

    it('returns correct line numbers', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'Info Object', 10);

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
            expect(result.line).toBeGreaterThan(0);
        }
    });

    it('includes surrounding lines in snippet', () => {
        const results = searchSpec(SAMPLE_SPEC_MD, 'reusable schemas', 10);

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
            expect(result.snippet.length).toBeGreaterThan(0);
        }
    });
});

describe('listAsyncApiSpecVersions', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('fetches and returns stable versions', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => GITHUB_TAGS_RESPONSE,
        });
        vi.stubGlobal('fetch', mockFetch);

        const { listAsyncApiSpecVersions } = await import('../asyncapi-spec.js');
        const versions = await listAsyncApiSpecVersions();

        expect(versions.length).toBeGreaterThanOrEqual(3);
        expect(versions.map(v => v.version)).toContain('2.6.0');
        expect(versions.map(v => v.version)).toContain('3.0.0');
        expect(versions.map(v => v.version)).toContain('3.0.1');

        vi.restoreAllMocks();
    });

    it('filters out non-stable tags', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => GITHUB_TAGS_RESPONSE,
        });
        vi.stubGlobal('fetch', mockFetch);

        const { listAsyncApiSpecVersions } = await import('../asyncapi-spec.js');
        const versions = await listAsyncApiSpecVersions();

        expect(versions.every(v => /^\d+\.\d+\.\d+$/.test(v.version))).toBe(true);

        vi.restoreAllMocks();
    });

    it('throws on API error', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => [],
        });
        vi.stubGlobal('fetch', mockFetch);

        const { listAsyncApiSpecVersions } = await import('../asyncapi-spec.js');
        await expect(listAsyncApiSpecVersions()).rejects.toThrow('GitHub tags API returned 403');

        vi.restoreAllMocks();
    });
});

describe('fetchAsyncApiSpec', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('fetches the latest spec successfully', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => SAMPLE_SPEC_MD,
            headers: new Headers({ etag: '"etag1"', 'last-modified': 'Wed, 15 Jan 2025 10:00:00 GMT' }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        const entry = await fetchAsyncApiSpec();

        expect(entry.text).toBe(SAMPLE_SPEC_MD);
        expect(entry.etag).toBe('"etag1"');
        expect(entry.cacheKey).toBe('latest');

        vi.restoreAllMocks();
    });

    it('falls back to cached entry on 304 Not Modified', async () => {
        const specText = '# AsyncAPI Specification\n\nVersion 3.0.0\n';
        let callCount = 0;

        const mockFetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: async () => specText,
                    headers: new Headers({ etag: '"etag1"' }),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 304,
                headers: new Headers(),
            });
        });
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        const first = await fetchAsyncApiSpec();

        expect(first.text).toBe(specText);

        const second = await fetchAsyncApiSpec();
        expect(second.text).toBe(specText);
        expect(second.cacheKey).toBe('latest');

        vi.restoreAllMocks();
    });

    it('throws on HTTP error', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        await expect(fetchAsyncApiSpec()).rejects.toThrow();

        vi.restoreAllMocks();
    });

    it('throws descriptive error on network failure', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        await expect(fetchAsyncApiSpec()).rejects.toThrow('Unable to fetch');

        vi.restoreAllMocks();
    });

    it('resolves a specific version to a tag', async () => {
        const tagsResponse = GITHUB_TAGS_RESPONSE;
        const specTextV3 = '# AsyncAPI Specification\n\n## Version 3.0.0\n';

        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/tags')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => tagsResponse,
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                text: async () => specTextV3,
                headers: new Headers(),
            });
        });
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        const entry = await fetchAsyncApiSpec('3.0.0');

        expect(entry.text).toBe(specTextV3);
        expect(entry.requestedVersion).toBe('3.0.0');
        expect(entry.resolvedTag).toBe('v3.0.0');

        vi.restoreAllMocks();
    });

    it('throws on unknown version', async () => {
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/tags')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => GITHUB_TAGS_RESPONSE,
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                text: async () => SAMPLE_SPEC_MD,
                headers: new Headers(),
            });
        });
        vi.stubGlobal('fetch', mockFetch);

        const { fetchAsyncApiSpec } = await import('../asyncapi-spec.js');
        await expect(fetchAsyncApiSpec('9.9.9')).rejects.toThrow('was not found');

        vi.restoreAllMocks();
    });
});