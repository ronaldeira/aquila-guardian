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
