// config.js — GET/POST the entire operator config in a single call. The web UI
// loads it once, edits whatever, and sends it back. Simpler than per-field endpoints
// for a single-tenant system and avoids partial-update race conditions.

var express = require('express');
var router = express.Router();
var auth = require('../middleware/auth');
var store = require('../services/config-store');
var monitor = require('../services/wallet-monitor');

var VALID_NETWORKS = Object.keys(monitor.NETWORKS);

// GET /api/config — returns the full operator state, contacts included
router.get('/config', auth.requireAuth, function(req, res) {
  var config = store.load();
  res.json({ ok: true, config: config });
});

// POST /api/config — replaces the full operator state. Body: { config: { ... } }
// Validates structure and normalizes before persisting.
router.post('/config', auth.requireAuth, function(req, res) {
  var incoming = (req.body && req.body.config) || {};
  var current = store.load();

  var next = {
    wallets: sanitizeWallets(incoming.wallets || current.wallets || []),
    contacts: {
      telegram: sanitizeStringArray(incoming.contacts && incoming.contacts.telegram, 200),
      sms: sanitizePhoneArray(incoming.contacts && incoming.contacts.sms),
      voice: sanitizePhoneArray(incoming.contacts && incoming.contacts.voice)
    },
    customMessages: {
      telegram: String((incoming.customMessages && incoming.customMessages.telegram) || '').slice(0, 500),
      sms: String((incoming.customMessages && incoming.customMessages.sms) || '').slice(0, 500),
      voice: String((incoming.customMessages && incoming.customMessages.voice) || '').slice(0, 500)
    },
    consentAccepted: !!(incoming.consentAccepted || current.consentAccepted),
    consentAcceptedAt: incoming.consentAccepted && !current.consentAccepted
      ? new Date().toISOString()
      : current.consentAcceptedAt,
    createdAt: current.createdAt || new Date().toISOString()
  };

  store.save(next);
  res.json({ ok: true, config: store.load() });
});

function sanitizeWallets(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(function(w) {
    return w && w.address && VALID_NETWORKS.indexOf(w.network) >= 0;
  }).map(function(w) {
    return {
      address: String(w.address).trim(),
      network: String(w.network),
      label: String(w.label || '').slice(0, 80),
      active: w.active !== false,
      lastAlertAt: w.lastAlertAt || null,
      lastAlertTxid: w.lastAlertTxid || null,
      alertCount: Number(w.alertCount) || 0
    };
  });
}

function sanitizeStringArray(arr, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(function(x) { return String(x || '').trim().slice(0, maxLen || 200); })
    .filter(function(x) { return x.length > 0; });
}

function sanitizePhoneArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(function(x) { return String(x || '').trim(); })
    .filter(function(x) { return /^\+[1-9][0-9]{7,14}$/.test(x); });
}

module.exports = router;
