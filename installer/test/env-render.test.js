var test = require('node:test');
var assert = require('node:assert');
var { renderEnv } = require('../src/env-render');

var WH = 'a'.repeat(64);

test('renders required + telegram-only env', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
                    { webhookSecret: WH, port: 3000 });
  assert.strictEqual(r.ok, true);
  assert.match(r.env, /^ADMIN_PASSWORD=pw$/m);
  assert.match(r.env, new RegExp('^WEBHOOK_SECRET=' + WH + '$', 'm'));
  assert.match(r.env, /^TELEGRAM_BOT_TOKEN=tg$/m);
  assert.match(r.env, /^PORT=3000$/m);
});

test('includes PUBLIC_HOST when provided', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
                    { webhookSecret: WH, publicHost: 'https://1-2-3-4.sslip.io' });
  assert.match(r.env, /^PUBLIC_HOST=https:\/\/1-2-3-4\.sslip\.io$/m);
});

test('fails when admin password missing', function () {
  var r = renderEnv({ TELEGRAM_BOT_TOKEN: 'tg' }, { webhookSecret: WH });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_INPUT');
});

test('fails when no alert channel configured', function () {
  var r = renderEnv({ ADMIN_PASSWORD: 'pw' }, { webhookSecret: WH });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'BAD_INPUT');
});
