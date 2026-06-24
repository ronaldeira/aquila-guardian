# Aquila Installer — Automation Core (Subsystem A) Runbook

Operational guide for running, testing, and extending the automation core.
Audience: the next developer/operator. Read alongside `README.md`, `SECURITY.md`,
`threat-model.md`, and `audit-checklist.md` in this directory.

**Status (2026-06-24):** Subsystem A is code-complete and reviewed. 60 unit tests
green, 1 integration test opt-in. Two prerequisites remain before a real install
works end-to-end: the **Hostinger API spike** and **publishing the Aquila image**
(both below). Branch: `feat/installer-automation-core-spec`. Tag: `installer-core-v0.1.0`.

---

## 1. Where this fits

Subsystem A is a **library of tools** consumed by Subsystem B (the host app + BYO-LLM
guide agent, not built yet). It does not collect secrets or talk to an LLM — it
receives a ready "install package" and turns it into a running Aquila on a VPS.

```
B (guide agent, future) ── calls ──▶ A: runInstall({ entryPoint, secrets, image, deps })
                                         │
   Hostinger path: provision_vps → wait_for_vps ─┐
   BYO-VPS path:   (skip) ──────────────────────┼─▶ preflight_check → deploy_aquila
                                                  │      → setup_https → verify_deployment
                                                  └─▶ live Aquila at https://<ip-dashed>.sslip.io
```

## 2. Prerequisites

- **Node ≥ 20** (`node --version`). The package is CommonJS; only runtime dep is `ssh2`.
- `cd installer && npm install` (installs `ssh2`; `package-lock.json` is committed).
- For a REAL install (not unit tests): a Hostinger API token **or** an existing VPS
  (IP + SSH credential), plus the Aquila secrets bundle (`ADMIN_PASSWORD`,
  `TELEGRAM_BOT_TOKEN` and/or Twilio `ACCOUNT_SID`/`AUTH_TOKEN`/`SMS_FROM`/`VOICE_FROM`).
- For the opt-in integration test: Docker on the host.

## 3. OPEN ITEM #1 — Hostinger API spike (do this first)

The Hostinger REST endpoint paths/shapes in `src/hostinger/client.js`,
`src/hostinger/provision.js`, `src/hostinger/wait.js`, and the mock
`test/helpers/mock-hostinger.js` are **provisional** — they were written before a
real-token confirmation. Spike steps:

