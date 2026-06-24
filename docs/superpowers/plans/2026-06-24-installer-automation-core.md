# Installer Automation Core (Subsystem A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js library of orchestratable, testable tools that provision a Hostinger VPS (or accept a user-supplied VPS) and deploy Aquila Guardian onto it over SSH with public HTTPS — preserving the zero-data / self-hosted model.

**Architecture:** A small CommonJS package (`installer/`) exposing six tools — `provision_vps`, `wait_for_vps`, `preflight_check`, `deploy_aquila`, `setup_https`, `verify_deployment` — plus a `runInstall` orchestrator. Each tool returns a structured `{ ok, ... }` result (never throws raw errors at the caller) and is idempotent against a local install-state file. Hostinger calls go through a thin, injectable REST client; SSH goes through an injectable connection wrapper. Tests run with the Node built-in test runner against a mocked Hostinger API and a local Docker container that plays the role of the "VPS".

**Tech Stack:** Node.js ≥20 (CommonJS, matching the Aquila repo), `node:test` + `node:assert` (zero-dep test runner), `ssh2` (the only new runtime dependency), `node:crypto`, global `fetch`. Docker (for the integration-test "VPS" target and the deployed Aquila image).

## Global Constraints

- **Language/module system:** CommonJS (`require` / `module.exports`), Node ≥20 — match the existing repo; do NOT introduce ESM or TypeScript.
- **Runtime dependencies:** only `ssh2` may be added. Everything else uses Node built-ins. Honor Aquila's minimalist ethos.
- **Zero-data invariant:** no telemetry, no "phone home", no secret ever written to the install-state file, no secret ever written to logs unredacted. The library must function fully offline except for the calls it makes to the user's own Hostinger account, the user's own VPS, and `sslip.io`/Let's Encrypt.
- **Error contract:** every tool returns `{ ok: true, ... }` or `{ ok: false, code, message, hint }`. `hint` is plain-language and safe to speak to a non-technical user. Tools never throw for expected failures.
- **Idempotency/resume:** a completed step, on re-run, returns its cached result from state instead of repeating side effects. `provision_vps` must never create a second billable VPS.
- **Health path:** the deployed Aquila health endpoint is `GET /api/health` (matches the repo's `docker-compose.yml` healthcheck). Use this exact path.
- **Aquila delivery:** deploy a published image `ghcr.io/AQUILA_ORG/aquila-guardian:AQUILA_TAG` (placeholders resolved in Task 14 / publish step). The VPS compose references `image:`, never `build:`; the repo is never cloned onto the VPS.
- **Public hostname scheme:** `setup_https` derives `https://<ip-with-dashes>.sslip.io` (e.g. `203.0.113.5` → `203-0-113-5.sslip.io`).
- **Security posture:** this is a security product under audit. Every task that touches secrets, SSH, or remote execution MUST keep secrets out of state/logs and prefer key-based SSH. Documentation and CI (Tasks 14–15) are not optional.

---

## File Structure

```
installer/                              # Subsystem A — automation core (new top-level dir)
├── package.json                        # name "aquila-installer-core", deps: ssh2
├── README.md                           # audit-facing: purpose, data-flow, what it touches
├── SECURITY.md                         # secret handling, SSH model, disclosure policy
├── src/
│   ├── index.js                        # public exports + runInstall orchestrator
│   ├── result.js                       # ok()/fail() + ERROR_CODES
│   ├── logger.js                       # audit logger with secret redaction
│   ├── secrets.js                      # generateWebhookSecret(), redact(), SECRET_KEYS
│   ├── env-render.js                   # renderEnv(secrets, opts) -> .env string
│   ├── state.js                        # install-state file (no secrets persisted)
│   ├── hostinger/
│   │   ├── client.js                   # createHostingerClient({token, fetchImpl})
│   │   ├── provision.js                # provisionVps(...)
│   │   └── wait.js                     # waitForVps(...)
│   ├── ssh/
│   │   └── connection.js               # connectSsh(...) ssh2 wrapper + injectable iface
│   └── deploy/
│       ├── preflight.js                # preflightCheck({ssh})
│       ├── deploy-aquila.js            # deployAquila({ssh, ...})
│       ├── https.js                    # setupHttps({ssh, ip, ...}) + ipToSslip()
│       └── verify.js                   # verifyDeployment({publicUrl, fetchImpl})
├── test/
│   ├── helpers/
│   │   ├── fake-ssh.js                 # in-memory ssh iface for unit tests
│   │   ├── mock-hostinger.js           # in-memory Hostinger API
│   │   └── docker-vps.js               # boot a local Docker container as SSH target
│   ├── result.test.js
│   ├── logger.test.js
│   ├── secrets.test.js
│   ├── env-render.test.js
│   ├── state.test.js
│   ├── hostinger-client.test.js
│   ├── hostinger-provision.test.js
│   ├── hostinger-wait.test.js
│   ├── preflight.test.js
│   ├── deploy-aquila.test.js
│   ├── https.test.js
│   ├── verify.test.js
│   ├── orchestrator.test.js
│   └── integration.test.js             # opt-in: real Docker "VPS", mocked Hostinger
└── docs/
    ├── threat-model.md
    └── audit-checklist.md
.github/workflows/installer-ci.yml      # lint-free: node --test + npm audit + secret scan
```

---

### Task 1: Package scaffold + structured result helpers

**Files:**
- Create: `installer/package.json`
- Create: `installer/src/result.js`
- Test: `installer/test/result.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ERROR_CODES` — frozen object of string codes: `BAD_TOKEN`, `NO_BALANCE`, `VPS_NOT_READY`, `SSH_FAILED`, `PREFLIGHT_FAILED`, `DEPLOY_FAILED`, `HTTPS_FAILED`, `HEALTH_FAILED`, `TIMEOUT`, `BAD_INPUT`, `UNKNOWN`.
  - `ok(data) -> { ok: true, ...data }`
  - `fail(code, message, hint) -> { ok: false, code, message, hint }`

- [ ] **Step 1: Write `installer/package.json`**

```json
{
  "name": "aquila-installer-core",
  "version": "0.1.0",
  "description": "Automation core: provision a VPS and deploy Aquila Guardian over SSH.",
  "main": "src/index.js",
  "scripts": {
    "test": "node --test",
    "test:integration": "RUN_INTEGRATION=1 node --test test/integration.test.js",
    "audit": "npm audit --omit=dev"
  },
  "license": "MIT",
  "engines": { "node": ">=20.0.0" },
  "dependencies": { "ssh2": "^1.15.0" }
}
```

- [ ] **Step 2: Write the failing test** — `installer/test/result.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { ok, fail, ERROR_CODES } = require('../src/result');

test('ok() wraps data with ok:true', function () {
  assert.deepStrictEqual(ok({ ip: '1.2.3.4' }), { ok: true, ip: '1.2.3.4' });
});

test('fail() carries code, message, hint', function () {
  var r = fail(ERROR_CODES.BAD_TOKEN, 'rejected', 'Re-check your key');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_TOKEN');
  assert.strictEqual(r.message, 'rejected');
  assert.strictEqual(r.hint, 'Re-check your key');
});

test('ERROR_CODES is frozen', function () {
  assert.ok(Object.isFrozen(ERROR_CODES));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd installer && node --test test/result.test.js`
Expected: FAIL — `Cannot find module '../src/result'`.

- [ ] **Step 4: Write `installer/src/result.js`**

```js
var ERROR_CODES = Object.freeze({
  BAD_TOKEN: 'BAD_TOKEN',
  NO_BALANCE: 'NO_BALANCE',
  VPS_NOT_READY: 'VPS_NOT_READY',
  SSH_FAILED: 'SSH_FAILED',
  PREFLIGHT_FAILED: 'PREFLIGHT_FAILED',
  DEPLOY_FAILED: 'DEPLOY_FAILED',
  HTTPS_FAILED: 'HTTPS_FAILED',
  HEALTH_FAILED: 'HEALTH_FAILED',
  TIMEOUT: 'TIMEOUT',
  BAD_INPUT: 'BAD_INPUT',
  UNKNOWN: 'UNKNOWN'
});

function ok(data) {
  return Object.assign({ ok: true }, data || {});
}

function fail(code, message, hint) {
  return { ok: false, code: code, message: message, hint: hint || '' };
}

module.exports = { ok: ok, fail: fail, ERROR_CODES: ERROR_CODES };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd installer && node --test test/result.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add installer/package.json installer/src/result.js installer/test/result.test.js
git commit -m "feat(installer): package scaffold + structured result helpers"
```

---

### Task 2: Secret helpers + audit logger with redaction

**Files:**
- Create: `installer/src/secrets.js`
- Create: `installer/src/logger.js`
- Test: `installer/test/secrets.test.js`, `installer/test/logger.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SECRET_KEYS` — array of env/secret key names treated as sensitive.
  - `generateWebhookSecret() -> string` (64 lowercase hex chars).
  - `redact(text, extraValues=[]) -> string` — masks any SECRET_KEYS values and any literal strings in `extraValues`.
  - `createLogger({ sink=console.error, secrets=[] }) -> { info(msg, meta), error(msg, meta) }` — every line passes through `redact` with the live secret values.

- [ ] **Step 1: Write the failing test** — `installer/test/secrets.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { generateWebhookSecret, redact, SECRET_KEYS } = require('../src/secrets');

test('generateWebhookSecret returns 64 hex chars', function () {
  var s = generateWebhookSecret();
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(generateWebhookSecret(), s); // randomness
});

test('SECRET_KEYS includes the sensitive env names', function () {
  ['ADMIN_PASSWORD', 'TWILIO_AUTH_TOKEN', 'TELEGRAM_BOT_TOKEN', 'WEBHOOK_SECRET']
    .forEach(function (k) { assert.ok(SECRET_KEYS.includes(k)); });
});

test('redact masks literal secret values', function () {
  var out = redact('token is abc123secret here', ['abc123secret']);
  assert.ok(!out.includes('abc123secret'));
  assert.ok(out.includes('***'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/secrets.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/secrets.js`**

```js
var crypto = require('crypto');

var SECRET_KEYS = [
  'ADMIN_PASSWORD',
  'WEBHOOK_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
];

function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function redact(text, extraValues) {
  var str = String(text == null ? '' : text);
  var values = (extraValues || []).filter(Boolean);
  values.forEach(function (v) {
    str = str.split(String(v)).join('***');
  });
  return str;
}

module.exports = {
  SECRET_KEYS: SECRET_KEYS,
  generateWebhookSecret: generateWebhookSecret,
  redact: redact
};
```

- [ ] **Step 4: Write the failing test** — `installer/test/logger.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { createLogger } = require('../src/logger');

test('logger redacts live secret values', function () {
  var lines = [];
  var log = createLogger({ sink: function (l) { lines.push(l); }, secrets: ['supersecret'] });
  log.info('connecting with supersecret');
  assert.ok(lines.length === 1);
  assert.ok(!lines[0].includes('supersecret'));
  assert.ok(lines[0].includes('***'));
  assert.ok(lines[0].includes('INFO'));
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd installer && node --test test/logger.test.js`
Expected: FAIL — module not found.

- [ ] **Step 6: Write `installer/src/logger.js`**

```js
var { redact } = require('./secrets');

function createLogger(opts) {
  opts = opts || {};
  var sink = opts.sink || console.error;
  var secrets = opts.secrets || [];
  function emit(level, msg) {
    sink('[' + level + '] ' + redact(msg, secrets));
  }
  return {
    info: function (msg) { emit('INFO', msg); },
    error: function (msg) { emit('ERROR', msg); }
  };
}

module.exports = { createLogger: createLogger };
```

- [ ] **Step 7: Run both tests**

Run: `cd installer && node --test test/secrets.test.js test/logger.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add installer/src/secrets.js installer/src/logger.js installer/test/secrets.test.js installer/test/logger.test.js
git commit -m "feat(installer): secret generation + redacting audit logger"
```

---

### Task 3: Render the VPS `.env` from the secrets bundle

**Files:**
- Create: `installer/src/env-render.js`
- Test: `installer/test/env-render.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES` (Task 1); `generateWebhookSecret` (Task 2).
- Produces:
  - `renderEnv(secrets, opts) -> { ok, env }` where `secrets` is `{ ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN?, TWILIO_ACCOUNT_SID?, TWILIO_AUTH_TOKEN?, TWILIO_SMS_FROM?, TWILIO_VOICE_FROM? }` and `opts` is `{ webhookSecret, publicHost?, port=3000 }`. Returns a `.env` file string. Fails `BAD_INPUT` if `ADMIN_PASSWORD` or `webhookSecret` missing, or if NO alert channel (neither Telegram token nor Twilio pair) is configured.

- [ ] **Step 1: Write the failing test** — `installer/test/env-render.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { renderEnv } = require('../src/env-render');

var WH = 'a'.repeat(64);

test('renders required + telegram-only env', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
                    { webhookSecret: WH, port: 3000 });
  assert.strictEqual(r.ok, true);
  assert.match(r.env, /^ADMIN_PASSWORD=pw$/m);
  assert.match(r.env, new RegExp('^WEBHOOK_SECRET=' + WH + '$', 'm'));
  assert.match(r.env, /^TELEGRAM_BOT_TOKEN=tg$/m);
  assert.match(r.env, /^PORT=3000$/m);
});

test('includes PUBLIC_HOST when provided', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
                    { webhookSecret: WH, publicHost: 'https://1-2-3-4.sslip.io' });
  assert.match(r.env, /^PUBLIC_HOST=https:\/\/1-2-3-4\.sslip\.io$/m);
});

test('fails when admin password missing', function () {
  var r = renderEnv({ TELEGRAM_BOT_TOKEN: 'tg' }, { webhookSecret: WH });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_INPUT');
});

test('fails when no alert channel configured', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw' }, { webhookSecret: WH });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_INPUT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/env-render.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/env-render.js`**

```js
var { ok, fail, ERROR_CODES } = require('./result');

function line(k, v) { return k + '=' + v; }

function renderEnv(secrets, opts) {
  secrets = secrets || {};
  opts = opts || {};
  if (!secrets.ADMIN_PASSWORD) {
    return fail(ERROR_CODES.BAD_INPUT, 'ADMIN_PASSWORD is required',
      'The admin password was not provided — collect it before deploying.');
  }
  if (!opts.webhookSecret) {
    return fail(ERROR_CODES.BAD_INPUT, 'webhookSecret is required',
      'Internal: webhook secret must be generated before rendering env.');
  }
  var hasTelegram = !!secrets.TELEGRAM_BOT_TOKEN;
  var hasTwilio = !!(secrets.TWILIO_ACCOUNT_SID && secrets.TWILIO_AUTH_TOKEN);
  if (!hasTelegram && !hasTwilio) {
    return fail(ERROR_CODES.BAD_INPUT, 'no alert channel configured',
      'Configure at least Telegram or Twilio before deploying.');
  }

  var lines = [];
  lines.push(line('PORT', String(opts.port || 3000)));
  lines.push(line('ADMIN_PASSWORD', secrets.ADMIN_PASSWORD));
  lines.push(line('WEBHOOK_SECRET', opts.webhookSecret));
  if (opts.publicHost) lines.push(line('PUBLIC_HOST', opts.publicHost));
  if (secrets.TELEGRAM_BOT_TOKEN) lines.push(line('TELEGRAM_BOT_TOKEN', secrets.TELEGRAM_BOT_TOKEN));
  ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_FROM', 'TWILIO_VOICE_FROM']
    .forEach(function (k) { if (secrets[k]) lines.push(line(k, secrets[k])); });

  return ok({ env: lines.join('\n') + '\n' });
}

module.exports = { renderEnv: renderEnv };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/env-render.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/env-render.js installer/test/env-render.test.js
git commit -m "feat(installer): render VPS .env from secrets bundle"
```

---

### Task 4: Install-state store (resume, no secrets)

**Files:**
- Create: `installer/src/state.js`
- Test: `installer/test/state.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createState({ installId, provider, dir }) -> stateObj` (in memory; not yet written).
  - `loadState({ installId, dir }) -> stateObj | null`
  - `markStep(stateObj, stepName, artifacts) -> stateObj` (merges artifacts, sets `steps[stepName] = { done: true, at: <iso> }`, persists to `<dir>/<installId>.json`).
  - `isDone(stateObj, stepName) -> boolean`
  - State shape: `{ installId, provider, steps: {}, artifacts: { vpsId?, ip?, publicUrl? } }`. Secrets are NEVER stored.

- [ ] **Step 1: Write the failing test** — `installer/test/state.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { createState, loadState, markStep, isDone } = require('../src/state');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aq-state-')); }

test('markStep persists artifacts and is reloadable', function () {
  var dir = tmpDir();
  var s = createState({ installId: 'i1', provider: 'hostinger', dir: dir });
  assert.strictEqual(isDone(s, 'provision'), false);
  markStep(s, 'provision', { vpsId: 'v9', ip: '1.2.3.4' });
  assert.strictEqual(isDone(s, 'provision'), true);

  var reloaded = loadState({ installId: 'i1', dir: dir });
  assert.strictEqual(reloaded.artifacts.vpsId, 'v9');
  assert.strictEqual(reloaded.artifacts.ip, '1.2.3.4');
  assert.strictEqual(isDone(reloaded, 'provision'), true);
});

test('loadState returns null when absent', function () {
  assert.strictEqual(loadState({ installId: 'nope', dir: tmpDir() }), null);
});

test('state file never contains secret-looking keys', function () {
  var dir = tmpDir();
  var s = createState({ installId: 'i2', provider: 'byo', dir: dir });
  markStep(s, 'deploy', { ip: '5.6.7.8' });
  var raw = fs.readFileSync(path.join(dir, 'i2.json'), 'utf8');
  ['ADMIN_PASSWORD', 'WEBHOOK_SECRET', 'TWILIO_AUTH_TOKEN', 'TELEGRAM_BOT_TOKEN']
    .forEach(function (k) { assert.ok(raw.indexOf(k) === -1); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/state.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/state.js`**

```js
var fs = require('fs');
var path = require('path');

var ALLOWED_ARTIFACTS = ['vpsId', 'ip', 'publicUrl'];

function fileFor(dir, installId) { return path.join(dir, installId + '.json'); }

function createState(opts) {
  return {
    installId: opts.installId,
    provider: opts.provider,
    dir: opts.dir,
    steps: {},
    artifacts: {}
  };
}

function persist(state) {
  fs.mkdirSync(state.dir, { recursive: true });
  var out = {
    installId: state.installId,
    provider: state.provider,
    steps: state.steps,
    artifacts: state.artifacts
  };
  fs.writeFileSync(fileFor(state.dir, state.installId), JSON.stringify(out, null, 2));
}

function loadState(opts) {
  var f = fileFor(opts.dir, opts.installId);
  if (!fs.existsSync(f)) return null;
  var data = JSON.parse(fs.readFileSync(f, 'utf8'));
  data.dir = opts.dir;
  return data;
}

function markStep(state, stepName, artifacts) {
  // Whitelist artifacts so secrets can never leak into state.
  Object.keys(artifacts || {}).forEach(function (k) {
    if (ALLOWED_ARTIFACTS.indexOf(k) !== -1) state.artifacts[k] = artifacts[k];
  });
  state.steps[stepName] = { done: true, at: new Date().toISOString() };
  persist(state);
  return state;
}

function isDone(state, stepName) {
  return !!(state.steps[stepName] && state.steps[stepName].done);
}

module.exports = {
  createState: createState,
  loadState: loadState,
  markStep: markStep,
  isDone: isDone
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/state.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/state.js installer/test/state.test.js
git commit -m "feat(installer): install-state store with secret-safe artifact whitelist"
```

---

### Task 5: Hostinger REST client (thin, injectable)

**Files:**
- Create: `installer/src/hostinger/client.js`
- Create: `installer/test/helpers/mock-hostinger.js`
- Test: `installer/test/hostinger-client.test.js`

**Interfaces:**
- Consumes: `fail`, `ERROR_CODES` (Task 1).
- Produces:
  - `createHostingerClient({ token, fetchImpl=fetch, baseUrl }) -> { request(method, pathName, body) -> Promise<{ ok, status, data }> }`. Maps HTTP 401/403 → `BAD_TOKEN`, 402 → `NO_BALANCE`, network throw → `UNKNOWN`. `baseUrl` defaults to `https://developers.hostinger.com`.
- Produces (test helper): `mock-hostinger.js` exports `makeMockHostinger() -> { fetchImpl, state }` simulating the VPS endpoints used in Tasks 6–7.

- [ ] **Step 1: Write the mock helper** — `installer/test/helpers/mock-hostinger.js`

```js
// Minimal in-memory Hostinger API for tests. Supports the endpoints the
// provision/wait tools use. Not a faithful copy of the real API surface —
// only the shapes our tools depend on. Confirm real paths in the spike (plan §9).
function makeMockHostinger(opts) {
  opts = opts || {};
  var state = {
    token: opts.token || 'good-token',
    created: [],
    readyAfterPolls: opts.readyAfterPolls == null ? 1 : opts.readyAfterPolls,
    polls: {}
  };

  function json(status, data) {
    return Promise.resolve({
      status: status,
      ok: status >= 200 && status < 300,
      json: function () { return Promise.resolve(data); }
    });
  }

  function fetchImpl(url, init) {
    init = init || {};
    var auth = (init.headers && init.headers.Authorization) || '';
    if (auth !== 'Bearer ' + state.token) return json(401, { message: 'unauthorized' });

    if (/\/vps\/v1\/virtual-machines$/.test(url) && init.method === 'POST') {
      var id = 'vps-' + (state.created.length + 1);
      state.created.push(id);
      state.polls[id] = 0;
      return json(201, { id: id, state: 'creating' });
    }
    var m = url.match(/\/vps\/v1\/virtual-machines\/([^/]+)$/);
    if (m && (!init.method || init.method === 'GET')) {
      var vid = m[1];
      state.polls[vid] = (state.polls[vid] || 0) + 1;
      var ready = state.polls[vid] > state.readyAfterPolls;
      return json(200, {
        id: vid,
        state: ready ? 'running' : 'creating',
        ipv4: ready ? [{ address: '203.0.113.5' }] : []
      });
    }
    return json(404, { message: 'not found' });
  }

  return { fetchImpl: fetchImpl, state: state };
}

module.exports = { makeMockHostinger: makeMockHostinger };
```

- [ ] **Step 2: Write the failing test** — `installer/test/hostinger-client.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { createHostingerClient } = require('../src/hostinger/client');
var { makeMockHostinger } = require('./helpers/mock-hostinger');

test('request returns parsed data on success', async function () {
  var mock = makeMockHostinger();
  var c = createHostingerClient({ token: 'good-token', fetchImpl: mock.fetchImpl });
  var r = await c.request('POST', '/api/vps/v1/virtual-machines', { plan: 'x' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 201);
  assert.ok(r.data.id);
});

test('maps 401 to BAD_TOKEN', async function () {
  var mock = makeMockHostinger();
  var c = createHostingerClient({ token: 'wrong', fetchImpl: mock.fetchImpl });
  var r = await c.request('GET', '/api/vps/v1/virtual-machines/vps-1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_TOKEN');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd installer && node --test test/hostinger-client.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `installer/src/hostinger/client.js`**

```js
var { fail, ERROR_CODES } = require('../result');

function createHostingerClient(opts) {
  opts = opts || {};
  var token = opts.token;
  var fetchImpl = opts.fetchImpl || fetch;
  var baseUrl = opts.baseUrl || 'https://developers.hostinger.com';

  async function request(method, pathName, body) {
    var res;
    try {
      res = await fetchImpl(baseUrl + pathName, {
        method: method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      return fail(ERROR_CODES.UNKNOWN, 'network error: ' + e.message,
        'Could not reach Hostinger — check your internet connection and try again.');
    }
    if (res.status === 401 || res.status === 403) {
      return fail(ERROR_CODES.BAD_TOKEN, 'Hostinger rejected the token (' + res.status + ')',
        'Re-check the Hostinger API key you pasted — it may be wrong or expired.');
    }
    if (res.status === 402) {
      return fail(ERROR_CODES.NO_BALANCE, 'Hostinger payment required',
        'Your Hostinger account needs a valid plan/payment method before a VPS can be created.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: true, status: res.status, data: data };
  }

  return { request: request };
}

module.exports = { createHostingerClient: createHostingerClient };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd installer && node --test test/hostinger-client.test.js`
Expected: PASS (2 tests).

> NOTE for the implementer: the exact Hostinger endpoint paths and JSON shapes here are provisional (see plan §9 "spike"). If the spike reveals different paths/fields, update `client.js` callers in Tasks 6–7 and `mock-hostinger.js` together so tests stay green.

- [ ] **Step 6: Commit**

```bash
git add installer/src/hostinger/client.js installer/test/helpers/mock-hostinger.js installer/test/hostinger-client.test.js
git commit -m "feat(installer): thin injectable Hostinger REST client + test mock"
```

---

### Task 6: `provision_vps` (idempotent, never double-creates)

**Files:**
- Create: `installer/src/hostinger/provision.js`
- Test: `installer/test/hostinger-provision.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES` (Task 1); Hostinger client (Task 5); `state` helpers (Task 4).
- Produces:
  - `provisionVps({ client, sshPublicKey, plan, datacenter, label, state }) -> Promise<{ ok, vpsId }>`. If `isDone(state,'provision')`, returns cached `vpsId` without an API call. Otherwise POSTs to create, stores `vpsId` via `markStep`, returns it.

- [ ] **Step 1: Write the failing test** — `installer/test/hostinger-provision.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { createHostingerClient } = require('../src/hostinger/client');
var { makeMockHostinger } = require('./helpers/mock-hostinger');
var { provisionVps } = require('../src/hostinger/provision');
var { createState, isDone } = require('../src/state');

function st() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aq-prov-'));
  return createState({ installId: 'p1', provider: 'hostinger', dir: dir });
}

test('creates a VPS and records vpsId', async function () {
  var mock = makeMockHostinger();
  var client = createHostingerClient({ token: 'good-token', fetchImpl: mock.fetchImpl });
  var state = st();
  var r = await provisionVps({ client: client, sshPublicKey: 'ssh-ed25519 AAA',
    plan: 'kvm1', datacenter: 'eu', label: 'aquila', state: state });
  assert.strictEqual(r.ok, true);
  assert.ok(r.vpsId);
  assert.strictEqual(isDone(state, 'provision'), true);
  assert.strictEqual(mock.state.created.length, 1);
});

test('idempotent: second call does not create a second VPS', async function () {
  var mock = makeMockHostinger();
  var client = createHostingerClient({ token: 'good-token', fetchImpl: mock.fetchImpl });
  var state = st();
  await provisionVps({ client: client, sshPublicKey: 'k', state: state });
  var again = await provisionVps({ client: client, sshPublicKey: 'k', state: state });
  assert.strictEqual(again.ok, true);
  assert.strictEqual(mock.state.created.length, 1);
});

test('surfaces BAD_TOKEN from client', async function () {
  var mock = makeMockHostinger();
  var client = createHostingerClient({ token: 'wrong', fetchImpl: mock.fetchImpl });
  var r = await provisionVps({ client: client, sshPublicKey: 'k', state: st() });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_TOKEN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/hostinger-provision.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/hostinger/provision.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

async function provisionVps(args) {
  var state = args.state;
  if (isDone(state, 'provision') && state.artifacts.vpsId) {
    return ok({ vpsId: state.artifacts.vpsId });
  }
  if (!args.sshPublicKey) {
    return fail(ERROR_CODES.BAD_INPUT, 'sshPublicKey required',
      'Internal: an SSH public key must be generated before provisioning.');
  }
  var res = await args.client.request('POST', '/api/vps/v1/virtual-machines', {
    plan: args.plan || 'kvm1',
    data_center: args.datacenter || 'eu',
    label: args.label || 'aquila-guardian',
    ssh_keys: [args.sshPublicKey]
  });
  if (res.ok === false) return res; // already a structured fail
  var id = res.data && res.data.id;
  if (!id) {
    return fail(ERROR_CODES.UNKNOWN, 'Hostinger did not return a VPS id',
      'Unexpected response creating the VPS — try again in a minute.');
  }
  markStep(state, 'provision', { vpsId: id });
  return ok({ vpsId: id });
}

module.exports = { provisionVps: provisionVps };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/hostinger-provision.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/hostinger/provision.js installer/test/hostinger-provision.test.js
git commit -m "feat(installer): provision_vps tool (idempotent, no double-create)"
```

---

### Task 7: `wait_for_vps` (poll until SSH-reachable IP, bounded timeout)

**Files:**
- Create: `installer/src/hostinger/wait.js`
- Test: `installer/test/hostinger-wait.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`; Hostinger client; `state` helpers.
- Produces:
  - `waitForVps({ client, vpsId, state, timeoutMs=600000, pollMs=10000, sleep, now }) -> Promise<{ ok, ip }>`. `sleep(ms)` and `now()` are injectable for tests. Polls GET until `state==='running'` with an IPv4; records `ip` via `markStep('wait')`; returns `TIMEOUT` if exceeded.

- [ ] **Step 1: Write the failing test** — `installer/test/hostinger-wait.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { createHostingerClient } = require('../src/hostinger/client');
var { makeMockHostinger } = require('./helpers/mock-hostinger');
var { waitForVps } = require('../src/hostinger/wait');
var { createState } = require('../src/state');

function st() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aq-wait-'));
  return createState({ installId: 'w1', provider: 'hostinger', dir: dir });
}
var noSleep = function () { return Promise.resolve(); };

test('returns ip once VPS is running', async function () {
  var mock = makeMockHostinger({ readyAfterPolls: 1 });
  var client = createHostingerClient({ token: 'good-token', fetchImpl: mock.fetchImpl });
  var r = await waitForVps({ client: client, vpsId: 'vps-1', state: st(),
    pollMs: 1, sleep: noSleep });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.ip, '203.0.113.5');
});

test('times out when never ready', async function () {
  var mock = makeMockHostinger({ readyAfterPolls: 9999 });
  var client = createHostingerClient({ token: 'good-token', fetchImpl: mock.fetchImpl });
  var t = 0;
  var r = await waitForVps({ client: client, vpsId: 'vps-1', state: st(),
    pollMs: 10, timeoutMs: 25, sleep: noSleep, now: function () { return (t += 10); } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'TIMEOUT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/hostinger-wait.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/hostinger/wait.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitForVps(args) {
  var state = args.state;
  if (isDone(state, 'wait') && state.artifacts.ip) return ok({ ip: state.artifacts.ip });

  var sleep = args.sleep || defaultSleep;
  var now = args.now || Date.now;
  var timeoutMs = args.timeoutMs == null ? 600000 : args.timeoutMs;
  var pollMs = args.pollMs == null ? 10000 : args.pollMs;
  var start = now();

  while (true) {
    var res = await args.client.request('GET', '/api/vps/v1/virtual-machines/' + args.vpsId);
    if (res.ok === false) return res;
    var d = res.data || {};
    var ip = d.ipv4 && d.ipv4[0] && d.ipv4[0].address;
    if (d.state === 'running' && ip) {
      markStep(state, 'wait', { ip: ip });
      return ok({ ip: ip });
    }
    if (now() - start >= timeoutMs) {
      return fail(ERROR_CODES.TIMEOUT, 'VPS not ready within ' + timeoutMs + 'ms',
        'The server is taking longer than expected to boot — wait a moment and resume.');
    }
    await sleep(pollMs);
  }
}

module.exports = { waitForVps: waitForVps };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/hostinger-wait.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/hostinger/wait.js installer/test/hostinger-wait.test.js
git commit -m "feat(installer): wait_for_vps tool with bounded timeout"
```

---

### Task 8: SSH connection wrapper (injectable interface + ssh2 impl)

**Files:**
- Create: `installer/src/ssh/connection.js`
- Create: `installer/test/helpers/fake-ssh.js`
- Test: `installer/test/ssh-connection.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`.
- Produces:
  - An **SSH client interface** (the contract every deploy tool depends on): `{ exec(cmd) -> Promise<{ code, stdout, stderr }>, putFile(content, remotePath, mode?) -> Promise<void>, close() -> void }`.
  - `connectSsh({ host, port=22, username='root', privateKey?, password?, ConnImpl? }) -> Promise<{ ok, ssh }>` where `ssh` implements the interface above using `ssh2`. `ConnImpl` is injectable (defaults to `require('ssh2').Client`) so the wrapper itself is unit-testable without a real server.
- Produces (test helper): `fake-ssh.js` exports `makeFakeSsh({ responses }) -> sshIface` — an in-memory SSH used by Tasks 9–11 unit tests. `responses` maps a command substring → `{ code, stdout, stderr }`; records `puts` (files written).

- [ ] **Step 1: Write the fake-ssh helper** — `installer/test/helpers/fake-ssh.js`

```js
// In-memory SSH double for unit tests. Matches command substrings to canned
// results; records files "uploaded". No real network/process involved.
function makeFakeSsh(opts) {
  opts = opts || {};
  var responses = opts.responses || {};
  var rec = { execs: [], puts: [] };

  function exec(cmd) {
    rec.execs.push(cmd);
    var keys = Object.keys(responses);
    for (var i = 0; i < keys.length; i++) {
      if (cmd.indexOf(keys[i]) !== -1) return Promise.resolve(responses[keys[i]]);
    }
    return Promise.resolve({ code: 0, stdout: '', stderr: '' });
  }
  function putFile(content, remotePath) {
    rec.puts.push({ remotePath: remotePath, content: content });
    return Promise.resolve();
  }
  function close() {}
  return { exec: exec, putFile: putFile, close: close, _rec: rec };
}

module.exports = { makeFakeSsh: makeFakeSsh };
```

- [ ] **Step 2: Write the failing test** — `installer/test/ssh-connection.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { connectSsh } = require('../src/ssh/connection');

// A minimal fake ssh2 Client: emits 'ready', and exec() returns a fake stream.
function FakeConn() {
  var handlers = {};
  this.on = function (ev, cb) { handlers[ev] = cb; return this; };
  this.connect = function () { setImmediate(function () { handlers.ready && handlers.ready(); }); };
  this.exec = function (cmd, cb) {
    var streamHandlers = {};
    var stream = {
      on: function (ev, h) { streamHandlers[ev] = h; return stream; },
      stderr: { on: function () { return stream.stderr; } }
    };
    cb(null, stream);
    setImmediate(function () {
      streamHandlers.data && streamHandlers.data(Buffer.from('hello'));
      streamHandlers.close && streamHandlers.close(0);
    });
  };
  this.end = function () {};
}

test('connectSsh resolves an ssh iface that execs', async function () {
  var r = await connectSsh({ host: '1.2.3.4', password: 'pw', ConnImpl: FakeConn });
  assert.strictEqual(r.ok, true);
  var out = await r.ssh.exec('echo hello');
  assert.strictEqual(out.code, 0);
  assert.strictEqual(out.stdout, 'hello');
  r.ssh.close();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd installer && node --test test/ssh-connection.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `installer/src/ssh/connection.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');

function connectSsh(args) {
  return new Promise(function (resolve) {
    var ConnImpl = args.ConnImpl;
    if (!ConnImpl) ConnImpl = require('ssh2').Client;
    var conn = new ConnImpl();
    var settled = false;

    conn.on('ready', function () {
      settled = true;
      resolve(ok({ ssh: makeIface(conn) }));
    });
    conn.on('error', function (e) {
      if (settled) return;
      settled = true;
      resolve(fail(ERROR_CODES.SSH_FAILED, 'SSH connect failed: ' + e.message,
        'Could not log in to the server — check the IP and SSH credential.'));
    });

    conn.connect({
      host: args.host,
      port: args.port || 22,
      username: args.username || 'root',
      privateKey: args.privateKey,
      password: args.password,
      readyTimeout: args.readyTimeout || 20000
    });
  });
}

function makeIface(conn) {
  function exec(cmd) {
    return new Promise(function (resolve, reject) {
      conn.exec(cmd, function (err, stream) {
        if (err) return reject(err);
        var stdout = '', stderr = '';
        stream.on('data', function (d) { stdout += d.toString(); });
        stream.stderr.on('data', function (d) { stderr += d.toString(); });
        stream.on('close', function (code) {
          resolve({ code: code == null ? 0 : code, stdout: stdout, stderr: stderr });
        });
      });
    });
  }
  function putFile(content, remotePath) {
    // Write via a heredoc-free base64 pipe to avoid quoting issues.
    var b64 = Buffer.from(content, 'utf8').toString('base64');
    return exec("echo '" + b64 + "' | base64 -d | sudo tee " + remotePath + " > /dev/null")
      .then(function (r) {
        if (r.code !== 0) throw new Error('putFile failed: ' + r.stderr);
      });
  }
  function close() { try { conn.end(); } catch (e) {} }
  return { exec: exec, putFile: putFile, close: close };
}

module.exports = { connectSsh: connectSsh };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd installer && node --test test/ssh-connection.test.js`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add installer/src/ssh/connection.js installer/test/helpers/fake-ssh.js installer/test/ssh-connection.test.js
git commit -m "feat(installer): ssh2 connection wrapper with injectable client"
```

---

### Task 9: `preflight_check` (BYO-VPS gate, plain-language issues)

**Files:**
- Create: `installer/src/deploy/preflight.js`
- Test: `installer/test/preflight.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`; an SSH iface (Task 8).
- Produces:
  - `preflightCheck({ ssh }) -> Promise<{ ok, issues }>`. Runs remote checks: OS is Ubuntu/Debian (`/etc/os-release`), `sudo` works, and a public IPv4 is reachable. Returns `ok:true, issues:[]` when all pass; `fail(PREFLIGHT_FAILED, ..., hint)` with `issues[]` (array of plain-language strings) when any fail.

- [ ] **Step 1: Write the failing test** — `installer/test/preflight.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { preflightCheck } = require('../src/deploy/preflight');

test('passes on ubuntu with sudo and public ip', async function () {
  var ssh = makeFakeSsh({ responses: {
    '/etc/os-release': { code: 0, stdout: 'ID=ubuntu\nVERSION_ID="22.04"', stderr: '' },
    'sudo -n true': { code: 0, stdout: '', stderr: '' },
    'curl': { code: 0, stdout: '203.0.113.5', stderr: '' }
  }});
  var r = await preflightCheck({ ssh: ssh });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.issues, []);
});

test('fails with issues on non-debian without sudo', async function () {
  var ssh = makeFakeSsh({ responses: {
    '/etc/os-release': { code: 0, stdout: 'ID=fedora', stderr: '' },
    'sudo -n true': { code: 1, stdout: '', stderr: 'no sudo' },
    'curl': { code: 0, stdout: '203.0.113.5', stderr: '' }
  }});
  var r = await preflightCheck({ ssh: ssh });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'PREFLIGHT_FAILED');
  assert.ok(r.issues.length >= 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/preflight.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/deploy/preflight.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');

async function preflightCheck(args) {
  var ssh = args.ssh;
  var issues = [];

  var os = await ssh.exec('cat /etc/os-release');
  if (!/ID=(ubuntu|debian)/.test(os.stdout)) {
    issues.push('The server is not Ubuntu or Debian. Aquila installs are only supported on those.');
  }
  var sudo = await ssh.exec('sudo -n true');
  if (sudo.code !== 0) {
    issues.push('The SSH user cannot use sudo without a password. Use a root or sudo-enabled account.');
  }
  var ip = await ssh.exec('curl -s -4 https://api.ipify.org || true');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test((ip.stdout || '').trim())) {
    issues.push('No public IPv4 was detected. A server behind NAT cannot receive Twilio voice calls.');
  }

  if (issues.length > 0) {
    return fail(ERROR_CODES.PREFLIGHT_FAILED, 'preflight failed', issues.join(' '));
  }
  return ok({ issues: [] });
}

// Re-export issues on failure for callers that want the array.
var _origFail = require('../result').fail;
module.exports = { preflightCheck: function (a) {
  return preflightCheck(a).then(function (r) {
    if (r.ok === false) r.issues = r.hint ? r.hint.split('. ').filter(Boolean) : [];
    return r;
  });
}};
```

> NOTE: keep `issues` on both success and failure results. The wrapper above
> reconstructs `issues` from the hint; if you prefer, thread `issues` through
> `fail()` directly — either is fine as long as the test passes.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/preflight.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/deploy/preflight.js installer/test/preflight.test.js
git commit -m "feat(installer): preflight_check for BYO-VPS targets"
```

---

### Task 10: `deploy_aquila` (Docker + .env + compose over SSH)

**Files:**
- Create: `installer/src/deploy/deploy-aquila.js`
- Test: `installer/test/deploy-aquila.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`; SSH iface (Task 8); `renderEnv` (Task 3); `generateWebhookSecret` (Task 2); `state` helpers (Task 4).
- Produces:
  - `deployAquila({ ssh, secrets, image, webhookSecret, port=3000, state, remoteDir='/opt/aquila' }) -> Promise<{ ok, deployed, webhookSecret }>`. Ensures Docker present (installs via `get.docker.com` if missing), writes `<remoteDir>/.env` (from `renderEnv`) and `<remoteDir>/docker-compose.yml` (referencing `image:`, NOT `build:`), then `docker compose pull && up -d`. If `webhookSecret` not passed, generates one and returns it so the orchestrator can persist nothing-but-pass-forward. Idempotent via `state` step `deploy`.

- [ ] **Step 1: Write the failing test** — `installer/test/deploy-aquila.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { deployAquila } = require('../src/deploy/deploy-aquila');
var { createState, isDone } = require('../src/state');

function st() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aq-dep-'));
  return createState({ installId: 'd1', provider: 'byo', dir: dir });
}

test('writes compose + env and runs docker up', async function () {
  var ssh = makeFakeSsh({ responses: {
    'docker --version': { code: 0, stdout: 'Docker version 27', stderr: '' },
    'docker compose': { code: 0, stdout: '', stderr: '' }
  }});
  var r = await deployAquila({
    ssh: ssh,
    secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
    image: 'ghcr.io/x/aquila-guardian:1.0.0',
    webhookSecret: 'a'.repeat(64),
    state: st()
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.deployed, true);

  var puts = ssh._rec.puts.map(function (p) { return p.remotePath; });
  assert.ok(puts.indexOf('/opt/aquila/.env') !== -1);
  assert.ok(puts.indexOf('/opt/aquila/docker-compose.yml') !== -1);

  var compose = ssh._rec.puts.find(function (p) { return /compose/.test(p.remotePath); }).content;
  assert.ok(compose.indexOf('image: ghcr.io/x/aquila-guardian:1.0.0') !== -1);
  assert.ok(compose.indexOf('build:') === -1);
});

test('fails clearly when bad secrets bundle', async function () {
  var ssh = makeFakeSsh({ responses: { 'docker --version': { code: 0, stdout: 'ok' } } });
  var r = await deployAquila({ ssh: ssh, secrets: {}, image: 'x', webhookSecret: 'a'.repeat(64), state: st() });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_INPUT');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/deploy-aquila.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/deploy/deploy-aquila.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');
var { renderEnv } = require('../env-render');
var { generateWebhookSecret } = require('../secrets');
var { markStep, isDone } = require('../state');

function composeYaml(image, port) {
  return [
    'services:',
    '  aquila:',
    '    image: ' + image,
    '    container_name: aquila-guardian',
    '    restart: unless-stopped',
    '    env_file: [.env]',
    '    ports:',
    '      - "' + port + ':3000"',
    '    volumes:',
    '      - ./data:/app/server/data',
    '    healthcheck:',
    '      test: ["CMD", "wget", "-q", "-O-", "http://localhost:3000/api/health"]',
    '      interval: 30s',
    '      timeout: 5s',
    '      retries: 3',
    ''
  ].join('\n');
}

async function deployAquila(args) {
  var state = args.state;
  var port = args.port || 3000;
  var remoteDir = args.remoteDir || '/opt/aquila';
  var webhookSecret = args.webhookSecret || generateWebhookSecret();

  if (state && isDone(state, 'deploy')) {
    return ok({ deployed: true, webhookSecret: webhookSecret });
  }

  var rendered = renderEnv(args.secrets, { webhookSecret: webhookSecret, port: port });
  if (rendered.ok === false) return rendered;

  var ssh = args.ssh;

  // 1. Ensure Docker.
  var dv = await ssh.exec('docker --version || true');
  if (!/Docker version/.test(dv.stdout)) {
    var inst = await ssh.exec('curl -fsSL https://get.docker.com | sudo sh');
    if (inst.code !== 0) {
      return fail(ERROR_CODES.DEPLOY_FAILED, 'docker install failed: ' + inst.stderr,
        'Could not install Docker on the server. Check the server has internet access.');
    }
  }

  // 2. Write files.
  await ssh.exec('sudo mkdir -p ' + remoteDir + '/data');
  await ssh.putFile(rendered.env, remoteDir + '/.env');
  await ssh.putFile(composeYaml(args.image, port), remoteDir + '/docker-compose.yml');

  // 3. Pull + up.
  var up = await ssh.exec('cd ' + remoteDir + ' && sudo docker compose pull && sudo docker compose up -d');
  if (up.code !== 0) {
    return fail(ERROR_CODES.DEPLOY_FAILED, 'docker compose up failed: ' + up.stderr,
      'The Aquila container did not start. This is usually a transient pull error — try resuming.');
  }

  if (state) markStep(state, 'deploy', {});
  return ok({ deployed: true, webhookSecret: webhookSecret });
}

module.exports = { deployAquila: deployAquila };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/deploy-aquila.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/deploy/deploy-aquila.js installer/test/deploy-aquila.test.js
git commit -m "feat(installer): deploy_aquila over SSH (image-based compose + .env)"
```

---

### Task 11: `setup_https` (Caddy + sslip.io, set PUBLIC_HOST)

**Files:**
- Create: `installer/src/deploy/https.js`
- Test: `installer/test/https.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`; SSH iface; `state` helpers.
- Produces:
  - `ipToSslip(ip) -> string` (e.g. `203.0.113.5` → `203-0-113-5.sslip.io`).
  - `setupHttps({ ssh, ip, port=3000, remoteDir='/opt/aquila', state }) -> Promise<{ ok, publicUrl }>`. Installs Caddy if missing, writes a Caddyfile reverse-proxying `<host>` → `localhost:port`, reloads Caddy, appends/updates `PUBLIC_HOST=https://<host>` in the remote `.env`, restarts Aquila. Idempotent via step `https`.

- [ ] **Step 1: Write the failing test** — `installer/test/https.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { setupHttps, ipToSslip } = require('../src/deploy/https');
var { createState } = require('../src/state');

function st() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aq-https-'));
  return createState({ installId: 'h1', provider: 'byo', dir: dir });
}

test('ipToSslip dashes the octets', function () {
  assert.strictEqual(ipToSslip('203.0.113.5'), '203-0-113-5.sslip.io');
});

test('configures caddy and returns public url', async function () {
  var ssh = makeFakeSsh({ responses: {
    'caddy version': { code: 0, stdout: 'v2', stderr: '' },
    'systemctl reload caddy': { code: 0, stdout: '', stderr: '' }
  }});
  var r = await setupHttps({ ssh: ssh, ip: '203.0.113.5', port: 3000, state: st() });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.publicUrl, 'https://203-0-113-5.sslip.io');

  var caddy = ssh._rec.puts.find(function (p) { return /Caddyfile/.test(p.remotePath); }).content;
  assert.ok(caddy.indexOf('203-0-113-5.sslip.io') !== -1);
  assert.ok(caddy.indexOf('reverse_proxy localhost:3000') !== -1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/https.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/deploy/https.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

function ipToSslip(ip) {
  return String(ip).split('.').join('-') + '.sslip.io';
}

function caddyfile(host, port) {
  return host + ' {\n    reverse_proxy localhost:' + port + '\n}\n';
}

async function setupHttps(args) {
  var state = args.state;
  var host = ipToSslip(args.ip);
  var publicUrl = 'https://' + host;
  if (state && isDone(state, 'https')) return ok({ publicUrl: publicUrl });

  var ssh = args.ssh;
  var port = args.port || 3000;
  var remoteDir = args.remoteDir || '/opt/aquila';

  // 1. Ensure Caddy.
  var cv = await ssh.exec('caddy version || true');
  if (!/v2|v1/.test(cv.stdout)) {
    var inst = await ssh.exec(
      'sudo apt-get update && sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl && ' +
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && " +
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list && " +
      'sudo apt-get update && sudo apt-get install -y caddy');
    if (inst.code !== 0) {
      return fail(ERROR_CODES.HTTPS_FAILED, 'caddy install failed: ' + inst.stderr,
        'Could not install the HTTPS proxy. Check the server has internet access and ports 80/443 are free.');
    }
  }

  // 2. Write Caddyfile + reload.
  await ssh.putFile(caddyfile(host, port), '/etc/caddy/Caddyfile');
  var reload = await ssh.exec('sudo systemctl reload caddy || sudo systemctl restart caddy');
  if (reload.code !== 0) {
    return fail(ERROR_CODES.HTTPS_FAILED, 'caddy reload failed: ' + reload.stderr,
      'The HTTPS proxy could not start — ports 80/443 may be in use.');
  }

  // 3. Set PUBLIC_HOST in .env and restart Aquila so Twilio voice URLs are correct.
  await ssh.exec(
    'cd ' + remoteDir + ' && sudo sed -i "/^PUBLIC_HOST=/d" .env && ' +
    'echo "PUBLIC_HOST=' + publicUrl + '" | sudo tee -a .env > /dev/null && ' +
    'sudo docker compose up -d');

  if (state) markStep(state, 'https', { publicUrl: publicUrl });
  return ok({ publicUrl: publicUrl });
}

module.exports = { setupHttps: setupHttps, ipToSslip: ipToSslip };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/https.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/deploy/https.js installer/test/https.test.js
git commit -m "feat(installer): setup_https via Caddy + sslip.io"
```

---

### Task 12: `verify_deployment` (GET /api/health with retries)

**Files:**
- Create: `installer/src/deploy/verify.js`
- Test: `installer/test/verify.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `ERROR_CODES`.
- Produces:
  - `verifyDeployment({ publicUrl, fetchImpl=fetch, retries=10, delayMs=3000, sleep }) -> Promise<{ ok, healthy }>`. GETs `publicUrl + '/api/health'`; success when JSON `status === 'ok'`. Retries on transient failure up to `retries`; returns `HEALTH_FAILED` after exhausting.

- [ ] **Step 1: Write the failing test** — `installer/test/verify.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var { verifyDeployment } = require('../src/deploy/verify');
var noSleep = function () { return Promise.resolve(); };

function fetchOk() {
  return Promise.resolve({ ok: true, status: 200,
    json: function () { return Promise.resolve({ status: 'ok', service: 'aquila-guardian' }); } });
}
function fetchFail() { return Promise.reject(new Error('conn refused')); }

test('healthy when /api/health returns status ok', async function () {
  var called = null;
  var r = await verifyDeployment({ publicUrl: 'https://h.sslip.io',
    fetchImpl: function (u) { called = u; return fetchOk(); }, sleep: noSleep });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.healthy, true);
  assert.strictEqual(called, 'https://h.sslip.io/api/health');
});

test('fails after retries exhausted', async function () {
  var r = await verifyDeployment({ publicUrl: 'https://h.sslip.io',
    fetchImpl: fetchFail, retries: 2, sleep: noSleep });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'HEALTH_FAILED');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/verify.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/deploy/verify.js`**

```js
var { ok, fail, ERROR_CODES } = require('../result');

function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function verifyDeployment(args) {
  var fetchImpl = args.fetchImpl || fetch;
  var sleep = args.sleep || defaultSleep;
  var retries = args.retries == null ? 10 : args.retries;
  var delayMs = args.delayMs == null ? 3000 : args.delayMs;
  var url = args.publicUrl + '/api/health';

  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      var res = await fetchImpl(url);
      if (res && res.ok) {
        var data = await res.json();
        if (data && data.status === 'ok') return ok({ healthy: true });
      }
    } catch (e) { /* transient — retry */ }
    if (attempt < retries) await sleep(delayMs);
  }
  return fail(ERROR_CODES.HEALTH_FAILED, 'health check did not pass after ' + retries + ' tries',
    'Aquila is installed but not answering yet. TLS can take a minute on first boot — resume to retry.');
}

module.exports = { verifyDeployment: verifyDeployment };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/verify.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add installer/src/deploy/verify.js installer/test/verify.test.js
git commit -m "feat(installer): verify_deployment against /api/health"
```

---

### Task 13: `runInstall` orchestrator + public exports (both entry points, resume)

**Files:**
- Create: `installer/src/index.js`
- Test: `installer/test/orchestrator.test.js`

**Interfaces:**
- Consumes: all tools above; `createState`/`loadState` (Task 4); `generateWebhookSecret` (Task 2).
- Produces:
  - `module.exports` re-exporting every tool (`provisionVps`, `waitForVps`, `preflightCheck`, `deployAquila`, `setupHttps`, `verifyDeployment`) plus `runInstall`.
  - `runInstall(opts) -> Promise<{ ok, publicUrl }>` where `opts = { entryPoint: 'hostinger'|'byo', installId, stateDir, secrets, image, deps }`. `deps` injects `{ client, connectSsh, sshTarget, sshPublicKey, fetchImpl }` for tests. Drives the path-specific order; on any tool failure returns that structured fail (so the caller can fix-and-resume); reloads existing state so a re-run skips completed steps.

- [ ] **Step 1: Write the failing test** — `installer/test/orchestrator.test.js`

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { runInstall } = require('../src/index');

function stateDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aq-orch-')); }

function fakeDeps() {
  var ssh = makeFakeSsh({ responses: {
    '/etc/os-release': { code: 0, stdout: 'ID=ubuntu', stderr: '' },
    'sudo -n true': { code: 0, stdout: '', stderr: '' },
    'curl': { code: 0, stdout: '203.0.113.5', stderr: '' },
    'docker --version': { code: 0, stdout: 'Docker version 27', stderr: '' },
    'docker compose': { code: 0, stdout: '', stderr: '' },
    'caddy version': { code: 0, stdout: 'v2', stderr: '' },
    'systemctl reload caddy': { code: 0, stdout: '', stderr: '' }
  }});
  return {
    sshTarget: { host: '203.0.113.5', password: 'pw' },
    connectSsh: function () { return Promise.resolve({ ok: true, ssh: ssh }); },
    fetchImpl: function () {
      return Promise.resolve({ ok: true, status: 200,
        json: function () { return Promise.resolve({ status: 'ok' }); } });
    },
    verifyOpts: { retries: 1, sleep: function () { return Promise.resolve(); } }
  };
}

test('byo path runs to a healthy public url', async function () {
  var r = await runInstall({
    entryPoint: 'byo',
    installId: 'o1',
    stateDir: stateDir(),
    secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
    image: 'ghcr.io/x/aquila-guardian:1.0.0',
    deps: fakeDeps()
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.publicUrl, 'https://203-0-113-5.sslip.io');
});

test('resume: second run with completed state still returns url', async function () {
  var dir = stateDir();
  var common = { entryPoint: 'byo', installId: 'o2', stateDir: dir,
    secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
    image: 'ghcr.io/x/aquila-guardian:1.0.0' };
  await runInstall(Object.assign({}, common, { deps: fakeDeps() }));
  var r2 = await runInstall(Object.assign({}, common, { deps: fakeDeps() }));
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.publicUrl, 'https://203-0-113-5.sslip.io');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd installer && node --test test/orchestrator.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `installer/src/index.js`**

```js
var { ok, fail, ERROR_CODES } = require('./result');
var { createState, loadState } = require('./state');
var { generateWebhookSecret } = require('./secrets');
var { provisionVps } = require('./hostinger/provision');
var { waitForVps } = require('./hostinger/wait');
var { preflightCheck } = require('./deploy/preflight');
var { deployAquila } = require('./deploy/deploy-aquila');
var { setupHttps, ipToSslip } = require('./deploy/https');
var { verifyDeployment } = require('./deploy/verify');

async function runInstall(opts) {
  var deps = opts.deps || {};
  var state = loadState({ installId: opts.installId, dir: opts.stateDir })
    || createState({ installId: opts.installId, provider: opts.entryPoint, dir: opts.stateDir });

  var ip;

  // Hostinger path: provision + wait.
  if (opts.entryPoint === 'hostinger') {
    var prov = await provisionVps({ client: deps.client, sshPublicKey: deps.sshPublicKey, state: state });
    if (prov.ok === false) return prov;
    var waited = await waitForVps({ client: deps.client, vpsId: prov.vpsId, state: state });
    if (waited.ok === false) return waited;
    ip = waited.ip;
  } else {
    ip = (deps.sshTarget && deps.sshTarget.host);
    if (!ip) return fail(ERROR_CODES.BAD_INPUT, 'no sshTarget host for byo path',
      'Provide the IP and SSH credential of your existing server.');
  }

  // Connect SSH.
  var conn = await deps.connectSsh(Object.assign({ host: ip }, deps.sshTarget || {}));
  if (conn.ok === false) return conn;
  var ssh = conn.ssh;

  try {
    var pre = await preflightCheck({ ssh: ssh });
    if (pre.ok === false) return pre;

    var dep = await deployAquila({ ssh: ssh, secrets: opts.secrets, image: opts.image,
      webhookSecret: generateWebhookSecret(), state: state });
    if (dep.ok === false) return dep;

    var https = await setupHttps({ ssh: ssh, ip: ip, state: state });
    if (https.ok === false) return https;

    var verifyOpts = Object.assign({ publicUrl: https.publicUrl, fetchImpl: deps.fetchImpl },
      deps.verifyOpts || {});
    var ver = await verifyDeployment(verifyOpts);
    if (ver.ok === false) return ver;

    return ok({ publicUrl: https.publicUrl });
  } finally {
    ssh.close();
  }
}

module.exports = {
  runInstall: runInstall,
  provisionVps: provisionVps,
  waitForVps: waitForVps,
  preflightCheck: preflightCheck,
  deployAquila: deployAquila,
  setupHttps: setupHttps,
  verifyDeployment: verifyDeployment,
  ipToSslip: ipToSslip
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd installer && node --test test/orchestrator.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole unit suite**

Run: `cd installer && node --test`
Expected: PASS — all tests across all files.

- [ ] **Step 6: Commit**

```bash
git add installer/src/index.js installer/test/orchestrator.test.js
git commit -m "feat(installer): runInstall orchestrator with resume + both entry points"
```

---

### Task 14: Integration test harness (real Docker "VPS", opt-in) + publish image

**Files:**
- Create: `installer/test/helpers/docker-vps.js`
- Create: `installer/test/integration.test.js`
- Create: `.github/workflows/installer-ci.yml`

**Interfaces:**
- Consumes: real `connectSsh` (Task 8); `deployAquila`, `setupHttps`, `verifyDeployment`; a published Aquila image.
- Produces:
  - `docker-vps.js`: `startDockerVps() -> Promise<{ host, port, password, stop() }>` — boots a container running `sshd` (e.g. a `linuxserver/openssh-server` or a custom Ubuntu+sshd image) with a known root password and Docker-in-Docker OR a stub. Gated behind `RUN_INTEGRATION=1`.
  - `integration.test.js`: end-to-end deploy against that container, Hostinger mocked.

> This task validates the real SSH deploy path. It is **excluded from the default
> `node --test` run** (guarded by `RUN_INTEGRATION`) because it needs Docker and is
> slower. The publish-image sub-steps below resolve the `AQUILA_ORG`/`AQUILA_TAG`
> placeholders from the Global Constraints.

- [ ] **Step 1: Publish the official Aquila image**

Build and push the existing repo `Dockerfile` to a registry. Run from repo root:

```bash
docker build -t ghcr.io/AQUILA_ORG/aquila-guardian:1.0.0 .
echo "$GHCR_TOKEN" | docker login ghcr.io -u AQUILA_ORG --password-stdin
docker push ghcr.io/AQUILA_ORG/aquila-guardian:1.0.0
```

Record the final image ref; it becomes the `image` arg in real installs and the
integration test. (If GHCR is not desired, Docker Hub works identically.)

- [ ] **Step 2: Write `installer/test/helpers/docker-vps.js`**

```js
var { execFileSync, execFile } = require('child_process');

// Boots an Ubuntu+sshd container to act as the "VPS". Requires Docker on the host.
// Uses host networking is avoided; we map a random high port to 22.
function startDockerVps() {
  // Image must have sshd + sudo + docker CLI available; build once in CI (see workflow).
  var name = 'aquila-vps-test';
  try { execFileSync('docker', ['rm', '-f', name]); } catch (e) {}
  execFileSync('docker', ['run', '-d', '--name', name, '--privileged',
    '-p', '0:22', 'aquila-vps-test:latest']);
  var port = execFileSync('docker', ['port', name, '22'])
    .toString().trim().split(':').pop();
  return Promise.resolve({
    host: '127.0.0.1',
    port: Number(port),
    username: 'root',
    password: 'root',
    stop: function () { try { execFileSync('docker', ['rm', '-f', name]); } catch (e) {} }
  });
}

module.exports = { startDockerVps: startDockerVps };
```

- [ ] **Step 3: Write `installer/test/integration.test.js`**

```js
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { runInstall } = require('../src/index');
var { connectSsh } = require('../src/ssh/connection');

var RUN = process.env.RUN_INTEGRATION === '1';

test('end-to-end deploy onto a real Docker VPS', { skip: !RUN }, async function () {
  var { startDockerVps } = require('./helpers/docker-vps');
  var vps = await startDockerVps();
  try {
    var r = await runInstall({
      entryPoint: 'byo',
      installId: 'int1',
      stateDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aq-int-')),
      secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
      image: process.env.AQUILA_IMAGE || 'ghcr.io/AQUILA_ORG/aquila-guardian:1.0.0',
      deps: {
        sshTarget: { host: vps.host, port: vps.port, username: vps.username, password: vps.password },
        connectSsh: connectSsh,
        verifyOpts: { retries: 20, delayMs: 3000 }
      }
    });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
  } finally {
    vps.stop();
  }
});
```

- [ ] **Step 4: Write `.github/workflows/installer-ci.yml`**

```yaml
name: installer-ci
on:
  push:
    paths: ['installer/**', '.github/workflows/installer-ci.yml']
  pull_request:
    paths: ['installer/**']
jobs:
  unit:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: installer } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm test
      - name: Dependency audit (high+)
        run: npm audit --omit=dev --audit-level=high
      - name: Secret scan (no secrets committed)
        run: |
          ! grep -rEn '(TWILIO_AUTH_TOKEN|ADMIN_PASSWORD|WEBHOOK_SECRET)=[^\s]+' \
            --include='*.js' --include='*.json' src test || \
            (echo 'Secret-looking value committed' && exit 1)
```

- [ ] **Step 5: Run the unit suite (integration stays skipped by default)**

Run: `cd installer && node --test`
Expected: PASS, integration test reported as skipped.

- [ ] **Step 6: Commit**

```bash
git add installer/test/helpers/docker-vps.js installer/test/integration.test.js .github/workflows/installer-ci.yml
git commit -m "test(installer): opt-in Docker-VPS integration + CI (test/audit/secret-scan)"
```

---

### Task 15: Audit-facing documentation (README, SECURITY, threat model, checklist)

**Files:**
- Create: `installer/README.md`
- Create: `installer/SECURITY.md`
- Create: `installer/docs/threat-model.md`
- Create: `installer/docs/audit-checklist.md`

**Interfaces:**
- Consumes: the finished code (documents real behavior — no aspirational claims).
- Produces: documentation only. No tests; the "test" is that every claim is verifiable against the code.

- [ ] **Step 1: Write `installer/README.md`**

Document, with exact accuracy: what the package is (Subsystem A of the Aquila installer);
the six tools and their signatures (copy from the code); the two entry points
(Hostinger / BYO-VPS); the data-flow diagram showing that **no data leaves the user's
control** — credentials flow only to the user's Hostinger account and their own VPS;
the explicit list of outbound network destinations (`developers.hostinger.com`, the
user's VPS over SSH, `get.docker.com`, Caddy's apt repo, Let's Encrypt via `sslip.io`);
how to run the tests; and the published image reference.

- [ ] **Step 2: Write `installer/SECURITY.md`**

Document: the secret-handling rules (secrets never persisted to state — link to the
`ALLOWED_ARTIFACTS` whitelist in `state.js`; secrets always redacted in logs — link to
`logger.js`); SSH model (key-based preferred for Hostinger path; password accepted for
BYO-VPS; `readyTimeout`); the `WEBHOOK_SECRET` generation (`crypto.randomBytes(32)`); the
trust boundary (we never receive user data; payment is a public on-chain tx handled by
Subsystem C); and a responsible-disclosure contact/process.

- [ ] **Step 3: Write `installer/docs/threat-model.md`**

Document the STRIDE-style threats and mitigations for the install flow, at minimum:
- Stolen Hostinger token → scoped to user's own account; never logged; lives only in memory.
- MITM on SSH → host-key handling note + recommendation to pin/verify on first connect (future work item).
- Malicious image → pinned image digest recommendation; image is the public Aquila build.
- sslip.io dependency → availability risk + Cloudflare Tunnel fallback (deferred).
- Secret leakage via logs/state → redaction + artifact whitelist (with code links).
List each as: threat → likelihood → mitigation → status (mitigated / accepted / deferred).

- [ ] **Step 4: Write `installer/docs/audit-checklist.md`**

A reviewer-runnable checklist mapping each Global Constraint and success criterion to the
file/test that proves it (e.g. "Secrets never in state → `state.js` `ALLOWED_ARTIFACTS` +
`state.test.js` 'state file never contains secret-looking keys'"). Include the exact
commands an auditor runs: `cd installer && node --test`, `npm audit --omit=dev`, and the
secret-scan grep from the CI workflow.

- [ ] **Step 5: Verify docs match code (manual)**

Run: `cd installer && node --test && npm audit --omit=dev --audit-level=high`
Expected: PASS. Then re-read each doc claim against the referenced file and fix any drift.

- [ ] **Step 6: Commit**

```bash
git add installer/README.md installer/SECURITY.md installer/docs/threat-model.md installer/docs/audit-checklist.md
git commit -m "docs(installer): audit-facing README, SECURITY, threat model, checklist"
```

---

## Self-Review

**Spec coverage:**
- Two entry points (Hostinger auto / BYO-VPS) → Tasks 6–7 (Hostinger), 9 (preflight gate), 13 (orchestrator picks path). ✓
- Six tools → Tasks 6, 7, 9, 10, 11, 12. ✓
- Reuse Hostinger public API → Task 5 thin REST client (note: wraps the REST API directly rather than spawning Hostinger's MCP, for deterministic/testable/idempotent calls — a documented, intentional refinement of the spec's "reuse the official surface"; the spike in §9 confirms exact paths). ✓
- Caddy + sslip.io → Task 11. ✓
- Published Docker image, compose uses `image:` not `build:` → Global Constraints + Task 10 + Task 14 publish step. ✓
- Install-state + resume, never double-create VPS → Tasks 4, 6 (idempotent provision), 13 (resume). ✓
- Structured human-readable errors → Task 1 + every tool returns `fail(code,msg,hint)`. ✓
- Preflight check for BYO-VPS → Task 9. ✓
- Testing: Hostinger mocked, local Docker VPS, opt-in real e2e → Tasks 5 (mock), 14 (docker-vps + integration). ✓
- Zero-data / no secrets in state or logs → Tasks 2 (redaction), 4 (artifact whitelist), 15 (documented + audited), Task 14 CI secret-scan. ✓
- Security/docs first-class → Tasks 14–15. ✓

**Placeholder scan:** `AQUILA_ORG`/`AQUILA_TAG` are intentional, explicitly-flagged publish-time placeholders resolved in Task 14 Step 1; no other TBD/TODO present. Every code step contains complete code.

**Type consistency:** tool names and signatures are consistent across tasks and the orchestrator (`provisionVps`, `waitForVps`, `preflightCheck`, `deployAquila`, `setupHttps`, `verifyDeployment`, `runInstall`, `ipToSslip`). Result shape `{ ok, code, message, hint }` is uniform. State steps used: `provision`, `wait`, `deploy`, `https` — referenced consistently.

**Known follow-ups (out of scope for A, noted for later):** SSH host-key pinning (threat-model lists as deferred); Cloudflare Tunnel fallback for NAT'd BYO-VPS; image digest pinning. None block A's success criteria.
