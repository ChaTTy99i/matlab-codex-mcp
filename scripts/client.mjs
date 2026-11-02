import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const matlabString = value => {
  const text = String(value);
  if (/[\r\n\0]/.test(text)) throw new Error('MATLAB path literals cannot contain line breaks or NUL');
  return `'${text.replaceAll("'", "''")}'`;
};

// Diagnostic client; Codex connects directly to the official server.
export class MatlabClient {
  constructor({ binary = path.join(projectRoot, 'bin', 'matlab-mcp-server-windows-x64.exe'),
    matlabRoot = process.env.MATLAB_ROOT || 'C:\\Program Files\\MATLAB\\R2026b',
    workspace = path.resolve(projectRoot, '..'), timeoutMs = 300_000, serverArgs } = {}) {
    this.pending = new Map();
    this.nextId = 1;
    this.timeoutMs = timeoutMs;
    this.stderr = '';
    this.process = spawn(binary, serverArgs ?? ['--matlab-root=' + matlabRoot,
      '--initial-working-folder=' + workspace, '--matlab-display-mode=nodesktop',
      '--matlab-session-mode=new', '--disable-telemetry=true'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: process.env
    });
    this.process.stderr.on('data', data => { this.stderr = (this.stderr + data).slice(-12000); });
    this.process.stdin.on('error', error => this.rejectAll(error));
    this.process.on('error', error => this.rejectAll(error));
    this.process.on('exit', (code, signal) => {
      this.rejectAll(new Error(`MCP server exited (${code ?? signal}): ${this.stderr}`));
    });
    this.lines = createInterface({ input: this.process.stdout });
    this.lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); }
      catch { this.rejectAll(new Error('Invalid MCP JSON: ' + line.slice(0, 500))); return; }
      if (message.method && message.id !== undefined) {
        // No interactive client features are advertised.
        this.send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not supported' } });
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }
  rejectAll(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  send(message) { this.process.stdin.write(JSON.stringify(message) + '\n'); }
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out; execution may still be running. Close the client before retrying.`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }
  async initialize() {
    const result = await this.request('initialize', { protocolVersion: '2024-11-05',
      capabilities: {}, clientInfo: { name: 'matlab-codex-diagnostics', version: '1.0.0' } });
    this.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return result;
  }
  async tools() {
    const all = [];
    let cursor;
    do {
      const page = await this.request('tools/list', cursor ? { cursor } : {});
      all.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    return all;
  }
  call(name, args) { return this.request('tools/call', { name, arguments: args }); }
  async close() {
    this.process.stdin.end();
    if (this.process.exitCode !== null || this.process.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { this.process.kill(); resolve(); }, 5000);
      this.process.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    this.lines.close();
  }
}
