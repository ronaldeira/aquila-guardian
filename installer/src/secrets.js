var crypto = require('crypto');

var SECRET_KEYS = [
  'ADMIN_PASSWORD',
  'WEBHOOK_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
];

function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function redact(text, extraValues) {
  var str = String(text == null ? '' : text);
  var values = (extraValues || []).filter(Boolean);
  values.forEach(function (v) {
    str = str.split(String(v)).join('***');
  });
  return str;
}

module.exports = {
  SECRET_KEYS: SECRET_KEYS,
  generateWebhookSecret: generateWebhookSecret,
  redact: redact
};
