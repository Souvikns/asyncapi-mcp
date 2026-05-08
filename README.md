# AsyncAPI MCP Server

[![Glama](https://img.shields.io/badge/Glama-Hosted-8A2BE2?style=flat-square)](https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp) [![MIT License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square)](https://www.typescriptlang.org/)

An MCP (Model Context Protocol) server that gives AI assistants access to the AsyncAPI specification. Search, explore, and retrieve any version of the spec directly from your coding tool.

**[Try it in your browser on Glama](https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp)** — no installation required.

## Features

- **Search** the AsyncAPI specification by keyword
- **Retrieve** specific sections by heading or slug
- **List** all stable spec versions available as GitHub tags
- **Get metadata** about the spec (version, source, cache info, size)
- **Version-aware** — query any released spec version, or default to the latest
- **Caching** — ETag/Last-Modified-based HTTP caching with a 10-minute TTL on tag lookups

## Quick Start

### Remote (Glama)

Use the hosted server on Glama — no local setup needed. Add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
    }
  }
}
```

See the [Configuration](#configuration-for-ai-coding-tools) section below for client-specific instructions.

### Local (Self-hosted)

<details>
<summary>Setup instructions</summary>

#### Prerequisites

- [Node.js](https://nodejs.org) v20 or later

#### Install

```bash
npm install
```

#### Build

```bash
npm run build
```

#### Run

Streamable HTTP (for local development):

```bash
npm run dev
```

The server starts on `http://localhost:3000/mcp` by default. Set the `PORT` environment variable to use a different port:

```bash
PORT=8080 npm run dev
```

Stdio (for deployment):

```bash
npm start
```

</details>

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

### Remote (Glama hosted)

Use these configs to connect to the Glama-hosted server. No local setup required.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
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
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
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
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp",
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
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
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
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
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
        "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
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
      "url": "https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp"
    }
  }
}
```

---

### Local (Self-hosted)

Use these configs when running the server locally with `npm run dev`. Make sure the server is running before connecting.

### Claude Desktop

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

### Windsurf / Cline / OpenCode / Zed

Replace the Glama URL in the configs above with `http://localhost:3000/mcp`.

## Deployment

This server is deployed on [Glama.ai](https://glama.ai). See [glama.ai/mcp/servers/Souvikns/asyncapi-mcp](https://glama.ai/mcp/servers/Souvikns/asyncapi-mcp) for the hosted instance.

To deploy your own instance, build and run with stdio transport:

```bash
npm run build
npm start
```

A `Dockerfile` is included for containerized deployments:

```bash
docker build -t asyncapi-mcp .
docker run -p 3000:3000 asyncapi-mcp
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
npm install

# Build TypeScript to dist/
npm run build

# Run the HTTP server (local development)
npm run dev

# Run the stdio server (for deployment)
npm start

# Type-check without emitting
npx tsc --noEmit
```
