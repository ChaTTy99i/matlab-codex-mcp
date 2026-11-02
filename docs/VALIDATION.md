# Local validation

Validated on 2 November 2026 using Windows x64, MATLAB R2026b, Node.js v24.22.1 and the official MathWorks MATLAB MCP server v0.16.0.

| Check | Result |
| --- | --- |
| Executable provenance | Pinned SHA-256 matched; MathWorks Authenticode signature valid |
| Protocol connection | Initialized and discovered five official tools |
| Command execution | Arithmetic evaluated in real MATLAB |
| Script execution and editing | Generated script ran, changed through MCP, reran with changed result |
| Static analysis | MATLAB Code Analyzer invoked successfully |
| Error reporting and recovery | Intentional MATLAB error returned; next command succeeded |
| Live Script handling | Valid-name Live Script ran; source export and input hashes checked |
| Synthetic plotting example | Ran successfully through MCP and the visible desktop runner |
| Saved inline output workflow | Live Editor Run All and Save verified locally |
| Diagnostic transport tests | Three automated tests passed |
| PowerShell | Installer and visible runner parsed successfully |

Detailed machine-specific reports and images stay in ignored artifacts/. Exact worked examples and their data belong in separate private example repositories.

The visible runner launches a separate MATLAB desktop and leaves figures open. It does not automate Live Editor Run/Save or attach to an existing MATLAB session. The Live Editor workflow was checked separately.

GitHub Actions runs transport tests and PowerShell syntax checks. It does not run licensed MATLAB. Reproduce local MATLAB checks:

```powershell
node --test tests/*.test.mjs
node scripts/smoke.mjs examples/plot_demo.m
.\scripts\run-visible.ps1 -ScriptPath .\examples\plot_demo.m
```

Inspect both connectorPassed and scriptPassed in artifacts/smoke-report.json. Script failures are reported separately from connector health. Restart Codex after registering an MCP server before expecting its tools in chat.
