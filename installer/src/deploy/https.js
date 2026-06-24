var { ok, fail, ERROR_CODES } = require('../result');
var { markStep, isDone } = require('../state');

function ipToSslip(ip) {
  return String(ip).split('.').join('-') + '.sslip.io';
}

function caddyfile(host, port) {
  return host + ' {\n    reverse_proxy localhost:' + port + '\n}\n';
}

async function setupHttps(args) {
  var state = args.state;
  var host = ipToSslip(args.ip);
  var publicUrl = 'https://' + host;
  if (state && isDone(state, 'https')) return ok({ publicUrl: publicUrl });

  var ssh = args.ssh;
  var port = args.port || 3000;
  var remoteDir = args.remoteDir || '/opt/aquila';

  // 1. Ensure Caddy.
  var cv = await ssh.exec('caddy version || true');
  if (!/v2|v1/.test(cv.stdout)) {
    var inst = await ssh.exec(
      'sudo apt-get update && sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl && ' +
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && " +
      "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list && " +
      'sudo apt-get update && sudo apt-get install -y caddy');
    if (inst.code !== 0) {
      return fail(ERROR_CODES.HTTPS_FAILED, 'caddy install failed: ' + inst.stderr,
        'Could not install the HTTPS proxy. Check the server has internet access and ports 80/443 are free.');
    }
  }

  // 2. Write Caddyfile + reload.
  await ssh.putFile(caddyfile(host, port), '/etc/caddy/Caddyfile');
  var reload = await ssh.exec('sudo systemctl reload caddy || sudo systemctl restart caddy');
  if (reload.code !== 0) {
    return fail(ERROR_CODES.HTTPS_FAILED, 'caddy reload failed: ' + reload.stderr,
      'The HTTPS proxy could not start — ports 80/443 may be in use.');
  }

  // 3. Set PUBLIC_HOST in .env and restart Aquila so Twilio voice URLs are correct.
  await ssh.exec(
    'cd ' + remoteDir + ' && sudo sed -i "/^PUBLIC_HOST=/d" .env && ' +
    'echo "PUBLIC_HOST=' + publicUrl + '" | sudo tee -a .env > /dev/null && ' +
    'sudo docker compose up -d');

  if (state) markStep(state, 'https', { publicUrl: publicUrl });
  return ok({ publicUrl: publicUrl });
}

module.exports = { setupHttps: setupHttps, ipToSslip: ipToSslip };
