var ERROR_CODES = Object.freeze({
  BAD_TOKEN: 'BAD_TOKEN',
  NO_BALANCE: 'NO_BALANCE',
  VPS_NOT_READY: 'VPS_NOT_READY',
  SSH_FAILED: 'SSH_FAILED',
  PREFLIGHT_FAILED: 'PREFLIGHT_FAILED',
  DEPLOY_FAILED: 'DEPLOY_FAILED',
  HTTPS_FAILED: 'HTTPS_FAILED',
  HEALTH_FAILED: 'HEALTH_FAILED',
  TIMEOUT: 'TIMEOUT',
  BAD_INPUT: 'BAD_INPUT',
  UNKNOWN: 'UNKNOWN'
});

function ok(data) {
  return Object.assign({ ok: true }, data || {});
}

function fail(code, message, hint) {
  return { ok: false, code: code, message: message, hint: hint || '' };
}

module.exports = { ok: ok, fail: fail, ERROR_CODES: ERROR_CODES };
