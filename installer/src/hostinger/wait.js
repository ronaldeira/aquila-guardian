var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

function defaultSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitForVps(args) {
  var state = args.state;
  if (isDone(state, 'wait') && state.artifacts.ip) return ok({ ip: state.artifacts.ip });

  var sleep = args.sleep || defaultSleep;
  var now = args.now || Date.now;
  var timeoutMs = args.timeoutMs == null ? 600000 : args.timeoutMs;
  var pollMs = args.pollMs == null ? 10000 : args.pollMs;
  var start = now();

  while (true) {
    var res = await args.client.request('GET', '/api/vps/v1/virtual-machines/' + args.vpsId);
    if (res.ok === false) return res;
    var d = res.data || {};
    var ip = d.ipv4 && d.ipv4[0] && d.ipv4[0].address;
    if (d.state === 'running' && ip) {
      markStep(state, 'wait', { ip: ip });
      return ok({ ip: ip });
    }
    if (now() - start >= timeoutMs) {
      return fail(ERROR_CODES.TIMEOUT, 'VPS not ready within ' + timeoutMs + 'ms',
        'The server is taking longer than expected to boot — wait a moment and resume.');
    }
    await sleep(pollMs);
  }
}

module.exports = { waitForVps: waitForVps };
