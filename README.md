# AsyncAPI MCP Server

[![MIT License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square)](https://www.typescriptlang.org/)

An MCP (Model Context Protocol) server that gives AI assistants access to the AsyncAPI specification. Search, explore, and retrieve any version of the spec directly from your coding tool.

## Features

- **Search** the AsyncAPI specification by keyword
- **Retrieve** specific sections by heading or slug
- **List** all stable spec versions available as GitHub tags
- **Get metadata** about the spec (version, source, cache info, size)
- **Version-aware** — query any released spec version, or default to the latest
- **Caching** — ETag/Last-Modified-based HTTP caching with a 10-minute TTL on tag lookups

## Quick Start

### Remote (Hosted, no signup required)

The server runs a free public instance at `https://asyncapi-mcp.onrender.com` — no account, no API key. Just point your client at it.

**Claude Code:**

```bash
claude plugin marketplace add Souvikns/asyncapi-mcp
/plugin install asyncapi-mcp@asyncapi-mcp
```

**Any other MCP client** — add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "https://asyncapi-mcp.onrender.com/mcp"
    }
  }
}
```

See the [Configuration](#configuration-for-ai-coding-tools) section below for client-specific instructions, and the [Deployment](#deployment) section if you'd rather run your own instance.

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

The server starts on `http://localhost:3000/mcp` by default, and the website is served at `http://localhost:3000/`. Set the `PORT` environment variable to use a different port:

```bash
PORT=8080 npm run dev
```

Stdio (for local MCP clients):

```bash
npm run start:stdio
```

</details>

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_asyncapi_spec_versions` | List stable AsyncAPI spec versions available as GitHub tags | None |
| `get_asyncapi_spec_metadata` | Return source, version, cache, and size metadata for a spec | `version` (optional) |
| `search_asyncapi_spec` | Search the spec and return matching snippets | `query` (required), `version` (optional), `limit` (default: 10, max: 20) |
| `validate_asyncapi_spec` | Validate raw AsyncAPI YAML or JSON content and return validation errors | `spec` (required) |
| `get_asyncapi_spec_section` | Return a section by heading text or slug | `heading` (required), `version` (optional) |

## Available Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Latest AsyncAPI Spec | `asyncapi://spec/latest` | The latest AsyncAPI markdown specification from the master branch |
| AsyncAPI Spec by Version | `asyncapi://spec/{version}` | A specific version of the spec fetched from the matching GitHub release tag |

## Rate Limiting

The `/mcp` endpoint has no authentication — it's rate-limited per IP address instead (60 requests per minute by default). Exceeding the limit returns a `429` response with a `Retry-After` header. The `/health` endpoint is never rate-limited, so platform health checks always succeed. Limits are configurable via the `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` environment variables if you're running your own instance.

## Configuration for AI Coding Tools

### Remote (Render hosted)

Use these configs to connect to the hosted instance at `https://asyncapi-mcp.onrender.com` — no setup or API key required. Running your own instance instead? Swap in your own URL (see [Deployment](#deployment)).

### Claude Code

```bash
claude plugin marketplace add Souvikns/asyncapi-mcp
/plugin install asyncapi-mcp@asyncapi-mcp
```

### Claude Desktop

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "https://asyncapi-mcp.onrender.com/mcp"
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
      "url": "https://asyncapi-mcp.onrender.com/mcp"
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
      "url": "https://asyncapi-mcp.onrender.com/mcp",
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
      "serverUrl": "https://asyncapi-mcp.onrender.com/mcp"
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
      "url": "https://asyncapi-mcp.onrender.com/mcp"
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
        "url": "https://asyncapi-mcp.onrender.com/mcp"
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
      "url": "https://asyncapi-mcp.onrender.com/mcp"
    }
  }
}
```

---

### Local (Self-hosted)

Use these configs when running the server locally with `npm run dev`. Make sure the server is running before connecting — no signup or API key needed.

### Cursor / Claude Desktop

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

Replace the Render URL in the configs above with `http://localhost:3000/mcp`.

## Deployment

### Render (Recommended — Free, easy setup)

[Render](https://render.com) provides a free web service tier with no credit card required. This is the easiest way to host your MCP server.

#### Free tier behavior

- **750 free instance hours per month** — plenty for a single MCP server
- **Sleeps after 15 minutes of idle time** — the service spins down when nobody is using it
- **Wakes up on next request** — takes about 30–60 seconds to respond after sleep
- **No credit card required** — truly $0

#### Prerequisites

- A [Render account](https://dashboard.render.com/register)
- Your code pushed to a public GitHub repository

#### Deploy via Git

1. In the Render dashboard, click **New** → **Web Service**.
2. Connect your **GitHub** account and select your repository.
3. Render will auto-detect the Node.js buildpack.
4. Set the following:
   - **Name**: `asyncapi-mcp` (or whatever you prefer)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Add environment variables:
   - `PORT` = `3000`
   - `NODE_ENV` = `production`
   - `TRUST_PROXY_HOPS` = `1` (verify this against Render's actual proxy chain post-deploy — see [Rate Limiting](#rate-limiting))
6. Click **Create Web Service**.

Render will build and deploy your app. Once finished, you'll get a public URL like `https://asyncapi-mcp.onrender.com` — visiting it shows the website, and the server is immediately usable with no signup step.

#### Publish it as a Claude Code plugin

This repo already includes `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. If you deploy your own instance, update the `url` in `.claude-plugin/plugin.json` to point at your Render URL, then anyone can install it with:

```bash
claude plugin marketplace add <your-github-username>/<your-repo>
/plugin install asyncapi-mcp@asyncapi-mcp
```

#### Configure your MCP client

Your Render domain is already configured in the [Configuration](#configuration-for-ai-coding-tools) section above.

#### Health check

You can verify the server is running by visiting:
```
https://asyncapi-mcp.onrender.com/health
```

### Self-hosted (Docker)

Build and run with the included `Dockerfile`:

```bash
docker build -t asyncapi-mcp .
docker run -p 3000:3000 asyncapi-mcp
```

The HTTP server will be available at `http://localhost:3000/mcp` and the website at `http://localhost:3000/`.

### Self-hosted (Local machine)

```bash
npm install
npm run build
npm start
```

The server starts on `http://localhost:3000/mcp` by default.

## Usage Examples

Once configured, you can ask your AI assistant questions like:

- "What does the AsyncAPI spec say about server objects?"
- "Search the AsyncAPI spec for 'channels'"
- "Get the Info Object section from version 2.6.0"
- "List all available AsyncAPI spec versions"
- "What are the differences between messages in AsyncAPI 2.x and 3.x?"
- "Show me the spec section about schema definitions"

## Development

### Setup

Requires Node.js v20+:

```bash
npm install
npm run build
npm run dev
```

This builds the website on first run and starts the server. Then visit **http://localhost:3000**, or use `http://localhost:3000/mcp` directly in your MCP client config — no signup or API key needed.

```bash
# In another terminal: run the website dev server with hot reload (proxies API calls to :3000)
npm run dev:web

# Build TypeScript to dist/ and the website to web/dist/
npm run build

# Run the stdio server (for local MCP clients)
npm run start:stdio

# Type-check without emitting
npx tsc --noEmit
```
