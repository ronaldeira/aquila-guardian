# Security — aquila-installer-core

This document describes the security model of the Aquila installer core
(Subsystem A). It is intended for security reviewers, auditors, and operators.

For threat-model details see `docs/threat-model.md`.
For a reviewer-runnable checklist see `docs/audit-checklist.md`.

---

## 1. Secret handling

### 1.1 Secrets are never persisted to install-state

`src/state.js` defines an explicit `ALLOWED_ARTIFACTS` whitelist:

```js
// src/state.js line 4
var ALLOWED_ARTIFACTS = ['vpsId', 'ip', 'publicUrl'];
```

`markStep()` filters every artifact through this whitelist before writing to
disk. Any key not in `['vpsId', 'ip', 'publicUrl']` is silently dropped — it
is impossible for `ADMIN_PASSWORD`, `WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, or any SSH credential to appear in
a state file.

This invariant is covered by the test
`test/state.test.js` — "state file never contains secret-looking keys":

```js
// test/state.test.js lines 27-34
test('state file never contains secret-looking keys', function () {
  ...
  ['ADMIN_PASSWORD', 'WEBHOOK_SECRET', 'TWILIO_AUTH_TOKEN', 'TELEGRAM_BOT_TOKEN']
    .forEach(function (k) { assert.ok(raw.indexOf(k) === -1); });
});
```

### 1.2 Secrets are redacted in all log output

`src/secrets.js` exports `redact(text, extraValues)`:

```js
// src/secrets.js lines 15-22
function redact(text, extraValues) {
  var str = String(text == null ? '' : text);
  var values = (extraValues || []).filter(Boolean);
  values.forEach(function (v) {
    str = str.split(String(v)).join('***');
  });
  return str;
}
```

The split/join approach replaces **all** occurrences of each secret value, not
just the first.

`src/logger.js` `createLogger` calls `redact` on every emitted line, passing
the live secrets array:

```js
// src/logger.js lines 7-8
function emit(level, msg) {
  sink('[' + level + '] ' + redact(msg, secrets));
}
```

The `secrets` array is supplied by the caller when the logger is created, so
the current runtime values are always used. This is verified by
`test/logger.test.js` — "logger redacts live secret values".

### 1.3 WEBHOOK_SECRET generation

The `WEBHOOK_SECRET` injected into the container's `.env` is generated
locally by `src/secrets.js`:

```js
// src/secrets.js lines 11-13
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}
```

This produces 64 hex characters (256 bits of CSPRNG entropy). It is generated
fresh for each install run (`src/index.js` line 43:
`webhookSecret: generateWebhookSecret()`). It is never logged and never
persisted to state.

### 1.4 Secret keys registry

`src/secrets.js` exports `SECRET_KEYS`:

```js
var SECRET_KEYS = [
  'ADMIN_PASSWORD', 'WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'
];
```

This list is used by CI (`installer-ci.yml`) as the basis for the secret-scan
grep and by tests to verify `ALLOWED_ARTIFACTS` does not overlap with secret
key names.

---

## 2. SSH model

`src/ssh/connection.js` wraps the `ssh2` library.

### 2.1 Authentication

| Entry point | Auth method |
|---|---|
| Hostinger | Key-based (`privateKey` field). The public key is injected into the VPS at provision time via the Hostinger API. |
| BYO-VPS | `privateKey` (preferred) or `password` (accepted for convenience). Both are supported by `connectSsh`. |

The raw credential is passed directly to `ssh2` and is never logged or stored.

### 2.2 Ready timeout

The `ssh2` `connect()` call uses `readyTimeout` (default **20 000 ms** if not
set by the caller — see `src/ssh/connection.js` line 27). A connection that
does not complete the SSH handshake within this window resolves as
`{ ok: false, code: 'SSH_FAILED', ... }`.

### 2.3 putFile — base64 encoding and shell quoting

`putFile(content, remotePath)` transfers a file to the remote server by
encoding the content as Base64 and piping it through `base64 -d | sudo tee`:

```js
// src/ssh/connection.js lines 54-55
var b64 = Buffer.from(content, 'utf8').toString('base64');
return exec("echo '" + b64 + "' | base64 -d | sudo tee " + shQuote(remotePath) + " > /dev/null")
```

`shQuote(s)` single-quote escapes the remote path:

```js
// src/ssh/connection.js lines 32-34
function shQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}
```

This prevents shell command injection via a malicious `remotePath` value.

**Important trust-boundary note:** `remotePath` is constructed entirely from
internal constants (`remoteDir` defaults to `/opt/aquila`; the file names
`.env`, `docker-compose.yml`, and `/etc/caddy/Caddyfile` are hard-coded).
The caller must never pass untrusted user input as `remotePath`. This is a
documented invariant, not a runtime guard.

The injection-prevention is covered by
`test/ssh-connection.test.js` — "putFile shell-quotes remotePath to prevent
command injection", which passes a deliberately malicious path
(`/opt/aquila/x'; rm -rf / #`) and confirms the raw unquoted path never
appears after `tee` in the constructed command.

### 2.4 SSH host-key verification

The current implementation does not pin or verify the remote host key. This is
a known accepted risk for the initial release (see `docs/threat-model.md` —
"SSH MITM"). Host-key pinning is deferred to a follow-up.

---

## 3. Trust boundary

- This package **never receives user personal data**. The secrets it handles
  are operational credentials (API tokens, passwords) supplied by the operator
  for their own account.
- Payment is a public on-chain transaction handled by Subsystem C. This package
  has no access to payment instruments or card data.
- The only outbound connections are to services the operator already has an
  account with (Hostinger, their own VPS) or well-known public infrastructure
  (`get.docker.com`, Caddy's apt repo, Let's Encrypt via `sslip.io`).
- No data is sent to any Aquila or third-party analytics endpoint.

---

## 4. Dependency surface

Runtime dependency: `ssh2 ^1.15.0` (SSH client — no transitive secrets
handling).

The CI workflow runs `npm audit --omit=dev --audit-level=high` on every push.
Dev-only dependencies are excluded from the audit scope as they are not shipped.

---

## 5. Responsible disclosure

To report a security vulnerability in this package:

1. **Do not open a public GitHub issue.**
2. Email **ronaldodublin5511@gmail.com** with the subject line
   `[SECURITY] aquila-installer-core`.
3. Include a description of the vulnerability, reproduction steps, and any
   proof-of-concept code.
4. We aim to acknowledge receipt within 48 hours and provide a remediation
   timeline within 7 days.

For non-sensitive bugs, open a GitHub issue as normal.
