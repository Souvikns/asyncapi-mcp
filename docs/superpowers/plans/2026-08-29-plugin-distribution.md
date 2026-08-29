# No-Auth Plugin Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove account-based auth (Postgres/sessions/API keys) from the AsyncAPI MCP server, replace `/mcp` auth with IP-based rate limiting, strip the web frontend to a single info page, and add a Claude Code plugin marketplace so the hosted Render instance is installable with `claude plugin marketplace add` + `/plugin install`.

**Architecture:** The MCP tool/resource layer and the stdio transport are untouched — they never depended on the account system. Only `src/index.ts` (the HTTP entrypoint) currently wires in `requireApiKey`/`initDatabase`; this plan replaces that wiring with a new rate-limit middleware, then deletes the now-dead account-system files, local Postgres dev tooling, and auth-related frontend pages, and finally adds the plugin manifest and rewrites the README around the new no-auth flow.

**Tech Stack:** Node.js 20+, TypeScript, Express 5, `express-rate-limit`, Vitest, React 19 + Vite (web/), Claude Code plugin manifest format.

**Spec:** `docs/superpowers/specs/2026-08-29-plugin-distribution-design.md`

## Global Constraints

- Rate limit defaults: 60 requests per 60,000ms per IP, configurable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` env vars.
- `app.set('trust proxy', N)` must use a verified numeric hop count (default `N=1` via `TRUST_PROXY_HOPS` env var), never `true`.
- The account system (Postgres, sessions, API keys, signup/login/dashboard) is removed entirely — no optional/legacy code path is kept.
- Plugin/marketplace identity: `name: "asyncapi-mcp"` in both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; GitHub repo is `Souvikns/asyncapi-mcp`; hosted MCP URL is `https://asyncapi-mcp.onrender.com/mcp`.
- No new HTTP test framework is introduced — the rate-limit test spins up its own minimal `express` instance on an ephemeral port and uses Node's built-in `fetch`.
- `web/` keeps React + `react-router-dom` (per project owner's decision) — only auth-related pages/routes are removed, not the frontend itself.

---

### Task 1: Rate limiting middleware

**Files:**
- Create: `src/rate-limit.ts`
- Create: `src/__tests__/rate-limit.test.ts`
- Modify: `package.json` (add `express-rate-limit` dependency)

**Interfaces:**
- Produces: `createRateLimiter(options?: { windowMs?: number; max?: number }): RequestHandler` and `mcpRateLimiter: RequestHandler` (the default instance, options read from `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX` env vars) — both exported from `src/rate-limit.ts`. Task 2 imports `mcpRateLimiter`.

- [ ] **Step 1: Add the dependency**

Run: `npm install express-rate-limit@^8.7.0`

Expected: `package.json` `dependencies` gains `"express-rate-limit": "^8.7.0"`, `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/rate-limit.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createRateLimiter } from '../rate-limit.js';

describe('createRateLimiter', () => {
    let server: Server | undefined;

    afterEach(async () => {
        if (!server) {
            return;
        }
        await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    });

    const startServer = (max: number, windowMs: number): Promise<string> => {
        const app = express();
        app.get('/mcp', createRateLimiter({ max, windowMs }), (req, res) => {
            res.json({ ok: true });
        });
        return new Promise(resolve => {
            server = app.listen(0, () => {
                const { port } = server!.address() as AddressInfo;
                resolve(`http://127.0.0.1:${port}/mcp`);
            });
        });
    };

    it('allows requests within the limit', async () => {
        const url = await startServer(3, 60_000);
        for (let i = 0; i < 3; i++) {
            const res = await fetch(url);
            expect(res.status).toBe(200);
        }
    });

    it('rejects requests past the limit with 429', async () => {
        const url = await startServer(2, 60_000);
        await fetch(url);
        await fetch(url);
        const res = await fetch(url);
        expect(res.status).toBe(429);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Too many requests, try again later.');
    });

    it('sets standard rate limit headers', async () => {
        const url = await startServer(5, 60_000);
        const res = await fetch(url);
        expect(res.headers.get('ratelimit-limit')).toBe('5');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/rate-limit.test.ts`
Expected: FAIL — `Cannot find module '../rate-limit.js'` (or similar; the module doesn't exist yet).

- [ ] **Step 4: Implement the rate limiter**

Create `src/rate-limit.ts`:

```ts
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export interface RateLimiterOptions {
    windowMs?: number;
    max?: number;
}

export const createRateLimiter = (options: RateLimiterOptions = {}): RequestHandler => {
    const windowMs = options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    const max = options.max ?? Number(process.env.RATE_LIMIT_MAX ?? 60);

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, try again later.' },
    });
};

