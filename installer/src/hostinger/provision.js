var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

async function provisionVps(args) {
  var state = args.state;
  if (isDone(state, 'provision') && state.artifacts.vpsId) {
    return ok({ vpsId: state.artifacts.vpsId });
  }
  if (!args.sshPublicKey) {
    return fail(ERROR_CODES.BAD_INPUT, 'sshPublicKey required',
      'Internal: an SSH public key must be generated before provisioning.');
  }
  var res = await args.client.request('POST', '/api/vps/v1/virtual-machines', {
    plan: args.plan || 'kvm1',
    data_center: args.datacenter || 'eu',
    label: args.label || 'aquila-guardian',
    ssh_keys: [args.sshPublicKey]
  });
  if (res.ok === false) return res; // already a structured fail
  var id = res.data && res.data.id;
  if (!id) {
    return fail(ERROR_CODES.UNKNOWN, 'Hostinger did not return a VPS id',
      'Unexpected response creating the VPS — try again in a minute.');
  }
  markStep(state, 'provision', { vpsId: id });
  return ok({ vpsId: id });
}

module.exports = { provisionVps: provisionVps };
