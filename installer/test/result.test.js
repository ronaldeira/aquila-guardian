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
