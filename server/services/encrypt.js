/**
 * AES-256-GCM encryption for sensitive data at rest.
 * Uses WEBHOOK_SECRET as encryption key (derived via SHA-256).
 */

var crypto = require('crypto');

var SECRET = process.env.WEBHOOK_SECRET || 'default-key-change-me';
var KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 bytes

function encrypt(text) {
  var iv = crypto.randomBytes(12);
  var cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  var encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  var tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data) {
  var parts = data.split(':');
  if (parts.length !== 3) return data; // Not encrypted (legacy)
  var iv = Buffer.from(parts[0], 'hex');
  var tag = Buffer.from(parts[1], 'hex');
  var encrypted = Buffer.from(parts[2], 'hex');
  var decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt: encrypt, decrypt: decrypt };
