// In-memory SSH double for unit tests. Matches command substrings to canned
// results; records files "uploaded". No real network/process involved.
function makeFakeSsh(opts) {
  opts = opts || {};
  var responses = opts.responses || {};
  var rec = { execs: [], puts: [] };

  function exec(cmd) {
    rec.execs.push(cmd);
    var keys = Object.keys(responses);
    for (var i = 0; i < keys.length; i++) {
      if (cmd.indexOf(keys[i]) !== -1) return Promise.resolve(responses[keys[i]]);
    }
    return Promise.resolve({ code: 0, stdout: '', stderr: '' });
  }
  function putFile(content, remotePath) {
    rec.puts.push({ remotePath: remotePath, content: content });
    return Promise.resolve();
  }
  function close() {}
  return { exec: exec, putFile: putFile, close: close, _rec: rec };
}

module.exports = { makeFakeSsh: makeFakeSsh };
