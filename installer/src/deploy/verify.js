var { ok, fail, ERROR_CODES } = require('../result');

function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function verifyDeployment(args) {
  var fetchImpl = args.fetchImpl || fetch;
  var sleep = args.sleep || defaultSleep;
  var retries = args.retries == null ? 10 : args.retries;
  var delayMs = args.delayMs == null ? 3000 : args.delayMs;
  var url = args.publicUrl + '/api/health';

  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      var res = await fetchImpl(url);
      if (res && res.ok) {
        var data = await res.json();
        if (data && data.status === 'ok') return ok({ healthy: true });
      }
    } catch (e) { /* transient — retry */ }
    if (attempt < retries) await sleep(delayMs);
  }
  return fail(ERROR_CODES.HEALTH_FAILED, 'health check did not pass after ' + retries + ' tries',
    'Aquila is installed but not answering yet. TLS can take a minute on first boot — resume to retry.');
}

module.exports = { verifyDeployment: verifyDeployment };