export const mcpRateLimiter: RequestHandler = createRateLimiter();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/rate-limit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/rate-limit.ts src/__tests__/rate-limit.test.ts
git commit -m "feat: add IP-based rate limiter for the MCP endpoint"
```

---

### Task 2: Wire the rate limiter into index.ts, remove auth/db wiring

**Files:**
- Modify: `src/index.ts` (full rewrite of the route wiring — see below)

**Interfaces:**
- Consumes: `mcpRateLimiter` from `src/rate-limit.ts` (Task 1).
- Produces: `/mcp` now gated by `mcpRateLimiter` instead of `requireApiKey`; `initDatabase()`, `authRouter`, `keysRouter` are no longer referenced by `index.ts` (their source files are deleted in Task 3).

- [ ] **Step 1: Replace `src/index.ts`**

Replace the full contents of `src/index.ts` with:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import express from 'express';

import { mcpRateLimiter } from './rate-limit.js';
import { registerAsyncApiSpecResources } from './asyncapi-spec.js';
import { registerTools } from './tools.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createMcpExpressApp({ host: '0.0.0.0' });
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'AsyncAPI MCP Server' });
});

const mcpServer = new McpServer({
    name: 'AsyncAPI MCP Server',
    description: 'An MCP server implemented using Express.js',
    version: '1.0.0',
});

registerAsyncApiSpecResources(mcpServer);
registerTools(mcpServer);

app.use('/mcp', mcpRateLimiter);

app.post('/mcp', async (req, res) => {
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

app.all('/mcp', (req, res) => {
    res.status(405).json({ error: 'Method not allowed. Use POST to talk to the MCP server.' });
});

const webDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');

app.use(express.static(webDistDir));
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(webDistDir, 'index.html'), error => {
        if (error && !res.headersSent) {
            res.status(404).json({ error: 'Not found' });
        }
    });
});

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const httpServer = app.listen(PORT, () => {
    console.log(`MCP server is running on http://localhost:${PORT}/mcp`);
});

httpServer.on('error', error => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    httpServer.close(() => {
        process.exit(0);
    });
});

await new Promise<void>(() => {});
```

- [ ] **Step 2: Verify the build and existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. (`src/auth.ts`, `src/api-keys.ts`, `src/db.ts` and their tests still exist and are untouched at this point — they're just no longer imported by `index.ts`. They're deleted in Task 3.)

- [ ] **Step 3: Manual smoke test**

Run: `PORT=3100 node --import tsx/esm src/index.ts &` then `curl -s http://localhost:3100/health` then `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' -d '{}'`, then stop the background process.
Expected: `/health` returns `{"status":"ok",...}`; `/mcp` returns `202` or a JSON-RPC response body (not `401`) — confirming the API-key gate is gone and rate limiting doesn't block a single request.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: replace API-key auth with IP rate limiting on /mcp"
```

---

### Task 3: Delete the account-system files and the Postgres dependency

**Files:**
- Delete: `src/auth.ts`, `src/api-keys.ts`, `src/db.ts`
- Delete: `src/routes/auth.ts`, `src/routes/keys.ts` (and the now-empty `src/routes/` directory)
- Delete: `src/__tests__/auth.test.ts`, `src/__tests__/api-keys.test.ts`
- Modify: `package.json` (remove `pg` and `@types/pg`)

**Interfaces:**
- Consumes: nothing (these files are already unreferenced after Task 2).
- Produces: nothing new — this is pure deletion; `tsc --noEmit` is the safety net that would catch any surviving reference.

- [ ] **Step 1: Delete the files**

```bash
rm src/auth.ts src/api-keys.ts src/db.ts
rm src/routes/auth.ts src/routes/keys.ts
rmdir src/routes
rm src/__tests__/auth.test.ts src/__tests__/api-keys.test.ts
```

- [ ] **Step 2: Remove the `pg` dependency**

In `package.json`, remove these two lines:

```json
    "@types/pg": "^8.20.0",
```

(from `devDependencies`) and

```json
    "pg": "^8.22.0",
