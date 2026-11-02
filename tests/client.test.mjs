import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { MatlabClient, matlabString } from '../scripts/client.mjs';

test('MATLAB literals safely quote apostrophes and preserve Windows paths', () => {
  assert.equal(matlabString("C:\\Student's work\\a.m"), "'C:\\Student''s work\\a.m'");
  assert.throws(() => matlabString('line1\nline2'), /line breaks/);
  assert.throws(() => matlabString('file\0.m'), /NUL/);
});

test('MCP handshake, pagination, concurrent response matching and server errors', async () => {
  const client = new MatlabClient({ binary: process.execPath,
    serverArgs: [fileURLToPath(new URL('./fixtures/server.mjs', import.meta.url))], timeoutMs: 5000 });
  try {
    assert.equal((await client.initialize()).serverInfo.name, 'fixture');
    assert.deepEqual((await client.tools()).map(x => x.name), ['first', 'second']);
    const results = await Promise.all(['one', 'two'].map(code => client.call('evaluate', { code })));
    assert.deepEqual(results.map(x => x.content[0].text), ['one', 'two']);
    await assert.rejects(client.request('unknown'), /Unknown method/);
    client.timeoutMs = 30;
    await assert.rejects(client.request('hang'), /timed out/);
    assert.equal(client.pending.size, 0);
  } finally { await client.close(); }
});

test('Missing server executable fails without hanging', async () => {
  const client = new MatlabClient({ binary: 'this-mcp-executable-does-not-exist', timeoutMs: 1000 });
  try { await assert.rejects(client.initialize(), /ENOENT/); }
  finally { await client.close(); }
});
