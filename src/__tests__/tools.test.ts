import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpecCacheEntry, SpecSearchResult, SpecSection } from '../asyncapi-spec.js';
import { SAMPLE_SPEC_MD } from './fixtures.js';

type ToolHandler = (...args: unknown[]) => Promise<unknown>;
type RegisterToolCall = { name: string; schema: unknown; handler: ToolHandler };

function createMockMcpServer(): {
    server: { registerTool: (name: string, schema: unknown, handler: ToolHandler) => void };
    calls: RegisterToolCall[];
} {
    const calls: RegisterToolCall[] = [];
    const server = {
        registerTool(name: string, schema: unknown, handler: ToolHandler) {
            calls.push({ name, schema, handler });
        },
    };
    return { server, calls };
}

function createMockCore() {
    const mockEntry: SpecCacheEntry = {
        text: SAMPLE_SPEC_MD,
        etag: '"etag1"',
        lastModified: 'Wed, 15 Jan 2025 10:00:00 GMT',
        fetchedAt: new Date('2025-01-15T10:00:00Z'),
        sourceUrl: 'https://raw.githubusercontent.com/asyncapi/spec/master/spec/asyncapi.md',
        version: '3.0.0',
        requestedVersion: undefined,
        resolvedTag: undefined,
        cacheKey: 'latest',
    };

    const listAsyncApiSpecVersions = vi.fn().mockResolvedValue([
        { tag: 'v2.6.0', version: '2.6.0' },
        { tag: 'v3.0.0', version: '3.0.0' },
        { tag: 'v3.0.1', version: '3.0.1' },
    ]);

    const fetchAsyncApiSpec = vi.fn().mockResolvedValue(mockEntry);

    const getSpecMetadata = vi.fn().mockReturnValue({
        sourceUrl: mockEntry.sourceUrl,
        version: '3.0.0',
        requestedVersion: null,
        resolvedTag: null,
        fetchedAt: mockEntry.fetchedAt.toISOString(),
        cacheAgeSeconds: 0,
        hasEtag: true,
        hasLastModified: true,
        contentSizeBytes: 500,
    });

    const searchSpec = vi.fn().mockReturnValue([
        { line: 8, heading: 'Info Object', snippet: 'The Info Object' },
    ] as SpecSearchResult[]);

    const getSectionText = vi.fn().mockReturnValue({
        heading: { level: 2, title: 'Info Object', slug: 'info-object', start: 30, end: 100 },
        text: '## Info Object\n\nThe Info Object contains metadata about the API.',
    } as SpecSection);

    const formatUnknownError = vi.fn((error: unknown) => {
        if (error instanceof Error) return error.message;
        return String(error);
    });

    const validateAsyncApiSpec = vi.fn().mockResolvedValue({
        valid: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        warnings: [],
    });

    return {
        listAsyncApiSpecVersions,
        fetchAsyncApiSpec,
        getSpecMetadata,
        searchSpec,
        getSectionText,
        formatUnknownError,
        validateAsyncApiSpec,
    };
}

