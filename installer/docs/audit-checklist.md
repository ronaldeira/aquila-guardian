# Audit Checklist — aquila-installer-core

This checklist maps each security constraint and success criterion to the exact
file or test that proves it, and provides the commands an auditor can run to
verify each claim independently.

**Working directory for all commands:** `installer/` inside the repo root.

---

## A. Run the test suite

```bash
cd installer && node --test
```

Expected: all tests pass; the integration test is skipped by default (it
requires Docker and `RUN_INTEGRATION=1`).

```bash
cd installer && npm audit --omit=dev --audit-level=high
```

Expected: zero high-severity vulnerabilities in runtime dependencies.

---

## B. Secret handling — state file

| Claim | Evidence |
|---|---|
| Secrets are never written to the state file | `src/state.js` line 4: `ALLOWED_ARTIFACTS = ['vpsId','ip','publicUrl']`; `markStep()` lines 38-40 filters every key against this list before `persist()`. |
| Test proves the invariant | `test/state.test.js` — "state file never contains secret-looking keys" asserts that `ADMIN_PASSWORD`, `WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `TELEGRAM_BOT_TOKEN` are absent from the written JSON. |

**Auditor command:**
```bash
cd installer && node --test test/state.test.js
```

**Auditor read:**
- `src/state.js` lines 1-56 (especially `ALLOWED_ARTIFACTS` and `markStep`).
- `test/state.test.js` lines 27-34.

---

## C. Secret handling — log redaction

| Claim | Evidence |
|---|---|
| Every log line passes through `redact()` | `src/logger.js` lines 7-8: `sink('[' + level + '] ' + redact(msg, secrets))` |
| `redact()` replaces ALL occurrences via split/join | `src/secrets.js` lines 18-20: `str = str.split(String(v)).join('***')` |
| Test proves the invariant | `test/logger.test.js` — "logger redacts live secret values" |

**Auditor command:**
```bash
cd installer && node --test test/logger.test.js
```

**Auditor read:**
- `src/secrets.js` lines 15-22 (`redact` function).
- `src/logger.js` lines 1-16 (`createLogger`).
- `test/logger.test.js`.

---

## D. WEBHOOK_SECRET generation

| Claim | Evidence |
|---|---|
| Generated from CSPRNG, 256-bit entropy | `src/secrets.js` lines 11-13: `crypto.randomBytes(32).toString('hex')` — produces 64 hex chars |
| Test proves length and randomness | `test/secrets.test.js` — "generateWebhookSecret returns 64 hex chars" checks `/^[0-9a-f]{64}$/` and that two calls differ |

**Auditor command:**
```bash
cd installer && node --test test/secrets.test.js
```

**Auditor read:**
- `src/secrets.js` lines 11-13.
- `src/index.js` line 43 (called fresh on each install run).

---

## E. putFile command injection prevention

| Claim | Evidence |
|---|---|
| `remotePath` is always shell-quoted | `src/ssh/connection.js` lines 32-34: `shQuote` wraps in single quotes and escapes internal `'` via `replace(/'/g, "'\\''")` |
| Base64 encoding prevents content injection | `src/ssh/connection.js` line 54: `Buffer.from(content, 'utf8').toString('base64')` |
| Test proves a malicious path is neutralised | `test/ssh-connection.test.js` — "putFile shell-quotes remotePath to prevent command injection" passes `"/opt/aquila/x'; rm -rf / #"` and asserts `capturedCmd.indexOf('tee /opt') === -1` |

**Auditor command:**
```bash
cd installer && node --test test/ssh-connection.test.js
```

**Auditor read:**
- `src/ssh/connection.js` lines 32-61 (`shQuote`, `putFile`, `exec`).
- `test/ssh-connection.test.js` lines 34-70.

---

## F. Orchestrator: structured errors, no throws

| Claim | Evidence |
|---|---|
| All tools return `{ ok, code, message, hint }` — never throw for expected failures | `src/result.js` — `ok()` and `fail()` shapes; every tool uses these |
| SSH phase exceptions caught and converted | `src/index.js` lines 38-60: `try { ... } catch (e) { return fail(...) } finally { ssh.close() }` |
| Test proves `putFile` rejection becomes `{ ok: false }` | `test/orchestrator.test.js` — "putFile rejection resolves to structured fail (does not throw)" |

**Auditor command:**
```bash
cd installer && node --test test/orchestrator.test.js
```

**Auditor read:**
- `src/index.js` lines 38-61.
- `src/result.js`.
- `test/orchestrator.test.js` lines 55-83.

---

## G. Preflight check blocks NAT'd servers

| Claim | Evidence |
|---|---|
| A server without a public IPv4 is rejected before deployment | `src/deploy/preflight.js` lines 14-17: probes `api.ipify.org`; fails if no valid IPv4 returned |
| Test proves the check runs and fails on bad servers | `test/preflight.test.js` — "fails with issues on non-debian without sudo" |

**Auditor command:**
```bash
cd installer && node --test test/preflight.test.js
```

**Auditor read:**
- `src/deploy/preflight.js`.
- `test/preflight.test.js`.

---

## H. No secrets committed to source

**CI secret-scan command** (run by `.github/workflows/installer-ci.yml`):

```bash
! grep -rEn '(TWILIO_AUTH_TOKEN|ADMIN_PASSWORD|WEBHOOK_SECRET)=[^[:space:]]{16,}' \
  --include='*.js' --include='*.json' src test || \
  (echo 'Secret-looking value committed' && exit 1)
