import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
    fetchAsyncApiSpec,
    formatUnknownError,
    getSectionText,
    getSpecMetadata,
    listAsyncApiSpecVersions,
    searchSpec,
} from './asyncapi-spec.js';

export const registerTools = (mcpServer: McpServer) => {
    mcpServer.registerTool(
        'list_asyncapi_spec_versions',
        {
            title: 'List AsyncAPI Spec Versions',
            description: 'List stable AsyncAPI specification versions available as GitHub tags.',
        },
        async () => {
            try {
                const versions = await listAsyncApiSpecVersions();
                const output = {
                    count: versions.length,
                    versions,
                };

                return {
                    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
                    structuredContent: output,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: formatUnknownError(error) }],
                };
            }
        }
    );

    mcpServer.registerTool(
        'get_asyncapi_spec_metadata',
        {
            title: 'Get AsyncAPI Spec Metadata',
            description: 'Return source, version, cache, and size metadata for the latest AsyncAPI specification.',
            inputSchema: z.object({
                version: z
                    .string()
                    .optional()
                    .describe('Optional spec version, for example "3.0.0". Defaults to latest from master.'),
            }),
        },
        async ({ version }) => {
            try {
                const entry = await fetchAsyncApiSpec(version);
                const metadata = getSpecMetadata(entry);

                return {
                    content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }],
                    structuredContent: metadata,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: formatUnknownError(error) }],
                };
            }
        }
    );

    mcpServer.registerTool(
        'search_asyncapi_spec',
        {
            title: 'Search AsyncAPI Spec',
            description: 'Search the latest AsyncAPI markdown specification and return matching snippets.',
            inputSchema: z.object({
                version: z
                    .string()
                    .optional()
                    .describe('Optional spec version, for example "3.0.0". Defaults to latest from master.'),
                query: z.string().min(1).describe('Search query to find in the AsyncAPI specification.'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(20)
                    .default(10)
                    .describe('Maximum number of matching snippets to return.'),
            }),
        },
        async ({ version, query, limit }) => {
            try {
                const entry = await fetchAsyncApiSpec(version);
                const results = searchSpec(entry.text, query, limit);
                const output = {
                    version: entry.version ?? null,
                    requestedVersion: entry.requestedVersion ?? null,
                    resolvedTag: entry.resolvedTag ?? null,
                    query,
                    count: results.length,
                    results,
                };

                return {
                    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
                    structuredContent: output,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: formatUnknownError(error) }],
                };
            }
        }
    );

    mcpServer.registerTool(
        'get_asyncapi_spec_section',
        {
            title: 'Get AsyncAPI Spec Section',
            description: 'Return one section from the latest AsyncAPI markdown specification by heading text or slug.',
            inputSchema: z.object({
                version: z
                    .string()
                    .optional()
                    .describe('Optional spec version, for example "3.0.0". Defaults to latest from master.'),
                heading: z.string().min(1).describe('Heading text or slug, for example "Info Object" or "info-object".'),
            }),
        },
        async ({ version, heading }) => {
            try {
                const entry = await fetchAsyncApiSpec(version);
                const section = getSectionText(entry.text, heading);

                if (!section) {
                    return {
                        isError: true,
                        content: [{ type: 'text', text: `No AsyncAPI spec section found for heading "${heading}".` }],
                    };
                }

                const output = {
                    version: entry.version ?? null,
                    requestedVersion: entry.requestedVersion ?? null,
                    resolvedTag: entry.resolvedTag ?? null,
                    heading: section.heading.title,
                    slug: section.heading.slug,
                    text: section.text,
                };

                return {
                    content: [{ type: 'text', text: section.text }],
                    structuredContent: output,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: formatUnknownError(error) }],
                };
            }
        }
    );
};
