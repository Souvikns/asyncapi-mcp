import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/server';

const ASYNCAPI_SPEC_REPO_TAGS_URL = 'https://api.github.com/repos/asyncapi/spec/tags?per_page=100';
const TAG_CACHE_TTL_MS = 10 * 60 * 1000;

export const ASYNCAPI_SPEC_SOURCE_URL = 'https://raw.githubusercontent.com/asyncapi/spec/master/spec/asyncapi.md';
export const ASYNCAPI_SPEC_RESOURCE_URI = 'asyncapi://spec/latest';
export const ASYNCAPI_SPEC_VERSION_RESOURCE_TEMPLATE = 'asyncapi://spec/{version}';
export const ASYNCAPI_SPEC_MIME_TYPE = 'text/markdown';

export type SpecCacheEntry = {
    text: string;
    etag?: string;
    lastModified?: string;
    fetchedAt: Date;
    sourceUrl: string;
    version?: string;
    requestedVersion?: string;
    resolvedTag?: string;
    cacheKey: string;
};

type Heading = {
    level: number;
    title: string;
    slug: string;
    start: number;
    end: number;
};

export type SpecMetadata = {
    sourceUrl: string;
    version: string | null;
    requestedVersion: string | null;
    resolvedTag: string | null;
    fetchedAt: string;
    cacheAgeSeconds: number;
    hasEtag: boolean;
    hasLastModified: boolean;
    contentSizeBytes: number;
};

export type SpecSearchResult = {
    line: number;
    heading?: string;
    snippet: string;
};

export type SpecSection = {
    heading: Heading;
    text: string;
};

type GitHubTag = {
    name: string;
};

type VersionTag = {
    version: string;
    tag: string;
};

type SpecRef = {
    cacheKey: string;
    sourceUrl: string;
    requestedVersion?: string;
    resolvedTag?: string;
};

let tagCache: { tags: VersionTag[]; fetchedAt: Date } | undefined;
const specCache = new Map<string, SpecCacheEntry>();

