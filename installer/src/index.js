var { ok, fail, ERROR_CODES } = require('./result');
var { createState, loadState } = require('./state');
var { generateWebhookSecret } = require('./secrets');
var { provisionVps } = require('./hostinger/provision');
var { waitForVps } = require('./hostinger/wait');
var { connectSsh } = require('./ssh/connection');
var { preflightCheck } = require('./deploy/preflight');
var { deployAquila } = require('./deploy/deploy-aquila');
var { setupHttps, ipToSslip } = require('./deploy/https');
var { verifyDeployment } = require('./deploy/verify');

async function runInstall(opts) {
  var deps = opts.deps || {};
  var state = loadState({ installId: opts.installId, dir: opts.stateDir })
    || createState({ installId: opts.installId, provider: opts.entryPoint, dir: opts.stateDir });

  var ip;

  // Hostinger path: provision + wait.
  if (opts.entryPoint === 'hostinger') {
    var prov = await provisionVps({ client: deps.client, sshPublicKey: deps.sshPublicKey, state: state });
    if (prov.ok === false) return prov;
    var waited = await waitForVps({ client: deps.client, vpsId: prov.vpsId, state: state });
    if (waited.ok === false) return waited;
    ip = waited.ip;
  } else {
    ip = (deps.sshTarget && deps.sshTarget.host);
    if (!ip) return fail(ERROR_CODES.BAD_INPUT, 'no sshTarget host for byo path',
      'Provide the IP and SSH credential of your existing server.');
  }

  // Connect SSH.
  var connectFn = deps.connectSsh || connectSsh;
  var conn = await connectFn(Object.assign({ host: ip }, deps.sshTarget || {}));
  if (conn.ok === false) return conn;
  var ssh = conn.ssh;

  try {
    var pre = await preflightCheck({ ssh: ssh });
    if (pre.ok === false) return pre;

    var dep = await deployAquila({ ssh: ssh, secrets: opts.secrets, image: opts.image,
      webhookSecret: generateWebhookSecret(), state: state });
    if (dep.ok === false) return dep;

    var https = await setupHttps({ ssh: ssh, ip: ip, state: state });
    if (https.ok === false) return https;

    var verifyOpts = Object.assign({ publicUrl: https.publicUrl, fetchImpl: deps.fetchImpl },
      deps.verifyOpts || {});
    var ver = await verifyDeployment(verifyOpts);
    if (ver.ok === false) return ver;

    return ok({ publicUrl: https.publicUrl });
  } catch (e) {
    return fail(ERROR_CODES.DEPLOY_FAILED, 'install failed during SSH phase: ' + e.message,
      'The server step failed unexpectedly. You can safely resume — completed steps are skipped.');
  } finally {
    ssh.close();
  }
}

module.exports = {
  runInstall: runInstall,
  provisionVps: provisionVps,
  waitForVps: waitForVps,
  preflightCheck: preflightCheck,
  deployAquila: deployAquila,
  setupHttps: setupHttps,
  verifyDeployment: verifyDeployment,
  ipToSslip: ipToSslip
};