```

Auditors can run this command directly from the `installer/` directory.
Expected: no output (grep finds no matches).

**Auditor read:**
- `.github/workflows/installer-ci.yml` (the `Secret scan` step).

---

## I. State is idempotent / resumable

| Claim | Evidence |
|---|---|
| Completed steps are skipped on a second run | Each tool calls `isDone(state, stepName)` before acting |
| Test proves resume returns the same result | `test/orchestrator.test.js` — "resume: second run with completed state still returns url" |

**Auditor read:**
- `src/hostinger/provision.js` lines 5-8.
- `src/hostinger/wait.js` lines 8-9.
- `src/deploy/deploy-aquila.js` lines 32-35.
- `src/deploy/https.js` lines 16-17.
- `test/orchestrator.test.js` lines 44-53.

---

## J. Outbound-destinations audit

The following is the exhaustive list of external hosts contacted. Auditors
should verify by reading the indicated source lines.

| Host | Source |
|---|---|
| `developers.hostinger.com` | `src/hostinger/client.js` line 6 (`baseUrl` default) |
| User's VPS over SSH (port 22) | `src/ssh/connection.js` line 28 (`port: args.port \|\| 22`) |
| `get.docker.com` | `src/deploy/deploy-aquila.js` line 45 |
| `dl.cloudsmith.io` (Caddy apt) | `src/deploy/https.js` lines 26-29 |
| `api.ipify.org` (preflight probe only, not a persistent connection) | `src/deploy/preflight.js` line 15 |
| Let's Encrypt (via sslip.io, initiated by Caddy on first TLS handshake) | `src/deploy/https.js` (Caddy configuration) |

No telemetry endpoints. Verify with:
```bash
grep -rn 'https://' installer/src/
```

---

## K. Dependency audit

```bash
cd installer && npm audit --omit=dev --audit-level=high
```

Only one runtime dependency: `ssh2 ^1.15.0`. Expected output: no high-severity
issues. Any advisory found must be investigated before the package is used in
production.

---

## L. Integration test (opt-in)

```bash
cd installer && RUN_INTEGRATION=1 npm run test:integration
```

Requires Docker on the test machine. Runs a full `runInstall` (BYO-VPS path)
against a Docker container acting as the target server. The test is skipped by
default in CI and unit-test runs.
