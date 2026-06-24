var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { runInstall } = require('../src/index');
var { ERROR_CODES } = require('../src/result');

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

test('putFile rejection resolves to structured fail (does not throw)', async function () {
  var ssh = makeFakeSsh({ responses: {
    '/etc/os-release': { code: 0, stdout: 'ID=ubuntu', stderr: '' },
    'sudo -n true': { code: 0, stdout: '', stderr: '' },
    'curl': { code: 0, stdout: '203.0.113.5', stderr: '' },
    'docker --version': { code: 0, stdout: 'Docker version 27', stderr: '' },
    'docker compose': { code: 0, stdout: '', stderr: '' },
    'caddy version': { code: 0, stdout: 'v2', stderr: '' },
    'systemctl reload caddy': { code: 0, stdout: '', stderr: '' }
  }});
  ssh.putFile = function () { return Promise.reject(new Error('boom')); };
  var deps = {
    sshTarget: { host: '10.0.0.1', password: 'pw' },
    connectSsh: function () { return Promise.resolve({ ok: true, ssh: ssh }); },
    fetchImpl: function () { return Promise.resolve({ ok: true, status: 200,
      json: function () { return Promise.resolve({ status: 'ok' }); } }); },
    verifyOpts: { retries: 1, sleep: function () { return Promise.resolve(); } }
  };
  var r = await runInstall({
    entryPoint: 'byo',
    installId: 'o3',
    stateDir: stateDir(),
    secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
    image: 'ghcr.io/x/aquila-guardian:1.0.0',
    deps: deps
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, ERROR_CODES.DEPLOY_FAILED);
});
