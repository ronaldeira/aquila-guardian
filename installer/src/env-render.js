var { ok, fail, ERROR_CODES } = require('./result');

function line(k, v) { return k + '=' + v; }

function renderEnv(secrets, opts) {
  secrets = secrets || {};
  opts = opts || {};
  if (!secrets.ADMIN_PASSWORD) {
    return fail(ERROR_CODES.BAD_INPUT, 'ADMIN_PASSWORD is required',
      'The admin password was not provided — collect it before deploying.');
  }
  if (!opts.webhookSecret) {
    return fail(ERROR_CODES.BAD_INPUT, 'webhookSecret is required',
      'Internal: webhook secret must be generated before rendering env.');
  }
  var hasTelegram = !!secrets.TELEGRAM_BOT_TOKEN;
  var hasTwilio = !!(secrets.TWILIO_ACCOUNT_SID && secrets.TWILIO_AUTH_TOKEN);
  if (!hasTelegram && !hasTwilio) {
    return fail(ERROR_CODES.BAD_INPUT, 'no alert channel configured',
      'Configure at least Telegram or Twilio before deploying.');
  }

  var lines = [];
  lines.push(line('PORT', String(opts.port || 3000)));
  lines.push(line('ADMIN_PASSWORD', secrets.ADMIN_PASSWORD));
  lines.push(line('WEBHOOK_SECRET', opts.webhookSecret));
  if (opts.publicHost) lines.push(line('PUBLIC_HOST', opts.publicHost));
  if (secrets.TELEGRAM_BOT_TOKEN) lines.push(line('TELEGRAM_BOT_TOKEN', secrets.TELEGRAM_BOT_TOKEN));
  ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_FROM', 'TWILIO_VOICE_FROM']
    .forEach(function (k) { if (secrets[k]) lines.push(line(k, secrets[k])); });

  return ok({ env: lines.join('\n') + '\n' });
}

module.exports = { renderEnv: renderEnv };
