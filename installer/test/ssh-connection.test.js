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
