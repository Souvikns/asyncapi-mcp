# AsyncAPI MCP Server

An MCP (Model Context Protocol) server that gives AI assistants access to the AsyncAPI specification. Search, explore, and retrieve any version of the spec directly from your coding tool.

## Features

- **Search** the AsyncAPI specification by keyword
- **Retrieve** specific sections by heading or slug
- **List** all stable spec versions available as GitHub tags
- **Get metadata** about the spec (version, source, cache info, size)
- **Version-aware** — query any released spec version, or default to the latest
- **Caching** — ETag/Last-Modified-based HTTP caching with a 10-minute TTL on tag lookups

## Prerequisites

- [Bun](https://bun.sh) v1.3.3 or later

## Installation

```bash
bun install
```

## Running the Server

```bash
bun run index.ts
```

The server starts on `http://localhost:3000/mcp` by default. Set the `PORT` environment variable to use a different port:

```bash
PORT=8080 bun run index.ts
```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_asyncapi_spec_versions` | List stable AsyncAPI spec versions available as GitHub tags | None |
| `get_asyncapi_spec_metadata` | Return source, version, cache, and size metadata for a spec | `version` (optional) |
| `search_asyncapi_spec` | Search the spec and return matching snippets | `query` (required), `version` (optional), `limit` (default: 10, max: 20) |
| `get_asyncapi_spec_section` | Return a section by heading text or slug | `heading` (required), `version` (optional) |

## Available Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Latest AsyncAPI Spec | `asyncapi://spec/latest` | The latest AsyncAPI markdown specification from the master branch |
| AsyncAPI Spec by Version | `asyncapi://spec/{version}` | A specific version of the spec fetched from the matching GitHub release tag |

## Configuration for AI Coding Tools

The server uses the Streamable HTTP transport. Make sure the server is running before connecting your AI tool.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### VS Code Copilot

Add to `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp",
      "type": "http"
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP settings:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Cline

In Cline's MCP settings, add:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### OpenCode

Add to your OpenCode configuration:

```json
{
  "mcp": {
    "servers": {
      "asyncapi": {
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

### Zed

Add to your Zed `settings.json`:

```json
{
  "context_servers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Usage Examples

Once configured, you can ask your AI assistant questions like:

- "What does the AsyncAPI spec say about server objects?"
- "Search the AsyncAPI spec for 'channels'"
- "Get the Info Object section from version 2.6.0"
- "List all available AsyncAPI spec versions"
- "What are the differences between messages in AsyncAPI 2.x and 3.x?"
- "Show me the spec section about schema definitions"

## Development

```bash
# Install dependencies
bun install

# Run the server
bun run index.ts
```

## License

MIT