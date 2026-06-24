# Threat Model — aquila-installer-core

**Scope:** Subsystem A of the Aquila Guardian installer. Covers the install run
only — from operator invocation through `runInstall` to a verified healthy
deployment. Runtime operation of the deployed container is out of scope.

**Methodology:** STRIDE-style enumeration. Each entry lists the threat,
likelihood (Low / Medium / High), the mitigation in place or the accepted risk,
and the current status.

---

## T-01 Stolen Hostinger API token

**Threat:** An attacker obtains the operator's Hostinger API token and uses it
to provision VMs on their account or list existing ones.

**Likelihood:** Medium (tokens are long-lived bearer tokens if not rotated).

**Mitigation:**
- The token is passed as a runtime argument; it is never persisted to disk by
  this package (`ALLOWED_ARTIFACTS` in `src/state.js` does not include it).
- The token is always redacted in logs via `redact()` in `src/secrets.js` and
  `createLogger` in `src/logger.js`.
- The token is scoped to the operator's own Hostinger account — an attacker
  with the token can only affect that account.
- Operators should rotate the token after each install and use a scoped API key
  if Hostinger's API supports it.

**Status:** Mitigated (no persistence or logging). Rotation policy is the
operator's responsibility.

---

## T-02 SSH man-in-the-middle (MITM)

**Threat:** An attacker positioned between the install machine and the VPS
intercepts the SSH connection, captures credentials, or injects malicious
commands into the deploy stream.

**Likelihood:** Low (requires network-level attacker; less likely on a freshly
provisioned VPS with a known IP).

**Mitigation (current):**
- `ssh2` performs an SSH handshake and encrypts the channel.
- The SSH connection uses key-based auth on the Hostinger path (private key
  never leaves the install machine); password is accepted on the BYO-VPS path.
- **The remote host key is not pinned or verified in the current
  implementation.** `connectSsh` in `src/ssh/connection.js` does not set
  `hostVerifier`, so the server's host key is accepted on first connect.

**Accepted risk / deferred:** SSH host-key pinning is deferred to a follow-up.
Operators running the BYO-VPS path against a server they trust over a trusted
network have lower exposure. The Hostinger path provisions a brand-new VM whose
IP has not previously been used, reducing impersonation risk.

**Status:** Partially mitigated (encrypted channel). Host-key pinning **deferred**.

---

## T-03 Malicious or unpinned Docker image

**Threat:** The Docker image pulled onto the VPS has been tampered with
(supply-chain attack on `ghcr.io`) or is not the intended build.

**Likelihood:** Low (GitHub Container Registry with automated builds from a
controlled repo).

**Mitigation (current):**
- The image is specified by the operator at call time (`opts.image`) and
  referenced by tag in the `docker-compose.yml` written to the server.
- The compose file uses `image:` (not `build:`), so only the published image is
  used — no local build artifact is transferred.

**Accepted risk / deferred:** Image-digest pinning (replacing tag references
with `sha256:` digests) is deferred. Tags are mutable; pinning to a digest
would provide a stronger integrity guarantee.

**Status:** Accepted. Digest pinning **deferred**.

---

## T-04 sslip.io availability or NAT limitation

**Threat A — availability:** `sslip.io` is a third-party service. If it is
unavailable, DNS resolution for the `publicUrl` fails and TLS certificate
issuance via Let's Encrypt fails.

