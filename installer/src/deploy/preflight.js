var { ok, fail, ERROR_CODES } = require('../result');

async function preflightCheck(args) {
  var ssh = args.ssh;
  var issues = [];

  var os = await ssh.exec('cat /etc/os-release');
  if (!/ID=(ubuntu|debian)/.test(os.stdout)) {
    issues.push('The server is not Ubuntu or Debian. Aquila installs are only supported on those.');
  }
  var sudo = await ssh.exec('sudo -n true');
  if (sudo.code !== 0) {
    issues.push('The SSH user cannot use sudo without a password. Use a root or sudo-enabled account.');
  }
  var ip = await ssh.exec('curl -s -4 https://api.ipify.org || true');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test((ip.stdout || '').trim())) {
    issues.push('No public IPv4 was detected. A server behind NAT cannot receive Twilio voice calls.');
  }

  if (issues.length > 0) {
    var r = fail(ERROR_CODES.PREFLIGHT_FAILED, 'preflight failed', issues.join(' '));
    r.issues = issues;
    return r;
  }
  return ok({ issues: [] });
}

module.exports = { preflightCheck: preflightCheck };
