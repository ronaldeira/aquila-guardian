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
