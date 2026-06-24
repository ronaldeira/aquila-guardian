# aquila-installer-core

Subsystem A of the Aquila Guardian installer. Provisions a VPS (or reuses an
existing one), connects over SSH, and deploys the Aquila Guardian Docker image
with HTTPS via Caddy and sslip.io — all in a resumable, idempotent run.

- **Package name:** `aquila-installer-core`
- **Main entry:** `src/index.js`
- **Node.js requirement:** `>=20.0.0`
- **Only runtime dependency:** `ssh2 ^1.15.0`

---

## Two entry points

### Hostinger auto-provision

Pass `entryPoint: 'hostinger'` and a pre-built Hostinger REST client
(`deps.client`) plus an SSH public key (`deps.sshPublicKey`). The orchestrator
calls `provisionVps` then `waitForVps` to obtain the server IP, then continues
with the shared SSH phase.

### BYO-VPS

Pass `entryPoint: 'byo'` and supply your own server via `deps.sshTarget`
(`{ host, port?, username?, privateKey?, password? }`). The orchestrator skips
provisioning, connects over SSH, and `preflightCheck` gates all further steps —
it verifies Ubuntu/Debian OS, passwordless sudo, and a reachable public IPv4.

---

## The six tools

All tools are exported from `src/index.js` alongside `runInstall`.  
Every tool returns `{ ok: true, ...data }` on success or
`{ ok: false, code, message, hint }` on failure — they never throw for expected
failures. Error codes are defined in `src/result.js`.

### `provisionVps(args)` — `src/hostinger/provision.js`

```
args.client       — Hostinger REST client (see createHostingerClient)
args.sshPublicKey — string, public key to inject into the new VPS
args.state        — install-state object (idempotent: skips if already done)
args.plan?        — VPS plan slug, default 'kvm1'
args.datacenter?  — region, default 'eu'
args.label?       — VPS label, default 'aquila-guardian'

Returns: { ok: true, vpsId: string }
```

Calls `POST /api/vps/v1/virtual-machines` on the Hostinger API. If the
`provision` step is already recorded in state it returns immediately without
making a second API call (idempotent).

### `waitForVps(args)` — `src/hostinger/wait.js`

```
args.client      — Hostinger REST client
args.vpsId       — string
args.state       — install-state object
args.timeoutMs?  — poll deadline in ms, default 600000 (10 min)
args.pollMs?     — interval between polls, default 10000 (10 s)

Returns: { ok: true, ip: string }
```

Polls `GET /api/vps/v1/virtual-machines/:id` until `state === 'running'` and
an IPv4 address is present. Returns `{ ok: false, code: 'TIMEOUT', ... }` if
the deadline is exceeded.

### `preflightCheck(args)` — `src/deploy/preflight.js`

```
args.ssh — SSH interface (exec, putFile, close)

Returns: { ok: true, issues: [] }
```

Runs three checks over SSH:
1. `/etc/os-release` — must match `ID=ubuntu` or `ID=debian`.
2. `sudo -n true` — the SSH user must be able to use sudo without a password.
3. `curl -s -4 https://api.ipify.org` — the server must have a public IPv4
   (required for Twilio voice calls; also needed for sslip.io TLS).

Returns `{ ok: false, code: 'PREFLIGHT_FAILED', issues: string[] }` listing
every failure found.

### `deployAquila(args)` — `src/deploy/deploy-aquila.js`

```
args.ssh           — SSH interface
args.secrets       — { ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN?, TWILIO_* }
args.image         — Docker image reference, e.g. 'ghcr.io/ORG/aquila-guardian:TAG'
args.webhookSecret — 64-char hex string (caller generates via generateWebhookSecret)
args.state         — install-state object
args.port?         — container port, default 3000
args.remoteDir?    — remote deploy directory, default '/opt/aquila'

Returns: { ok: true, deployed: true, webhookSecret: string }
```

Steps (each is idempotent):
1. Installs Docker via `curl -fsSL https://get.docker.com | sudo sh` if not
   already present.
2. Writes `.env` (rendered from `secrets` + `webhookSecret`) and
   `docker-compose.yml` to `remoteDir` using `putFile`.
   Compose uses `image:` (not `build:`), so the published image is pulled —
   the build never runs on the target server.
3. Runs `sudo docker compose pull && sudo docker compose up -d`.

Health path configured in the compose file: `GET http://localhost:3000/api/health`

### `setupHttps(args)` — `src/deploy/https.js`

```
args.ssh      — SSH interface
args.ip       — server's public IPv4 address
args.state    — install-state object
args.port?    — backend port, default 3000
args.remoteDir? — default '/opt/aquila'

Returns: { ok: true, publicUrl: string }
```

Derives `publicUrl` as `https://<ip-dashes>.sslip.io` (e.g.
`https://203-0-113-5.sslip.io`). Installs Caddy from its official apt repo if
not present, writes a Caddyfile that reverse-proxies to `localhost:port`, then
reloads Caddy. After Caddy is running it appends `PUBLIC_HOST=<publicUrl>` to
`.env` and restarts the container so Twilio webhook URLs are correct.

