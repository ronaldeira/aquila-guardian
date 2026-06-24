var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { createState, loadState, markStep, isDone } = require('../src/state');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aq-state-')); }

test('markStep persists artifacts and is reloadable', function () {
  var dir = tmpDir();
  var s = createState({ installId: 'i1', provider: 'hostinger', dir: dir });
  assert.strictEqual(isDone(s, 'provision'), false);
  markStep(s, 'provision', { vpsId: 'v9', ip: '1.2.3.4' });
  assert.strictEqual(isDone(s, 'provision'), true);

  var reloaded = loadState({ installId: 'i1', dir: dir });
  assert.strictEqual(reloaded.artifacts.vpsId, 'v9');
  assert.strictEqual(reloaded.artifacts.ip, '1.2.3.4');
  assert.strictEqual(isDone(reloaded, 'provision'), true);
});

test('loadState returns null when absent', function () {
  assert.strictEqual(loadState({ installId: 'nope', dir: tmpDir() }), null);
});

test('state file never contains secret-looking keys', function () {
  var dir = tmpDir();
  var s = createState({ installId: 'i2', provider: 'byo', dir: dir });
  markStep(s, 'deploy', { ip: '5.6.7.8' });
  var raw = fs.readFileSync(path.join(dir, 'i2.json'), 'utf8');
  ['ADMIN_PASSWORD', 'WEBHOOK_SECRET', 'TWILIO_AUTH_TOKEN', 'TELEGRAM_BOT_TOKEN']
    .forEach(function (k) { assert.ok(raw.indexOf(k) === -1); });
});