```

(from `dependencies`). Then run: `npm install` to update `package-lock.json`.

- [ ] **Step 3: Verify nothing references the deleted files**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — a stray import of `./auth.js`, `./api-keys.js`, or `./db.js` anywhere would surface as a `tsc` module-resolution error here.

- [ ] **Step 4: Commit**

```bash
git add -A src/ package.json package-lock.json
git commit -m "chore: remove the account-system backend and pg dependency"
```

---

### Task 4: Remove local Postgres dev tooling

**Files:**
- Delete: `docker-compose.yml`, `scripts/start-local.sh` (and the now-empty `scripts/` directory)
- Modify: `package.json` (remove the `start:local` script)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new — local dev no longer needs Docker at all (`npm run dev` alone is now sufficient, since it never required `DATABASE_URL` after Task 2/3).

- [ ] **Step 1: Delete the files**

```bash
rm docker-compose.yml scripts/start-local.sh
rmdir scripts
```

- [ ] **Step 2: Remove the script**

In `package.json`, remove this line from `scripts`:

```json
    "start:local": "bash scripts/start-local.sh",
```

- [ ] **Step 3: Verify**

Run: `cat package.json | grep -c start:local`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add -A docker-compose.yml scripts package.json
git commit -m "chore: remove local Postgres dev tooling (no longer needed)"
```

---

### Task 5: Strip the web frontend to a single info page

**Files:**
- Delete: `web/src/auth.tsx`, `web/src/api.ts`, `web/src/pages/Login.tsx`, `web/src/pages/Signup.tsx`, `web/src/pages/Dashboard.tsx`
- Modify: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/pages/Landing.tsx` (full rewrites below)

**Interfaces:**
- Produces: `web/src/App.tsx` exports `App` (default) rendering only the landing page for every route; `web/src/main.tsx` no longer wraps `App` in `AuthProvider`.

- [ ] **Step 1: Delete the auth-only frontend files**

```bash
rm web/src/auth.tsx web/src/api.ts
rm web/src/pages/Login.tsx web/src/pages/Signup.tsx web/src/pages/Dashboard.tsx
```

(`web/src/api.ts` is deleted here too — after the pages above are gone, nothing imports `apiFetch`/`ApiError` anymore.)

- [ ] **Step 2: Replace `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>
);
```

- [ ] **Step 3: Replace `web/src/App.tsx`**

```tsx
import { Route, Routes } from 'react-router-dom';

import Landing from './pages/Landing';

const SpikeMark = () => (
    <span className="nav-mark" aria-hidden="true">
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
        >
            <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
        </svg>
    </span>
);

const Nav = () => (
    <header className="nav">
        <a href="/" className="nav-brand">
            <SpikeMark /> AsyncAPI MCP
        </a>
        <nav className="nav-links">
            <a
                href="https://github.com/Souvikns/asyncapi-mcp"
                className="nav-link"
                target="_blank"
                rel="noreferrer"
            >
                GitHub
            </a>
        </nav>
    </header>
);

const App = () => (
    <div className="app">
        <Nav />
        <main>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="*" element={<Landing />} />
            </Routes>
        </main>
        <footer className="footer">
            <div className="footer-inner">
                <div>
                    <span className="footer-brand">
                        <SpikeMark /> AsyncAPI MCP
                    </span>
                    <p>Open source under the MIT license.</p>
                </div>
                <nav className="footer-links">
                    <a href="https://github.com/asyncapi/spec" target="_blank" rel="noreferrer">
                        AsyncAPI Specification
                    </a>
                    <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
                        Model Context Protocol
                    </a>
                </nav>
            </div>
        </footer>
    </div>
);

export default App;
```

- [ ] **Step 4: Replace `web/src/pages/Landing.tsx`**

```tsx
import { useState } from 'react';

