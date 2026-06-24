# Resume Prompt — Aquila Installer project

Paste the block below into a fresh Claude Code session (from the repo root
`/home/deploy/aquila-guardian-public`) to pick the project up exactly where we left off.

---

```
We are building the PAID Aquila Guardian installer — a way for non-technical people in
coercion situations to install the self-hosted duress-alert system almost as easily as
downloading an app, while we keep ZERO user data. Product shape (decided earlier):
- BYO-LLM host app ("connect your AI": Anthropic/OpenAI/Gemini natively + OpenRouter)
  with an embedded guide agent + the automation tools.
- VPS auto-provisioned on Hostinger (our referral); also supports "bring your own VPS".
- Payment: single license via on-chain EVM deposit to Aquila's wallet, confirmed by RPC.
- Decomposed into 4 subsystems: A automation core, B host app + guide agent,
  C on-chain license gate, D guided-signup tutorials.

STATUS: Subsystem A (automation core) is COMPLETE and on branch
`feat/installer-automation-core-spec` (pushed; tag `installer-core-v0.1.0`). It is a
CommonJS Node ≥20 package at `installer/` with six tools (provision_vps, wait_for_vps,
preflight_check, deploy_aquila, setup_https, verify_deployment) + a runInstall
orchestrator, resumable state, structured-never-throw error contract, zero-data
guarantees (secret whitelist in state + log redaction), and two command-injection
hardenings. 60 unit tests pass; 1 Docker integration test is opt-in. Audit docs are in
`installer/{README,SECURITY}.md` and `installer/docs/{threat-model,audit-checklist,RUNBOOK}.md`.

READ FIRST: installer/docs/RUNBOOK.md (operational guide + open items + troubleshooting),
docs/superpowers/specs/2026-06-24-aquila-installer-automation-core-design.md (spec),
docs/superpowers/plans/2026-06-24-installer-automation-core.md (the 15-task plan).

PICK ONE TO DO NEXT (in priority order):
1. Hostinger API SPIKE — I have a Hostinger API token now: <PASTE TOKEN OR SAY YOU'LL
   PROVIDE IT>. Confirm the real REST endpoints for create-VPS / SSH-key injection /
   status+IP polling, then reconcile src/hostinger/client.js + provision.js + wait.js
   and test/helpers/mock-hostinger.js so unit tests stay green. (RUNBOOK §3.)
2. Publish the official Aquila Docker image (RUNBOOK §4) — registry + creds: <SAY WHICH>.
3. Start Subsystem B: brainstorm → spec → plan the host app + "connect your AI" screen +
   guide-agent persona that collects the secrets and drives runInstall.

Use the superpowers skills (brainstorming before new design; writing-plans; TDD;
subagent-driven-development for execution). Keep the zero-data + audit posture.
```

---

**Tip:** before resuming, in a terminal run `git checkout feat/installer-automation-core-spec`
and `cd installer && npm install && node --test` to confirm the suite is green (60 pass / 1 skip).
The session ledger from the build is at `.git/sdd/progress.md`.
