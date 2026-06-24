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

test('propagates structured fail from client mid-poll', async function () {
  var failClient = {
    request: function () {
      return Promise.resolve({ ok: false, code: 'BAD_TOKEN',
        message: 'Hostinger rejected the token (403)', hint: 'Re-check the API key.' });
    }
  };
  var r = await waitForVps({ client: failClient, vpsId: 'vps-1', state: st(),
    pollMs: 1, sleep: noSleep });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_TOKEN');
});
