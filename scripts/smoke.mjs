import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { MatlabClient, matlabString, projectRoot } from './client.mjs';

const outDir = path.join(projectRoot, 'artifacts');
await mkdir(outDir, { recursive: true });
const client = new MatlabClient();
const report = { startedAt: new Date().toISOString(), checks: [] };
const textOf = result => (result.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
async function check(label, name, args, marker) {
  console.log('Testing: ' + label);
  const result = await client.call(name, args);
  report.checks.push({ label, result });
  assert.ok(!result.isError, `${label}: ${textOf(result)}`);
  if (marker) assert.ok(textOf(result).includes(marker), `${label}: missing ${marker}: ${textOf(result)}`);
  return result;
}
try {
  report.server = await client.initialize();
  report.tools = await client.tools();
  assert.ok(report.tools.some(tool => tool.name === 'evaluate_matlab_code'));
  await check('MATLAB starts and evaluates a command', 'evaluate_matlab_code', {
    code: "assert(2+2 == 4); disp(['MATLAB_RELEASE=' version('-release')]); disp('COMMAND_OK');"
  }, 'COMMAND_OK');
  const script = path.join(outDir, 'editable_smoke.m');
  await writeFile(script, "mcpSmokeValue = 6 * 7;\nassert(mcpSmokeValue == 42);\ndisp('SCRIPT_V1_OK');\n");
  await check('Run a script from disk', 'run_matlab_file', { script_path: script }, 'SCRIPT_V1_OK');
  // Exercise actual writes through the MATLAB MCP tool, then verify from Node.
  await check('Edit a script through MCP and run the changed contents', 'evaluate_matlab_code', {
    code: String.raw`fid = fopen(${matlabString(script)}, 'w'); assert(fid >= 0); fprintf(fid, 'mcpSmokeValue = 7 * 7;\nassert(mcpSmokeValue == 49);\ndisp(''SCRIPT_V2_OK'');\n'); fclose(fid); run(${matlabString(script)});`
  }, 'SCRIPT_V2_OK');
  assert.ok((await readFile(script, 'utf8')).includes('7 * 7'));
  await check('Code Analyzer on the edited script', 'check_matlab_code', { script_path: script });
  console.log('Testing: MATLAB errors are returned to the client');
  const error = await client.call('evaluate_matlab_code', { code: "error('MCP:ExpectedFailure', 'MCP_EXPECTED_ERROR');" });
  report.checks.push({ label: 'Expected MATLAB error', result: error });
  assert.ok(textOf(error).includes('MCP_EXPECTED_ERROR'));
  await check('Session remains usable after an error', 'evaluate_matlab_code', { code: "disp('RECOVERY_OK');" }, 'RECOVERY_OK');

  const inputScript = process.argv[2];
  if (inputScript) {
    const full = path.resolve(inputScript);
    const extension = path.extname(full).toLowerCase();
    assert.ok(['.m','.mlx'].includes(extension),'Local script must be .m or .mlx');
    const before = createHash('sha256').update(await readFile(full)).digest('hex');
    console.log('Testing unchanged MATLAB script: ' + full);
    // run_matlab_file only supports .m/.p. MATLAB run() handles Live Scripts.
    const result = await client.call('evaluate_matlab_code', { code: `run(${matlabString(full)});` });
    report.script = { path: full, sha256Before: before, directResult: result };
    let executionResult = result;
    if (textOf(result).includes('MATLAB:run:CannotExecute')) {
      const copy = path.join(outDir, 'script_under_test' + extension);
      await copyFile(full, copy);
      assert.equal(createHash('sha256').update(await readFile(copy)).digest('hex'), before);
      console.log('Retrying identical contents with a valid MATLAB filename.');
      executionResult = report.script.copyResult = await client.call('evaluate_matlab_code', { code: `run(${matlabString(copy)});` });
      console.log('Script copy result: ' + textOf(executionResult));
      if (extension === '.mlx') {
        const exported = path.join(outDir, 'script_editable.m');
        report.script.exportResult = await check('Export Live Script to editable MATLAB source', 'evaluate_matlab_code', {
          code: `export(${matlabString(copy)}, ${matlabString(exported)}, Run=false); disp('EXPORT_OK');`
        }, 'EXPORT_OK');
        assert.ok((await readFile(exported, 'utf8')).trim().length > 0,'Exported source is empty');
      }
    }
    const after = createHash('sha256').update(await readFile(full)).digest('hex');
    assert.equal(after, before, 'Original exercise was modified');
    report.script.sha256After = after;
    report.scriptPassed = !executionResult.isError;
    console.log('Script result: ' + textOf(executionResult));
    console.log('Optional script passed: ' + report.scriptPassed);
    // User script errors are separate from connector checks.
  }
  report.connectorPassed = true;
  console.log('All connector checks passed.');
} catch (error) {
  report.connectorPassed = false;
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(outDir, 'smoke-report.json'), JSON.stringify(report, null, 2) + '\n');
  await client.close();
}
