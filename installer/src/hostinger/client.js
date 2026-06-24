var { fail, ERROR_CODES } = require('../result');

function createHostingerClient(opts) {
  opts = opts || {};
  var token = opts.token;
  var fetchImpl = opts.fetchImpl || fetch;
  var baseUrl = opts.baseUrl || 'https://developers.hostinger.com';

  async function request(method, pathName, body) {
    var res;
    try {
      res = await fetchImpl(baseUrl + pathName, {
        method: method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      return fail(ERROR_CODES.UNKNOWN, 'network error: ' + e.message,
        'Could not reach Hostinger — check your internet connection and try again.');
    }
    if (res.status === 401 || res.status === 403) {
      return fail(ERROR_CODES.BAD_TOKEN, 'Hostinger rejected the token (' + res.status + ')',
        'Re-check the Hostinger API key you pasted — it may be wrong or expired.');
    }
    if (res.status === 402) {
      return fail(ERROR_CODES.NO_BALANCE, 'Hostinger payment required',
        'Your Hostinger account needs a valid plan/payment method before a VPS can be created.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: true, status: res.status, data: data };
  }

  return { request: request };
}

module.exports = { createHostingerClient: createHostingerClient };
