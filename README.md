# MATLAB from Codex on Windows

Run local MATLAB commands, inspect results, edit scripts, and test changes from a Codex chat. This project installs and configures the **official MathWorks MATLAB MCP Server**; it is an integration toolkit, not a replacement server or an affiliated MathWorks product.

The official server is pinned to **v0.16.0**. Installation checks both its SHA-256 checksum and its Windows Authenticode signature. No Python, MATLAB Engine for Python, API key, or Node packages are needed. The diagnostic tools use Node.js built-ins.

## Requirements

- Windows x64 with licensed MATLAB (tested with R2026b).
- PowerShell and Codex desktop or CLI.
- Node.js 20+ for diagnostics and tests.
- Internet access to GitHub for the initial download.

## Install and connect

Clone this repository into a permanent folder. Moving it afterward breaks the registered executable path.

```powershell
git clone https://github.com/ChaTTy99i/matlab-codex-mcp.git
cd matlab-codex-mcp
.\scripts\setup.ps1 -MatlabRoot 'C:\Program Files\MATLAB\R2026b' -WorkspacePath 'C:\path\to\your\MATLAB-project' -RegisterCodex
codex mcp get matlab
```

The setup script downloads the server into `bin/`, verifies it, backs up the existing Codex configuration, and appends a `matlab` server entry. It preserves other MCP servers and refuses to overwrite an existing MATLAB entry. Without `-RegisterCodex`, it only installs/verifies the binary and writes a configuration preview to `artifacts/codex-config.toml`.

**Restart Codex after registering the server** so the tools become available to the chat. The original setup chat tested the MCP directly using the included diagnostic client; tools added during a chat may require restart before they appear in that chat's tool list.

Windows needs `env_vars = ["WINDIR"]`; the installer includes it. The configuration uses a separate MATLAB session, no desktop, a 120-second startup timeout, a 300-second tool timeout, and disabled MathWorks server telemetry. MATLAB itself must be activated. The session persists across calls made by Codex's running MCP connection, but is separate from any MATLAB session you opened manually.

## Use in chat

Example requests after restarting:

- “Use MATLAB to calculate the eigenvalues of this matrix and show the result.”
- “Read this `.m` file, change the parameter, run it, and explain the output.”
- “Check this script with MATLAB Code Analyzer and fix the reported issues.”
- “Run my MATLAB unit tests and summarize failures.”

| Official tool | Purpose |
| --- | --- |
| `evaluate_matlab_code` | Evaluate commands in the persistent MATLAB workspace |
| `run_matlab_file` | Run `.m` or `.p` files |
| `check_matlab_code` | Static analysis of `.m` code |
| `run_matlab_test_file` | Run MATLAB unit tests |
| `detect_matlab_toolboxes` | Inspect MATLAB/toolbox versions |

Codex can edit `.m` files with its normal file tools; MATLAB commands can also read/write them through MCP. Execution tools run arbitrary MATLAB code with your account's privileges. The starting folder is a convenience, not an access restriction. Keep the connection local and use trusted scripts. Do not call `restoredefaultpath`, which removes server support functions.

## Live Scripts (`.mlx`)

Use `evaluate_matlab_code` with `run('C:\path\valid_name.mlx')`. The official `run_matlab_file` tool only accepts `.m`/`.p`. A filename containing spaces or parentheses may need a copy with a valid MATLAB identifier as its stem. `run` does not refresh saved inline outputs in a Live Script.

For text editing, export a separate `.m` copy through MATLAB:

```matlab
export('C:\path\exercise.mlx', 'C:\path\exercise_editable.m', Run=false);
```

Edit and run the `.m` copy with Codex. This export is a standard MATLAB code file and does not preserve all Live Editor interactivity. Keep the original `.mlx`; use MATLAB's Live Editor to save a final Live Script if needed. No binary `.mlx` editing is performed by this toolkit.

## Verify

```powershell
node --test tests/*.test.mjs
node scripts/cli.mjs tools
node scripts/smoke.mjs
# Optional local Live Script test; nothing is uploaded:
node scripts/smoke.mjs 'C:\path\to\exercise.mlx'
```

The smoke test starts real MATLAB, checks arithmetic, runs a generated script, changes its contents through MCP, reruns it, invokes Code Analyzer, checks error reporting and recovery, and optionally runs a Live Script. For a filename rejection it retries a byte-identical local copy with a valid name and exports editable source. It verifies the original file's SHA-256 remains unchanged. Reports and generated files go to ignored `artifacts/`.

Connector success and optional exercise success are separate report fields. An incomplete exercise can fail while the connector passes. Each diagnostic CLI invocation starts a fresh session; use the smoke test or Codex for multi-step persistent work.

GitHub Actions checks the diagnostic client's transport and PowerShell syntax without MATLAB. It does **not** claim to run the licensed MATLAB integration test. See [the local validation report](docs/VALIDATION.md).

## Troubleshooting

- Server exits before initialization: check filesystem/process permissions and the MathWorks server logs in the Windows temporary folder. Diagnostic execution in a restricted runner may need permission to start MATLAB.
- MATLAB startup or license error: start MATLAB manually once, complete activation, then retry.
- No tools in chat: restart Codex and check `codex mcp get matlab`.
- File cannot run: use an absolute path and a valid MATLAB filename; use `evaluate_matlab_code` for `.mlx`.
- Undefined variable in exercise: complete its missing inputs; this is a script error rather than an MCP connection failure.
- Timeout: execution may still be running. Inspect MATLAB before retrying; repeated commands can duplicate side effects.
- Update: review the upstream release, then update the pinned version and hash together and rerun validation. Do not bypass signature/checksum verification.

To disconnect, run `codex mcp remove matlab` and restart Codex. The configuration backup is beside your Codex `config.toml`. Removing the server entry does not delete MATLAB or your scripts.

## Repository scope

Only setup scripts, diagnostics, tests, and documentation belong here. MATLAB binaries, generated reports, machine-specific config, and course materials are excluded. No MATLAB license or third-party redistribution rights are granted. See [THIRD_PARTY.md](THIRD_PARTY.md).

## Sources

- [Official MathWorks MATLAB MCP server](https://github.com/matlab/matlab-mcp-server)
- [Pinned v0.16.0 release](https://github.com/matlab/matlab-mcp-server/releases/tag/v0.16.0)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp)
- [MATLAB run documentation](https://www.mathworks.com/help/matlab/ref/run.html)
- [MATLAB Live Script export documentation](https://www.mathworks.com/help/matlab/ref/export.html)
