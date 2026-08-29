import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import express from 'express';

import { requireApiKey } from './api-keys.js';
import { initDatabase } from './db.js';
import { authRouter } from './routes/auth.js';
import { keysRouter } from './routes/keys.js';
import { registerAsyncApiSpecResources } from './asyncapi-spec.js';
import { registerTools } from './tools.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createMcpExpressApp({ host: '0.0.0.0' });

app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'AsyncAPI MCP Server' });
});

app.use('/api/auth', authRouter);
app.use('/api/keys', keysRouter);
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const mcpServer = new McpServer({
    name: 'AsyncAPI MCP Server',
    description: 'An MCP server implemented using Express.js',
    version: '1.0.0',
});

registerAsyncApiSpecResources(mcpServer);
registerTools(mcpServer);

app.use('/mcp', requireApiKey);

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

await initDatabase();

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
