import { McpServer } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { registerAsyncApiSpecResources } from './asyncapi-spec.js';
import { registerTools } from './tools.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createMcpExpressApp({ host: '0.0.0.0' });

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

app.post('/mcp', async (req, res) => {
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
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
