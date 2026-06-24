// Minimal in-memory Hostinger API for tests. Supports the endpoints the
// provision/wait tools use. Not a faithful copy of the real API surface —
// only the shapes our tools depend on. Confirm real paths in the spike (plan §9).
function makeMockHostinger(opts) {
  opts = opts || {};
  var state = {
    token: opts.token || 'good-token',
    created: [],
    readyAfterPolls: opts.readyAfterPolls == null ? 1 : opts.readyAfterPolls,
    polls: {}
  };

  function json(status, data) {
    return Promise.resolve({
      status: status,
      ok: status >= 200 && status < 300,
      json: function () { return Promise.resolve(data); }
    });
  }

  function fetchImpl(url, init) {
    init = init || {};
    var auth = (init.headers && init.headers.Authorization) || '';
    if (auth !== 'Bearer ' + state.token) return json(401, { message: 'unauthorized' });

    if (/\/vps\/v1\/virtual-machines$/.test(url) && init.method === 'POST') {
      var id = 'vps-' + (state.created.length + 1);
      state.created.push(id);
      state.polls[id] = 0;
      return json(201, { id: id, state: 'creating' });
    }
    var m = url.match(/\/vps\/v1\/virtual-machines\/([^/]+)$/);
    if (m && (!init.method || init.method === 'GET')) {
      var vid = m[1];
      state.polls[vid] = (state.polls[vid] || 0) + 1;
      var ready = state.polls[vid] > state.readyAfterPolls;
      return json(200, {
        id: vid,
        state: ready ? 'running' : 'creating',
        ipv4: ready ? [{ address: '203.0.113.5' }] : []
      });
    }
    return json(404, { message: 'not found' });
  }

  return { fetchImpl: fetchImpl, state: state };
}

module.exports = { makeMockHostinger: makeMockHostinger };
