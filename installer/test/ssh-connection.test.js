var test = require('node:test');
var assert = require('node:assert');
var { connectSsh } = require('../src/ssh/connection');

// A minimal fake ssh2 Client: emits 'ready', and exec() returns a fake stream.
function FakeConn() {
  var handlers = {};
  this.on = function (ev, cb) { handlers[ev] = cb; return this; };
  this.connect = function () { setImmediate(function () { handlers.ready && handlers.ready(); }); };
  this.exec = function (cmd, cb) {
    var streamHandlers = {};
    var stream = {
      on: function (ev, h) { streamHandlers[ev] = h; return stream; },
      stderr: { on: function () { return stream.stderr; } }
    };
    cb(null, stream);
    setImmediate(function () {
      streamHandlers.data && streamHandlers.data(Buffer.from('hello'));
      streamHandlers.close && streamHandlers.close(0);
    });
  };
  this.end = function () {};
}

test('connectSsh resolves an ssh iface that execs', async function () {
  var r = await connectSsh({ host: '1.2.3.4', password: 'pw', ConnImpl: FakeConn });
  assert.strictEqual(r.ok, true);
  var out = await r.ssh.exec('echo hello');
  assert.strictEqual(out.code, 0);
  assert.strictEqual(out.stdout, 'hello');
  r.ssh.close();
});

test('putFile shell-quotes remotePath to prevent command injection', async function () {
  var capturedCmd = null;

  function FakeConnCapture() {
    var handlers = {};
    this.on = function (ev, cb) { handlers[ev] = cb; return this; };
    this.connect = function () { setImmediate(function () { handlers.ready && handlers.ready(); }); };
    this.exec = function (cmd, cb) {
      capturedCmd = cmd;
      var streamHandlers = {};
      var stream = {
        on: function (ev, h) { streamHandlers[ev] = h; return stream; },
        stderr: { on: function () { return stream.stderr; } }
      };
      cb(null, stream);
      setImmediate(function () {
        streamHandlers.close && streamHandlers.close(0);
      });
    };
    this.end = function () {};
  }

  var r = await connectSsh({ host: '1.2.3.4', password: 'pw', ConnImpl: FakeConnCapture });
  assert.strictEqual(r.ok, true);

  var dangerousPath = "/opt/aquila/x'; rm -rf / #";
  await r.ssh.putFile('data', dangerousPath);
  r.ssh.close();

  assert.ok(capturedCmd !== null, 'exec should have been called');
  // The dangerous path must be single-quoted and its internal single quote must be escaped
  // After shQuote, the path becomes: '/opt/aquila/x'\'' rm-rf / #'
  // i.e. tee followed by space and single-quoted path with escaped internal quote
  assert.ok(capturedCmd.includes("tee '"), 'command must use tee with a quoted path');
  // Confirm the raw unquoted path is NOT present as "tee /opt"
  assert.strictEqual(capturedCmd.indexOf('tee /opt'), -1, 'raw unquoted path must not appear after tee');
});
