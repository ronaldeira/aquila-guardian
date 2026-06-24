var test = require('node:test');
var assert = require('node:assert');
var { shQuote, isIpv4 } = require('../src/sh');

test('shQuote wraps a plain string in single quotes', function () {
  assert.strictEqual(shQuote('hello'), "'hello'");
});

test('shQuote escapes embedded single quotes', function () {
  assert.strictEqual(shQuote("a'b"), "'a'\\''b'");
});

test('shQuote handles multiple embedded single quotes', function () {
  assert.strictEqual(shQuote("it's a test's"), "'it'\\''s a test'\\''s'");
});

test('isIpv4 accepts a valid IPv4', function () {
  assert.strictEqual(isIpv4('203.0.113.5'), true);
});

test('isIpv4 accepts boundary values', function () {
  assert.strictEqual(isIpv4('0.0.0.0'), true);
  assert.strictEqual(isIpv4('255.255.255.255'), true);
});

test('isIpv4 rejects octet > 255', function () {
  assert.strictEqual(isIpv4('999.1.1.1'), false);
});

test('isIpv4 rejects too few octets', function () {
  assert.strictEqual(isIpv4('1.2.3'), false);
});

test('isIpv4 rejects alphabetic input', function () {
  assert.strictEqual(isIpv4('a.b.c.d'), false);
});

test('isIpv4 rejects injection attempt', function () {
  assert.strictEqual(isIpv4('1.2.3.4; rm -rf /'), false);
});

test('isIpv4 rejects non-string values', function () {
  assert.strictEqual(isIpv4(1234), false);
  assert.strictEqual(isIpv4(null), false);
  assert.strictEqual(isIpv4(undefined), false);
});