const cleanHeadingTitle = (heading: string): string =>
    heading
        .replace(/<a\s+[^>]*><\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();

const toSlug = (heading: string): string =>
    cleanHeadingTitle(heading)
        .trim()
        .toLowerCase()
        .replace(/[`*_~[\]()]/g, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const detectSpecVersion = (text: string): string | undefined => {
    const versionMatch = text.match(/#{1,6}\s+Version\s+([0-9]+(?:\.[0-9]+){1,2}(?:[-+][A-Za-z0-9.-]+)?)/i);
    return versionMatch?.[1];
};

const rawSpecUrl = (ref: string): string => `https://raw.githubusercontent.com/asyncapi/spec/${ref}/spec/asyncapi.md`;

const normalizeSpecVersion = (version: string): string => {
    const trimmed = version.trim().replace(/^v/i, '');

    if (!trimmed) {
        throw new Error('Spec version must not be empty.');
    }

    const numericParts = trimmed.split('.');
    if (numericParts.length < 1 || numericParts.length > 3 || numericParts.some(part => !/^\d+$/.test(part))) {
        throw new Error(`Invalid AsyncAPI spec version "${version}". Use a version like "3.0.0".`);
    }

    const [major, minor = '0', patch = '0'] = numericParts;
    return [major, minor, patch].map(part => String(Number(part))).join('.');
};

const isStableVersionTag = (tag: string): boolean => /^v?\d+\.\d+\.\d+$/.test(tag);

const versionFromTag = (tag: string): string => normalizeSpecVersion(tag);

const fetchVersionTags = async (): Promise<VersionTag[]> => {
    if (tagCache && Date.now() - tagCache.fetchedAt.getTime() < TAG_CACHE_TTL_MS) {
        return tagCache.tags;
    }

    const response = await fetch(ASYNCAPI_SPEC_REPO_TAGS_URL, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'asyncapi-mcp',
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub tags API returned ${response.status} ${response.statusText}`);
    }

    const tags = (await response.json()) as GitHubTag[];
    const versionTags = tags
        .map(tag => tag.name)
        .filter(isStableVersionTag)
        .map(tag => ({ tag, version: versionFromTag(tag) }))
        .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));

    tagCache = {
        tags: versionTags,
        fetchedAt: new Date(),
    };

    return versionTags;
};

const resolveSpecRef = async (version?: string): Promise<SpecRef> => {
    if (!version || version.trim().toLowerCase() === 'latest' || version.trim().toLowerCase() === 'master') {
        return {
            cacheKey: 'latest',
            sourceUrl: ASYNCAPI_SPEC_SOURCE_URL,
        };
    }

    const normalizedVersion = normalizeSpecVersion(version);
    const tags = await fetchVersionTags();
    const matchingTag = tags.find(tag => tag.version === normalizedVersion);

    if (!matchingTag) {
        const availableVersions = tags.map(tag => tag.version).join(', ');
        throw new Error(`AsyncAPI spec version "${version}" was not found in GitHub tags. Available versions: ${availableVersions}`);
    }

    return {
        cacheKey: matchingTag.tag,
        sourceUrl: rawSpecUrl(matchingTag.tag),
        requestedVersion: normalizedVersion,
        resolvedTag: matchingTag.tag,
    };
};

export const formatUnknownError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

export const listAsyncApiSpecVersions = async (): Promise<VersionTag[]> => fetchVersionTags();

export const fetchAsyncApiSpec = async (version?: string): Promise<SpecCacheEntry> => {
    const specRef = await resolveSpecRef(version);
    const cachedEntry = specCache.get(specRef.cacheKey);
    const headers = new Headers();

    if (cachedEntry?.etag) {
        headers.set('If-None-Match', cachedEntry.etag);
    }

    if (cachedEntry?.lastModified) {
        headers.set('If-Modified-Since', cachedEntry.lastModified);
    }

    try {
        const response = await fetch(specRef.sourceUrl, { headers });

        if (response.status === 304 && cachedEntry) {
            const refreshedEntry = {
                ...cachedEntry,
                fetchedAt: new Date(),
            };
            specCache.set(specRef.cacheKey, refreshedEntry);
            return refreshedEntry;
        }

        if (!response.ok) {
            throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const entry = {
            text,
            etag: response.headers.get('etag') ?? undefined,
            lastModified: response.headers.get('last-modified') ?? undefined,
            fetchedAt: new Date(),
            sourceUrl: specRef.sourceUrl,
            version: detectSpecVersion(text),
            requestedVersion: specRef.requestedVersion,
            resolvedTag: specRef.resolvedTag,
            cacheKey: specRef.cacheKey,
        };

        specCache.set(specRef.cacheKey, entry);
        return entry;
    } catch (error) {
        if (cachedEntry) {
            return cachedEntry;
        }

        throw new Error(`Unable to fetch AsyncAPI spec from ${specRef.sourceUrl}: ${formatUnknownError(error)}`);
    }
};

export const getSpecMetadata = (entry: SpecCacheEntry): SpecMetadata => ({
    sourceUrl: entry.sourceUrl,
    version: entry.version ?? null,
    requestedVersion: entry.requestedVersion ?? null,
    resolvedTag: entry.resolvedTag ?? null,
    fetchedAt: entry.fetchedAt.toISOString(),
    cacheAgeSeconds: Math.floor((Date.now() - entry.fetchedAt.getTime()) / 1000),
    hasEtag: Boolean(entry.etag),
    hasLastModified: Boolean(entry.lastModified),
    contentSizeBytes: new TextEncoder().encode(entry.text).byteLength,
});

const getSpecHeadings = (text: string): Heading[] => {
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;
    const headings: Omit<Heading, 'end'>[] = [];
    let match: RegExpExecArray | null;

    while ((match = headingPattern.exec(text)) !== null) {
        const title = cleanHeadingTitle(match[2] ?? '');
        const marker = match[1];
        if (!title || !marker) {
            continue;
        }

        headings.push({
            level: marker.length,
            title,
            slug: toSlug(title),
            start: match.index,
        });
    }

    return headings.map((heading, index) => ({
        ...heading,
        end: headings[index + 1]?.start ?? text.length,
    }));
};

const findHeading = (text: string, headingOrSlug: string): Heading | undefined => {
    const normalizedSlug = toSlug(headingOrSlug);
    const normalizedTitle = headingOrSlug.trim().toLowerCase();

    return getSpecHeadings(text).find(
        heading => heading.slug === normalizedSlug || heading.title.toLowerCase() === normalizedTitle
    );
};

export const getSectionText = (text: string, headingOrSlug: string): SpecSection | undefined => {
    const heading = findHeading(text, headingOrSlug);

    if (!heading) {
        return undefined;
    }

    return {
        heading,
        text: text.slice(heading.start, heading.end).trim(),
    };
};

export const searchSpec = (text: string, query: string, limit: number): SpecSearchResult[] => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return [];
    }

    const lines = text.split(/\r?\n/);
    const results: SpecSearchResult[] = [];
    let currentHeading: string | undefined;

    lines.forEach((line, index) => {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        const headingTitle = cleanHeadingTitle(headingMatch?.[2] ?? '');
        if (headingTitle) {
            currentHeading = headingTitle;
        }

        if (results.length >= limit || !line.toLowerCase().includes(normalizedQuery)) {
            return;
        }

        const start = Math.max(0, index - 1);
        const end = Math.min(lines.length, index + 2);
        const snippet = lines.slice(start, end).join('\n').trim();

        results.push({
            line: index + 1,
            heading: currentHeading,
            snippet,
        });
    });

    return results;
};

export const registerAsyncApiSpecResources = (mcpServer: McpServer) => {
    mcpServer.registerResource(
        'asyncapi-spec',
        ASYNCAPI_SPEC_RESOURCE_URI,
        {
            title: 'Latest AsyncAPI Specification',
            description: 'The latest AsyncAPI markdown specification fetched from the GitHub master branch.',
            mimeType: ASYNCAPI_SPEC_MIME_TYPE,
        },
        async uri => {
            const entry = await fetchAsyncApiSpec();

            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: ASYNCAPI_SPEC_MIME_TYPE,
                        text: entry.text,
                    },
                ],
            };
        }
    );

    mcpServer.registerResource(
        'asyncapi-spec-version',
        new ResourceTemplate(ASYNCAPI_SPEC_VERSION_RESOURCE_TEMPLATE, {
            list: async () => {
                const versions = await listAsyncApiSpecVersions();

                return {
                    resources: versions.map(({ version, tag }) => ({
                        uri: `asyncapi://spec/${version}`,
                        name: `asyncapi-spec-${version}`,
                        title: `AsyncAPI Specification ${version}`,
                        description: `AsyncAPI markdown specification fetched from GitHub tag ${tag}.`,
                        mimeType: ASYNCAPI_SPEC_MIME_TYPE,
                    })),
                };
            },
            complete: {
                version: async value => {
                    const versions = await listAsyncApiSpecVersions();
                    return versions.map(version => version.version).filter(version => version.startsWith(value));
                },
            },
        }),
        {
            title: 'AsyncAPI Specification by Version',
            description: 'AsyncAPI markdown specification fetched from the matching GitHub release tag.',
            mimeType: ASYNCAPI_SPEC_MIME_TYPE,
        },
        async (uri, variables) => {
            const versionVariable = variables.version;
            const version = Array.isArray(versionVariable) ? versionVariable[0] : versionVariable;
            const entry = await fetchAsyncApiSpec(version);

            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: ASYNCAPI_SPEC_MIME_TYPE,
                        text: entry.text,
                    },
                ],
            };
        }
    );
};
