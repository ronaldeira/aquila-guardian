var { redact } = require('./secrets');

function createLogger(opts) {
  opts = opts || {};
  var sink = opts.sink || console.error;
  var secrets = opts.secrets || [];
  function emit(level, msg) {
    sink('[' + level + '] ' + redact(msg, secrets));
  }
  return {
    info: function (msg) { emit('INFO', msg); },
    error: function (msg) { emit('ERROR', msg); }
  };
}

module.exports = { createLogger: createLogger };
