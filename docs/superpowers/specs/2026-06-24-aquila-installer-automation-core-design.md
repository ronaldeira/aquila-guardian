# Aquila Installer — Subsystem A: Automation Core (Design)

**Date:** 2026-06-24
**Status:** Approved design, pending spec review
**Author:** brainstorm session (ronaldocosta5511)

---

## 1. Product context (the whole, so this part stands alone)

Aquila Guardian is a free, open-source, self-hosted duress-alert system for crypto
wallets. Today it requires a technically capable user to: rent a 24/7 server, use
Docker/Node, fill a `.env` (admin password, `WEBHOOK_SECRET`, a public HTTPS host),
create a Telegram bot, and create a Twilio account with purchased phone numbers.

The **paid installer product** removes that barrier so a non-technical person can
install Aquila almost as easily as downloading any app — confirming steps and granting
permissions. Privacy is preserved: **we keep zero user data**. Credentials stay in the
user's app; Aquila runs on the user's own VPS; the only thing we ever touch is a public
on-chain transaction used to confirm payment.

### How the full product fits together

```
APP INSTALADOR AQUILA  (user downloads ONE thing)
├── "Connect your AI" screen ....... BYO-LLM: user pastes their own provider key
│                                    (Anthropic / OpenAI / Gemini natively + OpenRouter
│                                     for everything else). Plug-in / plug-out.
├── Guide agent (persona/script) ... walks the user through the manual signups
│                                    (Hostinger via referral, Twilio, Telegram, LLM key)
│                                    and triggers automation when each credential arrives.
├── Automation core (THIS SPEC) .... tools that provision the Hostinger VPS and deploy Aquila.
└── License gate .................... EVM on-chain deposit to Aquila's existing wallet,
                                      confirmed via RPC, then unlock.
```

### Decomposition (each its own spec → plan → implementation)

| # | Subsystem | Status |
|---|---|---|
| **A** | **Automation core** | **THIS SPEC** — built first (highest technical risk, everything depends on it) |
| B | Host app + BYO-LLM + guide agent | later |
| C | On-chain license gate | later (port from original Aquila / Clube do BCA / Clube do Ouro — not in this public repo; `wallet-monitor.js:3` confirms the open-source build stripped `licenseKey`) |
| D | Tutorials / guided-signup content | later |

---

## 2. Scope of Subsystem A

**A is a library of orchestratable tools.** It does not own the UI, the LLM connection,
the guide persona, or the license gate. It is consumed by Subsystem B (the agent/host).

### In scope
- Provision a VPS on **Hostinger** via Hostinger's public API.
- Deploy the Aquila Guardian Docker image onto that VPS over SSH.
- Write the VPS `.env` from the collected secrets (and generate `WEBHOOK_SECRET`).
- Stand up **public HTTPS** so Twilio voice works, with no domain owned by the user.
- Verify the running deployment and report the URL back.
- Track install state so a failed run **resumes** instead of recreating the (paid) VPS.

### Out of scope (other subsystems)
- "Connect your AI" screen, chat UI, guide-agent persona (B).
- Collecting the secrets from the user / guided signups (B + D).
- License/payment verification (C).
- Creating the Hostinger/Twilio/Telegram/LLM accounts themselves (manual, guided by B/D).

---

## 3. Key external dependencies & decisions

