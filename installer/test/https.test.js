var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { makeFakeSsh } = require('./helpers/fake-ssh');
var { setupHttps, ipToSslip } = require('../src/deploy/https');
var { createState } = require('../src/state');

function st() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aq-https-'));
  return createState({ installId: 'h1', provider: 'byo', dir: dir });
}

test('ipToSslip dashes the octets', function () {
  assert.strictEqual(ipToSslip('203.0.113.5'), '203-0-113-5.sslip.io');
});

test('configures caddy and returns public url', async function () {
  var ssh = makeFakeSsh({ responses: {
    'caddy version': { code: 0, stdout: 'v2', stderr: '' },
    'systemctl reload caddy': { code: 0, stdout: '', stderr: '' }
  }});
  var r = await setupHttps({ ssh: ssh, ip: '203.0.113.5', port: 3000, state: st() });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.publicUrl, 'https://203-0-113-5.sslip.io');

  var caddy = ssh._rec.puts.find(function (p) { return /Caddyfile/.test(p.remotePath); }).content;
  assert.ok(caddy.indexOf('203-0-113-5.sslip.io') !== -1);
  assert.ok(caddy.indexOf('reverse_proxy localhost:3000') !== -1);
});

test('returns HTTPS_FAILED when caddy reload fails', async function () {
  var ssh = makeFakeSsh({ responses: {
    'caddy version': { code: 0, stdout: 'v2', stderr: '' },
    'systemctl reload caddy': { code: 1, stdout: '', stderr: 'port 80 in use' }
  }});
  var r = await setupHttps({ ssh: ssh, ip: '203.0.113.5', port: 3000, state: st() });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'HTTPS_FAILED');
});
