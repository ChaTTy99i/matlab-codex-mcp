import { MatlabClient } from './client.mjs';
const client = new MatlabClient();
try {
  const initialized = await client.initialize();
  const [action, name, json] = process.argv.slice(2);
  if (action === 'tools') console.log(JSON.stringify({ initialized, tools: await client.tools() }, null, 2));
  else if (action === 'call' && name) console.log(JSON.stringify(await client.call(name, JSON.parse(json || '{}')), null, 2));
  else throw new Error('Usage: node scripts/cli.mjs tools | call TOOL_NAME JSON_ARGUMENTS');
} finally { await client.close(); }