const MCP_URL = `${window.location.origin}/mcp`;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "asyncapi": {
      "url": "${MCP_URL}"
    }
  }
}`;

const PLUGIN_SNIPPET = `claude plugin marketplace add Souvikns/asyncapi-mcp
/plugin install asyncapi-mcp@asyncapi-mcp`;

const TOOLS = [
    {
        name: 'search_asyncapi_spec',
        description: 'Search the specification by keyword and get matching snippets back.',
    },
    {
        name: 'get_asyncapi_spec_section',
        description: 'Retrieve any section by heading or slug — "Info Object", "channels", you name it.',
    },
    {
        name: 'validate_asyncapi_spec',
        description: 'Validate raw AsyncAPI YAML or JSON and get detailed validation errors.',
    },
    {
        name: 'list_asyncapi_spec_versions',
        description: 'List all stable spec versions available as GitHub tags.',
    },
    {
        name: 'get_asyncapi_spec_metadata',
        description: 'Get version, source, cache, and size metadata for any spec version.',
    },
];

const FEATURES = [
    {
        title: 'No signup',
        description: 'No account, no API key. Point your client at the server and go.',
    },
    {
        title: 'Version-aware',
        description: 'Query any released spec version, or default to the latest from master.',
    },
    {
        title: 'Spec resources',
        description: 'Expose the full spec as MCP resources: asyncapi://spec/latest and asyncapi://spec/{version}.',
    },
    {
        title: 'Works everywhere',
        description:
            'Claude Code, Claude Desktop, Cursor, VS Code Copilot, Windsurf, Cline, OpenCode, Zed — any MCP client.',
    },
];

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button type="button" className="btn btn-on-dark btn-sm copy-btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
};

const CodeWindow = ({ title, snippet }: { title: string; snippet: string }) => (
    <div className="code-block">
        <div className="code-window-bar">
            <span className="code-window-dot" />
            <span className="code-window-dot" />
            <span className="code-window-dot" />
            <span className="code-window-title">{title}</span>
        </div>
        <CopyButton text={snippet} />
        <pre>
            <code>{snippet}</code>
        </pre>
    </div>
);

const Landing = () => (
    <>
        <section className="hero">
            <div className="hero-grid">
                <div className="hero-copy">
                    <p className="hero-eyebrow">Model Context Protocol Server</p>
                    <h1>The AsyncAPI specification, inside your AI assistant.</h1>
                    <p className="hero-sub">
                        Search, explore, and validate any version of the AsyncAPI spec directly from your coding
                        tool. No signup, no API key — just point your client at the server.
                    </p>
                    <div className="hero-actions">
                        <a href="#setup" className="btn btn-primary">
                            Get started
                        </a>
                        <a
                            href="https://github.com/Souvikns/asyncapi-mcp"
                            className="btn btn-ghost"
                            target="_blank"
                            rel="noreferrer"
                        >
                            View on GitHub
                        </a>
                    </div>
                </div>
                <div className="hero-aside">
                    <CodeWindow title="mcpServers" snippet={CONFIG_SNIPPET} />
                </div>
            </div>
        </section>

        <section className="section">
            <div className="section-head">
                <h2>What your assistant can do</h2>
                <p className="section-sub">
                    Five tools and two resources give your AI full access to the AsyncAPI specification.
                </p>
            </div>
            <div className="card-grid">
                {TOOLS.map(tool => (
                    <div key={tool.name} className="card">
                        <code className="card-code">{tool.name}</code>
                        <p>{tool.description}</p>
                    </div>
                ))}
                <div className="card">
                    <code className="card-code">asyncapi://spec/&#123;version&#125;</code>
                    <p>The full spec served as MCP resources — latest or any tagged release.</p>
                </div>
            </div>
        </section>

        <section className="band-soft">
            <div className="section">
                <div className="section-head">
                    <h2>Built for real workflows</h2>
                    <p className="section-sub">
                        A small server that does one thing well: the spec, at your fingertips.
                    </p>
                </div>
                <div className="card-grid">
                    {FEATURES.map(feature => (
                        <div key={feature.title} className="card-outline">
                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        <section className="section" id="setup">
            <div className="section-head">
                <h2>Up and running in a minute</h2>
                <p className="section-sub">Install it as a plugin, or paste the config into any MCP client.</p>
            </div>
            <div className="setup-inner">
                <div className="steps">
                    <div className="step">
                        <span className="step-number">1</span>
                        <div>
                            <h3>Using Claude Code</h3>
                            <p className="muted">Add the marketplace once, then install the plugin.</p>
                        </div>
                    </div>
                    <div className="step">
                        <span className="step-number">2</span>
                        <div>
                            <h3>Any other MCP client</h3>
                            <p className="muted">Paste this into your client's server configuration.</p>
                        </div>
                    </div>
                </div>
                <CodeWindow title="Claude Code" snippet={PLUGIN_SNIPPET} />
                <CodeWindow title="mcpServers" snippet={CONFIG_SNIPPET} />
            </div>
            <p className="muted ask-examples">
                Then ask things like: "What does the AsyncAPI spec say about server objects?" · "Search the spec for
                'channels'" · "Validate this AsyncAPI document"
            </p>
        </section>

        <section className="section">
            <div className="cta-band-coral">
                <h2>Start using it today</h2>
                <p>Free, open source, and ready when you are.</p>
                <a
                    href="https://github.com/Souvikns/asyncapi-mcp"
                    className="btn btn-on-coral"
                    target="_blank"
                    rel="noreferrer"
                >
                    View on GitHub
                </a>
            </div>
        </section>
    </>
);

export default Landing;
```