`ipToSslip(ip)` is also exported as a standalone utility.

### `verifyDeployment(args)` — `src/deploy/verify.js`

```
args.publicUrl  — string returned by setupHttps
args.fetchImpl? — fetch implementation (defaults to global fetch)
args.retries?   — default 10
args.delayMs?   — ms between retries, default 3000

Returns: { ok: true, healthy: true }
```

GETs `publicUrl + '/api/health'` up to `retries` times. Expects
`{ status: 'ok' }` in the JSON body. Returns
`{ ok: false, code: 'HEALTH_FAILED', ... }` if all retries are exhausted.

---

## Orchestrator — `runInstall(opts)` — `src/index.js`

```
opts.entryPoint   — 'hostinger' | 'byo'
opts.installId    — unique string (used as state file name)
opts.stateDir     — directory for state files
opts.secrets      — { ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN?, TWILIO_* }
opts.image        — Docker image reference
opts.deps         — {
    client?       — Hostinger REST client (hostinger path)
    sshPublicKey? — string (hostinger path)
    sshTarget?    — { host, port?, username?, privateKey?, password? }
    connectSsh?   — override for testing
    fetchImpl?    — override fetch for testing
    verifyOpts?   — extra opts forwarded to verifyDeployment
  }

Returns: { ok: true, publicUrl: string }
      or { ok: false, code, message, hint }
```

The orchestrator:
1. Loads or creates install-state from `stateDir/<installId>.json`.
2. Runs the Hostinger or BYO path to obtain the VPS IP.
3. Connects SSH (20 s ready timeout by default).
4. Calls `preflightCheck`, `deployAquila`, `setupHttps`, `verifyDeployment` in
   sequence; any `ok: false` result propagates immediately.
5. Wraps the SSH phase (steps 3-4) in `try/catch` so unexpected rejections
   (e.g. a `putFile` error) become a structured `{ ok: false, code: 'DEPLOY_FAILED' }`
   rather than an uncaught exception.
6. Calls `ssh.close()` in `finally`.

A resumed run loads existing state; completed steps are skipped automatically.

---

## Data flow — no user data leaves your control

```
User machine
  │
  ├─ Hostinger path ──► developers.hostinger.com   (your account API only)
  │     API token                                   token used in Bearer header
  │
  ├─ BYO path ─────────────────────────────────────────────────────────────────┐
  │                                                                             │
  └─ SSH ──────────────────────────────────────────────────────────────────────┤
        credentials                  your VPS (SSH)                            │
        secrets (.env)    ──────►    get.docker.com (docker install)           │
        compose.yml                  dl.cloudsmith.io (Caddy apt repo)         │
                                     api.ipify.org (preflight IPv4 probe)      │
                                     letsencrypt.org via sslip.io (TLS cert)   │
                                                                                │
                          No data flows to any Aquila/vendor server.           │
                          Payment is an on-chain transaction handled by        │
                          Subsystem C — this package never sees it.            │
```

**Outbound network destinations (exhaustive list):**

| Destination | Purpose |
|---|---|
| `developers.hostinger.com` | Hostinger VPS REST API (your account) |
| Your VPS over SSH (port 22) | All deployment steps |
| `get.docker.com` | Docker install script (if Docker not present) |
| `dl.cloudsmith.io` | Caddy stable apt repository |
| `api.ipify.org` | Preflight probe: detect the server's public IPv4 (one-time, over SSH) |
| `letsencrypt.org` (via `sslip.io`) | Automatic TLS certificate |

No telemetry, no analytics, no external logging services.

---

## Published image

```
ghcr.io/AQUILA_ORG/aquila-guardian:AQUILA_TAG
```

`AQUILA_ORG` and `AQUILA_TAG` are publish-time placeholders resolved when the
image is built and pushed to GitHub Container Registry. The image reference can
be overridden at runtime via the `AQUILA_IMAGE` environment variable or by
passing `opts.image` directly to `runInstall`.

The compose file uses `image:` (not `build:`), so the server pulls the
pre-built image. No source code is transferred to the VPS.

---

## Running tests

```bash
cd installer

# Unit tests (no Docker, no network, integration test skipped by default)
node --test

# Dependency security audit
npm audit --omit=dev --audit-level=high

# Opt-in end-to-end test (requires Docker on the test machine)
RUN_INTEGRATION=1 npm run test:integration
```

CI is defined in `.github/workflows/installer-ci.yml`. It runs on every push or
pull request that touches `installer/**`. The workflow runs unit tests, the
dependency audit, and a secret-scan grep that fails the build if any
secret-looking value is found in committed source files.

---

## Resuming a failed install

Every completed step is recorded in `stateDir/<installId>.json`. Only
`vpsId`, `ip`, and `publicUrl` are persisted — secrets are never written to
disk (see `SECURITY.md`). If a run fails part-way through, call `runInstall`
again with the same `installId` and `stateDir`; completed steps are skipped
automatically.
