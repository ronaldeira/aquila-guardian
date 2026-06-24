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