describe('registerTools', () => {
    let calls: RegisterToolCall[];
    let mocks: ReturnType<typeof createMockCore>;

    beforeEach(async () => {
        vi.resetModules();
        calls = [];
        mocks = createMockCore();

        vi.doMock('../asyncapi-spec.js', () => ({
            listAsyncApiSpecVersions: mocks.listAsyncApiSpecVersions,
            fetchAsyncApiSpec: mocks.fetchAsyncApiSpec,
            getSpecMetadata: mocks.getSpecMetadata,
            searchSpec: mocks.searchSpec,
            getSectionText: mocks.getSectionText,
            formatUnknownError: mocks.formatUnknownError,
        }));

        vi.doMock('../asyncapi-parser.js', () => ({
            validateAsyncApiSpec: mocks.validateAsyncApiSpec,
        }));

        const { registerTools } = await import('../tools.js');
        const { server, calls: c } = createMockMcpServer();
        calls = c;
        registerTools(server as unknown as import('@modelcontextprotocol/server').McpServer);
    });

    afterEach(() => {
        vi.doUnmock('../asyncapi-spec.js');
        vi.doUnmock('../asyncapi-parser.js');
    });

    it('registers exactly 5 tools', () => {
        expect(calls).toHaveLength(5);
    });

    it('registers tools with correct names', () => {
        const names = calls.map(c => c.name);
        expect(names).toContain('list_asyncapi_spec_versions');
        expect(names).toContain('get_asyncapi_spec_metadata');
        expect(names).toContain('search_asyncapi_spec');
        expect(names).toContain('validate_asyncapi_spec');
        expect(names).toContain('get_asyncapi_spec_section');
    });

    describe('list_asyncapi_spec_versions', () => {
        let handler: ToolHandler;

        beforeEach(() => {
            handler = calls.find(c => c.name === 'list_asyncapi_spec_versions')!.handler;
        });

        it('returns count and versions', async () => {
            const result = await handler({});

            expect(mocks.listAsyncApiSpecVersions).toHaveBeenCalledOnce();
            const content = (result as { content: { type: string; text: string }[] }).content;
            const parsed = JSON.parse(content[0]!.text);
            expect(parsed.count).toBe(3);
            expect(parsed.versions).toHaveLength(3);
        });

        it('returns error on failure', async () => {
            mocks.listAsyncApiSpecVersions.mockRejectedValueOnce(new Error('API failure'));

            const result = await handler({}) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
            expect(result.content[0]!.text).toBe('API failure');
        });
    });

    describe('get_asyncapi_spec_metadata', () => {
        let handler: ToolHandler;

        beforeEach(() => {
            handler = calls.find(c => c.name === 'get_asyncapi_spec_metadata')!.handler;
        });

        it('returns metadata for latest spec', async () => {
            const result = await handler({ version: undefined });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith(undefined);
            expect(mocks.getSpecMetadata).toHaveBeenCalledOnce();
            const content = (result as { structuredContent: unknown }).structuredContent;
            expect(content).toBeDefined();
        });

        it('passes version parameter to fetchAsyncApiSpec', async () => {
            await handler({ version: '3.0.0' });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith('3.0.0');
        });

        it('returns error on fetch failure', async () => {
            mocks.fetchAsyncApiSpec.mockRejectedValueOnce(new Error('fetch error'));

            const result = await handler({ version: undefined }) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
        });
    });

    describe('search_asyncapi_spec', () => {
        let handler: ToolHandler;

        beforeEach(() => {
            handler = calls.find(c => c.name === 'search_asyncapi_spec')!.handler;
        });

        it('returns search results', async () => {
            const result = await handler({ version: undefined, query: 'info', limit: 10 });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith(undefined);
            expect(mocks.searchSpec).toHaveBeenCalledWith(SAMPLE_SPEC_MD, 'info', 10);
            const content = (result as { structuredContent: unknown }).structuredContent;
            expect(content).toBeDefined();
        });

        it('passes all parameters correctly', async () => {
            await handler({ version: '3.0.0', query: 'server', limit: 5 });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith('3.0.0');
            expect(mocks.searchSpec).toHaveBeenCalledWith(SAMPLE_SPEC_MD, 'server', 5);
        });

        it('returns error on fetch failure', async () => {
            mocks.fetchAsyncApiSpec.mockRejectedValueOnce(new Error('network error'));

            const result = await handler({ version: undefined, query: 'test', limit: 10 }) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
        });
    });

    describe('validate_asyncapi_spec', () => {
        let handler: ToolHandler;

        beforeEach(() => {
            handler = calls.find(c => c.name === 'validate_asyncapi_spec')!.handler;
        });

        it('returns valid result for valid spec content', async () => {
            const spec = 'asyncapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\nchannels: {}\noperations: {}\n';

            const result = await handler({ spec });

            expect(mocks.validateAsyncApiSpec).toHaveBeenCalledWith(spec);
            const output = (result as { structuredContent: { valid: boolean; errorCount: number } }).structuredContent;
            expect(output.valid).toBe(true);
            expect(output.errorCount).toBe(0);
        });

        it('returns validation errors for invalid spec content', async () => {
            mocks.validateAsyncApiSpec.mockResolvedValueOnce({
                valid: false,
                errorCount: 1,
                warningCount: 0,
                errors: [{ message: '"info" property must have required property "version"', path: 'info', severity: 'error' }],
                warnings: [],
            });

            const result = await handler({ spec: 'asyncapi: 3.1.0\ninfo:\n  title: Test\n' });

            const output = (result as { structuredContent: { valid: boolean; errors: { message: string }[] } }).structuredContent;
            expect(output.valid).toBe(false);
            expect(output.errors[0]!.message).toContain('version');
        });

        it('returns error on unexpected validation failure', async () => {
            mocks.validateAsyncApiSpec.mockRejectedValueOnce(new Error('parser failed'));

            const result = await handler({ spec: 'asyncapi: 3.1.0' }) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
            expect(result.content[0]!.text).toBe('parser failed');
        });
    });

    describe('get_asyncapi_spec_section', () => {
        let handler: ToolHandler;

        beforeEach(() => {
            handler = calls.find(c => c.name === 'get_asyncapi_spec_section')!.handler;
        });

        it('returns section when found', async () => {
            const result = await handler({ version: undefined, heading: 'Info Object' });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith(undefined);
            expect(mocks.getSectionText).toHaveBeenCalledWith(SAMPLE_SPEC_MD, 'Info Object');
            const output = (result as { structuredContent: unknown }).structuredContent;
            expect(output).toBeDefined();
        });

        it('returns error when section not found', async () => {
            mocks.getSectionText.mockReturnValueOnce(undefined);

            const result = await handler({ version: undefined, heading: 'Nonexistent' }) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
            expect(result.content[0]!.text).toContain('Nonexistent');
        });

        it('passes version parameter', async () => {
            await handler({ version: '2.6.0', heading: 'Server Object' });

            expect(mocks.fetchAsyncApiSpec).toHaveBeenCalledWith('2.6.0');
        });

        it('returns error on fetch failure', async () => {
            mocks.fetchAsyncApiSpec.mockRejectedValueOnce(new Error('fetch failed'));

            const result = await handler({ version: undefined, heading: 'Info Object' }) as { isError: boolean; content: { type: string; text: string }[] };

            expect(result.isError).toBe(true);
        });
    });
});
