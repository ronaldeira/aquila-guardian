var { ok, fail, ERROR_CODES } = require('../result');
var { renderEnv } = require('../env-render');
var { generateWebhookSecret } = require('../secrets');
var { markStep, isDone } = require('../state');
var { shQuote } = require('../sh');

function composeYaml(image, port) {
  return [
    'services:',
    '  aquila:',
    '    image: ' + image,
    '    container_name: aquila-guardian',
    '    restart: unless-stopped',
    '    env_file: [.env]',
    '    ports:',
    '      - "' + port + ':3000"',
    '    volumes:',
    '      - ./data:/app/server/data',
    '    healthcheck:',
    '      test: ["CMD", "wget", "-q", "-O-", "http://localhost:3000/api/health"]',
    '      interval: 30s',
    '      timeout: 5s',
    '      retries: 3',
    ''
  ].join('\n');
}

async function deployAquila(args) {
  var state = args.state;
  var port = args.port || 3000;
  var remoteDir = args.remoteDir || '/opt/aquila';
  var webhookSecret = args.webhookSecret || generateWebhookSecret();

  if (state && isDone(state, 'deploy')) {
    return ok({ deployed: true, webhookSecret: webhookSecret });
  }

  var rendered = renderEnv(args.secrets, { webhookSecret: webhookSecret, port: port });
  if (rendered.ok === false) return rendered;

  var ssh = args.ssh;

  // 1. Ensure Docker.
  var dv = await ssh.exec('docker --version || true');
  if (!/Docker version/.test(dv.stdout)) {
    var inst = await ssh.exec('curl -fsSL https://get.docker.com | sudo sh');
    if (inst.code !== 0) {
      return fail(ERROR_CODES.DEPLOY_FAILED, 'docker install failed: ' + inst.stderr,
        'Could not install Docker on the server. Check the server has internet access.');
    }
  }

  // 2. Write files.
  await ssh.exec('sudo mkdir -p ' + shQuote(remoteDir + '/data'));
  await ssh.putFile(rendered.env, remoteDir + '/.env');
  await ssh.putFile(composeYaml(args.image, port), remoteDir + '/docker-compose.yml');

  // 3. Pull + up.
  var up = await ssh.exec('cd ' + shQuote(remoteDir) + ' && sudo docker compose pull && sudo docker compose up -d');
  if (up.code !== 0) {
    return fail(ERROR_CODES.DEPLOY_FAILED, 'docker compose up failed: ' + up.stderr,
      'The Aquila container did not start. This is usually a transient pull error — try resuming.');
  }

  if (state) markStep(state, 'deploy', {});
  return ok({ deployed: true, webhookSecret: webhookSecret });
}

module.exports = { deployAquila: deployAquila };
