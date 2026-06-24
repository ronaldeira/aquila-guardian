var test = require('node:test');
var assert = require('node:assert');
var { generateWebhookSecret, redact, SECRET_KEYS } = require('../src/secrets');

test('generateWebhookSecret returns 64 hex chars', function () {
  var s = generateWebhookSecret();
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(generateWebhookSecret(), s); // randomness
});

test('SECRET_KEYS includes the sensitive env names', function () {
  ['ADMIN_PASSWORD', 'TWILIO_AUTH_TOKEN', 'TELEGRAM_BOT_TOKEN', 'WEBHOOK_SECRET']
    .forEach(function (k) { assert.ok(SECRET_KEYS.includes(k)); });
});

test('redact masks literal secret values', function () {
  var out = redact('token is abc123secret here', ['abc123secret']);
  assert.ok(!out.includes('abc123secret'));
  assert.ok(out.includes('***'));
});
