import type { SpecCacheEntry } from '../asyncapi-spec.js';

export const SAMPLE_SPEC_MD = `\
# AsyncAPI Specification

## Version 3.0.0

This is the AsyncAPI specification.

## Info Object

The Info Object contains metadata about the API.

\`\`\`yaml
asyncapi: 3.0.0
info:
  title: My API
  version: 1.0.0
\`\`\`

### License

The License object contains license information.

## Server Object

The Server Object describes a server available for the API.

Servers are defined with their URLs and protocol.

## Channels Object

Channels define the messages and operations.

### Channel Item Object

A channel item describes a channel.

## Components Object

The Components Object holds reusable schemas.

## <a id="definitions"></a>Definitions

Some definitions here.

## Deprecated Stuff

This section is deprecated.
`;

export function createSpecCacheEntry(overrides: Partial<SpecCacheEntry> = {}): SpecCacheEntry {
    return {
        text: SAMPLE_SPEC_MD,
        etag: undefined,
        lastModified: undefined,
        fetchedAt: new Date('2025-01-15T10:00:00Z'),
        sourceUrl: 'https://raw.githubusercontent.com/asyncapi/spec/master/spec/asyncapi.md',
        version: '3.0.0',
        requestedVersion: undefined,
        resolvedTag: undefined,
        cacheKey: 'latest',
        ...overrides,
    };
}

export const SAMPLE_TAGS = [
    { name: 'v2.6.0' },
    { name: 'v3.0.0' },
    { name: 'v3.0.1' },
    { name: 'some-rc-tag' },
];

export const GITHUB_TAGS_RESPONSE = SAMPLE_TAGS.map(t => ({ name: t.name }));