- [ ] **Step 5: Verify the frontend builds**

Run: `npm --prefix web run build`
Expected: PASS — `tsc --noEmit && vite build` succeeds with no errors about missing modules (`./auth`, `./api`, `./pages/Login`, etc. are no longer imported anywhere).

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: strip the web frontend to a single no-auth info page"
```

---

### Task 6: Add the Claude Code plugin marketplace manifest

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Produces: a plugin named `asyncapi-mcp` installable via `claude plugin marketplace add Souvikns/asyncapi-mcp` then `/plugin install asyncapi-mcp@asyncapi-mcp`.

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "asyncapi-mcp",
  "description": "Search, explore, and validate the AsyncAPI specification directly from your coding agent.",
  "version": "1.0.0",
  "author": {
    "name": "Souvikns"
  },
  "homepage": "https://github.com/Souvikns/asyncapi-mcp",
  "license": "MIT",
  "mcpServers": {
    "asyncapi": {
      "type": "http",
      "url": "https://asyncapi-mcp.onrender.com/mcp"
    }
  }
}
```

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "asyncapi-mcp",
  "owner": {
    "name": "Souvikns"
  },
  "plugins": [
    {
      "name": "asyncapi-mcp",
      "source": "./",
      "description": "Search, explore, and validate the AsyncAPI specification directly from your coding agent."
    }
  ]
}
```

- [ ] **Step 3: Validate the plugin**

Run: `claude plugin validate .`
Expected: `✔ Validation passed` (or `✔ Validation passed with warnings` — investigate any warning before proceeding, since this is what the future community-marketplace review pipeline runs too).

- [ ] **Step 4: Local install smoke test**

Run: `claude --plugin-dir .` in a separate terminal, then inside that session ask a question that needs the AsyncAPI spec (e.g. "search the AsyncAPI spec for 'channels'").
Expected: Claude Code loads the `asyncapi` MCP server from `.claude-plugin/plugin.json` with zero additional configuration and the tool call succeeds.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin
git commit -m "feat: add Claude Code plugin marketplace manifest"
```

---

### Task 7: Update the README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Replace the Quick Start section**

Find:

```
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
```

Replace with:

```
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
```

- [ ] **Step 2: Simplify local Prerequisites**

Find:

```
#### Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- A PostgreSQL database (e.g. via the included Docker Compose file: `docker compose up -d db`)
```

Replace with:

```
#### Prerequisites

- [Node.js](https://nodejs.org) v20 or later
```

- [ ] **Step 3: Simplify the local Run instructions**

Find:

```
#### Run

Set `DATABASE_URL` so the server can store accounts and API keys:

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/asyncapi_mcp"
```

Streamable HTTP (for local development):
```

Replace with:

```
#### Run

Streamable HTTP (for local development):
```

- [ ] **Step 4: Replace the Authentication section with a Rate Limiting section**

Find:

```
## Authentication & API Keys

The server hosts a small website at its root URL (`/`) where users can sign up with an email and password. After logging in, the dashboard lets you:

- **Create API keys** (multiple keys are supported, e.g. one per device) — the full key is shown only once at creation; only a SHA-256 hash is stored
- **Revoke keys** at any time — revoked keys stop working immediately
- **Copy a ready-made client config** with your key already filled in

The `/mcp` endpoint requires a valid key sent as `Authorization: Bearer <key>`. Requests without a key, or with an invalid/revoked key, receive a `401` response. The `/health` endpoint stays open for platform health checks.

