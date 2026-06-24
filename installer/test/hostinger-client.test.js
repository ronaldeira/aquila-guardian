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

test('maps 403 to BAD_TOKEN', async function () {
  var fetchImpl = function () {
    return Promise.resolve({ status: 403, ok: false, json: function () { return Promise.resolve({}); } });
  };
  var c = createHostingerClient({ token: 'x', fetchImpl: fetchImpl });
  var r = await c.request('GET', '/api/vps/v1/virtual-machines/vps-1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_TOKEN');
});

test('maps 402 to NO_BALANCE', async function () {
  var fetchImpl = function () {
    return Promise.resolve({ status: 402, ok: false, json: function () { return Promise.resolve({}); } });
  };
  var c = createHostingerClient({ token: 'x', fetchImpl: fetchImpl });
  var r = await c.request('GET', '/api/vps/v1/virtual-machines/vps-1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'NO_BALANCE');
});

test('maps network throw to UNKNOWN', async function () {
  var fetchImpl = function () { return Promise.reject(new Error('down')); };
  var c = createHostingerClient({ token: 'x', fetchImpl: fetchImpl });
  var r = await c.request('GET', '/api/vps/v1/virtual-machines/vps-1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'UNKNOWN');
});

test('200 with unparseable JSON returns ok:true data:null', async function () {
  var fetchImpl = function () {
    return Promise.resolve({
      status: 200, ok: true,
      json: function () { return Promise.reject(new Error('bad json')); }
    });
  };
  var c = createHostingerClient({ token: 'x', fetchImpl: fetchImpl });
  var r = await c.request('GET', '/api/vps/v1/virtual-machines/vps-1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data, null);
});
