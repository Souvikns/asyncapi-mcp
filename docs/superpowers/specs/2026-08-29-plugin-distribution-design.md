# AsyncAPI MCP: No-Auth Plugin Distribution

## Context

The server currently requires account-based auth: users sign up on a web
dashboard, create an API key backed by Postgres, and pass it as a Bearer
token to `/mcp`. This was designed for a self-hosted-by-each-user model.

The goal now is a zero-friction install experience: a user adds this
project as a Claude Code plugin (and, for other coding agents, pastes a
plain URL with no headers) and it just works, backed by one shared
hosted instance on Render. Authentication is being dropped in favor of
IP-based rate limiting, and the project gains a `.claude-plugin/`
marketplace so it can be installed via `claude plugin marketplace add` +
`/plugin install` instead of manual JSON config-copying (which remains
available for non-Claude-Code clients, now simpler with no key to
paste).

## Validated groundwork

- **MCP spec**: authorization is explicitly optional for Streamable HTTP
  servers. A fully open server is a conformant deployment, not a
  workaround.
- **Precedent**: DeepWiki's public MCP server runs no-auth,
  rate-limit-only. Context7 runs a similar model with an optional key
  for higher limits — declined here in favor of the simpler no-auth
  model, revisited later if a paid tier is added (see Future
  Considerations).
- **Claude Code plugins**: `mcpServers` entries support a remote
  `"type": "http"` transport with a bare `url` (no `command`, no local
  process). Confirmed directly against `code.claude.com/docs`.
  Installing requires a marketplace (`.claude-plugin/marketplace.json`);
  there is no bare single-plugin install. Any individual can self-publish
  a marketplace with zero approval step — submitting to Anthropic's
  curated/community marketplaces is a separate, optional step not in
  scope here.
- **Rate limiting**: `express-rate-limit`'s in-memory store is
  sufficient for Render's single free instance. `app.set('trust proxy',
  N)` must use a verified numeric hop count, not `true` (which trusts a
  client-forgeable `X-Forwarded-For` header and defeats the limiter).

## Scope decisions (confirmed with project owner)

1. The account system is removed entirely, not kept as an optional
   tier. No Postgres dependency remains anywhere in the deployed
   server.
2. The `web/` React app is kept, but stripped down to a single
   marketing/info page — no login, signup, or dashboard routes.
3. The plugin marketplace lives in this same repository (not a
   separate marketplace-only repo), as `Souvikns/asyncapi-mcp` (matching
   the `fork` git remote and the existing `asyncapi-mcp.onrender.com`
   references already in the README).

## Architecture

```
Client (Claude Code plugin, or manual MCP config in Cursor/VS Code/etc.)
  -> https://asyncapi-mcp.onrender.com/mcp
  -> rate-limit middleware (per-IP bucket, in-memory)
       -> 429 + Retry-After if over budget
       -> otherwise: existing MCP transport/tool handlers (unchanged)
  -> https://asyncapi-mcp.onrender.com/  (static info page, unchanged tools/resources)
  -> https://asyncapi-mcp.onrender.com/health (always open, never rate-limited)
```

The MCP tool/resource layer (`asyncapi-spec.ts`, `asyncapi-parser.ts`,
`tools.ts`) and the stdio transport (`stdio.ts`) are untouched — neither
ever depended on `db.ts`/`auth.ts`/`api-keys.ts`. Only `index.ts` (the
HTTP entrypoint) currently wires those modules in, via
`requireApiKey` and `initDatabase()`.

## Components removed

- `src/auth.ts`, `src/api-keys.ts`, `src/db.ts`
- `src/routes/auth.ts`, `src/routes/keys.ts` (and the `/api/auth`,
  `/api/keys`, catch-all `/api` routes in `index.ts` that wire them up)
- `src/__tests__/auth.test.ts`, `src/__tests__/api-keys.test.ts`
- `pg`, `@types/pg` from `package.json` dependencies
- `docker-compose.yml`, `scripts/start-local.sh` (both exist solely to
  run/wait-for local Postgres)
- `web/src/auth.tsx`, `web/src/pages/Login.tsx`,
  `web/src/pages/Signup.tsx`, `web/src/pages/Dashboard.tsx`, and the
  corresponding routes/nav links in `web/src/App.tsx`. `Landing.tsx`
  becomes the only page; nav simplifies to just the brand mark (no
  login/signup links to show).

## Components added

- `src/rate-limit.ts` — an `express-rate-limit` instance mounted on
  `/mcp` in place of the current `requireApiKey` middleware. Defaults:
  60 requests / 60 seconds per IP, both configurable via
  `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` env vars so the limit can be
  tuned on Render without a code change. `app.set('trust proxy', 1)` as
  a starting point, called out in the PR/README as needing empirical
  verification against Render's actual proxy chain before being treated
  as final (a wrong hop count either disables IP limiting or makes it
  spoofable — either failure mode is silent, so this needs a manual
  check post-deploy: log `req.ip` for a real request and confirm it
  matches the client's actual public IP, not Render's internal one).
- `.claude-plugin/plugin.json` — `name`, `description`, `version`,
  `author`, and an `mcpServers` entry pointing at
  `https://asyncapi-mcp.onrender.com/mcp` with `"type": "http"`.
- `.claude-plugin/marketplace.json` — lists that one plugin from
  `"source": "."`.
- README updates: a new "Install as a Claude Code plugin" quick-start
  path (`claude plugin marketplace add Souvikns/asyncapi-mcp` then
  `/plugin install asyncapi-mcp@asyncapi-mcp`), and removal of the
  signup/API-key steps from every other client's config section — those
  configs drop to a bare `url`, no `headers` block, since there's no key
  to send.

## Error handling

- `/mcp` over the rate limit returns `429` with a JSON body
  (`{ "error": "Too many requests, try again later." }`) and standard
  `RateLimit-*` / `Retry-After` headers (express-rate-limit's default
  `standardHeaders: true`).
- The existing `401` path for missing/invalid API keys is deleted along
  with `requireApiKey` — there is no key to be missing or invalid
  anymore.
- `/health` is exempt from rate limiting so Render's platform health
  checks are never a source of false-positive downtime.

## Testing

- Delete `auth.test.ts` and `api-keys.test.ts` — their subjects no
  longer exist.
- Add `src/__tests__/rate-limit.test.ts`: asserts requests within budget
  return normally and the `(max + 1)`th request in a window returns
  `429`, using a short test-only window/max so the test runs fast.
- `asyncapi-parser.test.ts`, `asyncapi-spec.test.ts`, `tools.test.ts` are
  unaffected and should continue passing unmodified.
- Manual verification after implementation: `claude --plugin-dir .`
  against the modified repo, confirm the MCP server registers with zero
  client-side configuration and tools respond; hit `/mcp` past the rate
  limit against a locally running build and confirm `429` behavior.

## Future considerations (not in scope now)

A paid tier can be layered on later without redoing plugin
distribution: the Claude Code plugin manifest already supports
`headers`/`headersHelper` for a future paid-plugin variant or
user-supplied key, and a lightweight key-check middleware could be
reintroduced purely for elevated limits/gated tools — without
resurrecting the current `users`/`sessions` schema. That would need
*some* persistence again (e.g., a key-to-plan lookup via a managed
store), but that's a separate, later design, not part of this change.