User accounts, sessions, and API keys are stored in **PostgreSQL**, configured via the `DATABASE_URL` environment variable (see [Deployment](#deployment)).

## Configuration for AI Coding Tools
```

Replace with:

```
## Rate Limiting

The `/mcp` endpoint has no authentication — it's rate-limited per IP address instead (60 requests per minute by default). Exceeding the limit returns a `429` response with a `Retry-After` header. The `/health` endpoint is never rate-limited, so platform health checks always succeed. Limits are configurable via the `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` environment variables if you're running your own instance.

## Configuration for AI Coding Tools
```

- [ ] **Step 5: Update the remote client-config intro and add a Claude Code entry**

Find:

```
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
```

Replace with:

```
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
```

(Claude Desktop no longer needs the `mcp-remote` proxy — that was only a workaround for sending a header, and there's no header to send anymore.)

- [ ] **Step 6: Strip `headers` from the remaining client configs**

In the "Configuration for AI Coding Tools" → "Remote (Render hosted)" section, five blocks (Cursor, Windsurf, Cline, OpenCode, Zed) currently end with:

```json
      "url": "https://asyncapi-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
```

In each of those five, replace with:

```json
      "url": "https://asyncapi-mcp.onrender.com/mcp"
```

The sixth block (VS Code Copilot) currently reads:

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

Replace with:

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

- [ ] **Step 7: Update the Local (Self-hosted) config section**

Find:

```
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
```

Replace with:

```
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
```

- [ ] **Step 8: Update the Deployment → Render section**

Find:

```
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
```

Replace with:

```
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
```

- [ ] **Step 9: Update the Self-hosted (Docker) section**

Find:

```
### Self-hosted (Docker)

Build and run with the included `Dockerfile`:

```bash
docker build -t asyncapi-mcp .
docker run -p 3000:3000 -e DATABASE_URL="postgres://..." asyncapi-mcp
```

The HTTP server will be available at `http://localhost:3000/mcp` and the website at `http://localhost:3000/`. The container needs network access to your PostgreSQL instance.
```

Replace with:

```
### Self-hosted (Docker)

Build and run with the included `Dockerfile`:

```bash
docker build -t asyncapi-mcp .
docker run -p 3000:3000 asyncapi-mcp
```

The HTTP server will be available at `http://localhost:3000/mcp` and the website at `http://localhost:3000/`.
```

- [ ] **Step 10: Update the Development section**

Find:

```
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
```

Replace with:

```
### Setup

Requires Node.js v20+:

```bash
npm install
npm run build
npm run dev
```

This builds the website on first run and starts the server. Then visit **http://localhost:3000**, or use `http://localhost:3000/mcp` directly in your MCP client config — no signup or API key needed.

```bash
# Run the HTTP server (local development, serves the built website and the API)
npm run dev
```

- [ ] **Step 11: Verify no stale references remain**

Run: `grep -ni "DATABASE_URL\|api key\|sign up\|signup\|start:local\|mcp-remote\|Authorization: Bearer" README.md`
Expected: no output (empty). If anything matches, fix that specific line before moving on.

- [ ] **Step 12: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README around no-auth hosted access and plugin install"
```

---

### Task 8: Final end-to-end verification

**Files:**
- None (verification only).

- [ ] **Step 1: Full build and test suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass (`asyncapi-parser.test.ts`, `asyncapi-spec.test.ts`, `tools.test.ts`, `rate-limit.test.ts` — `auth.test.ts`/`api-keys.test.ts` no longer exist).

- [ ] **Step 2: Boot the server with no DATABASE_URL and confirm no-auth access**

Run: `NODE_ENV=production PORT=3200 node dist/index.js &` then:

```bash
curl -s http://localhost:3200/health
curl -s -X POST http://localhost:3200/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
```

Expected: `/health` returns `{"status":"ok",...}`; `/mcp` returns a successful `initialize` response with no `Authorization` header sent (confirming auth is fully gone, not just optional).

- [ ] **Step 3: Confirm the rate limit actually triggers**

With the same server still running, run:

```bash
for i in $(seq 1 65); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3200/mcp -X POST -H "Content-Type: application/json" -d '{}'; done | sort | uniq -c
```

Expected: some `429`s appear once past the default 60/minute budget (exact split depends on timing, but at least one `429` should show up in 65 rapid requests). Then stop the background server.

- [ ] **Step 4: Plugin install smoke test**

Run: `claude plugin validate .` (expect `✔ Validation passed`), then `claude --plugin-dir .` and confirm the `asyncapi` MCP server appears and a tool call succeeds (same check as Task 6 Step 4, re-run here as the final gate after all other changes).

- [ ] **Step 5: Report status**

Summarize: tests passing count, build success, manual curl results, plugin validation result. If any step failed, stop and fix before considering this plan complete — do not report success without every step above actually having been run.