| Decision | Choice | Rationale |
|---|---|---|
| VPS provider | **Hostinger** (our referral) | User's choice; mature public API + official MCP server. |
| Hostinger API access | **Reuse the official [`hostinger/api-mcp-server`](https://github.com/hostinger/api-mcp-server)** for the Hostinger-API surface | Less code we maintain; official lifecycle support (create/destroy). |
| Public HTTPS | **Caddy reverse proxy + `sslip.io`** | `https://<ip-dashed>.sslip.io` with automatic Let's Encrypt TLS — zero domain, zero signup. Fallback if sslip.io is down: Cloudflare Tunnel (deferred). |
| Aquila delivery | **Published Docker image** (e.g. `ghcr.io/<org>/aquila-guardian:<version>`) | Deploy is `docker compose pull && up`; pinned version; fewer failure points than building on the VPS. |
| OS template | Ubuntu LTS (Docker installed by us if the template lacks it) | Predictable target. |

**New prerequisite this introduces:** an official Aquila Docker image must be published.
The repo already has a `Dockerfile`; publishing to a registry is a small dependency task
tracked as part of A's plan.

**Risk to validate during planning (now low):** confirm the exact Hostinger API calls to
(a) purchase/create a VPS on the user's account and (b) inject an SSH public key at
provision time. The API blog + Terraform `hostinger_vps` resource indicate both are
supported; a short spike against a real token confirms before building.

---

## 4. The tools (isolated, testable units)

Each tool has a clear interface and returns a **structured result or a structured,
human-readable error** the agent can relay. All tools are **idempotent**.

| Tool | Input | Output | Notes |
|---|---|---|---|
| `provision_vps` | Hostinger token, plan, datacenter, generated SSH public key | `{ vpsId, status }` | Wraps official Hostinger MCP. Idempotent: if a tagged VPS already exists in state, returns it. |
| `wait_for_vps` | `vpsId` | `{ ip, ready: true }` | Polls until SSH-reachable; bounded timeout. |
| `deploy_aquila` | `ip`, SSH private key, secrets bundle | `{ deployed: true }` | SSH in → ensure Docker → write `.env` (generate `WEBHOOK_SECRET` via `openssl rand -hex 32`) → `docker compose pull && up -d`. |
| `setup_https` | `ip` | `{ publicUrl }` | Install/configure Caddy → reverse-proxy `:3000` behind `https://<ip-dashed>.sslip.io` with auto-TLS. Sets `PUBLIC_HOST` accordingly and restarts Aquila. |
| `verify_deployment` | `publicUrl` | `{ healthy: true }` | GET `/health` over HTTPS; assert expected response. |

The **secrets bundle** passed into `deploy_aquila`: `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_VOICE_FROM`.
`WEBHOOK_SECRET` is generated by A. `PORT` defaults to 3000. `PUBLIC_HOST` is set by
`setup_https` (A) once the URL is known.

### Orchestration order
`provision_vps → wait_for_vps → deploy_aquila → setup_https → verify_deployment`.
The agent (B) drives this order; A makes each step independently runnable and resumable.

---

## 5. State, idempotency & resume

A local **install-state file** (owned by A, e.g. `installs/<install-id>.json`) records
which steps completed and the artifacts produced (`vpsId`, `ip`, `publicUrl`). Rules:

- Before any step, A reads state; a completed step is **skipped** (returns cached result).
- `provision_vps` is gated on state + a Hostinger-side tag/label so a retry never creates
  a second (billable) VPS.
- A failed step leaves state intact so the agent can **resume** from exactly that step.
- Secrets are **not** written to the state file in plaintext (state holds non-secret
  artifacts + step status only).

---

## 6. Error handling

- Every tool returns `{ ok: false, code, message, hint }` on failure — never throws raw
  network/SSH errors at the user. `hint` is a plain-language next action the guide agent
  can speak (e.g. "Hostinger rejected the token — re-check the API key you pasted").
- Distinguish **user-fixable** errors (bad token, insufficient Hostinger balance) from
  **transient** errors (VPS still booting) so the agent retries the latter automatically
  and asks the user about the former.
- Timeouts are bounded and explicit on `wait_for_vps` and `verify_deployment`.

---

## 7. Testing strategy (TDD, no money spent per run)

- **Hostinger API mocked** in unit/integration tests — no real VPS created in CI.
- Deploy-path tools (`deploy_aquila`, `setup_https`, `verify_deployment`) run against a
  **local Docker container acting as the "VPS"**, reached over SSH — exercises the real
  deploy flow end-to-end, locally and free.
- `verify_deployment` tested against a locally-run Aquila container's `/health`.
- One **real end-to-end test** (creates a genuine Hostinger VPS) exists but is **manual,
  opt-in, and excluded from CI** (it costs money).
- Follow TDD: write the failing test for each tool's contract before implementing it.

---

## 8. Success criteria

1. Given a valid Hostinger token + a complete secrets bundle, running the five tools in
   order yields a live Aquila reachable at an `https://<ip>.sslip.io` URL whose `/health`
   passes — with **no manual step on the VPS**.
2. Re-running after a mid-way failure **resumes** without creating a second VPS.
3. Full deploy-path test suite passes against the local Docker "VPS" with the Hostinger
   API mocked, in CI, spending nothing.
4. All five tools return structured, human-readable errors (no raw stack traces) for the
   common failure modes (bad token, no balance, VPS not ready, health-check fail).

---

## 9. Open items for the plan (not blockers)

- Confirm exact Hostinger API endpoints/params for purchase + SSH-key injection (spike).
- Choose the registry and publish the official Aquila Docker image (`Dockerfile` exists).
- Decide default VPS plan + datacenter selection (cheapest viable, or user-selectable in B).
- Confirm `sslip.io` TLS issuance works from a fresh Hostinger IP (Let's Encrypt rate limits).
