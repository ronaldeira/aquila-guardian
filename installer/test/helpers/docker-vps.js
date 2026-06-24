var { execFileSync } = require('child_process');

// Boots an Ubuntu+sshd container to act as the "VPS". Requires Docker on the host.
// Uses host networking is avoided; we map a random high port to 22.
function startDockerVps() {
  // Image must have sshd + sudo + docker CLI available; build once in CI (see workflow).
  var name = 'aquila-vps-test';
  try { execFileSync('docker', ['rm', '-f', name]); } catch (e) {}
  execFileSync('docker', ['run', '-d', '--name', name, '--privileged',
    '-p', '0:22', 'aquila-vps-test:latest']);
  var port = execFileSync('docker', ['port', name, '22'])
    .toString().trim().split(':').pop();
  return Promise.resolve({
    host: '127.0.0.1',
    port: Number(port),
    username: 'root',
    password: 'root',
    stop: function () { try { execFileSync('docker', ['rm', '-f', name]); } catch (e) {} }
  });
}

module.exports = { startDockerVps: startDockerVps };
