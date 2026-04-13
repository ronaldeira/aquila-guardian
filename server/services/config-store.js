// config-store.js — single-tenant persistence for the entire self-host operator state.
// Everything (wallets, contacts, custom messages, consent flag) lives in data/config.json.
// Contacts are encrypted at rest using AES-256-GCM (via encrypt.js).
//
// This module is deliberately the ONLY place that touches data/config.json on disk, so
// concurrent writes from wallet-monitor + route handlers can't race on the same file.

var fs = require('fs');
var path = require('path');
var enc = require('./encrypt');

var CONFIG_PATH = path.join(__dirname, '../data/config.json');

function emptyConfig() {
  return {
    wallets: [],
    contacts: {
      telegram: [],
      sms: [],
      voice: []
    },
    customMessages: {
      telegram: '',
      sms: '',
      voice: ''
    },
    consentAccepted: false,
    consentAcceptedAt: null,
    createdAt: new Date().toISOString()
  };
}

function loadRaw() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[CONFIG-STORE] Failed to read config.json:', e.message);
  }
  return emptyConfig();
}

function saveRaw(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// Public API — returns the config with contacts DECRYPTED (plain arrays).
// Use this everywhere except the raw persistence layer.
function load() {
  var raw = loadRaw();
  var config = emptyConfig();
  Object.assign(config, raw);

  // Decrypt contact arrays (stored as ciphertext strings on disk)
  config.contacts = {
    telegram: decryptArray(raw.contacts && raw.contacts.telegram),
    sms: decryptArray(raw.contacts && raw.contacts.sms),
    voice: decryptArray(raw.contacts && raw.contacts.voice)
  };
  return config;
}

// Save config — takes a plain (decrypted) object and encrypts contacts before writing.
function save(config) {
  var toWrite = Object.assign({}, config, {
    contacts: {
      telegram: encryptArray(config.contacts && config.contacts.telegram),
      sms: encryptArray(config.contacts && config.contacts.sms),
      voice: encryptArray(config.contacts && config.contacts.voice)
    }
  });
  saveRaw(toWrite);
}

function encryptArray(arr) {
  if (!arr || arr.length === 0) return '';
  try {
    return enc.encrypt(JSON.stringify(arr));
  } catch (e) {
    return '';
  }
}

function decryptArray(value) {
  if (!value) return [];
  // Legacy / plain array fallback (hand-edited config.json)
  if (Array.isArray(value)) return value;
  try {
    var plain = enc.decrypt(value);
    var parsed = JSON.parse(plain);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

module.exports = {
  load: load,
  save: save,
  CONFIG_PATH: CONFIG_PATH
};
