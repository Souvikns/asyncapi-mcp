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

### Remote (Self-hosted on Render)

The recommended way to use this server is to deploy your own instance on Render — it's free (no credit card required). Access to the `/mcp` endpoint requires an API key:

1. Visit your deployed instance (e.g. `https://asyncapi-mcp.onrender.com`) and **sign up**.
2. In the dashboard, **create an API key**.
3. Add the following to your MCP client configuration, replacing `YOUR_API_KEY`:

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

See the [Configuration](#configuration-for-ai-coding-tools) section below for client-specific instructions (including a fallback for clients that cannot send headers), and the [Deployment](#deployment) section for setup steps.

### Local (Self-hosted)

<details>
<summary>Setup instructions</summary>

#### Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- A PostgreSQL database (e.g. via the included Docker Compose file: `docker compose up -d db`)

#### Install

```bash
npm install
```

#### Build

```bash
npm run build
```

#### Run

Set `DATABASE_URL` so the server can store accounts and API keys:

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/asyncapi_mcp"
```

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

## Authentication & API Keys

The server hosts a small website at its root URL (`/`) where users can sign up with an email and password. After logging in, the dashboard lets you:

- **Create API keys** (multiple keys are supported, e.g. one per device) — the full key is shown only once at creation; only a SHA-256 hash is stored
- **Revoke keys** at any time — revoked keys stop working immediately
- **Copy a ready-made client config** with your key already filled in

The `/mcp` endpoint requires a valid key sent as `Authorization: Bearer <key>`. Requests without a key, or with an invalid/revoked key, receive a `401` response. The `/health` endpoint stays open for platform health checks.

User accounts, sessions, and API keys are stored in **PostgreSQL**, configured via the `DATABASE_URL` environment variable (see [Deployment](#deployment)).

## Configuration for AI Coding Tools

### Remote (Render hosted)

Use these configs to connect to your self-hosted Render instance. Make sure you've [deployed the server](#deployment) first and [created an API key](#authentication--api-keys). Replace `YOUR_API_KEY` in each config.

### Claude Desktop

Claude Desktop cannot send custom headers for remote servers, so use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) as a proxy. Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "asyncapi": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://asyncapi-mcp.onrender.com/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
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
      "url": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
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
      "type": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
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
      "serverUrl": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
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
      "url": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
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
        "url": "https://asyncapi-mcp.onrender.com/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
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
      "url": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

---

### Local (Self-hosted)

Use these configs when running the server locally with `npm run dev`. Make sure the server is running before connecting. The `/mcp` endpoint requires an API key here too — sign up on the local site (`http://localhost:3000`) and create a key first. Claude Desktop users should adapt the `mcp-remote` config from the remote section above.

### Cursor / Claude Desktop (via mcp-remote)

```json
{
  "mcpServers": {
    "asyncapi": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
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
      "type": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Windsurf / Cline / OpenCode / Zed

Replace the Render URL in the configs above with `http://localhost:3000/mcp` and use your locally created API key.

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

#### Create the database

The website, accounts, and API keys are stored in PostgreSQL:

1. In the Render dashboard, click **New** → **PostgreSQL**.
2. Pick a name, select the **Free** instance type, and click **Create Database**.
3. Once provisioned, copy the **Internal Database URL** from the database's info page.

> **Note:** Render's free PostgreSQL expires after 30 days unless upgraded. After expiry, create a new database and update `DATABASE_URL` (existing accounts and keys are not carried over).

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
   - `DATABASE_URL` = the **Internal Database URL** from the previous step
6. Click **Create Web Service**.

Render will build and deploy your app. Once finished, you'll get a public URL like `https://asyncapi-mcp.onrender.com` — visiting it shows the website where you can sign up and create API keys.

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
docker run -p 3000:3000 -e DATABASE_URL="postgres://..." asyncapi-mcp
```

The HTTP server will be available at `http://localhost:3000/mcp` and the website at `http://localhost:3000/`. The container needs network access to your PostgreSQL instance.

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

### One-command setup (recommended)

Requires [Docker](https://www.docker.com) (for the database) and Node.js v20+:

```bash
npm install
npm run start:local
```

This starts PostgreSQL via Docker Compose, waits for it to be ready, builds the website on first run, and starts the server. Then visit **http://localhost:3000** — sign up, create an API key, and use `http://localhost:3000/mcp` in your MCP client config.

The database keeps running (with your data persisted in a volume) after you stop the app with `Ctrl+C`. Manage it with:

```bash
docker compose down          # stop the database (data is kept)
docker compose down -v       # stop the database AND delete all data
```

### Manual setup

```bash
# Install dependencies
npm install

# Start a local PostgreSQL (or point DATABASE_URL at any Postgres)
docker compose up -d db
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/asyncapi_mcp"

# Run the HTTP server (local development, serves the built website and the API)
npm run dev

# In another terminal: run the website dev server with hot reload (proxies API calls to :3000)
npm run dev:web

# Build TypeScript to dist/ and the website to web/dist/
npm run build

# Run the stdio server (for local MCP clients)
npm run start:stdio

# Type-check without emitting
npx tsc --noEmit
```
