var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { deployAquila } = require('../src/deploy/deploy-aquila');
var { createState, isDone, markStep } = require('../src/state');

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

test('skips all ssh calls when deploy step already done (idempotency)', async function () {
  var state = st();
  markStep(state, 'deploy', {});
  var ssh = makeFakeSsh();
  var r = await deployAquila({
    ssh: ssh,
    secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
    image: 'ghcr.io/x/aquila-guardian:1.0.0',
    webhookSecret: 'a'.repeat(64),
    state: state
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.deployed, true);
  assert.strictEqual(ssh._rec.execs.length, 0);
  assert.strictEqual(ssh._rec.puts.length, 0);
});
