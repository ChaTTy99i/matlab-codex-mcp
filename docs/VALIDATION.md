# Local validation

Tested on **2 November 2026** on Windows x64, MATLAB **R2026b**, Node.js **v24.22.1**, official MATLAB MCP server **v0.16.0**. Real MATLAB checks were performed through MCP JSON-RPC over standard input/output, not through a shell-only MATLAB batch command.

| Check | Result |
| --- | --- |
| Official executable SHA-256 | Matched pinned hash |
| Windows digital signature | Valid; The MathWorks, Inc. |
| MCP initialization and tool discovery | Passed; five official tools |
| MATLAB startup and arithmetic | Passed; release reported 2026b |
| Execute generated `.m` script | Passed; result 42 |
| Rewrite script through MCP and rerun | Passed; changed result 49 |
| Code Analyzer | Passed; no issues in edited test script |
| Intentional MATLAB error returned to client | Passed |
| Command after the intentional error | Passed |
| Live Script export to editable `.m` | Passed |
| Original exercise hash before/after | Identical |
| Codex registration read-back | Enabled stdio server, correct executable, WINDIR forwarding and timeouts |
| Diagnostic client automated tests | 3 passed |
| Installer PowerShell syntax validation | Passed |

Verified executable SHA-256:

```text
7C70FDC69E7E7D4762732FEDE64F348B18ECBC89C3DE705F9DDE89A86D1883EA
```

## Exercise outcome

The requested local electrocatalytic-film exercise was attempted without modifying it. Its original filename contains spaces and parentheses; direct MATLAB `run` rejected the name with `MATLAB:run:CannotExecute`.

A byte-identical copy named `exercise_under_test.mlx` executed and stopped at the first missing exercise input:

```text
Unrecognized function or variable 'y'.
solinit = bvpinit(y, @guess);
```

The input contains unfinished exercise sections. Other inputs such as `E`, `q0`, and `Da2` are also left for the student; these later failures were not reached. The full numerical solution was therefore **not** validated. The connector correctly reported the MATLAB error. Solving the exercise is separate from connecting MATLAB.

The exact copy, editable export and detailed machine-specific JSON report are stored locally under ignored `artifacts/`. The original exercise and course materials are not part of the repository.

## Limits

The newly registered server must be loaded by restarting Codex before its tools appear in the chat. Registration and direct MCP operation were verified; a post-restart call from the current chat cannot be claimed before that restart. A separate MATLAB session is used; attaching to an existing interactive desktop session was not tested. GitHub CI uses a mock protocol server and does not require or run licensed MATLAB.