1. Get a Hostinger API token (hPanel → API). Reference: <https://developers.hostinger.com/>.
2. Confirm the exact calls for: (a) create/purchase a VPS, (b) inject an SSH public key
   at provision time, (c) poll VPS status + read the assigned IPv4. Cross-check the
   official MCP server (<https://github.com/hostinger/api-mcp-server>) and the Terraform
   `hostinger_vps` resource for the real field names.
3. If paths/fields differ, update `client.js` callers **and** `mock-hostinger.js`
   **together** so the unit tests stay green. Re-run `node --test`.
4. (Optional) Do ONE real provision to confirm end-to-end, then destroy the VPS.

## 4. OPEN ITEM #2 — Publish the Aquila Docker image

`deploy_aquila` pulls a published image (`AQUILA_ORG`/`AQUILA_TAG` placeholders). From
the repo root (the existing `Dockerfile` builds the server):

```bash
docker build -t ghcr.io/<org>/aquila-guardian:<tag> .
echo "$GHCR_TOKEN" | docker login ghcr.io -u <org> --password-stdin
docker push ghcr.io/<org>/aquila-guardian:<tag>
```

Record the final ref; it becomes the `image` arg to `runInstall` and the integration
test's `AQUILA_IMAGE`. (Docker Hub works identically.) Future hardening: pin by digest.

## 5. Running an install

```js
var { runInstall } = require('aquila-installer-core'); // installer/src/index.js

// BYO-VPS (user already has an Ubuntu/Debian server with a public IPv4):
var result = await runInstall({
  entryPoint: 'byo',
  installId: 'unique-id-per-install',          // also the resume key
  stateDir: '/path/to/install-state',          // holds <installId>.json (NO secrets)
  secrets: { ADMIN_PASSWORD: '…', TELEGRAM_BOT_TOKEN: '…' /*, TWILIO_*… */ },
  image: 'ghcr.io/<org>/aquila-guardian:<tag>',
  deps: {
    sshTarget: { host: '203.0.113.5', username: 'root', password: '…' /* or privateKey */ },
    connectSsh: require('aquila-installer-core')./* internal */ // see index.js wiring
  }
});
// result -> { ok:true, publicUrl:'https://203-0-113-5.sslip.io' } | { ok:false, code, message, hint }

// Hostinger (auto-provision): entryPoint:'hostinger', deps.client = createHostingerClient({token}),
// deps.sshPublicKey = <generated public key>. Then provision→wait run before the SSH phase.
```

**Contract:** every result is `{ ok, … }`; tools never throw for expected failures. On
`ok:false`, show `hint` to the user (plain-language, safe to speak).

## 6. Resume behavior

- State lives at `<stateDir>/<installId>.json` and records which steps completed
  (`provision`/`wait`/`deploy`/`https`) plus non-secret artifacts (`vpsId`/`ip`/`publicUrl`).
- Re-running with the **same `installId`** skips completed steps — it never re-creates a
  billable VPS.
- The state's `provider` is checked against `entryPoint`: resuming with a different entry
  point returns `BAD_INPUT` (use a new `installId` or the original entry point).
- Secrets are **never** written to state (whitelist) or logs (redaction).

## 7. Tests, audit, CI

```bash
cd installer
node --test                                   # full unit suite (no Docker), integration SKIPPED
RUN_INTEGRATION=1 npm run test:integration    # opt-in real deploy onto a local Docker "VPS"
npm audit --omit=dev --audit-level=high       # dependency audit
# secret-scan (same as CI): expect no output, exit 1
grep -rEn '(TWILIO_AUTH_TOKEN|ADMIN_PASSWORD|WEBHOOK_SECRET)=[^[:space:]]+' \
  --include='*.js' --include='*.json' --exclude='*.test.js' src test ; echo "exit $?"
```

CI runs all of the above on `installer/**` changes (`.github/workflows/installer-ci.yml`).

## 8. Troubleshooting (error `code` → meaning → action)

| `code` | Meaning | Action |
|---|---|---|
| `BAD_TOKEN` | Hostinger rejected the API key (401/403) | Re-check the token. |
| `NO_BALANCE` | Hostinger payment required (402) | Add a plan/payment method to the account. |
| `BAD_INPUT` | Missing secret/channel, malformed IPv4, or entryPoint↔state mismatch | Read `message`; fix the input or use a fresh `installId`. |
| `TIMEOUT` | VPS not ready within the deadline | Wait, then resume (same `installId`). |
| `SSH_FAILED` | Could not log in to the server | Verify IP + SSH credential. |
| `PREFLIGHT_FAILED` | Not Ubuntu/Debian, no passwordless sudo, or no public IPv4 | See `issues[]`; NAT'd hosts can't use sslip.io (Cloudflare Tunnel is the deferred fallback). |
| `DEPLOY_FAILED` | Docker install / compose up failed | Usually transient pull error — resume. |
| `HTTPS_FAILED` | Caddy install/reload or PUBLIC_HOST restart failed | Check ports 80/443 free; resume. |
| `HEALTH_FAILED` | `/api/health` not green after retries | TLS can take a minute on first boot — resume to retry. |

## 9. Known deferred follow-ups (see threat-model.md)

- SSH host-key pinning (not pinned today).
- Image-digest pinning + pinning the Docker/Caddy install repos (supply-chain).
- Cloudflare Tunnel fallback for NAT'd BYO-VPS.

## 10. Next subsystems (not built)

- **B** — host app + "Connect your AI" (BYO-LLM) screen + guide-agent persona that
  collects secrets and orchestrates A.
- **C** — on-chain EVM license gate (port deposit-verification from the original Aquila /
  Clube do BCA / Clube do Ouro; the public repo stripped `licenseKey`).
- **D** — guided-signup tutorials (Hostinger via referral, Twilio, Telegram, LLM key).
