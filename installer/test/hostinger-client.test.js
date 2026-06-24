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
