var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs'); var os = require('os'); var path = require('path');
var { runInstall } = require('../src/index');
var { connectSsh } = require('../src/ssh/connection');

var RUN = process.env.RUN_INTEGRATION === '1';

test('end-to-end deploy onto a real Docker VPS', { skip: !RUN }, async function () {
  var { startDockerVps } = require('./helpers/docker-vps');
  var vps = await startDockerVps();
  try {
    var r = await runInstall({
      entryPoint: 'byo',
      installId: 'int1',
      stateDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aq-int-')),
      secrets: { ADMIN_PASSWORD: 'pw', TELEGRAM_BOT_TOKEN: 'tg' },
      image: process.env.AQUILA_IMAGE || 'ghcr.io/AQUILA_ORG/aquila-guardian:1.0.0',
      deps: {
        sshTarget: { host: vps.host, port: vps.port, username: vps.username, password: vps.password },
        connectSsh: connectSsh,
        verifyOpts: { retries: 20, delayMs: 3000 }
      }
    });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
  } finally {
    vps.stop();
  }
});
