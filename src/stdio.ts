import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAsyncApiSpecResources } from './asyncapi-spec.js';
import { registerTools } from './tools.js';

const mcpServer = new McpServer({
    name: 'AsyncAPI MCP Server',
    description: 'An MCP server implemented using stdio transport',
    version: '1.0.0',
});

registerAsyncApiSpecResources(mcpServer);
registerTools(mcpServer);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);