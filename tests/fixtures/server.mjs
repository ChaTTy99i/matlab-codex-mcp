import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const message = JSON.parse(line);
  if (message.id === undefined || message.method === 'hang') return;
  const response = { jsonrpc: '2.0', id: message.id };
  if (message.method === 'initialize') response.result = { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fixture', version: '1' } };
  else if (message.method === 'tools/list') response.result = message.params.cursor ? { tools: [{ name: 'second' }] } : { tools: [{ name: 'first' }], nextCursor: 'page2' };
  else if (message.method === 'tools/call') response.result = { content: [{ type: 'text', text: message.params.arguments.code }] };
  else response.error = { code: -32601, message: 'Unknown method' };
  process.stdout.write(JSON.stringify(response) + '\n');
});
