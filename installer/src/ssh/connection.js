var { ok, fail, ERROR_CODES } = require('../result');

function connectSsh(args) {
  return new Promise(function (resolve) {
    var ConnImpl = args.ConnImpl;
    if (!ConnImpl) ConnImpl = require('ssh2').Client;
    var conn = new ConnImpl();
    var settled = false;

    conn.on('ready', function () {
      settled = true;
      resolve(ok({ ssh: makeIface(conn) }));
    });
    conn.on('error', function (e) {
      if (settled) return;
      settled = true;
      resolve(fail(ERROR_CODES.SSH_FAILED, 'SSH connect failed: ' + e.message,
        'Could not log in to the server — check the IP and SSH credential.'));
    });

    conn.connect({
      host: args.host,
      port: args.port || 22,
      username: args.username || 'root',
      privateKey: args.privateKey,
      password: args.password,
      readyTimeout: args.readyTimeout || 20000
    });
  });
}

function makeIface(conn) {
  function exec(cmd) {
    return new Promise(function (resolve, reject) {
      conn.exec(cmd, function (err, stream) {
        if (err) return reject(err);
        var stdout = '', stderr = '';
        stream.on('data', function (d) { stdout += d.toString(); });
        stream.stderr.on('data', function (d) { stderr += d.toString(); });
        stream.on('close', function (code) {
          resolve({ code: code == null ? 0 : code, stdout: stdout, stderr: stderr });
        });
      });
    });
  }
  function putFile(content, remotePath) {
    // Write via a heredoc-free base64 pipe to avoid quoting issues.
    var b64 = Buffer.from(content, 'utf8').toString('base64');
    return exec("echo '" + b64 + "' | base64 -d | sudo tee " + remotePath + " > /dev/null")
      .then(function (r) {
        if (r.code !== 0) throw new Error('putFile failed: ' + r.stderr);
      });
  }
  function close() { try { conn.end(); } catch (e) {} }
  return { exec: exec, putFile: putFile, close: close };
}

module.exports = { connectSsh: connectSsh };