**Threat B — NAT:** A BYO-VPS behind NAT does not have a public IPv4. The
`preflightCheck` in `src/deploy/preflight.js` will catch this (it probes the
server's outbound IPv4 via `api.ipify.org`) and return
`{ ok: false, code: 'PREFLIGHT_FAILED' }` before any deployment step runs.
However, the operator has no automated fallback.

**Likelihood:** Low (sslip.io is a well-maintained free service) / Medium
(NAT is common in home or corporate environments).

**Mitigation (current):**
- `preflightCheck` blocks NAT'd servers early with a clear error message
  (`'No public IPv4 was detected...'`).
- The `publicUrl` is derived deterministically from the IP:
  `ipToSslip(ip)` in `src/deploy/https.js` — no external lookup is required
  to compute the URL, only for DNS to resolve it.

**Accepted risk / deferred:** A Cloudflare Tunnel fallback for NAT'd servers
is a known follow-up (deferred from the initial scope). Operators behind NAT
must use a server with a public IP.

**Status:** NAT case blocked by preflight (mitigated). sslip.io availability
**accepted**. Cloudflare Tunnel fallback **deferred**.

---

## T-05 Secret leakage via logs

**Threat:** A secret value (API token, SSH password, `ADMIN_PASSWORD`, etc.)
appears in log output and is captured by a log aggregator or visible in a
terminal session.

**Likelihood:** Medium (logging is pervasive; secrets are handled throughout
the install flow).

**Mitigation:**
- `src/secrets.js` `redact(text, extraValues)` replaces all occurrences of
  each supplied secret value with `***` using a split/join approach
  (`src/secrets.js` lines 15-22).
- `src/logger.js` `createLogger` wraps every emitted line through `redact`
  with the live secrets array (`src/logger.js` lines 7-8).
- Verified by `test/logger.test.js` — "logger redacts live secret values".

**Status:** Mitigated (code verified, test present).

---

## T-06 Secret leakage via install-state file

**Threat:** The state file written to `stateDir/<installId>.json` contains a
secret value, which is then read by another process, shipped to a logging
system, or included in a bug report.

**Likelihood:** Medium (state files persist on disk).

**Mitigation:**
- `src/state.js` `ALLOWED_ARTIFACTS` whitelist (`['vpsId', 'ip', 'publicUrl']`)
  is applied in `markStep()` before every write. Keys outside this list are
  silently discarded (`src/state.js` lines 38-40).
- Verified by `test/state.test.js` — "state file never contains secret-looking
  keys" (checks `ADMIN_PASSWORD`, `WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`,
  `TELEGRAM_BOT_TOKEN`).

**Status:** Mitigated (code verified, test present).

---

## T-07 remotePath command injection in putFile

**Threat:** An attacker-controlled value is passed as `remotePath` to
`putFile()`, injecting shell commands into the SSH exec call.

**Likelihood:** Low (the calling code uses hard-coded paths; no user input
reaches `remotePath` in the current codebase).

**Mitigation:**
- `shQuote(s)` in `src/ssh/connection.js` (lines 32-34) single-quote escapes
  the path: it wraps the value in `'...'` and replaces any internal `'` with
  `'\''`, making shell injection impossible regardless of input content.
- `putFile` also validates that `remotePath` is a non-empty string before
  constructing the command.
- Verified by `test/ssh-connection.test.js` — "putFile shell-quotes remotePath
  to prevent command injection" (passes `"/opt/aquila/x'; rm -rf / #"` and
  confirms the raw path does not appear after `tee`).

**Trust-boundary invariant:** `remotePath` is constructed from internal
constants only. It must never be derived from untrusted user input. This is a
documented invariant — the shell quoting is defence-in-depth, not a licence to
accept arbitrary paths from external sources.

**Status:** Mitigated (code verified, test present). Input-origin constraint
**documented**.

---

## T-08 Dependency vulnerability in ssh2

**Threat:** A vulnerability in `ssh2` (the only runtime dependency) is
exploited during the install run.

**Likelihood:** Low (actively maintained library; no known critical CVEs at
time of writing).

**Mitigation:**
- `npm audit --omit=dev --audit-level=high` runs in CI on every push
  (`.github/workflows/installer-ci.yml`).
- Dev dependencies are excluded from the audit scope.

**Status:** Monitored via CI. Operators should run `npm audit` before each
production install.

---

## Known follow-ups (accepted/deferred, not blocking)

| Item | Status |
|---|---|
| SSH host-key pinning | Deferred |
| Docker image digest pinning | Deferred |
| Cloudflare Tunnel fallback for NAT'd BYO-VPS | Deferred |
